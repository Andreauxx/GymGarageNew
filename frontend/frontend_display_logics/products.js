// products.js
import { displayProducts, isLoggedIn } from './utils.js';

// Function to fetch and display products based on filters
export async function fetchProducts(containerId) {


  const searchQuery = document.getElementById("search-input").value.trim();
  const category = document.getElementById("category").value;
  const price = document.getElementById("price-range").value;
  const availability = document.getElementById("availability").value;

  // Construct query string
  let query = `/api/products?`;
  if (searchQuery) query += `search=${encodeURIComponent(searchQuery)}&`; // Encode query params
  if (category && category !== "all") query += `category=${encodeURIComponent(category)}&`;
  if (price) query += `price=${price}&`; 
  if (availability && availability !== "all") query += `availability=${encodeURIComponent(availability)}`;


  
  try {
    const response = await fetch(query);
    if (!response.ok) throw new Error('Failed to fetch products');

    const products = await response.json();
    displayProducts(products, containerId); // Assuming displayProducts handles rendering
  } catch (error) {
    console.error("Error fetching products:", error);
  }
}


// Function to handle adding products to the cart
export async function addToCart(productId) {
  const token = localStorage.getItem('token');
  if (!isLoggedIn()) {
    alert("Please log in to add items to the cart.");
    window.location.href = '/login.html';
    return;
  }
  
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId })
    });

    if (response.ok) {
      alert('Product added to cart successfully!');
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to add product to cart');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
  }
}

// Function to set up filters
export function setupFilters(containerId) {
  document.getElementById('apply-filters').addEventListener('click', () => fetchProducts(containerId));
  document.getElementById("price-range").addEventListener("input", () => {
    const price = document.getElementById("price-range").value;
    document.getElementById("price-label").innerText = `₱0 - ₱${price}`;
  });
}




export async function fetchReviews(productId) {
  try {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch reviews.');

    return await response.json();
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return []; // Return an empty array to avoid breaking the UI
  }
}


// Event Listener for Review Form Submission
document.getElementById('review-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const comment = document.getElementById('review-text').value;
  const rating = document.getElementById('review-rating').value;

  const response = await fetch(`/api/products/${productId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${yourToken}`, // Include if authentication is required
    },
    body: JSON.stringify({ comment, rating }),
  });

  if (response.ok) {
    alert('Review added successfully!');
    fetchAndUpdateReviews(); // Refresh reviews
  } else {
    alert('Failed to add review');
  }
});



// Update the rating summary and breakdown
function updateRatingSummary(averageRating, totalReviews, breakdown) {
  document.getElementById('average-rating').innerHTML = `
      ${renderStars(Math.round(averageRating))}
      <span>${averageRating} out of 5</span> (${totalReviews} reviews)
  `;

  document.getElementById('rating-breakdown').innerHTML = `
      ${[5, 4, 3, 2, 1].map(rating => `
          <div class="breakdown-item">
              <span>${renderStars(rating)}</span>
              <span>${breakdown[rating] || 0} reviews</span>
          </div>
      `).join('')}
  `;
}

// Render stars based on rating
function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
      stars += `<i class="fas fa-star ${i <= rating ? 'filled' : ''}"></i>`;
  }
  return stars;
}
