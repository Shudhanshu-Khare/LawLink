const LegalDocument = require('../models/LegalDocument.model');
const { generateLegalDocPDF } = require('../services/pdfService');
const path = require('path');

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

    const pdfUrl = await generateLegalDocPDF(doc);
    doc.pdfUrl = pdfUrl;
    await doc.save();

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (req.query.caseId) filter.case = req.query.caseId;
    if (req.query.status) filter.status = req.query.status;

    const documents = await LegalDocument.find(filter)
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .populate('case', 'title caseNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadPDF = async (req, res) => {
  try {
    const doc = await LegalDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    if (doc.status === 'revoked' && req.user.role === 'client') {
      return res.status(403).json({ success: false, message: 'Access revoked' });
    }

    const hasAccess = doc.lawyer.toString() === req.user.id ||
                      doc.client.toString() === req.user.id;
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    const filePath = path.join(__dirname, '..', doc.pdfUrl);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.revokeDocument = async (req, res) => {
  try {
    const doc = await LegalDocument.findOneAndUpdate(
      { _id: req.params.id, lawyer: req.user.id },
      { status: 'revoked' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
