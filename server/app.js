import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { RedisStore } from 'connect-redis'; // v9 named import
import Redis from 'ioredis';

import pagesRouter from './pages.js';
import supabase, {
  getUserByEmail,
  addItemToCart,
  getCartItems,
  getProducts,
  saveProductToDatabase,
  updateProductInDatabase,
  deleteProductFromDatabase,
  getProductById,
  getProductReviews,
  removeItemFromCart,
  checkoutCart,
} from './database.js';


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS + JSON
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Sessions (Redis)
// Sessions (Redis)
const useRedis = process.env.USE_REDIS === 'true' || Boolean(process.env.REDIS_URL);

const baseCookie = {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000,
};

if (useRedis) {
  try {
    const redisClient = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      { lazyConnect: true }
    );

    // Try to connect, but don’t crash if it fails
    redisClient.connect().catch(err => {
      console.warn(
        '[redis] connect failed, using MemoryStore instead:',
        err?.code || err?.message || err
      );
    });

    app.use(session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || 'fallback_secret',
      resave: false,
      saveUninitialized: false,
      cookie: baseCookie,
    }));
    console.log('[redis] enabled');
  } catch (e) {
    console.warn('[redis] setup error, using MemoryStore:', e.message);
    app.use(session({
      secret: process.env.SESSION_SECRET || 'fallback_secret',
      resave: false,
      saveUninitialized: false,
      cookie: baseCookie,
    }));
  }
} else {
  console.log('[redis] disabled; using MemoryStore');
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: baseCookie,
  }));
}


// Auth guard
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
}

// --- Debug route to confirm DB connectivity ---
app.get('/api/_debug/db', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true, sample: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ======= AUTH =======

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Incorrect password' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.role === 'admin';

    return res.json({
      message: 'Login successful',
      isAdmin: req.session.isAdmin,
      username: user.username,
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
});





// Get orders for the logged-in user
app.get('/api/orders', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Please log in.' });
  }

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_price,
        status,
        created_at,
        order_items (
          quantity,
          products (name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error.message);
    res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});




// Signup (session-only, no fake token)
app.post('/api/signup', async (req, res) => {
  const { f_name, l_name, username, address, number, email, password, role = 'user' } = req.body;

  if (!f_name || !l_name || !username || !address || !number || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ f_name, l_name, username, address, number, email, password: hashedPassword, role })
      .select()
      .single();

    if (error) {
      console.error('Database Error:', error.message);
      return res.status(500).json({ message: 'Database error.', details: error.message });
    }

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    req.session.isAdmin = newUser.role === 'admin';

    return res
      .status(201)
      .json({ message: 'ok', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (e) {
    console.error('Server Error:', e.message);
    return res.status(500).json({ message: 'Server error during signup.' });
  }
});

// Session status
app.get('/api/session', (req, res) => {
  const loggedIn = Boolean(req.session?.userId);
  res.status(200).json({ loggedIn, userId: loggedIn ? req.session.userId : null });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: 'Failed to log out' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// ======= CART =======
app.use('/api/cart', isAuthenticated);

// Add to cart
app.post('/api/cart/add', async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.userId;

  if (!productId) return res.status(400).json({ message: 'Product ID is required' });
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await addItemToCart(userId, productId);
    const cartItems = await getCartItems(userId);
    res.status(201).json({ cartCount: cartItems.length });
  } catch (error) {
    console.error('Error adding item to cart:', error.message);
    res.status(500).json({ message: 'Failed to add item to cart' });
  }
});

// Get cart items
app.get('/api/cart', async (req, res) => {
  try {
    const cartItems = await getCartItems(req.session.userId);
    res.json(cartItems);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ message: 'Error fetching cart items' });
  }
});

// Cart count
app.get('/api/cart/count', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized: Please log in.' });

    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError || !cart) return res.json({ count: 0 });

    const { data: cartItems, error: itemsError } = await supabase.from('cart_items').select('id').eq('cart_id', cart.id);
    if (itemsError) return res.status(500).json({ message: 'Error fetching cart count' });

    res.json({ count: cartItems.length });
  } catch (error) {
    console.error('Error fetching cart count:', error.message);
    res.status(500).json({ message: 'Server error fetching cart count.' });
  }
});

