
export async function isLoggedIn() {
  try {
    const response = await fetch('/api/cart', { method: 'GET' });
    return response.ok; // True if response status is 200 OK
  } catch (error) {
    console.error("Error checking login status:", error);
     res.redirect('/login'); // Redirect to login
    return false; // Assume not logged in if there's an error
    
  }
}


export function setupAddToCartButtons() {
  const buttons = document.querySelectorAll('.add-to-cart');
  buttons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const loggedIn = await isLoggedIn(); // Check session-based login
      if (!loggedIn) {
        event.preventDefault();
        alert("Please log in to add items to the cart.");
        window.location.href = '/login'; // Redirect to login
      } else {
        const productId = button.getAttribute('data-product-id');
        if (productId) {
          try {
            await addToCart(productId); // Call addToCart without userId
          } catch (error) {
            console.error("Failed to add product to cart:", error.message);
          }
        } else {
          console.error("Product ID not found.");
        }
      }
    });
  });
}


// Updated addToCart function to accept userId as a parameter
export async function addToCart(productId) {
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Ensure session cookies are included
      body: JSON.stringify({ productId }) // Send only productId
    });


    if (response.status === 401) {
      // Redirect to login if unauthorized
      alert('You need to log in to add items to the cart.');
      window.location.href = '/login'; // Adjust the path to your login page
      return;
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add item to cart');
    }

    const { cartCount } = await response.json();

    // Update cart counter if available
    const cartCounter = document.querySelector('.cart-counter');
    if (cartCounter) {
      cartCounter.textContent = cartCount || 0;
    }

    alert('Product added to cart successfully!');
  } catch (error) {
    console.error('Error adding item to cart:', error.message);
    alert('Error: ' + error.message);
  }
}




async function logout() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.ok) {
      localStorage.removeItem('username');
      alert("Logged out successfully");
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Error during logout:", error);
  }
}




export async function updateCartCounter() {
  try {
    const response = await fetch('/api/cart/count');
    if (response.ok) {
      const { count } = await response.json();
      const counter = document.querySelector('.cart-counter');
      if (counter) counter.textContent = count;
    }
  } catch (error) {
    console.error('Error updating cart counter:', error);
  }
}



export async function checkout(userId) {
  const { data: pendingOrder, error: findOrderError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (findOrderError) {
    console.error('Error finding pending order:', findOrderError.message);
    throw new Error('Error finding pending order');
  }

  if (!pendingOrder) {
    throw new Error('No pending order found');
  }

  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', pendingOrder.id);

  if (updateOrderError) {
    console.error('Error completing order:', updateOrderError.message);
    throw new Error('Error completing order');
  }

  return { message: 'Checkout successful', orderId: pendingOrder.id };
}