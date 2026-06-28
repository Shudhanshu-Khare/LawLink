const Invoice = require('../models/Invoice.model');
const Case = require('../models/Case.model');
const User = require('../models/User.model');
const { generateInvoicePDF } = require('../services/pdfService');
const path = require('path');

exports.createInvoice = async (req, res) => {
  try {
    const { caseId, clientId, lineItems, dueDate } = req.body;

    const lawyer = await User.findById(req.user.id);
    const rate = lawyer.feePerHour || 0;

    const processedItems = lineItems.map(item => ({
      description: item.description,
      hours: item.hours,
      ratePerHour: item.ratePerHour || rate,
      amount: item.hours * (item.ratePerHour || rate)
    }));

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);

    const invoice = await Invoice.create({
      lawyer: req.user.id,
      client: clientId,
      case: caseId,
      lineItems: processedItems,
      totalAmount,
      dueDate: new Date(dueDate)
    });

    const pdfUrl = await generateInvoicePDF(invoice);
    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    const totalHours = processedItems.reduce((sum, item) => sum + item.hours, 0);
    await Case.findByIdAndUpdate(caseId, {
      $inc: { totalBillableHours: totalHours }
    });

    const populated = await invoice.populate([
      { path: 'lawyer', select: 'name email' },
      { path: 'client', select: 'name email' },
      { path: 'case', select: 'title caseNumber' }
    ]);

    res.status(201).json({ success: true, invoice: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (req.query.caseId) filter.case = req.query.caseId;
    if (req.query.status) filter.status = req.query.status;

    let invoices = await Invoice.find(filter)
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .populate('case', 'title caseNumber')
      .sort({ createdAt: -1 });

    const now = new Date();
    for (const inv of invoices) {
      if (inv.status === 'pending' && inv.dueDate < now) {
        inv.status = 'overdue';
        await inv.save();
      }
    }

    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Not found' });

    const hasAccess = invoice.lawyer.toString() === req.user.id ||
                      invoice.client.toString() === req.user.id;
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    const filePath = path.join(__dirname, '..', invoice.pdfUrl);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, client: req.user.id, status: { $in: ['pending', 'overdue'] } },
      { status: 'paid', paidAt: new Date() },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found or already paid' });
    }

    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
