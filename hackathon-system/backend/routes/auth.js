const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Judge = require('../models/Judge');
const { protectAdmin, protectSuperAdmin } = require('../middleware/auth');

const generateToken = (id, type) => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// POST /api/auth/admin/login
router.post('/admin/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = generateToken(admin._id, 'admin');
    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/judge/login
router.post('/judge/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const judge = await Judge.findOne({ email }).select('+password');
    if (!judge || !(await judge.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!judge.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    const token = generateToken(judge._id, 'judge');
    res.json({
      success: true,
      message: 'Login successful',
      token,
      judge: { id: judge._id, name: judge.name, email: judge.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/judge/create  (admin only)
router.post('/judge/create', protectAdmin, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('expertise').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const { name, email, password, expertise } = req.body;
    const existing = await Judge.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Judge with this email already exists.' });
    }
    const judge = await Judge.create({ name, email, password, expertise });
    res.status(201).json({ success: true, message: 'Judge created successfully', judge: { id: judge._id, name, email } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;
    if (decoded.type === 'admin') {
      user = await Admin.findById(decoded.id).select('-password');
    } else if (decoded.type === 'judge') {
      user = await Judge.findById(decoded.id).select('-password');
    }
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user, type: decoded.type });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
