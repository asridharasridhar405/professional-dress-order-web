// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Data file for orders ---
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

// --- Admin configuration ---
const ADMIN_PASSWORD = 'SRIDHAR_35';
const ADMIN_TOKEN_EXP_MS = 1000 * 60 * 60; // 1 hour
let adminSessions = {}; // token -> expiry timestamp

// --- Catalog data ---
const catalog = [
  { id: 'dress1', title: 'Floral Summer Dress', price: 1200, img: '/img/floral.jpg', desc: 'Bright floral print, breezy fit.' },
  { id: 'dress2', title: 'Elegant Evening Gown', price: 3500, img: '/img/elegant.jpg', desc: 'Flowy, formal, for special nights.' },
  { id: 'dress3', title: 'Casual Shirt Dress', price: 900, img: '/img/casuals.jpg', desc: 'Comfortable and chic for everyday.' },
  { id: 'dress4', title: 'Denim Midi Dress', price: 1500, img: '/img/denim.jpg', desc: 'Stylish denim with a modern cut.' }
];

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper functions ---
async function readOrders() {
  try {
    const txt = await fs.readFile(ORDERS_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (err) {
    return [];
  }
}

async function writeOrders(orders) {
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function isValidAdminToken(token) {
  if (!token) return false;
  const exp = adminSessions[token];
  if (!exp) return false;
  if (Date.now() > exp) {
    delete adminSessions[token];
    return false;
  }
  return true;
}

// --- API Endpoints ---

// Get catalog
app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

// Admin login → returns token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    adminSessions[token] = Date.now() + ADMIN_TOKEN_EXP_MS;
    return res.json({ token, expiresInMs: ADMIN_TOKEN_EXP_MS });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// Get orders: admin sees all, users only their own
app.get('/api/orders', async (req, res) => {
  const token = req.headers['x-admin-token'];
  const orders = await readOrders();

  if (isValidAdminToken(token)) return res.json(orders);

  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.status(403).json({ error: 'Unauthorized. Provide admin token or ?email=' });
  const filtered = orders.filter(o => (o.email || '').toLowerCase() === email);
  return res.json(filtered);
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    let { name, phone, address, dressId, size, quantity, notes, email } = req.body || {};
    email = email ? String(email).toLowerCase() : '';

    if (!name || !phone || !address || !dressId || !size || !quantity) {
      return res.status(400).json({ error: 'Missing required fields: name, phone, address, dressId, size, quantity.' });
    }

    const orders = await readOrders();
    const id = Date.now().toString() + '-' + crypto.randomBytes(4).toString('hex');
    const newOrder = {
      id,
      name: String(name),
      phone: String(phone),
      address: String(address),
      dressId: String(dressId),
      size: String(size),
      quantity: Number(quantity),
      notes: notes ? String(notes) : '',
      email,
      status: 'received',
      createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    await writeOrders(orders);

    return res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Server error creating order.' });
  }
});

// Cancel order (admin or user)
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const token = req.headers['x-admin-token'];
    const id = req.params.id;
    const orders = await readOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    if (isValidAdminToken(token)) {
      if (orders[idx].status === 'cancelled') return res.json({ order: orders[idx] });
      orders[idx].status = 'cancelled';
      orders[idx].cancelledAt = new Date().toISOString();
      await writeOrders(orders);
      return res.json({ success: true, order: orders[idx] });
    }

    // User cancel: must provide email
    const { email } = req.body || {};
    if (!email || (orders[idx].email || '').toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match order' });
    }
    if (orders[idx].status === 'cancelled') return res.json({ order: orders[idx] });
    orders[idx].status = 'cancelled';
    orders[idx].cancelledAt = new Date().toISOString();
    await writeOrders(orders);
    return res.json({ success: true, order: orders[idx] });
  } catch (err) {
    console.error('Cancel failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin edit order
app.post('/api/orders/:id/edit', async (req, res) => {
  try {
    const token = req.headers['x-admin-token'];
    if (!isValidAdminToken(token)) return res.status(403).json({ error: 'Unauthorized' });

    const id = req.params.id;
    const orders = await readOrders();
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const allowed = ['name','phone','address','dressId','size','quantity','notes','status','email'];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) {
        if (k === 'quantity') order[k] = Number(req.body[k]);
        else order[k] = req.body[k];
      }
    });
    order.updatedAt = new Date().toISOString();
    await writeOrders(orders);
    return res.json({ success: true, order });
  } catch (err) {
    console.error('Edit failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin update status
app.post('/api/orders/:id/status', async (req, res) => {
  try {
    const token = req.headers['x-admin-token'];
    if (!isValidAdminToken(token)) return res.status(403).json({ error: 'Unauthorized' });

    const id = req.params.id;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Missing status' });

    const orders = await readOrders();
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (status === 'completed') order.completedAt = new Date().toISOString();

    await writeOrders(orders);
    return res.json({ success: true, order });
  } catch (err) {
    console.error('Status change failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});