import { displayProducts } from './utils.js';
import { addToCart, updateCartCounter, isLoggedIn } from './authdisplay.js';

export async function fetchShopProducts({ search = '', page = 1, limit = 10 } = {}) {
  // Get search parameters from the URL or input fields
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get("search") || document.getElementById("search-input").value.trim();
  const category = document.getElementById("category").value;
  const price = document.getElementById("price-range").value;
  const availability = document.getElementById("availability").value;

  // Build query string for API request
  let query = `/api/products?page=${page}&limit=${limit}`;
  if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
  if (category && category !== "all") query += `&category=${encodeURIComponent(category)}`;
  if (price) query += `&price=${encodeURIComponent(price)}`;
  if (availability && availability !== "all") query += `&availability=${encodeURIComponent(availability)}`;

  try {
    const response = await fetch(query);
    if (!response.ok) throw new Error('Failed to fetch products');

    const { results, next, previous } = await response.json();

    // Load products into the grid
    displayProducts(results, 'product-grid', addToCart);

    // Update pagination controls
    setupPagination(next, previous);

    // Set the search input value if searchQuery exists
    if (searchQuery) {
      document.getElementById("search-input").value = searchQuery;
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    document.getElementById('product-grid').innerHTML = '<p>Failed to load products.</p>';
  }
}


export function setupPagination(next, previous) {
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');
  const currentPageSpan = document.getElementById('current-page');

  const currentPage = 
    (next && next.page - 1) || 
    (previous && previous.page + 1) || 
    1; // Default to page 1 if pagination is unavailable

  prevButton.disabled = !previous;
  nextButton.disabled = !next;

  currentPageSpan.textContent = `Page ${currentPage}`;

  // Ensure fetchShopProducts is called with valid page numbers
  prevButton.onclick = () => fetchShopProducts({ page: Math.max(1, currentPage - 1) });
  nextButton.onclick = () => fetchShopProducts({ page: currentPage + 1 });
}


export function setupFilters() {
  document.getElementById('apply-filters').addEventListener('click', fetchShopProducts);

  document.getElementById("price-range").addEventListener("input", () => {
    const price = document.getElementById("price-range").value;
    document.getElementById("price-label").innerText = `₱0 - ₱${price}`;
  });
}

// New function to initialize the page and handle both products and cart
async function initializeShopPage() {
  await fetchShopProducts(); // Fetch and display products first

  if (isLoggedIn()) {
    await updateCartCounter(); // Only update cart counter if the user is logged in
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeShopPage(); // Initialize the shop page components
  setupFilters(); // Set up the filter functionality
});


