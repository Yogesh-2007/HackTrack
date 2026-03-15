const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { protectAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/teamController');

// ── Validation helpers ─────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array(), message: errors.array()[0].msg });
  }
  next();
};

const registerRules = [
  body('teamName').trim().notEmpty().withMessage('Team name is required').isLength({ max: 100 }),
  body('teamLeaderName').trim().notEmpty().withMessage('Leader name is required'),
  body('leaderEmail').isEmail().normalizeEmail().withMessage('Valid leader email is required'),
  body('phoneNumber').matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit phone number'),
  body('collegeName').trim().notEmpty().withMessage('College name is required'),
  body('projectIdea').trim().isLength({ min: 10, max: 1000 }).withMessage('Project idea must be 10–1000 characters'),
  body('teamMembers').isArray({ min: 1, max: 5 }).withMessage('1 to 5 team members required'),
  body('teamMembers.*.name').trim().notEmpty().withMessage('Each member must have a name'),
  body('teamMembers.*.email').isEmail().normalizeEmail().withMessage('Each member must have a valid email'),
];

// ══════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/teams/register
router.post('/register', registerRules, validate, ctrl.registerTeam);

// GET /api/teams/status/:email
router.get('/status/:email', ctrl.getTeamStatus);

// ══════════════════════════════════════════════════════════════
// ADMIN ROUTES  (all require valid admin JWT)
// ══════════════════════════════════════════════════════════════

// GET  /api/admin/teams/stats
router.get('/admin/stats', protectAdmin, ctrl.getTeamStats);

// GET  /api/admin/teams
router.get('/admin', protectAdmin, ctrl.getAllTeams);

// GET  /api/admin/teams/:id
router.get('/admin/:id', protectAdmin, ctrl.getTeamById);

// PUT  /api/admin/teams/:id/approve
router.put('/admin/:id/approve', protectAdmin, ctrl.approveTeam);

// PUT  /api/admin/teams/:id/reject
router.put('/admin/:id/reject', protectAdmin, [
  body('reason').optional().trim().isLength({ max: 500 })
], validate, ctrl.rejectTeam);

// POST /api/admin/teams/bulk-approve
router.post('/admin/bulk-approve', protectAdmin, ctrl.bulkApproveTeams);

module.exports = router;
