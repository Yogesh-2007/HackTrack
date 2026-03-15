const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Judge = require('../models/Judge');

// ── Protect Admin Routes ───────────────────────────────────────────────────────
const protectAdmin = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Token missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Admin not found or deactivated.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// ── Protect Superadmin-only Routes ────────────────────────────────────────────
const protectSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'superadmin') return next();
  return res.status(403).json({ success: false, message: 'Superadmin access required.' });
};

// ── Protect Judge Routes ───────────────────────────────────────────────────────
const protectJudge = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Token missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'judge') {
      return res.status(403).json({ success: false, message: 'Access denied. Judges only.' });
    }

    const judge = await Judge.findById(decoded.id);
    if (!judge || !judge.isActive) {
      return res.status(401).json({ success: false, message: 'Judge not found or deactivated.' });
    }

    req.judge = judge;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ── Allow Admin OR Judge ───────────────────────────────────────────────────────
const protectAny = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Token missing.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = { protectAdmin, protectSuperAdmin, protectJudge, protectAny };
