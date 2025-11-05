import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Load environment variables from .env file
dotenv.config();

// Initialize the Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  console.log(
    "Attempting to create user with hashed password:",
    hashedPassword
  );

  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        f_name,
        l_name,
        username,
        address,
        number,
        email,
        password: hashedPassword,
      },
    ]) // Ensure username is included
    .select();

  if (error) {
    console.error("Supabase error while creating user:", error.message);
    throw new Error("Error creating user in database: " + error.message);
  }

  console.log("User created successfully:", data);
  return data[0];
}

// Function to get a user by email for login
export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401); // Unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Forbidden
    req.user = user;
    next();
  });
}

// Fetch single product details by ID
export async function getProductById(productId) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(image_url)")
    .eq("id", productId)
    .single();

  if (error) {
    console.error("Error fetching product by ID:", error.message);
    throw new Error("Error fetching product details");
  }

  return data;
}

// Fetch reviews for a specific product
export async function getProductReviews(productId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*, users(username)")
    .eq("product_id", productId);

  if (error) {
    console.error("Error fetching reviews:", error.message);
    throw new Error("Failed to fetch product reviews");
  }

  return data;
}

async function fetchProductReviews() {
  try {
    const response = await fetch(`/api/products/${productId}/reviews`);
    if (!response.ok) {
      throw new Error("Failed to fetch reviews.");
    }
    const reviewsData = await response.json();
    console.log("Fetched reviews:", reviewsData);
  } catch (error) {
    console.error("Error fetching reviews:", error.message);
  }
}

// Function to fetch products from Supabase with filters
export async function getProducts({ search, category, price, availability }) {
  let query = supabase.from("products").select("*");

  // Apply filters
  if (search) query = query.ilike("name", `%${search}%`); // Case-insensitive search
  if (category && category !== "all") query = query.eq("category", category);
  if (price) query = query.lte("discounted_price", price); // Use price filter for discounted price
  if (availability) {
    query =
      availability === "in-stock" ? query.gt("stock", 0) : query.eq("stock", 0); // Handle stock availability
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching products:", error.message);
    throw error;
  }

  return data;
}

// Function to add a new product and images to Supabase
export async function saveProductToDatabase({
  name,
  original_price,
  discounted_price,
  category,
  stock,
  mainImageUrl,
  additionalImages = [],
  description
}) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert([
      {
        name,
        original_price,
        discounted_price,
        category,
        stock,
        image_url: mainImageUrl,
        description
      },
    ])
    .select();

  if (productError) {
    console.error("Error saving product:", productError.message);
    throw productError;
  }

  const productId = product[0].id;
  if (additionalImages.length > 0) {
    const imageRecords = additionalImages.map((url) => ({
      product_id: productId,
      image_url: url,
    }));
    const { error: imageError } = await supabase
      .from("product_images")
      .insert(imageRecords);
    if (imageError) {
      console.error("Error saving additional images:", imageError.message);
      throw imageError;
    }
  }

  return product[0];
}

// Function to update a product and its images in Supabase
export async function updateProductInDatabase(
  id,
  {
    name,
    original_price,
    discounted_price,
    category,
    stock,
    mainImageUrl,
    additionalImages = [],
    description
  }
) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .update({
      name,
      original_price,
      discounted_price,
      category,
      stock,
      image_url: mainImageUrl,
      description
    })
    .eq("id", id)
    .select();

  if (productError) {
    console.error("Error updating product:", productError.message);
    throw productError;
  }

  // Replace additional images if any are provided
  if (additionalImages.length > 0) {
    await supabase.from("product_images").delete().eq("product_id", id);
    const imageRecords = additionalImages.map((url) => ({
      product_id: id,
      image_url: url,
    }));
    const { error: imageError } = await supabase
      .from("product_images")
      .insert(imageRecords);
    if (imageError) {
      console.error("Error updating images:", imageError.message);
      throw imageError;
    }
  }

  return product[0];
}

// Function to delete a product by ID, including associated images
export async function deleteProductFromDatabase(id) {
  const { error: imageError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", id);
  if (imageError) {
    console.error("Error deleting product images:", imageError.message);
    throw imageError;
  }

  const { error: productError } = await supabase
    .from("products")
    .delete()
    .eq("id", id);
  if (productError) {
    console.error("Error deleting product:", productError.message);
    throw productError;
  }

  return { message: "Product deleted successfully" };
}

export async function getUserCart(userId) {
  try {
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError && cartError.code !== 'PGRST116') {  // Allow 'No Rows Found' error
      throw cartError;
    }

    if (cart) return cart; // Return existing pending cart if found

    // Create new pending cart if none exists
    const { data: newCart, error: newCartError } = await supabase
      .from('carts')
      .insert({
        user_id: userId,
        status: 'pending',
        created_at: new Date(),
      })
      .select()
      .single();

    if (newCartError) throw newCartError;
    return newCart;

  } catch (error) {
    console.error('Error fetching/creating cart:', error.message);
    throw error;
  }
}



