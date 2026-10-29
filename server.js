require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb, writeDb, resetDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// --- HEALTH CHECK ENDPOINT ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'smart-pos-ledger-calculator',
    timestamp: new Date().toISOString()
  });
});

// --- SHOP SETTINGS ENDPOINTS ---
app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json(db.settings || { shopName: 'Chamundeshwari Provision Store', theme: 'light' });
});

app.put('/api/settings', (req, res) => {
  const db = readDb();
  const { shopName, theme } = req.body || {};
  db.settings = {
    shopName: typeof shopName === 'string' && shopName.trim() ? shopName.trim() : (db.settings?.shopName || 'Smart Ledger POS'),
    theme: ['light', 'dark', 'retro', 'cyber'].includes(theme) ? theme : (db.settings?.theme || 'light')
  };
  writeDb(db);
  res.json(db.settings);
});

// --- TRANSACTIONS ENDPOINTS ---
app.get('/api/transactions', (req, res) => {
  const db = readDb();
  let list = Array.isArray(db.transactions) ? db.transactions : [];
  const { type, paymentMode, search } = req.query;

  if (type && type !== 'ALL') {
    list = list.filter((tx) => tx.type === type);
  }
  if (paymentMode && paymentMode !== 'ALL') {
    list = list.filter((tx) => tx.paymentMode === paymentMode);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((tx) =>
      `${tx.customerName} ${tx.phone} ${tx.note} ${tx.paymentMode}`.toLowerCase().includes(q)
    );
  }

  res.json({ count: list.length, transactions: list });
});

app.post('/api/transactions', (req, res) => {
  const { id, customerName, phone, type, paymentMode, amount, expression, itemCount, note, timestamp } = req.body || {};
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive amount is required' });
  }
  if (!customerName && !phone) {
    return res.status(400).json({ error: 'Customer name or phone number is required' });
  }

  const db = readDb();
  const newTx = {
    id: id || `tx-${Date.now()}`,
    customerName: (customerName || 'Walk-in Customer').trim(),
    phone: (phone || '—').trim(),
    type: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
    paymentMode: ['UPI', 'Cash', 'Card'].includes(paymentMode) ? paymentMode : 'UPI',
    amount: Math.round(numericAmount * 100) / 100,
    expression: expression || String(numericAmount),
    itemCount: Number(itemCount) || 1,
    note: note || (type === 'DEBIT' ? 'Customer Udhaar / Due' : 'Store Purchase'),
    timestamp: timestamp || new Date().toLocaleString('en-IN')
  };

  db.transactions = [newTx, ...(db.transactions || [])];
  writeDb(db);
  res.status(201).json(newTx);
});

app.delete('/api/transactions/:id', (req, res) => {
  const txId = req.params.id;
  const db = readDb();
  const beforeCount = (db.transactions || []).length;
  db.transactions = (db.transactions || []).filter((tx) => tx.id !== txId);
  writeDb(db);
  res.json({ deleted: beforeCount - db.transactions.length, remaining: db.transactions.length });
});

app.delete('/api/transactions', (req, res) => {
  const restoreSample = req.query.restoreSample === 'true';
  const updated = resetDb(restoreSample);
  res.json({ status: 'ok', transactions: updated.transactions });
});

// --- COLLECTIONS & KHATA SUMMARY ENDPOINT ---
app.get('/api/summary', (req, res) => {
  const db = readDb();
  const list = Array.isArray(db.transactions) ? db.transactions : [];
  let totalCredit = 0;
  let totalDebit = 0;
  const byMode = { UPI: 0, Cash: 0, Card: 0 };

  list.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'CREDIT') {
      totalCredit += amt;
      byMode[tx.paymentMode] = (byMode[tx.paymentMode] || 0) + amt;
    } else {
      totalDebit += amt;
    }
  });

  res.json({
    shopName: db.settings?.shopName || 'Smart Ledger POS',
    totalCollection: totalCredit,
    totalCredit,
    totalDebit,
    netBalance: totalCredit - totalDebit,
    collectionByMode: byMode,
    transactionCount: list.length
  });
});

// SPA Fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart POS & Customer Ledger Server running on http://localhost:${PORT}`);
});
