const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hours: { type: Number, required: true, min: 0.1 },
  ratePerHour: { type: Number, required: true },
  amount: { type: Number, required: true }
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

InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `LW-INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

InvoiceSchema.index({ lawyer: 1 });
InvoiceSchema.index({ client: 1 });
InvoiceSchema.index({ case: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
