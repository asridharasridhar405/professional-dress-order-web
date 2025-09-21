// fetch catalog from server and render; handle placing orders and user order cancellation

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error: 'Network error' }));
    throw new Error(err.error || res.statusText || 'Request failed');
  }
  return res.json();
}

function $(sel) { return document.querySelector(sel); }

let catalog = [];

async function loadCatalog() {
  try {
    catalog = await apiFetch('/api/catalog');
    renderCatalog();
    populateSelect();
  } catch (err) {
    console.error('Catalog load error', err);
    $('#items').innerHTML = '<div class="card">Failed to load catalog</div>';
  }
}

function renderCatalog() {
  const container = $('#items');
  container.innerHTML = '';
  catalog.forEach(item => {
    const el = document.createElement('div');
    el.className = 'product card';
    el.innerHTML = `
      <img src="${item.img}" alt="${item.title}" />
      <div class="title">${item.title}</div>
      <div class="meta">${item.desc || ''}</div>
      <div class="price">₹ ${Number(item.price).toLocaleString()}</div>
      <div class="actions">
        <button data-id="${item.id}" class="selectBtn">Select</button>
      </div>
    `;
    container.appendChild(el);
  });
}

function populateSelect() {
  const sel = $('#dressSelect');
  sel.innerHTML = '';
  catalog.forEach(it => {
    const o = document.createElement('option');
    o.value = it.id;
    o.textContent = `${it.title} — ₹ ${it.price}`;
    sel.appendChild(o);
  });
}

// prefill email if user visited from login
function prefillEmail() {
  const stored = localStorage.getItem('userEmail');
  if (stored) {
    $('#orderEmail').value = stored;
    $('#welcomeInfo').textContent = `Hello, ${stored}`;
    $('#loginBtn').textContent = 'Change Email';
  } else {
    $('#welcomeInfo').textContent = '';
    $('#loginBtn').textContent = 'Login';
  }
}

// select button behavior
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.selectBtn');
  if (!btn) return;
  const id = btn.dataset.id;
  $('#dressSelect').value = id;
  window.scrollTo({ top: 300, behavior: 'smooth' });
});

document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  prefillEmail();

  $('#loginBtn').addEventListener('click', () => {
    location.href = '/login.html';
  });

  $('#orderForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // basic validation already present by HTML, but double-check:
    if (!data.name || !data.phone || !data.address || !data.dressId || !data.size || !data.quantity || !data.email) {
      showMessage('Please fill all required fields', false);
      return;
    }

    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      showMessage('Order placed! ID: ' + res.order.id, true);
      // save email locally for convenience
      localStorage.setItem('userEmail', data.email.toLowerCase());
      prefillEmail();
      form.reset();
    } catch (err) {
      showMessage(err.message || 'Order failed', false);
    }
  });

  $('#myOrdersBtn').addEventListener('click', async () => {
    await showMyOrders();
  });

  $('#closeMyOrders').addEventListener('click', () => {
    $('#myOrdersPanel').classList.add('hidden');
  });
});

function showMessage(msg, ok=true) {
  const el = $('#message');
  el.style.color = ok ? 'green' : 'crimson';
  el.textContent = msg;
  setTimeout(()=>{ el.textContent = ''; }, 6000);
}

async function showMyOrders() {
  const stored = localStorage.getItem('userEmail');
  let email = stored;
  if (!email) {
    email = prompt('Enter the email you used for orders:');
    if (!email) return alert('Email required to view orders');
    localStorage.setItem('userEmail', email.toLowerCase());
  }
  try {
    const orders = await apiFetch('/api/orders?email=' + encodeURIComponent(email));
    const wrap = $('#myOrdersList');
    wrap.innerHTML = '';
    if (!orders.length) wrap.innerHTML = '<div>No orders found.</div>';
    orders.slice().reverse().forEach(o => {
      const div = document.createElement('div');
      div.className = 'orderRow';
      div.innerHTML = `
        <div><strong>${o.name}</strong> — ${o.phone} — <small>${new Date(o.createdAt).toLocaleString()}</small></div>
        <div class="meta">Item: ${o.dressId} | Size: ${o.size} | Qty: ${o.quantity} | Status: ${o.status}</div>
        <div>${o.address}</div>
      `;
      if (o.notes) div.innerHTML += `<div>Notes: ${o.notes}</div>`;
      if (o.status === 'received') {
        const btn = document.createElement('button');
        btn.textContent = 'Cancel Order';
        btn.style.marginTop = '8px';
        btn.addEventListener('click', async () => {
          if (!confirm('Cancel this order?')) return;
          try {
            await apiFetch('/api/orders/' + o.id + '/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            showMessage('Order cancelled');
            showMyOrders(); // refresh
          } catch (err) {
            showMessage(err.message, false);
          }
        });
        div.appendChild(btn);
      } else {
        div.innerHTML += `<div class="meta">Updated: ${o.updatedAt || '—'}</div>`;
      }
      wrap.appendChild(div);
    });
    $('#myOrdersPanel').classList.remove('hidden');
  } catch (err) {
    showMessage(err.message || 'Failed to load orders', false);
  }
}