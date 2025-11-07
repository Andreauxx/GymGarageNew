// utils.js
export function formatPrice(price) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(price);
}
  
  export function calculateDiscount(originalPrice, discountedPrice) {
    return ((originalPrice - discountedPrice) / originalPrice * 100).toFixed(0);
  }
  
  // Function to check if user is logged in
  export function isLoggedIn() {
    const token = localStorage.getItem('token');
    return token && parseJwt(token);
  }
  
  
// 🎨 Display Products
export function displayProducts(products, containerId, onAddToCart) {
  const grid = document.getElementById(containerId);
  if (!grid) return console.warn(`Container ${containerId} not found`);
  grid.innerHTML = '';

  if (!products || !products.length) {
    grid.innerHTML = '<p>No products found.</p>';
    return;
  }

  products.forEach((product) => {
    const original = formatPrice(product.original_price || 0);
    const discounted = product.discounted_price
      ? formatPrice(product.discounted_price)
      : original;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="/product.html?id=${product.id}">
        ${product.discounted_price ? `<div class="save-banner">Save ${calculateDiscount(product.original_price, product.discounted_price)}%</div>` : ''}
        <img src="${product.image_url}" alt="${product.name}" />
        <h2>${product.name}</h2>
        <div class="price-section">
          ${product.discounted_price ? `<span class="original-price">${original}</span><span class="discounted-price">${discounted}</span>` : `<span class="price">${original}</span>`}
        </div>
      </a>
      <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
    `;
    grid.appendChild(card);

    card.querySelector('.add-to-cart').addEventListener('click', () =>
      onAddToCart(product.id)
    );
  });
}
  




// Shuffle an array in place and filter out products with long names
export function shuffleArray(array, maxNameLength = 30) {
  // Filter out products with long names
  const filteredArray = array.filter(product => product.name.length <= maxNameLength);

  // Shuffle the filtered array
  for (let i = filteredArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredArray[i], filteredArray[j]] = [filteredArray[j], filteredArray[i]];
  }

  // Return the shuffled, filtered array
  return filteredArray;
}


  
 // 🛒 Add to Cart (session-based)
export async function addToCart(productId) {
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to add to cart.');
    }

    const result = await response.json();
    await updateCartCounter();
    alert('Product added to cart!');
    return result;
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.message.includes('Unauthorized')) {
      window.location.href = '/login';
    }
  }
}

  // Update cart counter in navigation
  export async function updateCartCounter() {
    const token = localStorage.getItem('token');
    if (!token) return;
  
    try {
      const response = await fetch('/api/cart/count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const { count } = await response.json();
        const counter = document.querySelector('.cart-counter');
        if (counter) counter.textContent = count;
      }
    } catch (error) {
      console.error('Error updating cart counter:', error);
    }
  }
  
  // Initialize product display
  export async function initializeProductDisplay(containerId = 'scrollable-grid') {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const products = await response.json();
      displayProducts(products, containerId);
      updateCartCounter();
    } catch (error) {
      console.error('Error initializing products:', error);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '<p class="error-message">Failed to load products. Please try again later.</p>';
      }
    }
  }
  
  // Initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    initializeProductDisplay();
  });