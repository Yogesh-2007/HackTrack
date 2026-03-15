const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const EntryLog = require('../models/EntryLog');
const { validateQRToken } = require('../utils/qrUtils');
const { protectAdmin } = require('../middleware/auth');

// POST /api/qr/scan
// Volunteer scans a QR code - validates and checks in the participant
router.post('/scan', async (req, res) => {
  const { token, scannedBy = 'Volunteer' } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'QR token is required.' });
  }

  // 1. Validate token
  const validation = validateQRToken(token);

  if (!validation.valid) {
    // Log invalid scan
    return res.status(400).json({
      success: false,
      type: validation.reason,
      message: validation.message
    });
  }

  const { payload } = validation;

  try {
    // 2. Fetch participant
    const participant = await Participant.findById(payload.participantId);

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found in database.' });
    }

    // 3. Check participant is approved
    if (participant.status !== 'approved') {
      return res.status(403).json({
        success: false,
        type: 'not_approved',
        message: `Participant is ${participant.status}. Entry not allowed.`
      });
    }

    // 4. Duplicate scan check
    if (participant.checkedIn) {
      await EntryLog.create({
        participant: participant._id,
        registrationId: participant.registrationId,
        participantName: participant.name,
        action: 'duplicate_scan',
        success: false,
        scannedBy,
        ipAddress: req.ip,
        message: `Already checked in at ${participant.checkedInAt}`
      });

      return res.status(409).json({
        success: false,
        type: 'duplicate',
        message: `${participant.name} has already checked in at ${new Date(participant.checkedInAt).toLocaleTimeString()}.`,
        checkedInAt: participant.checkedInAt
      });
    }

    // 5. Mark as checked in
    participant.checkedIn = true;
    participant.checkedInAt = new Date();
    participant.checkedInBy = scannedBy;
    await participant.save();

    // 6. Log the entry
    await EntryLog.create({
      participant: participant._id,
      registrationId: participant.registrationId,
      participantName: participant.name,
      action: 'checkin',
      success: true,
      scannedBy,
      ipAddress: req.ip,
      message: 'Successful entry'
    });

    res.json({
      success: true,
      type: 'checkin',
      message: `✅ Welcome, ${participant.name}!`,
      data: {
        name: participant.name,
        registrationId: participant.registrationId,
        college: participant.college,
        teamName: participant.teamName,
        checkedInAt: participant.checkedInAt
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/qr/verify/:token
// Quick token verification without check-in (preview)
router.get('/verify/:token', async (req, res) => {
  const validation = validateQRToken(req.params.token);
  if (!validation.valid) {
    return res.status(400).json({ success: false, ...validation });
  }
  try {
    const participant = await Participant.findById(validation.payload.participantId)
      .select('name registrationId college teamName status checkedIn');
    if (!participant) return res.status(404).json({ success: false, message: 'Participant not found.' });
    res.json({ success: true, participant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
