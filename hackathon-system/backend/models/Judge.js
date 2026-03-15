const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const judgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  expertise: {
    type: String,
    trim: true
  },
  assignedTeams: [{
    type: String  // team names or participant IDs
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

judgeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

judgeSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Judge', judgeSchema);
