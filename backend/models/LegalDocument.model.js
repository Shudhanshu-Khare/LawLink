// backend/models/LegalDocument.model.js
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
    type: String, // Rich text content of the document
    required: true
  },
  pdfUrl: String,  // Legacy — kept for backward compatibility
  pdfData: Buffer,  // PDF binary stored in MongoDB (survives Render restarts)
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

// Auto-generate document number (race-safe with retry)
LegalDocumentSchema.pre('save', async function(next) {
  if (!this.documentNumber) {
    const year = new Date().getFullYear();
    const prefix = `LW-DOC-${year}-`;
    const DocModel = mongoose.model('LegalDocument');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await DocModel.findOne({ documentNumber: new RegExp(`^${prefix}`) })
        .sort({ _id: -1 })
        .select('documentNumber');
      
      let nextNum = 1;
      if (last && last.documentNumber) {
        const parts = last.documentNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.documentNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;
      
      const exists = await DocModel.findOne({ documentNumber: this.documentNumber });
      if (!exists) break;
    }
  }
  next();
});

module.exports = mongoose.model('LegalDocument', LegalDocumentSchema);
