// backend/routes/document.routes.js
const express = require('express');
const router = express.Router();
const { createDocument, getDocuments, downloadPDF, revokeDocument } = require('../controllers/document.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createDocument);
router.get('/', protect, getDocuments);
router.get('/:id/pdf', protect, downloadPDF);
router.get('/:id/download', protect, downloadPDF);  // Alias for new MongoDB-based download
router.put('/:id/revoke', protect, authorize('lawyer'), revokeDocument);

module.exports = router;
