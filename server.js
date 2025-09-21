const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = 3000;
const ORDERS_FILE = path.join(__dirname, 'orders.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function readOrders() {
  try {
    const txt = await fs.readFile(ORDERS_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch {
    return [];
  }
}

async function writeOrders(orders) {
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

// Place order
app.post('/api/orders', async (req, res) => {
  try {
    const { name, phone, address, dressId, size, quantity, notes, email } = req.body;
    if (!name || !phone || !address || !dressId || !size || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const orders = await readOrders();
    const newOrder = {
      id: Date.now().toString(),
      name,
      phone,
      email: email || '',
      address,
      dressId,
      size,
      quantity: Number(quantity),
      notes: notes || '',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    orders.push(newOrder);
    await writeOrders(orders);
    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error("❌ Place order error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all orders (admin only)
app.get('/api/orders', async (req, res) => {
  try {
    const { adminKey } = req.query;
    if (adminKey !== 'SRIDHAR_35') return res.status(403).json({ error: 'Forbidden' });
    const orders = await readOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel order (user or admin)
app.post('/api/orders/cancel', async (req, res) => {
  try {
    const { id, email, adminKey } = req.body;
    let orders = await readOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    if (adminKey === 'SRIDHAR_35' || (email && orders[idx].email === email)) {
      orders[idx].status = 'cancelled';
      await writeOrders(orders);
      return res.json({ success: true, order: orders[idx] });
    } else {
      return res.status(403).json({ error: 'Not allowed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status (admin only)
app.post('/api/orders/update', async (req, res) => {
  try {
    const { id, status, adminKey } = req.body;
    if (adminKey !== 'SRIDHAR_35') return res.status(403).json({ error: 'Forbidden' });
    let orders = await readOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    orders[idx].status = status;
    await writeOrders(orders);
    res.json({ success: true, order: orders[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));