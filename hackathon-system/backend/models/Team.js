const mongoose = require('mongoose');

// ── Team Member Sub-Schema ─────────────────────────────────────
const teamMemberSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true,
           match: [/^\S+@\S+\.\S+$/, 'Invalid member email'] },
  role:  { type: String, trim: true, maxlength: 80, default: 'Member' }
}, { _id: true });

// ── Team Schema ────────────────────────────────────────────────
const teamSchema = new mongoose.Schema({

  teamName: {
    type: String, required: [true, 'Team name is required'],
    trim: true, minlength: 2, maxlength: 100
  },

  teamLeaderName: {
    type: String, required: [true, 'Team leader name is required'],
    trim: true, maxlength: 100
  },

  leaderEmail: {
    type: String, required: [true, 'Leader email is required'],
    unique: true, lowercase: true, trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
  },

  phoneNumber: {
    type: String, required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number']
  },

  collegeName: {
    type: String, required: [true, 'College name is required'],
    trim: true, maxlength: 200
  },

  teamMembers: {
    type: [teamMemberSchema],
    validate: {
      validator: arr => arr.length >= 1 && arr.length <= 5,
      message: 'Team must have between 1 and 5 members'
    }
  },

  projectIdea: {
    type: String, required: [true, 'Project idea is required'],
    trim: true, minlength: 10, maxlength: 1000
  },

  projectCategory: {
    type: String,
    enum: ['AI/ML', 'Web Dev', 'Mobile App', 'IoT', 'Blockchain', 'Cybersecurity', 'FinTech', 'HealthTech', 'EdTech', 'Other'],
    default: 'Other'
  },

  // AI Identity Verification (team leader)
  idVerification: {
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'manual_review'],
      default: 'pending'
    },
    score: { type: Number, min: 0, max: 100, default: 0 },
    reasoning: String,
    extractedText: String,
    extractedFields: {
      name: String,
      institution: String,
      idNumber: String
    },
    verifiedAt: Date,
    method: {
      type: String,
      enum: ['ai_auto', 'manual_admin'],
      default: 'ai_auto'
    }
  },

  registrationDate: { type: Date, default: Date.now },

  // ── Status & Admin Fields ─────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  verifiedByAdmin: { type: Boolean, default: false },

  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt:  Date,
  rejectedAt:  Date,
  rejectionReason: { type: String, trim: true, maxlength: 500 },

  // Auto-generated team ID shown to users
  teamId: { type: String, unique: true, sparse: true }

}, { timestamps: true });

// ── Auto-generate teamId ───────────────────────────────────────
teamSchema.pre('save', async function (next) {
  if (!this.teamId) {
    const count = await mongoose.model('Team').countDocuments();
    const year  = new Date().getFullYear();
    this.teamId = `TEAM-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ── Indexes ────────────────────────────────────────────────────
teamSchema.index({ status: 1 });
teamSchema.index({ registrationDate: -1 });
teamSchema.index({ leaderEmail: 1 });

module.exports = mongoose.model('Team', teamSchema);
