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
  
  // JWT parser // Decided not to use this anymore had a hard time putting the token in the header
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }
  
  // Product display functionality
  export function displayProducts(products, containerId, onAddToCart) {
    const productGrid = document.getElementById(containerId);
    productGrid.innerHTML = '';
  
    if (!products.length) {
      productGrid.innerHTML = '<p>No products available.</p>';
      return;
    }
  
    products.forEach(product => {
      const originalPrice = product.original_price ? `₱${parseFloat(product.original_price).toFixed(2)}` : 'N/A';
      const discountedPrice = product.discounted_price ? `₱${parseFloat(product.discounted_price).toFixed(2)}` : originalPrice;
      const priceDisplay = product.discounted_price
        ? `<span class="original-price">${originalPrice}</span> <span class="discounted-price">${discountedPrice}</span>`
        : `<span class="price">${originalPrice}</span>`;
  
      const productCard = document.createElement('div');
      productCard.className = 'product-card';
      productCard.innerHTML = `
        <a href="/product.html?id=${product.id}">
          ${product.discounted_price ? `<div class="save-banner">Save ₱${(product.original_price - product.discounted_price).toFixed(2)}</div>` : ''}
          <img src="${product.image_url}" alt="${product.name}">
          <h2>${product.name}</h2>
          <div class="price-section">${priceDisplay}</div>
        </a>
        <button class="add-to-cart" data-product-id="${product.id}">Add to Cart</button>
      `;
      productGrid.appendChild(productCard);
  
      productCard.querySelector('.add-to-cart').addEventListener('click', () => {
        if (isLoggedIn()) {
          onAddToCart(product.id);
        } else {
          alert("Please log in to add items to the cart.");
          window.location.href = '/login';
        }
      });
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


  
  // Cart functionality
  export async function addToCart(productId) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
  
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId })
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add to cart');
    }
  
    return response.json();
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