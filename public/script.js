// script.js
document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const catalogContainer = document.getElementById('items');
  const dressSelect = document.getElementById('dressSelect');
  const orderForm = document.getElementById('orderForm');
  const messageEl = document.getElementById('message');
  const viewOrdersBtn = document.getElementById('viewOrdersBtn');
  const ordersList = document.getElementById('ordersList');
  const ordersSection = document.getElementById('ordersListSection');
  const closeOrdersBtn = document.getElementById('closeOrders');

  // Optional user login info
  const userEmail = localStorage.getItem('userEmail') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const adminToken = isAdmin ? localStorage.getItem('adminToken') : null;

  // --- Fetch catalog from server ---
  async function fetchCatalog() {
    try {
      const resp = await fetch('/api/catalog');
      const data = await resp.json();
      renderCatalog(data);
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
      catalogContainer.innerHTML = '<p style="color:red">Failed to load catalog</p>';
    }
  }

  // --- Render catalog cards and dropdown ---
  function renderCatalog(catalog) {
    catalogContainer.innerHTML = '';
    dressSelect.innerHTML = '';

    catalog.forEach(item => {
      // Card for display
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${item.img}" alt="${item.title}" />
        <div class="title">${item.title}</div>
        <div class="desc">${item.desc}</div>
        <div class="price">₹ ${item.price.toLocaleString()}</div>
        <div style="margin-top:5px;">
          <button data-id="${item.id}" class="selectBtn">Select</button>
        </div>
      `;
      catalogContainer.appendChild(card);

      // Option for select dropdown
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.title} — ₹${item.price}`;
      dressSelect.appendChild(opt);
    });
  }

  // --- Handle "Select" button in catalog ---
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.selectBtn');
    if (!btn) return;
    dressSelect.value = btn.dataset.id;
    dressSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // --- Submit order ---
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(orderForm);
    const data = Object.fromEntries(formData.entries());

    // Add optional user email
    if (userEmail) data.email = userEmail;

    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Order failed');

      messageEl.style.color = 'green';
      messageEl.textContent = `Order placed successfully! Order ID: ${result.order.id}`;
      orderForm.reset();
    } catch (err) {
      messageEl.style.color = 'red';
      messageEl.textContent = err.message;
    }

    setTimeout(() => { messageEl.textContent = ''; }, 5000);
  });

  // --- Fetch and display orders ---
  async function fetchOrders() {
    try {
      let url = '/api/orders';
      const headers = {};
      if (isAdmin) headers['x-admin-token'] = adminToken;
      else if (userEmail) url += `?email=${encodeURIComponent(userEmail)}`;

      const resp = await fetch(url, { headers });
      const orders = await resp.json();
      if (!resp.ok) throw new Error(orders.error || 'Failed to load orders');
      renderOrders(orders);
    } catch (err) {
      messageEl.style.color = 'red';
      messageEl.textContent = err.message;
    }
  }

  // --- Render orders ---
  function renderOrders(orders) {
    ordersList.innerHTML = '';
    if (!orders.length) {
      ordersList.innerHTML = '<em>No orders yet.</em>';
      ordersSection.classList.remove('hidden');
      return;
    }

    orders.slice().reverse().forEach(o => {
      const div = document.createElement('div');
      div.className = 'orderItem';
      div.innerHTML = `
        <div><strong>${o.name}</strong> — ${o.phone} — <small>${new Date(o.createdAt).toLocaleString()}</small></div>
        <div>${o.dressId} | Size: ${o.size} | Qty: ${o.quantity} | Status: ${o.status}</div>
        <div>Address: ${o.address}</div>
        ${o.notes ? `<div>Notes: ${o.notes}</div>` : ''}
        <div style="margin-top:4px;">
          ${canCancel(o) ? `<button class="cancelBtn" data-id="${o.id}">Cancel</button>` : ''}
          ${isAdmin ? `<button class="completeBtn" data-id="${o.id}">Mark Completed</button>` : ''}
        </div>
      `;
      ordersList.appendChild(div);
    });
    ordersSection.classList.remove('hidden');
  }

  // --- Determine if user/admin can cancel order ---
  function canCancel(order) {
    if (isAdmin) return order.status !== 'cancelled';
    return (userEmail && order.email === userEmail && order.status !== 'cancelled');
  }

  // --- Handle order buttons ---
  document.addEventListener('click', async (e) => {
    const cancelBtn = e.target.closest('.cancelBtn');
    const completeBtn = e.target.closest('.completeBtn');

    if (cancelBtn) {
      const id = cancelBtn.dataset.id;
      const body = {};
      if (!isAdmin) body.email = userEmail;

      try {
        const resp = await fetch(`/api/orders/${id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
          body: JSON.stringify(body)
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Cancel failed');
        fetchOrders();
        messageEl.style.color = 'green';
        messageEl.textContent = `Order ${id} cancelled successfully.`;
      } catch (err) {
        messageEl.style.color = 'red';
        messageEl.textContent = err.message;
      }
      setTimeout(() => { messageEl.textContent = ''; }, 5000);
    }

    if (completeBtn && isAdmin) {
      const id = completeBtn.dataset.id;
      try {
        const resp = await fetch(`/api/orders/${id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ status: 'completed' })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Status update failed');
        fetchOrders();
        messageEl.style.color = 'green';
        messageEl.textContent = `Order ${id} marked as completed.`;
      } catch (err) {
        messageEl.style.color = 'red';
        messageEl.textContent = err.message;
      }
      setTimeout(() => { messageEl.textContent = ''; }, 5000);
    }
  });

  // --- View orders button ---
  viewOrdersBtn?.addEventListener('click', fetchOrders);
  closeOrdersBtn?.addEventListener('click', () => ordersSection.classList.add('hidden'));

  // Initial catalog load
  fetchCatalog();
});