// Update qty
app.post('/api/cart/update', async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized: Please log in' });
  if (!productId || !quantity || quantity <= 0) return res.status(400).json({ message: 'Invalid product ID or quantity' });

  try {
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (cartError || !cart) return res.status(404).json({ message: 'Pending cart not found' });

    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('cart_id', cart.id)
      .eq('product_id', productId);

    if (updateError) throw new Error(updateError.message);

    res.json({ message: 'Cart quantity updated successfully' });
  } catch (error) {
    console.error('Error updating cart quantity:', error.message);
    res.status(500).json({ message: 'Failed to update cart quantity' });
  }
});

// Remove item
app.post('/api/cart/remove', async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.userId;

  try {
    await removeItemFromCart(userId, productId);
    const cartItems = await getCartItems(userId);
    res.json({ message: 'Item removed successfully', cartCount: cartItems.length });
  } catch (error) {
    console.error('Error removing item from cart:', error.message);
    res.status(500).json({ message: 'Failed to remove item from cart' });
  }
});

// Checkout
app.post('/api/checkout', async (req, res) => {
  try {
    const { message, orderId } = await checkoutCart(req.session.userId);
    res.json({ message, orderId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======= PRODUCTS =======

// Multer + validation
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../frontend/uploads'));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, filename);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});
function allowImages(req, res, next) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'];
  if (req.file && !ok.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Invalid image type' });
  }
  next();
}
function normalizeExtraImages(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try {
      return JSON.parse(v);
    } catch {
      /* ignore */
    }
  }
  return [];
}

// Single paginated GET
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, price, availability } = req.query;
    const products = await getProducts({ search, category, price, availability });
    if (!Array.isArray(products)) throw new TypeError('Expected products to be an array');

    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    const startIndex = (p - 1) * l;
    const endIndex = p * l;

    const paginatedResults = {
      results: products.slice(startIndex, endIndex),
      next: endIndex < products.length ? { page: p + 1, limit: l } : null,
      previous: startIndex > 0 ? { page: p - 1, limit: l } : null,
    };

    res.json(paginatedResults);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.post('/api/products', upload.single('image_file'), allowImages, async (req, res) => {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url || null;

    const { name, original_price, discounted_price, category, stock, description } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name,
        original_price,
        discounted_price,
        category,
        stock,
        image_url: imageUrl,
        description,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    console.error('Error saving product:', error.message);
    res.status(500).json({ message: 'Error saving product', error: error.message });
  }
});


app.put('/api/products/:id', upload.single('image_file'), allowImages, async (req, res) => {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url || null;

    const { name, original_price, discounted_price, category, stock, description } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        original_price,
        discounted_price,
        category,
        stock,
        image_url: imageUrl,
        description,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
});



app.delete('/api/products/:id', async (req, res) => {
  try {
    await deleteProductFromDatabase(req.params.id);
    console.log('✅ Product deleted:', req.params.id);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});


// ======= MEMBERSHIP =======
app.get('/plansCheckout', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'plansCheckout.html'));
});

app.post('/api/plans/checkout', async (req, res) => {
  const { planId } = req.body;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized: Please log in.' });

  try {
    const { data: plan, error: fetchPlanError } = await supabase
      .from('membership_plans')
      .select('id, price, duration, plan_name')
      .eq('id', planId)
      .single();

    if (fetchPlanError || !plan) return res.status(404).json({ message: 'Plan not found.' });

    const expiryDate = calculateExpiryDate(plan.duration);

    const { error: insertError } = await supabase.from('members').insert({
      user_id: userId,
      plan_id: planId,
      start_date: new Date().toISOString(),
      expiry_date: expiryDate,
    });

    if (insertError) throw new Error('Failed to activate membership.');

    res.status(201).json({ message: 'Membership successfully activated.' });
  } catch (error) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ message: 'Checkout failed.', details: error.message });
  }
});

