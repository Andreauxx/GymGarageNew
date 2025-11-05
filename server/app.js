

  import express from 'express';
  import session from 'express-session';
  import bcrypt from 'bcrypt';
  import path from 'path';
  import multer from 'multer';
  import { fileURLToPath } from 'url';
  import {
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
    checkoutCart, // Keep these
  } from './database.js';
  import cors from 'cors';
  import pagesRouter from './pages.js';
  import supabase from './database.js';

  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use(cors({
    origin: 'http://localhost:5173', // Adjust for your frontend URL
    credentials: true, // Allow sending cookies
  }));

  app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set true if HTTPS
      httpOnly: true,
      sameSite: 'lax', // Adjust for cross-origin issues
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  }));


  app.use(express.json());

  // Middleware for session-based authentication
  function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
      next(); // User is authenticated
    } else {
      res.status(401).json({ message: 'Unauthorized: Please log in' });
      
    }
  }

  // Protect Cart routes using session-based authentication
  app.use('/api/cart', isAuthenticated);




  //======ROUTES FOR SIGNIN LOGIN LOGOUT=========//
  // Login route
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await getUserByEmail(email); // Ensure user exists in the database
      if (!user) return res.status(400).json({ message: 'User not found' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: 'Incorrect password' });

      req.session.userId = user.id;
      req.session.username = user.username; // Store username in the session

      // Check if the user is an admin
      if (user.email === 'admin@gmail.com') {
        req.session.isAdmin = true; // Set admin flag
        res.json({ 
          message: 'Admin login successful', 
          isAdmin: true, 
          redirectUrl: '/admin/dashboard',
          username: user.username  // Send username in response
        });
      } else {
        req.session.isAdmin = false; // Regular user
        res.json({ 
          message: 'User login successful', 
          isAdmin: false, 
          username: user.username  // Send username in response
        });
      }
    } catch (error) {
      console.error('Error during login:', error.message);
      res.status(500).json({ message: 'Server error during login' });
    }
  });



  // Logout route
  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ message: "Failed to log out" });
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });



  app.post('/api/signup', async (req, res) => {
    const { f_name, l_name, username, address, number, email, password, role = 'user' } = req.body;

    if (!f_name || !l_name || !username || !address || !number || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      const { data, error } = await supabase
        .from('users')
        .insert({
          f_name,
          l_name,
          username,
          address,
          number, // Ensure this matches your schema in the `users` table
          email,
          password: hashedPassword,
          role, // Assign default 'user' if role is not provided in request
        });

      if (error) {
        console.error('Database Error:', error.message); // Log error details
        return res.status(500).json({ message: 'Database error.', details: error.message });
      }

      res.status(201).json({ message: 'Signup successful', token: 'fake-jwt-token' });
    } catch (error) {
      console.error('Server Error:', error.message);
      res.status(500).json({ message: 'Server error during signup.' });
    }
  });










  app.get('/admin/', (req, res) => {
    if (req.session.userId && req.session.isAdmin) {
      res.redirect('/admin/dashboard'); // Redirect to dashboard
    } else {
      res.status(403).send('Forbidden: Admins only');
    }
  });



  app.use('/admin_settings', express.static(path.join(__dirname, '../frontend/admin_settings')));


  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin_settings/admin.html'));
  });





  // ======== CART ROUTES ============ 

  app.post('/api/cart/add', async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.userId; // Fetch userId from session



    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }

    if (!productId) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
      await addItemToCart(userId, productId);
      const cartItems = await getCartItems(userId);
      res.status(201).json({ cartCount: cartItems.length });
    } catch (error) {
      console.error('Error adding item to cart:', error.message);
      res.status(500).json({ message: 'Failed to add item to cart' });
    }
  });


  // Fetch Cart Items
  app.get('/api/cart', async (req, res) => {
    console.log('Fetching cart items for user:', req.session.userId); // Log session user ID
    try {
      const cartItems = await getCartItems(req.session.userId);
      console.log('Cart items fetched:', cartItems); // Log fetched cart items
      res.json(cartItems);
    } catch (error) {
      console.error('Error fetching cart items:', error);
      res.status(500).json({ message: 'Error fetching cart items' });
    }
  });


  app.get('/api/cart/count', async (req, res) => {
    try {
      const userId = req.session.userId; // Ensure the session contains userId
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
      }

      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

      if (cartError || !cart) {
        return res.json({ count: 0 });
      }

      const { data: cartItems, error: itemsError } = await supabase
        .from('cart_items')
        .select('id')
        .eq('cart_id', cart.id);

      if (itemsError) {
        return res.status(500).json({ message: 'Error fetching cart count' });
      }

      res.json({ count: cartItems.length });
    } catch (error) {
      console.error('Error fetching cart count:', error.message);
      res.status(500).json({ message: 'Server error fetching cart count.' });
    }
  });

  // Checkout Route
  app.post('/api/checkout', async (req, res) => {
    try {
      const { message, orderId } = await checkoutCart(req.session.userId);
      res.json({ message, orderId });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

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

  app.post('/api/cart/update', async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.userId; // Use session to get the logged-in user

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid product ID or quantity' });
    }

    try {
      // Fetch the user's pending cart
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

      if (cartError || !cart) {
        return res.status(404).json({ message: 'Pending cart not found' });
      }

      // Update the cart item's quantity
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('cart_id', cart.id)
        .eq('product_id', productId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      res.json({ message: 'Cart quantity updated successfully' });
    } catch (error) {
      console.error('Error updating cart quantity:', error.message);
      res.status(500).json({ message: 'Failed to update cart quantity' });
    }
  });




  // ========== PRODUCT ROUTES ===========


  // Example backend response
  app.get('/api/products', async (req, res) => {
    try {
      const { page = 1, limit = 10, search, category, price, availability } = req.query;

      // Ensure `getProducts` returns an array
      const products = await getProducts({ search, category, price, availability });

      if (!Array.isArray(products)) {
        throw new TypeError('Expected products to be an array');
      }

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedResults = {
        results: products.slice(startIndex, endIndex), // Ensure results is always an array
        next: endIndex < products.length ? { page: parseInt(page) + 1, limit } : null,
        previous: startIndex > 0 ? { page: parseInt(page) - 1, limit } : null,
      };

      res.json(paginatedResults);
      console.log('Paginated Results:', paginatedResults);
    } catch (error) {
      console.error('Error fetching products:', error.message);
      res.status(500).json({ message: 'Error fetching products' });
    }
  });




  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  app.get('/api/products', async (req, res) => {
    try {
      const { search, category, price, availability } = req.query;
      const products = await getProducts({ search, category, price, availability });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching products', error: error.message });
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

  app.post('/api/products', upload.single('image_file'), async (req, res) => {
    try {
      const { name, original_price, discounted_price, category, stock, image_url, extra_images,description } = req.body;
      const product = await saveProductToDatabase({
        name, original_price, discounted_price, category, stock, 
        mainImageUrl: image_url,description, additionalImages: JSON.parse(extra_images || '[]')
      });
      res.status(201).json({ message: 'Product added successfully', product });
    } catch (error) {
      res.status(500).json({ message: 'Error saving product', error: error.message });
    }
  });

  app.put('/api/products/:id', upload.single('image_file'), async (req, res) => {
    try {
      const { name, original_price, discounted_price, category, stock, image_url, extra_images, description } = req.body;
      const product = await updateProductInDatabase(req.params.id, {
        name, original_price, discounted_price, category, stock, 
        mainImageUrl: image_url,description, additionalImages: JSON.parse(extra_images || '[]')
      });
      res.status(200).json({ message: 'Product updated successfully', product });
    } catch (error) {
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      await deleteProductFromDatabase(req.params.id);
      res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  });




  // == MEMBERSHIP PLANS

  app.get('/plansCheckout', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'plansCheckout.html')); // Adjust for correct relative path
  });

  app.post('/api/plans/checkout', async (req, res) => {
    const { planId } = req.body;
    const userId = req.session.userId; // Ensure the userId is retrieved from session
  
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }
  
    try {
      const { data: plan, error: fetchPlanError } = await supabase
        .from('membership_plans')
        .select('id, price, duration, plan_name')
        .eq('id', planId)
        .single();
  
      if (fetchPlanError || !plan) {
        return res.status(404).json({ message: 'Plan not found.' });
      }
  
      const expiryDate = calculateExpiryDate(plan.duration);
  
      const { error: insertError } = await supabase
        .from('members')
        .insert({
          user_id: userId,
          plan_id: planId,
          start_date: new Date().toISOString(),
          expiry_date: expiryDate,
        });
  
      if (insertError) {
        throw new Error('Failed to activate membership.');
      }
  
      res.status(201).json({ message: 'Membership successfully activated.' });
    } catch (error) {
      console.error('Checkout error:', error.message);
      res.status(500).json({ message: 'Checkout failed.', details: error.message });
    }
  });
  


  app.get('/api/plans/:id', async (req, res) => {
    try {
      const { data: plan, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error || !plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch plan details.' });
    }
  });


  app.get('/api/session', (req, res) => {
    if (req.session && req.session.userId) {
      res.status(200).json({ loggedIn: true, userId: req.session.userId });
    } else {
      res.status(401).json({ loggedIn: false });
    }
  });
  

  // Route to check if the user is logged in
  app.get('/api/session-check', (req, res) => {
    if (req.session && req.session.userId) {
      res.status(200).json({ loggedIn: true });  // Ensure consistent response
    } else {
      res.status(200).json({ loggedIn: false });
    }
  });




  function calculateExpiryDate(duration) {
    const now = new Date();
    if (duration === 'monthly') {
      now.setMonth(now.getMonth() + 1);
    } else if (duration === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      throw new Error('Invalid plan duration');
    }
    return now.toISOString();
  }







  // ============ REVIEW ROUTES AND CHECKOUT ======= 
  app.get('/api/products/:id/reviews', isAuthenticated, async (req, res) => {
    try {
      const reviews = await getProductReviews(req.params.id);
      if (!reviews || reviews.length === 0) return res.status(404).json({ message: 'No reviews found for this product.' });
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ message: 'Failed to fetch reviews' });
    }
  });

  app.post('/api/products/:id/reviews', isAuthenticated, async (req, res) => {
    try {
      const { rating, comment_text } = req.body;
      const review = await supabase.from('comments').insert([
        { product_id: req.params.id, user_id: req.session.userId, rating, comment_text }
      ]);
      res.status(201).json({ message: 'Review added successfully', review });
    } catch (error) {
      console.error('Error submitting review:', error.message);
      res.status(500).json({ message: 'Server error' });
    }
  });



  // Fetch Order History for Logged-in User
  app.get('/api/orders', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

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
            price,
            products (
              name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error.message);
        return res.status(500).json({ message: 'Failed to fetch orders' });
      }

      res.status(200).json(orders);
    } catch (error) {
      console.error('Unexpected error:', error.message);
      res.status(500).json({ message: 'Server error while fetching orders' });
    }
  });







  //====================ADMIN=====================
  app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                total_price,
                status,
                created_at,
                address,
                user:users(id, f_name, l_name, email),
                order_items (
                    quantity,
                    price,
                    product:products(name)
                )
            `); // No inline comments inside the query string.

        if (error) {
            console.error('Supabase Query Error:', error);
            throw error;
        }

        console.log('Fetched Orders:', orders);
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
                id,
                total_price,
                status,
                created_at,
                address,
                user:users(id, f_name, l_name, email),
                order_items (
                    quantity,
                    price,
                    product:products(name)
                )
            `)
            .eq('id', orderId)
            .single(); 

        if (error) {
            console.error('Supabase Query Error:', error);
            throw error;
        }

        console.log('Fetched Order Details:', order);
        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order details:', error.message);
        res.status(500).json({ message: 'Error fetching order details.' });
    }
  });


  // Complete Order Route
  app.post('/api/admin/orders/:id/complete', async (req, res) => {
    const orderId = req.params.id;

    try {
        // Fetch the order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_items(product_id, quantity), status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            throw new Error('Order not found.');
        }

        if (order.status === 'Completed') {
            return res.status(400).json({ message: 'Order is already completed.' });
        }

        // Update stock for each product in the order
        for (const item of order.order_items) {
            // Fetch the current stock for the product
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (productError || !product) {
                throw new Error(`Failed to fetch stock for product ${item.product_id}`);
            }

            const newStock = product.stock - item.quantity;

            if (newStock < 0) {
                throw new Error(`Insufficient stock for product ${item.product_id}`);
            }

            const { error: stockUpdateError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.product_id);

            if (stockUpdateError) {
                throw new Error(`Failed to update stock for product ${item.product_id}`);
            }
        }

        // Update order status to 'Completed'
        const { error: statusError } = await supabase
            .from('orders')
            .update({ status: 'Completed' })
            .eq('id', orderId);

        if (statusError) {
            throw new Error('Failed to update order status.');
        }

        res.status(200).json({ message: 'Order marked as complete.' });
    } catch (error) {
        console.error('Error completing order:', error.message);
        res.status(500).json({ message: error.message });
    }
  });





  // Fetch All Members
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




  // Get Dashboard Metrics
  app.get('/api/admin/metrics', async (req, res) => {
    try {
      // Total income from completed orders
      const { data: incomeData, error: incomeError } = await supabase
        .from('orders')
        .select('total_price')
        .eq('status', 'Completed');

      if (incomeError) throw incomeError;

      const totalIncome = incomeData.reduce((sum, order) => sum + order.total_price, 0);

      // Fetch recent 5 orders
      const { data: recentOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_price, status, created_at, user:users(f_name, l_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      // Fetch top 5 users
      const { data: topUsers, error: usersError } = await supabase
        .from('users')
        .select('id, f_name, l_name, email')
        .limit(5);

      if (usersError) throw usersError;

      res.json({
        totalIncome,
        recentOrders,
        topUsers
      });
    } catch (error) {
      console.error('Error fetching metrics:', error.message);
      res.status(500).json({ message: 'Failed to fetch metrics' });
    }
  });









  app.get('/api/admin/users', async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, role, f_name, l_name');

      if (error) throw error;

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'No users found.' });
      }

      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        name: `${user.f_name} ${user.l_name}` // Combine first and last name
      }));

      res.status(200).json(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error.message);
      res.status(500).json({ message: 'Error fetching users.' });
    }
  });


  // Logout route
  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: "Failed to log out" });
        res.clearCookie('connect.sid'); // Ensure session cookie is cleared
        res.json({ message: "Logged out successfully" });
    });
  });



  // Serve static files
  // Serve static files from the "frontend" or "public" directory
  app.use(express.static(path.join(__dirname, 'frontend'))); // Ensure 'frontend' contains your HTML files
  app.use(express.static(path.join(__dirname, 'public')));  // Replace 'public' with the actual directory
  app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
  app.use('/styles', express.static(path.join(__dirname, '../frontend/styles')));
  app.get('/product.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend/product.html')));

  // HTML Routing via pagesRouter
  app.use('/', pagesRouter);

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  