const mongoose = require('mongoose');

const LegalDocumentSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentType: {
    type: String,
    enum: ['demand_letter', 'contract', 'legal_notice', 'court_brief', 'agreement', 'power_of_attorney'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  pdfUrl: String,
  status: {
    type: String,
    enum: ['draft', 'issued', 'acknowledged', 'expired', 'revoked'],
    default: 'draft'
  },
  documentNumber: {
    type: String,
    unique: true
  },
  issuedAt: Date
}, { timestamps: true });

LegalDocumentSchema.pre('save', async function(next) {
  if (!this.documentNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('LegalDocument').countDocuments();
    this.documentNumber = `LW-DOC-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('LegalDocument', LegalDocumentSchema);
