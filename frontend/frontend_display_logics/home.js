// home.js
import { shuffleArray, displayProducts } from './utils.js';
import { isLoggedIn, addToCart, updateCartCounter } from './authdisplay.js';

// Fetch and display home products
export async function fetchHomeProducts() {
  try {
    const response = await fetch('/api/products'); // Fetch products from the backend
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }

    const data = await response.json(); // Extract the paginated results
    console.log("Backend response data:", data); // Check full response

    const products = data.results; // Access the array of products
    console.log("Products variable:", products); // Explicit logging

    if (!Array.isArray(products)) {
      throw new TypeError(`Expected an array, but got ${typeof products}: `, products);
    }

    shuffleArray(products); // Shuffle products
    const limitedProducts = products.slice(0, 8); // Display limited number

    displayProducts(limitedProducts, 'scrollable-grid', addToCart); // Render products
    updateCartCounter(); // Update cart UI
  } catch (error) {
    console.error('Error fetching products for home page:', error);
    const grid = document.getElementById('scrollable-grid');
    if (grid) {
      grid.innerHTML = '<p>Failed to load products. Please try again later.</p>';
    }
  }
}

// Modal functionality
export function setupModal() {
  const modal = document.getElementById('custom-modal');
  const modalMessage = document.getElementById('modal-message');
  const closeModal = document.querySelector('.close');
  const okButton = document.getElementById('modal-ok-btn');

  // Function to show the modal
  function showModal(message) {
    modalMessage.textContent = message;
    modal.style.display = 'block';
  }

  // Close the modal
  closeModal.onclick = okButton.onclick = function () {
    modal.style.display = 'none';
  };

  // Close modal when clicking outside
  window.onclick = function (event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };

  // Example trigger
  const testAlert = document.getElementById('test-alert');
  if (testAlert) {
    testAlert.addEventListener('click', () => {
      showModal('This is a custom alert message!');
    });
  }
}



// Search input handling
export function setupSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchButton = document.querySelector('.search-button');

  if (searchInput && searchButton) {
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `/shop?search=${encodeURIComponent(query)}`;
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchButton.click(); // Trigger the search
      }
    });
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    updateCartCounter();
  }

  fetchHomeProducts();
  setupModal();
  setupCarousel();
  setupSearch();
});
