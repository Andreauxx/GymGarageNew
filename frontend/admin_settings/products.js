console.log("products.js loaded successfully");

let editingProductId = null;

export async function loadProducts() {
    console.log("Loading products...");
    try {
        const response = await fetch('/api/products'); // Ensure query params if paginated
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

        const { results: products } = await response.json(); // Destructure results from the response
        const productsTable = document.getElementById("products-table");

        if (!productsTable) {
            console.error("Products table element not found.");
            return;
        }

        // Ensure products is an array
        if (!Array.isArray(products)) {
            throw new Error("Invalid data format: Expected an array of products in 'results'");
        }

        productsTable.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>₱${product.discounted_price || product.original_price}</td>
                <td>
                    <button class="action-btn edit" data-id="${product.id}">Edit</button>
                    <button class="action-btn delete" data-id="${product.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        productsTable.querySelectorAll(".edit").forEach(button => {
            button.addEventListener("click", () => editProduct(button.getAttribute("data-id")));
        });
        productsTable.querySelectorAll(".delete").forEach(button => {
            button.addEventListener("click", () => deleteProduct(button.getAttribute("data-id")));
        });
        console.log("Products loaded and event listeners attached.");
    } catch (error) {
        console.error("Failed to load products:", error);
    }
}
    
export function showAddProductForm() {
    document.getElementById("form-title").innerText = "Add Product";
    document.getElementById("product-form-container").style.display = "block";
    clearForm();
    editingProductId = null;
}

export function hideProductForm() {
    document.getElementById("product-form-container").style.display = "none";
    clearForm();
    editingProductId = null;
}

function clearForm() {
    document.getElementById("product-name").value = "";
    document.getElementById("product-original-price").value = "";
    document.getElementById("product-discounted-price").value = "";
    document.getElementById("product-category").value = "";
    document.getElementById("product-description").value = "";
    document.getElementById("product-stock").value = "";
    document.getElementById("product-image-url").value = "";
    document.getElementById("product-image-file").value = "";
    document.getElementById("product-extra-images").value = "";
}

export async function submitProductForm(event) {
  event.preventDefault();
  console.log("Submitting product form...");

  const name = document.getElementById("product-name").value;
  const original_price = parseFloat(document.getElementById("product-original-price").value) || 0;
  const discounted_price = parseFloat(document.getElementById("product-discounted-price").value) || 0;
  const category = document.getElementById("product-category").value;
  const description = document.getElementById("product-description").value;
  const stock = parseInt(document.getElementById("product-stock").value) || 0;
  const imageUrl = document.getElementById("product-image-url").value;
  const imageFile = document.getElementById("product-image-file").files[0]; // ✅ get the file
  const extraImages = document.getElementById("product-extra-images").value
    .split(",")
    .map(url => url.trim())
    .filter(url => url);

  const formData = new FormData();
  formData.append("name", name);
  formData.append("original_price", original_price);
  formData.append("discounted_price", discounted_price);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("stock", stock);

  // ✅ attach the file if selected
  if (imageFile) {
    formData.append("image_file", imageFile);
  } else if (imageUrl) {
    formData.append("image_url", imageUrl);
  }

  formData.append("extra_images", JSON.stringify(extraImages));

  const method = editingProductId ? "PUT" : "POST";
  const url = editingProductId ? `/api/products/${editingProductId}` : "/api/products";

  try {
    const response = await fetch(url, { method, body: formData });
    if (response.ok) {
      console.log("Product saved successfully");
      hideProductForm();
      loadProducts();
      editingProductId = null;
    } else {
      const errorResponse = await response.json();
      console.error("Failed to save product:", errorResponse.message || errorResponse);
      alert("Failed to save product. Check console for details.");
    }
  } catch (error) {
    console.error("Error saving product:", error);
  }
}

  
  export async function editProduct(id) {
    console.log(`Editing product with ID: ${id}`);
    try {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const product = await response.json();

      document.getElementById("form-title").innerText = "Edit Product";
      document.getElementById("product-name").value = product.name;
      document.getElementById("product-original-price").value = product.original_price;
      document.getElementById("product-discounted-price").value = product.discounted_price || "";
      document.getElementById("product-category").value = product.category;
      document.getElementById("product-description").value = product.description;
      document.getElementById("product-stock").value = product.stock;
      document.getElementById("product-image-url").value = product.image_url || "";
      document.getElementById("product-extra-images").value = (product.additional_images || []).join(", ");
      document.getElementById("product-form-container").style.display = "block";
      editingProductId = id;
    } catch (error) {
      console.error("Error loading product data:", error);
      alert("Failed to load product data. Please check if the product exists.");
    }
}

  
export async function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
        loadProducts();
    }
}

export function initProductEvents() {
    document.querySelector(".add-product-btn").addEventListener("click", showAddProductForm);
    document.getElementById("product-form").addEventListener("submit", submitProductForm);
    document.getElementById("cancel-btn").addEventListener("click", hideProductForm);
    loadProducts();
}
