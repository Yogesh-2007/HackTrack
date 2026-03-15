const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Participant = require('../models/Participant');
const upload = require('../middleware/upload');

// POST /api/participants/register
// Public: Register a new participant with ID proof upload
router.post('/register', upload.single('idProof'), [
  body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[6-9]\d{9}$/),
  body('college').trim().notEmpty().isLength({ max: 200 }),
  body('teamName').optional().trim().isLength({ max: 100 }),
  body('projectTitle').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, college, teamName, projectTitle } = req.body;

    // Check duplicate email
    const existing = await Participant.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A participant with this email is already registered.' });
    }

    const participantData = { name, email, phone, college, teamName, projectTitle };

    if (req.file) {
      participantData.idProof = {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        uploadedAt: new Date()
      };
    }

    const participant = await Participant.create(participantData);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for admin approval.',
      data: {
        registrationId: participant.registrationId,
        name: participant.name,
        email: participant.email,
        status: participant.status
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/participants/status/:email
// Public: Participant can check their own status
router.get('/status/:email', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email.toLowerCase() })
      .select('name email registrationId status checkedIn teamName projectTitle qrCode.image qrCode.expiresAt createdAt');

    if (!participant) {
      return res.status(404).json({ success: false, message: 'No registration found for this email.' });
    }

    const responseData = {
      registrationId: participant.registrationId,
      name: participant.name,
      email: participant.email,
      teamName: participant.teamName,
      projectTitle: participant.projectTitle,
      status: participant.status,
      checkedIn: participant.checkedIn,
      registeredAt: participant.createdAt
    };

    // Only send QR if approved and has one
    if (participant.status === 'approved' && participant.qrCode?.image) {
      responseData.qrCode = {
        image: participant.qrCode.image,
        expiresAt: participant.qrCode.expiresAt
      };
    }

    res.json({ success: true, data: responseData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
