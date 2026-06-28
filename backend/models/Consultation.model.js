// backend/models/Consultation.model.js
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
    // Format: "09:00-10:00", "10:00-11:00", etc.
  },
  duration: {
    type: Number,
    default: 60 // minutes — LawLink uses 60-min consultation slots
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

// Prevent double-booking: unique constraint on lawyer + date + timeSlot
ConsultationSchema.index({ lawyer: 1, date: 1, timeSlot: 1 }, { unique: true });
ConsultationSchema.index({ client: 1, date: 1 });

module.exports = mongoose.model('Consultation', ConsultationSchema);
