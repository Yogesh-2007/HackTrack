const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const { protectAdmin } = require('../middleware/auth');
const { verifyParticipantID, getApprovalAction } = require('../utils/idVerificationAgent');
const { generateParticipantQR } = require('../utils/qrUtils');

// All verification routes are admin-protected
router.use(protectAdmin);

// GET /api/verification/status/:id
// Get detailed AI verification results for a participant
router.get('/status/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id)
      .select('name email registrationId college phone idProof idVerification status');
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }
    res.json({
      success: true,
      data: {
        registrationId: participant.registrationId,
        name: participant.name,
        email: participant.email,
        college: participant.college,
        status: participant.status,
        idProof: participant.idProof,
        verification: participant.idVerification || { status: 'pending', score: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/verification/re-verify/:id
// Re-run AI verification on a participant
router.post('/re-verify/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    if (!participant.idProof?.path) {
      return res.status(400).json({ success: false, message: 'No ID proof uploaded for this participant.' });
    }

    console.log(`🔄 Admin re-verification requested for ${participant.registrationId}`);
    const verificationResult = await verifyParticipantID(participant);
    participant.idVerification = verificationResult;
    await participant.save();

    res.json({
      success: true,
      message: `Re-verification complete. Score: ${verificationResult.score}/100 — ${verificationResult.status}`,
      data: {
        verification: verificationResult,
        suggestedAction: getApprovalAction(verificationResult)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/verification/override/:id
// Admin manually overrides AI verification decision
router.post('/override/:id', async (req, res) => {
  try {
    const { action, reason } = req.body; // action = 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    // Update verification to mark manual override
    participant.idVerification = {
      ...participant.idVerification?.toObject?.() || participant.idVerification || {},
      method: 'manual_admin',
      status: action === 'approve' ? 'verified' : 'failed',
      reasoning: `Admin override: ${reason || 'No reason provided'}. Original AI score: ${participant.idVerification?.score || 'N/A'}`,
      verifiedAt: new Date()
    };

    if (action === 'approve') {
      const qrData = await generateParticipantQR(participant);
      participant.status = 'approved';
      participant.approvedBy = req.admin._id;
      participant.approvedAt = new Date();
      participant.qrCode = qrData;
    } else {
      participant.status = 'rejected';
      participant.rejectionReason = reason || 'Rejected by admin (override)';
    }

    await participant.save();

    res.json({
      success: true,
      message: `Participant ${participant.name} ${action === 'approve' ? 'approved' : 'rejected'} (admin override).`,
      data: {
        registrationId: participant.registrationId,
        name: participant.name,
        status: participant.status
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/verification/stats
// Get AI verification statistics
router.get('/stats', async (req, res) => {
  try {
    const [verified, failed, manualReview, pending, totalWithProof] = await Promise.all([
      Participant.countDocuments({ 'idVerification.status': 'verified' }),
      Participant.countDocuments({ 'idVerification.status': 'failed' }),
      Participant.countDocuments({ 'idVerification.status': 'manual_review' }),
      Participant.countDocuments({ 'idVerification.status': 'pending' }),
      Participant.countDocuments({ 'idProof.path': { $exists: true } })
    ]);

    // Average verification score
    const avgScoreResult = await Participant.aggregate([
      { $match: { 'idVerification.score': { $gt: 0 } } },
      { $group: { _id: null, avgScore: { $avg: '$idVerification.score' } } }
    ]);

    res.json({
      success: true,
      stats: {
        verified,
        failed,
        manualReview,
        pending,
        totalWithProof,
        averageScore: Math.round(avgScoreResult[0]?.avgScore || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
