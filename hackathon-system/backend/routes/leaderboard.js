const express = require('express');
const router = express.Router();
const Score = require('../models/Score');
const Participant = require('../models/Participant');

// GET /api/leaderboard
// Returns ranked participants by average score across all judges
router.get('/', async (req, res) => {
  try {
    // Aggregate scores per participant
    const scoreAggregation = await Score.aggregate([
      {
        $group: {
          _id: '$participant',
          avgInnovation: { $avg: '$innovation' },
          avgTechnicalComplexity: { $avg: '$technicalComplexity' },
          avgPresentation: { $avg: '$presentation' },
          avgFeasibility: { $avg: '$feasibility' },
          avgImpact: { $avg: '$impact' },
          avgTotal: { $avg: '$totalScore' },
          judgeCount: { $sum: 1 },
          teamName: { $first: '$teamName' },
          projectTitle: { $first: '$projectTitle' }
        }
      },
      { $sort: { avgTotal: -1 } }
    ]);

    // Enrich with participant info
    const leaderboard = [];
    for (let i = 0; i < scoreAggregation.length; i++) {
      const entry = scoreAggregation[i];
      const participant = await Participant.findById(entry._id)
        .select('name registrationId college teamName projectTitle checkedIn');

      if (!participant) continue;

      leaderboard.push({
        rank: i + 1,
        participantId: entry._id,
        name: participant.name,
        registrationId: participant.registrationId,
        college: participant.college,
        teamName: participant.teamName || entry.teamName,
        projectTitle: participant.projectTitle || entry.projectTitle,
        scores: {
          innovation: parseFloat((entry.avgInnovation || 0).toFixed(2)),
          technicalComplexity: parseFloat((entry.avgTechnicalComplexity || 0).toFixed(2)),
          presentation: parseFloat((entry.avgPresentation || 0).toFixed(2)),
          total: parseFloat((entry.avgTotal || 0).toFixed(2))
        },
        judgeCount: entry.judgeCount
      });
    }

    // Participants with no scores yet (approved, checked in)
    const scoredIds = leaderboard.map(l => l.participantId.toString());
    const unscored = await Participant.find({
      _id: { $nin: scoredIds },
      status: 'approved'
    }).select('name registrationId college teamName projectTitle');

    const unscoredEntries = unscored.map(p => ({
      rank: '-',
      participantId: p._id,
      name: p.name,
      registrationId: p.registrationId,
      college: p.college,
      teamName: p.teamName,
      projectTitle: p.projectTitle,
      scores: { innovation: 0, technicalComplexity: 0, presentation: 0, total: 0 },
      judgeCount: 0,
      unscored: true
    }));

    res.json({
      success: true,
      lastUpdated: new Date(),
      leaderboard,
      unscored: unscoredEntries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