// Function to fetch product price and insert/update cart item
async function handleCartItem(cartId, productId, quantity) {
  try {
    // Fetch the product price
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("discounted_price")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw new Error("Failed to fetch product price");
    }

    // Check if product is already in the cart
    const { data: existingItem, error: existingItemError } = await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cartId)
      .eq("product_id", productId)
      .single();

    if (existingItemError && existingItemError.code !== "PGRST116") {
      throw existingItemError;
    }

    if (existingItem) {
      // Update quantity if item exists
      await supabase
        .from("cart_items")
        .update({
          quantity: existingItem.quantity + quantity,
        })
        .eq("id", existingItem.id);
    } else {
      // Insert new item with price
      await supabase.from("cart_items").insert({
        cart_id: cartId,
        product_id: productId,
        quantity,
        price: product.discounted_price, // Add price from product table
      });
    }
  } catch (error) {
    console.error("Error handling cart item:", error.message);
    throw error;
  }
}

export async function addItemToCart(userId, productId, quantity = 1) {
  try {
    console.log(
      `Adding item to cart: UserID: ${userId}, ProductID: ${productId}, Quantity: ${quantity}`
    );

    const cart = await getUserCart(userId);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("discounted_price, original_price")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw new Error("Failed to fetch product price.");
    }

    const productPrice = product.discounted_price || product.original_price;

    const { data: existingItem, error: existingItemError } = await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart.id)
      .eq("product_id", productId)
      .single();

    if (existingItem) {
      await supabase
        .from("cart_items")
        .update({
          quantity: existingItem.quantity + quantity,
        })
        .eq("id", existingItem.id);
    } else {
      await supabase.from("cart_items").insert({
        cart_id: cart.id,
        product_id: productId,
        quantity,
        price: productPrice,
      });
    }

    console.log("Item added to cart successfully.");
    return { message: "Item added to cart successfully." };
  } catch (error) {
    console.error("Error adding item to cart:", error.message);
    throw error;
  }
}

export async function getCartItems(userId) {
  try {
    console.log(`getCartItems called for user: ${userId}`);

    const cart = await getUserCart(userId);
    console.log(`Fetching items from cart ID: ${cart.id}`);

    const { data: cartItems, error: cartItemsError } = await supabase
      .from("cart_items")
      .select(
        `
              id,
              quantity,
              product_id,
              products:product_id(name, discounted_price, original_price, image_url)
          `
      )
      .eq("cart_id", cart.id);

    if (cartItemsError) {
      console.error("Failed to fetch cart items:", cartItemsError);
      throw new Error("Failed to fetch cart items");
    }

    console.log("Cart items fetched:", cartItems);
    return cartItems;
  } catch (error) {
    console.error("Error fetching cart items:", error.message);
    throw error;
  }
}

export async function checkoutCart(userId) {
  try {
    console.log('Fetching cart for user:', userId);

    // Fetch user's pending cart
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError) {
      console.error('Error fetching cart:', cartError.message);
      throw new Error('Failed to fetch cart.');
    }

    if (!cart) {
      throw new Error('No pending cart found.');
    }

    // Fetch cart items
    const { data: cartItems, error: cartItemsError } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id);

    if (cartItemsError) {
      throw new Error('Failed to fetch cart items.');
    }

    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty.');
    }

    // Calculate total price
    const totalPrice = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

    console.log(`Total price calculated: ₱${totalPrice}`);

    // Insert new order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_price: totalPrice,
        status: 'pending',
        created_at: new Date(),
      })
      .select()
      .single(); // Attempt to retrieve inserted order

    if (orderError) {
      console.error('Order creation failed:', orderError.message);
      throw new Error('Failed to create order.');
    }

    if (!order) {
      throw new Error('Order data is null. Insert operation might have failed.');
    }

    // Transfer cart items to order_items
    const { error: orderItemError } = await supabase
      .from('order_items')
      .insert(
        cartItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        }))
      );

    if (orderItemError) {
      throw new Error(`Failed to insert order items. ${orderItemError.message}`);
    }

    console.log('Order items transferred successfully.');

    // Clear cart and update status
    await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    await supabase.from('carts').update({ status: 'checked_out' }).eq('id', cart.id);

    console.log('Checkout completed successfully.');
    return { message: 'Checkout successful', orderId: order.id };

  } catch (error) {
    console.error('Checkout failed:', error.message);
    throw error;
  }
}


export async function saveOrderTransaction(userId, orderData) {
  const { name, address, total, items } = orderData;

  try {
    // Insert into the 'orders' table
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        total_price: total,
        address: address, // New Address field
        customer_name: name, // New Customer Name field
        created_at: new Date(),
        status: "pending", // Start as 'pending' status
      })
      .select()
      .single();

    if (orderError) throw new Error("Failed to save order");

    const orderId = order.id;

    // Insert all items into 'order_items' table
    const orderItems = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      price: item.price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);
    if (itemsError) throw new Error("Failed to save order items");

    return { message: "Order saved successfully", orderId };
  } catch (error) {
    console.error("Error saving order transaction:", error.message);
    throw error;
  }
}

// Remove Item from Cart
export async function removeItemFromCart(userId, productId) {
  try {
    console.log(
      `Removing item from cart: { userId: ${userId}, productId: ${productId} }`
    );

    // Ensure the user has a pending cart
    const cart = await getUserCart(userId);
    console.log(`Found pending cart: ${cart.id}`);

    // Delete the product from cart_items table
    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id)
      .eq("product_id", productId);

    if (deleteError) {
      console.error("Error removing product from cart:", deleteError.message);
      throw new Error("Failed to remove product from cart");
    }

    console.log(`Product with ID ${productId} removed from cart.`);
  } catch (error) {
    console.error("Error removing item from cart:", error.message);
    throw error;
  }
}

export default supabase;
