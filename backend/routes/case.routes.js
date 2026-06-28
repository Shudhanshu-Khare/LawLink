const express = require('express');
const router = express.Router();
const {
  createCase, getCases, getCase, addMilestone, advanceStatus
} = require('../controllers/case.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createCase);
router.get('/', protect, getCases);
router.get('/:id', protect, getCase);
router.put('/:id/milestone', protect, authorize('lawyer'), addMilestone);
router.put('/:id/status', protect, authorize('lawyer'), advanceStatus);

module.exports = router;
