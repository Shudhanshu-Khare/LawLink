const express = require('express');
const router = express.Router();
const {
  bookConsultation, getConsultations, updateConsultation,
  getAvailability, getUpcoming
} = require('../controllers/consultation.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('client'), bookConsultation);
router.get('/', protect, getConsultations);
router.get('/upcoming', protect, getUpcoming);
router.get('/availability/:lawyerId', getAvailability);
router.put('/:id', protect, updateConsultation);

module.exports = router;
