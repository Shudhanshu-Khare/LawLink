// backend/controllers/document.controller.js
const LegalDocument = require('../models/LegalDocument.model');
const { generateLegalDocPDF } = require('../services/pdfService');

// @desc    Create and issue a legal document (PDF auto-generated)
// @route   POST /api/documents
exports.createDocument = async (req, res) => {
  try {
    const { caseId, clientId, documentType, title, content } = req.body;

    const doc = await LegalDocument.create({
      case: caseId,
      lawyer: req.user.id,
      client: clientId,
      documentType,
      title,
      content,
      status: 'issued',
      issuedAt: new Date()
    });

    // Generate PDF in memory and store binary in MongoDB
    const pdfBuffer = await generateLegalDocPDF(doc);
    doc.pdfData = pdfBuffer;
    doc.pdfUrl = `/api/documents/${doc._id}/download`; // API URL instead of file path
    await doc.save();

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    List documents (role-filtered)
// @route   GET /api/documents
exports.getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (req.query.caseId) filter.case = req.query.caseId;
    if (req.query.status) filter.status = req.query.status;

    // Exclude pdfData from list queries (it's large binary data)
    const documents = await LegalDocument.find(filter)
      .select('-pdfData')
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .populate('case', 'title caseNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Download document PDF (serves from MongoDB)
// @route   GET /api/documents/:id/download
exports.downloadPDF = async (req, res) => {
  try {
    const doc = await LegalDocument.findById(req.params.id).select('pdfData pdfUrl title lawyer client status');
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    // Check access
    if (doc.status === 'revoked' && req.user.role === 'client') {
      return res.status(403).json({ success: false, message: 'Access revoked' });
    }

    const hasAccess = doc.lawyer.toString() === req.user.id ||
                      doc.client.toString() === req.user.id;
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    if (!doc.pdfData) {
      return res.status(404).json({ success: false, message: 'PDF not available — document was created before the storage fix. Please ask the lawyer to re-issue it.' });
    }

    const fileName = `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': doc.pdfData.length
    });
    res.send(doc.pdfData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Revoke client access to document
// @route   PUT /api/documents/:id/revoke
exports.revokeDocument = async (req, res) => {
  try {
    const doc = await LegalDocument.findOneAndUpdate(
      { _id: req.params.id, lawyer: req.user.id },
      { status: 'revoked' },
      { new: true }
    ).select('-pdfData');
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
