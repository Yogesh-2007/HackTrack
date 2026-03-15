const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Score = require('../models/Score');
const Participant = require('../models/Participant');
const Judge = require('../models/Judge');
const { protectJudge, protectAdmin } = require('../middleware/auth');

// GET /api/judges/teams
// Judge views all checked-in teams available for scoring
router.get('/teams', protectJudge, async (req, res) => {
  try {
    const teams = await Participant.find({ status: 'approved', checkedIn: true })
      .select('name registrationId teamName projectTitle college _id');

    // Get already-scored participants by this judge
    const scoredIds = (await Score.find({ judge: req.judge._id }).select('participant'))
      .map(s => s.participant.toString());

    const teamsWithStatus = teams.map(t => ({
      ...t.toObject(),
      alreadyScored: scoredIds.includes(t._id.toString())
    }));

    res.json({ success: true, data: teamsWithStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/judges/score
// Submit score for a participant/team
router.post('/score', protectJudge, [
  body('participantId').notEmpty(),
  body('innovation').isFloat({ min: 0, max: 10 }),
  body('technicalComplexity').isFloat({ min: 0, max: 10 }),
  body('presentation').isFloat({ min: 0, max: 10 }),
  body('feedback').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { participantId, innovation, technicalComplexity, presentation, feasibility, impact, feedback } = req.body;

    const participant = await Participant.findById(participantId);
    if (!participant) return res.status(404).json({ success: false, message: 'Participant not found.' });

    // Check if already scored
    const existing = await Score.findOne({ participant: participantId, judge: req.judge._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already scored this team. Use update endpoint.' });
    }

    const score = await Score.create({
      participant: participantId,
      judge: req.judge._id,
      teamName: participant.teamName,
      projectTitle: participant.projectTitle,
      innovation,
      technicalComplexity,
      presentation,
      feasibility: feasibility !== undefined ? feasibility : null,
      impact: impact !== undefined ? impact : null,
      feedback
    });

    res.status(201).json({ success: true, message: 'Score submitted successfully.', score });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Score already submitted for this participant.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/judges/score/:participantId
// Update score
router.put('/score/:participantId', protectJudge, [
  body('innovation').optional().isFloat({ min: 0, max: 10 }),
  body('technicalComplexity').optional().isFloat({ min: 0, max: 10 }),
  body('presentation').optional().isFloat({ min: 0, max: 10 }),
], async (req, res) => {
  try {
    const score = await Score.findOne({ participant: req.params.participantId, judge: req.judge._id });
    if (!score) return res.status(404).json({ success: false, message: 'Score not found.' });

    const updateFields = ['innovation', 'technicalComplexity', 'presentation', 'feasibility', 'impact', 'feedback'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) score[field] = req.body[field];
    });

    await score.save();
    res.json({ success: true, message: 'Score updated.', score });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/judges/my-scores
// Judge sees all their own submitted scores
router.get('/my-scores', protectJudge, async (req, res) => {
  try {
    const scores = await Score.find({ judge: req.judge._id })
      .populate('participant', 'name registrationId teamName projectTitle')
      .sort({ submittedAt: -1 });
    res.json({ success: true, data: scores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/judges/list  (admin only)
router.get('/list', protectAdmin, async (req, res) => {
  try {
    const judges = await Judge.find().select('-password');
    res.json({ success: true, data: judges });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/judges/submit-score  (alias, same as /score)
router.post('/submit-score', protectJudge, async (req, res) => {
  req.url = '/score';
  router.handle(req, res);
});

module.exports = router;
