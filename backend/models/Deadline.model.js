const mongoose = require('mongoose');

const DeadlineSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Deadline title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 500
  },
  deadlineDate: {
    type: Date,
    required: [true, 'Deadline date is required']
  },
  type: {
    type: String,
    enum: ['court_date', 'filing_deadline', 'statute_of_limitations', 'hearing_date', 'response_due'],
    required: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

DeadlineSchema.index({ deadlineDate: 1, reminderSent: 1 });
DeadlineSchema.index({ case: 1 });
DeadlineSchema.index({ participants: 1, deadlineDate: 1 });

module.exports = mongoose.model('Deadline', DeadlineSchema);
