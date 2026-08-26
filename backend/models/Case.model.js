// backend/models/Case.model.js
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

// Auto-generate case number before saving (race-safe with retry)
CaseSchema.pre('save', async function(next) {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const CaseModel = mongoose.model('Case');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await CaseModel.findOne({ caseNumber: new RegExp(`^LW-${year}-`) })
        .sort({ _id: -1 })
        .select('caseNumber');
      
      let nextNum = 1;
      if (last && last.caseNumber) {
        const parts = last.caseNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.caseNumber = `LW-${year}-${String(nextNum).padStart(5, '0')}`;
      
      // Check if this number already exists (race condition guard)
      const exists = await CaseModel.findOne({ caseNumber: this.caseNumber });
      if (!exists) break;
    }
  }
  next();
});

CaseSchema.index({ client: 1 });
CaseSchema.index({ lawyer: 1 });

module.exports = mongoose.model('Case', CaseSchema);
