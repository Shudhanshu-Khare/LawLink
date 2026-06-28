const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'],
    required: true
  },
  note: {
    type: String,
    required: [true, 'Milestone note is required'],
    maxlength: 500
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const CaseSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Case title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 2000
  },
  caseNumber: {
    type: String,
    unique: true
  },
  legalArea: {
    type: String,
    enum: ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'],
    required: true
  },
  status: {
    type: String,
    enum: ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'],
    default: 'intake'
  },
  milestones: [MilestoneSchema],
  totalBillableHours: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

CaseSchema.pre('save', async function(next) {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Case').countDocuments();
    this.caseNumber = `LW-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

CaseSchema.index({ client: 1 });
CaseSchema.index({ lawyer: 1 });

module.exports = mongoose.model('Case', CaseSchema);
