const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const EntryLog = require('../models/EntryLog');
const Score = require('../models/Score');
const Judge = require('../models/Judge');
const { protectAdmin } = require('../middleware/auth');
const { generateParticipantQR } = require('../utils/qrUtils');

// All admin routes are protected
router.use(protectAdmin);

// GET /api/admin/participants
// Get all participants with optional filters
router.get('/participants', async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search } = req.query;
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } },
        { registrationId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Participant.countDocuments(query);
    const participants = await Participant.find(query)
      .select('-qrCode.token')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), data: participants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/approve/:id
// Approve participant and generate QR code
router.post('/approve/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }
    if (participant.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Participant is already approved.' });
    }

    // Generate QR
    const qrData = await generateParticipantQR(participant);

    participant.status = 'approved';
    participant.approvedBy = req.admin._id;
    participant.approvedAt = new Date();
    participant.qrCode = qrData;

    await participant.save();

    res.json({
      success: true,
      message: `Participant ${participant.name} approved and QR generated.`,
      data: {
        registrationId: participant.registrationId,
        name: participant.name,
        qrExpiresAt: qrData.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/reject/:id
router.post('/reject/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    participant.status = 'rejected';
    participant.rejectionReason = reason || 'Not specified';
    await participant.save();

    res.json({ success: true, message: `Participant ${participant.name} rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/bulk-approve
// Approve all pending participants at once
router.post('/bulk-approve', async (req, res) => {
  try {
    const pending = await Participant.find({ status: 'pending' });
    let approved = 0;

    for (const participant of pending) {
      const qrData = await generateParticipantQR(participant);
      participant.status = 'approved';
      participant.approvedBy = req.admin._id;
      participant.approvedAt = new Date();
      participant.qrCode = qrData;
      await participant.save();
      approved++;
    }

    res.json({ success: true, message: `${approved} participants approved.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/stats
// Live dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, approved, rejected, checkedIn, entryLogs, judges] = await Promise.all([
      Participant.countDocuments(),
      Participant.countDocuments({ status: 'pending' }),
      Participant.countDocuments({ status: 'approved' }),
      Participant.countDocuments({ status: 'rejected' }),
      Participant.countDocuments({ checkedIn: true }),
      EntryLog.countDocuments({ action: 'checkin', success: true }),
      Judge.countDocuments({ isActive: true })
    ]);

    // Recent check-ins (last 10)
    const recentCheckIns = await EntryLog.find({ action: 'checkin', success: true })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('participantName registrationId timestamp scannedBy');

    res.json({
      success: true,
      stats: { total, pending, approved, rejected, checkedIn, judges },
      recentCheckIns
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/entry-logs
router.get('/entry-logs', async (req, res) => {
  try {
    const logs = await EntryLog.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/participant/:id
router.get('/participant/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id).select('-qrCode.token');
    if (!participant) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: participant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/regenerate-qr/:id
router.post('/regenerate-qr/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant || participant.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Participant not found or not approved.' });
    }
    const qrData = await generateParticipantQR(participant);
    participant.qrCode = qrData;
    await participant.save();
    res.json({ success: true, message: 'QR regenerated.', qrExpiresAt: qrData.expiresAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
