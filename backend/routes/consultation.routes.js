// backend/routes/consultation.routes.js
const express = require('express');
const router = express.Router();
const {
  bookConsultation, getConsultations, updateConsultation,
  getAvailability, getUpcoming, getBulkAvailability
} = require('../controllers/consultation.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('client'), bookConsultation);
router.get('/', protect, getConsultations);
router.get('/upcoming', protect, getUpcoming);
// bulk-availability MUST be before :lawyerId to avoid param capture
router.get('/bulk-availability', getBulkAvailability);    // Public — replaces N+1 calls
router.get('/availability/:lawyerId', getAvailability);   // Public
router.put('/:id', protect, updateConsultation);

module.exports = router;
