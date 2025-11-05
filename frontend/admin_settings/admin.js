// admin.js

import {
    loadProducts,
    showAddProductForm,
    initProductEvents,
} from "/admin_settings/products.js";

const routes = {
    "/admin/dashboard": "/admin_settings/dashboard.html",
    "/admin/orders": "/admin_settings/orders.html",
    "/admin/products": "/admin_settings/products.html",
    "/admin/users": "/admin_settings/users.html",
    "/admin/members": "/admin_settings/members.html",
    "/admin/404": "/admin_settings/404.html",
};

// Function to handle navigation
async function handleLocation() {
    const path = window.location.pathname;
    const route = routes[path] || routes["/admin/404"];
    console.log("Navigating to:", route);

     // Default /admin/ to /admin/dashboard
  if (path === '/admin/') {
    path = '/admin/dashboard';
  }

    try {
        const html = await fetch(route).then((response) => response.text());
        document.getElementById("app").innerHTML = html;

        // Initialize product-related events when on the products page
        if (path === "/admin/products") {
            initProductEvents(); // Set up events (including loadProducts and form actions)
        }
        if (path === "/admin/users") {
            await loadUsers();
        } else if (path === "/admin/orders") {
            await loadOrders();
        }
         if (path === "/admin/members") {
            await loadMembers();
        }
    } catch (error) {
        console.error("Error loading page:", error);
    }
}



async function loadDashboardMetrics() {
    try {
      const response = await fetch('/api/admin/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics.');
      }
  
      const { totalIncome, recentOrders, topUsers } = await response.json();
  
      // Update Total Income
      document.getElementById('total-income').textContent = `₱${totalIncome.toLocaleString()}`;
  
      // Populate Recent Orders
      const recentOrdersTable = document.querySelector('#recent-orders-table tbody');
      recentOrdersTable.innerHTML = '';
      recentOrders.forEach(order => {
        recentOrdersTable.innerHTML += `
          <tr>
            <td>${order.id}</td>
            <td>${order.user.f_name} ${order.user.l_name}</td>
            <td>₱${order.total_price}</td>
            <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
          </tr>`;
      });
  
      // Populate Top Users
      const topUsersTable = document.querySelector('#top-users-table tbody');
      topUsersTable.innerHTML = '';
      topUsers.forEach(user => {
        topUsersTable.innerHTML += `
          <tr>
            <td>${user.id}</td>
            <td>${user.f_name} ${user.l_name}</td>
            <td>${user.email}</td>
          </tr>`;
      });
  
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    }
  }
  
  document.addEventListener('DOMContentLoaded', loadDashboardMetrics);
  



async function loadUsers() {
    try {
        const response = await fetch("/api/admin/users");
        if (!response.ok) {
            throw new Error("Failed to fetch users.");
        }

        const users = await response.json();
        if (!Array.isArray(users)) {
            throw new Error("Invalid data format from server.");
        }

        const tableBody = document.getElementById("user-table-body");
        tableBody.innerHTML = "";

        users.forEach((user) => {
            tableBody.innerHTML += `
          <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
              <button class="action-btn view">View</button>
              <button class="action-btn edit">Edit</button>
            </td>
          </tr>
        `;
        });
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

async function loadOrders() {
    try {
        const response = await fetch("/api/admin/orders");
        if (!response.ok) {
            throw new Error("Failed to fetch orders.");
        }

        const orders = await response.json();
        const tableBody = document.getElementById("order-table-body");
        tableBody.innerHTML = ""; // Clear previous rows

        orders.forEach((order) => {
            tableBody.innerHTML += `
                <tr>
                    <td>${order.id}</td>
                    <td>${order.user.f_name} ${order.user.l_name} (${order.user.email
                })</td>
                    <td>₱${order.total_price}</td>
                    <td>${new Date(order.created_at).toLocaleDateString()}</td>
                    <td><span class="status ${order.status.toLowerCase()}">${order.status
                }</span></td>
                    <td>
                        <button class="action-btn view" data-order-id="${order.id
                }">View</button>
<button class="action-btn complete" data-order-id="${order.id
                }">Complete</button>
                     


                    </td>
                </tr>
            `;
        });

        attachOrderEvents(); // Attach event listeners
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

async function loadMembers() {
    try {
      const response = await fetch('/api/admin/members');
      if (!response.ok) throw new Error('Failed to fetch members data.');
  
      const members = await response.json();
      const tableBody = document.querySelector('#members-table tbody');
  
      // Clear the table to prevent duplicate data
      tableBody.innerHTML = '';
  
      members.forEach((member) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${member.user.f_name} ${member.user.l_name}</td>
          <td>${member.user.email}</td>
          <td>${member.plan.plan_name} - ₱${member.plan.price}</td>
          <td>${new Date(member.start_date).toLocaleDateString()}</td>
          <td>${new Date(member.expiry_date).toLocaleDateString()}</td>
        `;
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  }
  


function attachOrderEvents() {
    document.querySelectorAll(".action-btn.view").forEach((button) => {
        button.addEventListener("click", (e) => {
            const orderId = e.target.getAttribute("data-order-id");
            viewOrderDetails(orderId);
        });
    });

    document.querySelectorAll('.action-btn.complete').forEach(button => {
        button.addEventListener('click', async (e) => {
            const orderId = e.target.getAttribute('data-order-id');
            await completeOrder(orderId);
            await loadOrders(); // Refresh orders after completion
        });
    });
    
}

async function viewOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch order details.");
        }

        const order = await response.json();

        // Populate modal content
        const modalContent = `
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Customer:</strong> ${order.user.f_name} ${order.user.l_name
            } (${order.user.email})</p>
            <p><strong>Total Amount:</strong> ₱${order.total_price}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Address:</strong> ${order.address || "N/A"}</p>
            <h6>Items:</h6>
            <ul>
                ${order.order_items
                .map(
                    (item) => `
                    <li>${item.product.name} (x${item.quantity}): ₱${item.price}</li>
                `
                )
                .join("")}
            </ul>
        `;

        // Insert the content into the modal body
        document.getElementById("order-details-content").innerHTML = modalContent;

        // Show the modal
        const orderDetailsModal = new bootstrap.Modal(
            document.getElementById("orderDetailsModal")
        );
        orderDetailsModal.show();
    } catch (error) {
        console.error("Error fetching order details:", error);
    }
}

async function completeOrder(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            throw new Error("Failed to complete the order.");
        }

        alert("Order marked as complete!");
        await loadOrders(); // Refresh orders to reflect the updated status
    } catch (error) {
        console.error("Error completing order:", error);
        alert("Error completing the order: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const logoutButton = document.querySelector('.menu a[href="/admin/logout"]');

    logoutButton.addEventListener("click", async (event) => {
        event.preventDefault(); // Prevent default navigation

        try {
            const response = await fetch("/api/logout", { method: "POST" });

            if (response.ok) {
                // Redirect to the login page after successful logout
                window.location.href = "/login";
            } else {
                throw new Error("Failed to log out");
            }
        } catch (error) {
            console.error("Error during logout:", error);
            alert("An error occurred while logging out. Please try again.");
        }
    });
});

// Setup SPA navigation
window.onpopstate = handleLocation;
window.route = (event) => {
    event.preventDefault();
    window.history.pushState({}, "", event.target.href);
    handleLocation();
};

// Initial page load
document.addEventListener("DOMContentLoaded", handleLocation);
