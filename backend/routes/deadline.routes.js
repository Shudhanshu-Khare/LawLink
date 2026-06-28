const express = require('express');
const router = express.Router();
const { createDeadline, getDeadlines, deleteDeadline } = require('../controllers/deadline.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createDeadline);
router.get('/', protect, getDeadlines);
router.delete('/:id', protect, authorize('lawyer'), deleteDeadline);

module.exports = router;
