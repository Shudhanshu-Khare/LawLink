const mongoose = require('mongoose');

const ConsultationSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: [true, 'Please provide a consultation date']
  },
  timeSlot: {
    type: String,
    required: [true, 'Please provide a time slot'],
  },
  duration: {
    type: Number,
    default: 60
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  reason: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  caseRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  billableHours: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

ConsultationSchema.index({ lawyer: 1, date: 1, timeSlot: 1 }, { unique: true });
ConsultationSchema.index({ client: 1, date: 1 });

module.exports = mongoose.model('Consultation', ConsultationSchema);
