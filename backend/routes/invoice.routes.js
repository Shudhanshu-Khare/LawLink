const express = require('express');
const router = express.Router();
const {
  createInvoice, getInvoices, downloadInvoicePDF, markAsPaid
} = require('../controllers/invoice.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createInvoice);
router.get('/', protect, getInvoices);
router.get('/:id/pdf', protect, downloadInvoicePDF);
router.put('/:id/pay', protect, authorize('client'), markAsPaid);

module.exports = router;