app.get('/api/plans/:id', async (req, res) => {
  try {
    const { data: plan, error } = await supabase.from('membership_plans').select('*').eq('id', req.params.id).single();
    if (error || !plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch plan details.' });
  }
});

function calculateExpiryDate(duration) {
  const now = new Date();
  if (!duration) throw new Error('Missing plan duration');

  // Normalize for safer matching
  const normalized = duration.toString().toLowerCase().trim();

  if (normalized.includes('month')) {
    now.setMonth(now.getMonth() + 1);
  } else if (normalized.includes('year')) {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    throw new Error('Invalid plan duration');
  }

  return now.toISOString();
}

// ======= REVIEWS =======
// GET reviews
app.get('/api/products/:id/reviews', isAuthenticated, async (req, res) => {
  try {
    const productId = req.params.id;
    const page = Math.max(parseInt(req.query.page ?? '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit ?? '10', 10), 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: reviews, error } = await supabase
      .from('reviews')  // ← was 'comments'
      .select(`
        id, product_id, user_id, rating, comment_text, created_at,
        user:users(id, username, f_name, l_name)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ message: 'Failed to fetch reviews', details: error.message });
    if (!reviews || reviews.length === 0) return res.status(404).json({ message: 'No reviews found for this product.' });

    return res.status(200).json({ page, limit, count: reviews.length, reviews });
  } catch (err) {
    console.error('Unexpected error (reviews):', err);
    return res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// POST review
app.post('/api/products/:id/reviews', isAuthenticated, async (req, res) => {
  try {
    const { rating, comment_text } = req.body;
    const { data: review, error } = await supabase
      .from('reviews')  // ← was 'comments'
      .insert({ product_id: req.params.id, user_id: req.session.userId, rating, comment_text })
      .select()
      .single();

    if (error) return res.status(500).json({ message: 'Error submitting review', details: error.message });
    return res.status(201).json({ message: 'Review added successfully', review });
  } catch (error) {
    console.error('Error submitting review:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/plans', async (req, res) => {
  const { data, error } = await supabase.from('membership_plans').select('*');
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});



// ======= ADMIN =======
// (unchanged admin endpoints here)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, total_price, status, created_at, address,
        user:users(id, f_name, l_name, email),
        order_items ( quantity, price, product:products(name) )
      `);

    if (error) throw error;
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ message: 'Error fetching orders.' });
  }
});

app.get('/api/admin/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id, total_price, status, created_at, address,
        user:users(id, f_name, l_name, email),
        order_items ( quantity, price, product:products(name) )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order details:', error.message);
    res.status(500).json({ message: 'Error fetching order details.' });
  }
});

app.post('/api/admin/orders/:id/complete', async (req, res) => {
  const orderId = req.params.id;
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_items(product_id, quantity), status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found.');
    if (order.status === 'Completed') return res.status(400).json({ message: 'Order is already completed.' });

    for (const item of order.order_items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single();
      if (productError || !product) throw new Error(`Failed to fetch stock for product ${item.product_id}`);

      const newStock = product.stock - item.quantity;
      if (newStock < 0) throw new Error(`Insufficient stock for product ${item.product_id}`);

      const { error: stockUpdateError } = await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
      if (stockUpdateError) throw new Error(`Failed to update stock for product ${item.product_id}`);
    }

    const { error: statusError } = await supabase.from('orders').update({ status: 'Completed' }).eq('id', orderId);
    if (statusError) throw new Error('Failed to update order status.');

    res.status(200).json({ message: 'Order marked as complete.' });
  } catch (error) {
    console.error('Error completing order:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/members', async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id,
        user:users (f_name, l_name, email),
        plan:membership_plans (plan_name, price),
        start_date,
        expiry_date
      `);
    if (error) throw error;
    res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Failed to fetch members.' });
  }
});

app.get('/api/admin/metrics', async (req, res) => {
  try {
    const { data: incomeData, error: incomeError } = await supabase.from('orders').select('total_price').eq('status', 'Completed');
    if (incomeError) throw incomeError;
    const totalIncome = incomeData.reduce((sum, order) => sum + order.total_price, 0);

    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_price, status, created_at, user:users(f_name, l_name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (ordersError) throw ordersError;

    const { data: topUsers, error: usersError } = await supabase.from('users').select('id, f_name, l_name, email').limit(5);
    if (usersError) throw usersError;

    res.json({ totalIncome, recentOrders, topUsers });
  } catch (error) {
    console.error('Error fetching metrics:', error.message);
    res.status(500).json({ message: 'Failed to fetch metrics' });
  }
});

// ✅ Serve the main admin shell
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'admin.html'));
});

// ✅ Serve admin subpages (dashboard, products, etc.)
app.use('/admin_settings', express.static(path.join(__dirname, '../frontend/admin_settings')))

// ======= STATIC + PAGES =======
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
app.use('/styles', express.static(path.join(__dirname, '../frontend/styles')));
app.get('/product.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend/product.html')));
app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));
// HTML routing
app.use('/', pagesRouter);

// Boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



