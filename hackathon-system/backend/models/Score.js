const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  judge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Judge',
    required: true
  },
  teamName: {
    type: String,
    trim: true
  },
  projectTitle: {
    type: String,
    trim: true
  },

  // Scoring Criteria (0-10 each)
  innovation: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  technicalComplexity: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  presentation: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  // Optional additional criteria
  feasibility: {
    type: Number,
    min: 0,
    max: 10,
    default: null
  },
  impact: {
    type: Number,
    min: 0,
    max: 10,
    default: null
  },

  // Calculated total
  totalScore: {
    type: Number
  },

  feedback: {
    type: String,
    trim: true,
    maxlength: 500
  },

  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Prevent duplicate scores from same judge for same participant
scoreSchema.index({ participant: 1, judge: 1 }, { unique: true });

// Auto-calculate total before saving
scoreSchema.pre('save', function(next) {
  const scores = [this.innovation, this.technicalComplexity, this.presentation];
  if (this.feasibility !== null && this.feasibility !== undefined) scores.push(this.feasibility);
  if (this.impact !== null && this.impact !== undefined) scores.push(this.impact);
  this.totalScore = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length * 10).toFixed(2));
  next();
});

module.exports = mongoose.model('Score', scoreSchema);
