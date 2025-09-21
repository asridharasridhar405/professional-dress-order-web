// Admin actions: login (password SRIDHAR_35), fetch orders, edit, cancel, mark completed
const ADMIN_TOKEN_KEY = 'adminToken';

function $a(sel) { return document.querySelector(sel); }
async function adminApi(url, opts = {}) {
  opts.headers = opts.headers || {};
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) opts.headers['x-admin-token'] = token;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error: res.statusText }));
    throw new Error(err.error || res.statusText || 'Request failed');
  }
  return res.json();
}

document.addEventListener('DOMContentLoaded', () => {
  $a('#adminLoginBtn').addEventListener('click', adminLogin);
  $a('#logoutBtn').addEventListener('click', adminLogout);

  // if token exists, auto load
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    showAdminPanel();
    loadOrders();
  }
});

async function adminLogin() {
  const pass = $a('#adminPass').value;
  if (!pass) return ($a('#adminMsg').textContent = 'Enter password');
  try {
    const res = await adminApi('/api/admin/login', { method: 'POST', body: { password: pass } });
    localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
    $a('#adminMsg').textContent = 'Logged in';
    showAdminPanel();
    await loadOrders();
    $a('#logoutBtn').classList.remove('hidden');
  } catch (err) {
    $a('#adminMsg').textContent = 'Login failed: ' + err.message;
  }
}

function adminLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  $a('#ordersContainer').classList.add('hidden');
  $a('#adminLogin').classList.remove('hidden');
  $a('#logoutBtn').classList.add('hidden');
  $a('#adminMsg').textContent = '';
  $a('#ordersList').innerHTML = '';
}

function showAdminPanel() {
  $a('#adminLogin').classList.add('hidden');
  $a('#ordersContainer').classList.remove('hidden');
}

async function loadOrders() {
  try {
    const orders = await adminApi('/api/orders');
    renderOrders(orders);
  } catch (err) {
    $a('#adminMsg').textContent = 'Failed to load orders: ' + err.message;
    adminLogout();
  }
}

function renderOrders(orders) {
  const wrap = $a('#ordersList');
  wrap.innerHTML = '';
  if (!orders.length) wrap.innerHTML = '<div>No orders yet</div>';
  orders.slice().reverse().forEach(o => {
    const box = document.createElement('div');
    box.className = 'orderBox';
    box.innerHTML = `
      <div><strong>${o.name}</strong> — ${o.phone} — <small>${new Date(o.createdAt).toLocaleString()}</small></div>
      <div class="meta">Order ID: ${o.id}</div>
      <div style="margin-top:8px">
        <label>Name <input data-field="name" value="${escapeHtml(o.name)}" /></label>
        <label>Phone <input data-field="phone" value="${escapeHtml(o.phone)}" /></label>
        <label>Email <input data-field="email" value="${escapeHtml(o.email||'')}" /></label>
        <label>Address <input data-field="address" value="${escapeHtml(o.address)}" /></label>
        <label>Dress ID <input data-field="dressId" value="${escapeHtml(o.dressId)}" /></label>
        <label>Size <input data-field="size" value="${escapeHtml(o.size)}" /></label>
        <label>Quantity <input data-field="quantity" type="number" value="${o.quantity}" /></label>
        <label>Notes <input data-field="notes" value="${escapeHtml(o.notes||'')}" /></label>
        <label>Status
          <select data-field="status">
            <option ${o.status==='received'?'selected':''}>received</option>
            <option ${o.status==='completed'?'selected':''}>completed</option>
            <option ${o.status==='cancelled'?'selected':''}>cancelled</option>
          </select>
        </label>
      </div>
      <div class="order-actions">
        <button data-action="save" data-id="${o.id}">Save</button>
        <button data-action="complete" data-id="${o.id}">Mark Completed</button>
        <button data-action="cancel" data-id="${o.id}">Cancel</button>
      </div>
    `;
    // events
    box.querySelector('[data-action="save"]').addEventListener('click', async (ev) => {
      const id = ev.target.dataset.id;
      const inputs = box.querySelectorAll('[data-field]');
      const body = {};
      inputs.forEach(inp => {
        const key = inp.dataset.field;
        const val = inp.value;
        body[key] = val;
      });
      try {
        await adminApi('/api/orders/' + id + '/edit', { method: 'POST', body });
        alert('Saved');
        loadOrders();
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    });
    box.querySelector('[data-action="complete"]').addEventListener('click', async (ev) => {
      const id = ev.target.dataset.id;
      if (!confirm('Mark order as completed?')) return;
      try {
        await adminApi('/api/orders/' + id + '/status', { method: 'POST', body: { status: 'completed' } });
        alert('Marked completed');
        loadOrders();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    });
    box.querySelector('[data-action="cancel"]').addEventListener('click', async (ev) => {
      const id = ev.target.dataset.id;
      if (!confirm('Cancel this order?')) return;
      try {
        await adminApi('/api/orders/' + id + '/cancel', { method: 'POST' });
        alert('Cancelled');
        loadOrders();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    });

    wrap.appendChild(box);
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}