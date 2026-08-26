// backend/models/Invoice.model.js
const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hours: { type: Number, required: true, min: 0.1 },
  ratePerHour: { type: Number, required: true },
  amount: { type: Number, required: true } // hours × ratePerHour (computed on create)
});

const InvoiceSchema = new mongoose.Schema({
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
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  lineItems: [LineItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  pdfUrl: String,
  invoiceNumber: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidAt: Date
}, { timestamps: true });

// Auto-generate invoice number (race-safe with retry)
InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `LW-INV-${year}${month}-`;
    const InvoiceModel = mongoose.model('Invoice');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await InvoiceModel.findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
        .sort({ _id: -1 })
        .select('invoiceNumber');
      
      let nextNum = 1;
      if (last && last.invoiceNumber) {
        const parts = last.invoiceNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
      
      const exists = await InvoiceModel.findOne({ invoiceNumber: this.invoiceNumber });
      if (!exists) break;
    }
  }
  next();
});

InvoiceSchema.index({ lawyer: 1 });
InvoiceSchema.index({ client: 1 });
InvoiceSchema.index({ case: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
