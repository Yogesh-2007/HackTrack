const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number']
  },
  college: {
    type: String,
    required: [true, 'College name is required'],
    trim: true,
    maxlength: [200, 'College name cannot exceed 200 characters']
  },
  teamName: {
    type: String,
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  projectTitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Project title cannot exceed 200 characters']
  },

  // ID Proof Upload
  idProof: {
    filename: String,
    path: String,
    mimetype: String,
    uploadedAt: Date
  },

  // AI Identity Verification
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

  // Registration
  registrationId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: Date,

  // QR Code
  qrCode: {
    image: String,       // base64 QR image
    token: String,       // encrypted JWT token embedded in QR
    generatedAt: Date,
    expiresAt: Date
  },

  // Entry / Check-in
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: Date,
  checkedInBy: String,  // volunteer name or device ID

}, { timestamps: true });

// Generate unique registration ID before saving
participantSchema.pre('save', async function(next) {
  if (!this.registrationId) {
    const count = await mongoose.model('Participant').countDocuments();
    this.registrationId = `HKT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Participant', participantSchema);
