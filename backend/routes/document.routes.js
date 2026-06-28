const express = require('express');
const router = express.Router();
const { createDocument, getDocuments, downloadPDF, revokeDocument } = require('../controllers/document.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createDocument);
router.get('/', protect, getDocuments);
router.get('/:id/pdf', protect, downloadPDF);
router.put('/:id/revoke', protect, authorize('lawyer'), revokeDocument);

module.exports = router;
