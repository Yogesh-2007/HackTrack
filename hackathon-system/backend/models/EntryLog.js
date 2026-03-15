const mongoose = require('mongoose');

const entryLogSchema = new mongoose.Schema({
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  registrationId: String,
  participantName: String,

  action: {
    type: String,
    enum: ['checkin', 'checkout', 'duplicate_scan', 'invalid_qr', 'expired_qr'],
    required: true
  },

  success: {
    type: Boolean,
    default: true
  },

  scannedBy: {
    type: String,  // volunteer name / device
    default: 'Unknown'
  },

  ipAddress: String,
  userAgent: String,

  message: String,  // additional info or error message

  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: false });

module.exports = mongoose.model('EntryLog', entryLogSchema);
