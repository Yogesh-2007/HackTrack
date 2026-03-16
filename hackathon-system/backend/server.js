const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Rate Limiting ──────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});

const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, message: 'Scan rate limit exceeded.' }
});

app.use(globalLimiter);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploaded IDs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── Database Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hackathon_db')
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    // Seed admin on first run
    require('./utils/seedAdmin')();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authLimiter, require('./routes/auth'));
app.use('/api/participants',              require('./routes/participants'));
app.use('/api/admin',                    require('./routes/admin'));
app.use('/api/verification',             require('./routes/verification'));
app.use('/api/qr',          scanLimiter, require('./routes/qr'));
app.use('/api/judges',                   require('./routes/judges'));
app.use('/api/leaderboard',              require('./routes/leaderboard'));

// ── Serve Frontend Pages ───────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  }
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ── Start Server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Hackathon Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`📷 Scanner:     http://localhost:${PORT}/scanner.html`);
  console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
});

module.exports = app;
