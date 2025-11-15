// server/database.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
// If you stick with sessions, you don't need JWT here. Remove if unused.
// import jwt from 'jsonwebtoken';

dotenv.config();

// ---------------- Supabase client (SERVER) ----------------
// IMPORTANT: Use the service role key on the server so RLS won't block you.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // not the anon key
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
export default supabase;


// ---------------- Users ----------------
export async function createUser({
  f_name,
  l_name,
  username,
  address,
  number,
  email,
  password,
}) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([
      { f_name, l_name, username, address, number, email, password: hashedPassword },
    ])
    .select()
    .single();

  if (error) {
    console.error('Supabase error while creating user:', error);
    throw new Error('Error creating user in database: ' + error.message);
  }

  return data;
}

export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ---------------- Products ----------------
export async function getProductById(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(image_url)')
    .eq('id', productId)
    .single();

  if (error) {
    console.error('Error fetching product by ID:', error);
    throw new Error('Error fetching product details');
  }
  return data;
}

export async function getProducts({ search, category, price, availability }) {
  let query = supabase.from('products').select('*');

  if (search) query = query.ilike('name', `%${search}%`);
  if (category && category !== 'all') query = query.eq('category', category);
  if (price) query = query.lte('discounted_price', price);
  if (availability) {
    query = availability === 'in-stock' ? query.gt('stock', 0) : query.eq('stock', 0);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
  return data;
}

export async function saveProductToDatabase({
  name,
  original_price,
  discounted_price,
  category,
  stock,
  mainImageUrl,
  additionalImages = [],
  description,
}) {
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert([{ name, original_price, discounted_price, category, stock, image_url: mainImageUrl, description }])
    .select()
    .single();

  if (productError) {
    console.error('Error saving product:', productError);
    throw productError;
  }

  const productId = product.id;

  if (additionalImages.length > 0) {
    const imageRecords = additionalImages.map((url) => ({ product_id: productId, image_url: url }));
    const { error: imageError } = await supabase.from('product_images').insert(imageRecords);
    if (imageError) {
      console.error('Error saving additional images:', imageError);
      throw imageError;
    }
  }

  return product;
}

export async function updateProductInDatabase(
  id,
  { name, original_price, discounted_price, category, stock, mainImageUrl, additionalImages = [], description }
) {
  const { data: product, error: productError } = await supabase
    .from('products')
    .update({ name, original_price, discounted_price, category, stock, image_url: mainImageUrl, description })
    .eq('id', id)
    .select()
    .single();

  if (productError) {
    console.error('Error updating product:', productError);
    throw productError;
  }

  if (additionalImages.length > 0) {
    await supabase.from('product_images').delete().eq('product_id', id);
    const imageRecords = additionalImages.map((url) => ({ product_id: id, image_url: url }));
    const { error: imageError } = await supabase.from('product_images').insert(imageRecords);
    if (imageError) {
      console.error('Error updating images:', imageError);
      throw imageError;
    }
  }

  return product;
}

export async function deleteProductFromDatabase(id) {
  const { error: imageError } = await supabase.from('product_images').delete().eq('product_id', id);
  if (imageError) {
    console.error('Error deleting product images:', imageError);
    throw imageError;
  }

  const { error: productError } = await supabase.from('products').delete().eq('id', id);
  if (productError) {
    console.error('Error deleting product:', productError);
    throw productError;
  }

  return { message: 'Product deleted successfully' };
}

// ---------------- Reviews ----------------
// NOTE: your new DB has a 'reviews' table (not 'comments')
export async function getProductReviews(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      product_id,
      user_id,
      rating,
      comment_text,
      created_at,
      users ( id, username, f_name, l_name )
    `)
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reviews:', error);
    throw new Error('Failed to fetch product reviews');
  }

  return data;
}

// ---------------- Cart / Orders ----------------
export async function getUserCart(userId) {
  try {
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError && cartError.code !== 'PGRST116') throw cartError; // PGRST116 = no rows

    if (cart) return cart;

    const { data: newCart, error: newCartError } = await supabase
      .from('carts')
      .insert({ user_id: userId, status: 'pending', created_at: new Date() })
      .select()
      .single();

    if (newCartError) throw newCartError;
    return newCart;
  } catch (error) {
    console.error('Error fetching/creating cart:', error);
    throw error;
  }
}

export async function addItemToCart(userId, productId, quantity = 1) {
  try {
    const cart = await getUserCart(userId);

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('discounted_price, original_price')
      .eq('id', productId)
      .single();

    if (productError || !product) throw new Error('Failed to fetch product price.');

    const productPrice = product.discounted_price || product.original_price;

    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .single();

    if (existingItem) {
      await supabase.from('cart_items').update({ quantity: existingItem.quantity + quantity }).eq('id', existingItem.id);
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cart.id,
        product_id: productId,
        quantity,
        price: productPrice,
      });
    }

    return { message: 'Item added to cart successfully.' };
  } catch (error) {
    console.error('Error adding item to cart:', error);
    throw error;
  }
}

export async function getCartItems(userId) {
  try {
    const cart = await getUserCart(userId);

    const { data: cartItems, error: cartItemsError } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        product_id,
        products:product_id(name, discounted_price, original_price, image_url)
      `)
      .eq('cart_id', cart.id);

    if (cartItemsError) {
      console.error('Failed to fetch cart items:', cartItemsError);
      throw new Error('Failed to fetch cart items');
    }

    return cartItems;
  } catch (error) {
    console.error('Error fetching cart items:', error);
    throw error;
  }
}

export async function checkoutCart(userId) {
  try {
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError) throw new Error('Failed to fetch cart.');
    if (!cart) throw new Error('No pending cart found.');

    const { data: cartItems, error: cartItemsError } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id);

    if (cartItemsError) throw new Error('Failed to fetch cart items.');
    if (!cartItems || cartItems.length === 0) throw new Error('Cart is empty.');

    const totalPrice = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ user_id: userId, total_price: totalPrice, status: 'pending', created_at: new Date() })
      .select()
      .single();

    if (orderError || !order) throw new Error('Failed to create order.');

    const { error: orderItemError } = await supabase.from('order_items').insert(
      cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      })),
    );
    if (orderItemError) throw new Error(`Failed to insert order items. ${orderItemError.message}`);

    await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    await supabase.from('carts').update({ status: 'checked_out' }).eq('id', cart.id);

    return { message: 'Checkout successful', orderId: order.id };
  } catch (error) {
    console.error('Checkout failed:', error);
    throw error;
  }
}

export async function saveOrderTransaction(userId, orderData) {
  const { name, address, total, items } = orderData;

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_price: total,
        address,
        customer_name: name,
        created_at: new Date(),
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw new Error('Failed to save order');

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      price: item.price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw new Error('Failed to save order items');

    return { message: 'Order saved successfully', orderId: order.id };
  } catch (error) {
    console.error('Error saving order transaction:', error);
    throw error;
  }
}

export async function removeItemFromCart(userId, productId) {
  try {
    const cart = await getUserCart(userId);

    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('product_id', productId);

    if (deleteError) {
      console.error('Error removing product from cart:', deleteError);
      throw new Error('Failed to remove product from cart');
    }
  } catch (error) {
    console.error('Error removing item from cart:', error);
    throw error;
  }
}


