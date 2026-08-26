const Case = require('../models/Case.model');

// valid progression order — case can only move forward (or jump to closed)
const STATUS_ORDER = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];

/** POST /api/cases — lawyer creates a new case for a client */
exports.createCase = async (req, res) => {
  try {
    const { clientId, title, description, legalArea } = req.body;

    const newCase = await Case.create({
      client: clientId,
      lawyer: req.user.id,
      title,
      description,
      legalArea,
      milestones: [{
        stage: 'intake',
        note: 'Case opened',
        addedBy: req.user.id,
        timestamp: new Date()
      }]
    });

    const populated = await newCase.populate([
      { path: 'client', select: 'name email' },
      { path: 'lawyer', select: 'name email' },
      { path: 'milestones.addedBy', select: 'name' }
    ]);

    res.status(201).json({ success: true, case: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/cases — returns cases for the logged-in user (filtered by role) */
exports.getCases = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const { status, legalArea } = req.query;
    if (status) filter.status = status;
    if (legalArea) filter.legalArea = legalArea;

    const cases = await Case.find(filter)
      .populate('client', 'name email')
      .populate('lawyer', 'name email practiceAreas')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: cases.length, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/cases/:id — single case with full milestone history */
exports.getCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('lawyer', 'name email phone practiceAreas feePerHour')
      .populate('milestones.addedBy', 'name role');

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // only the assigned client, lawyer, or admin can view
    const hasAccess = caseDoc.client._id.toString() === req.user.id ||
                      caseDoc.lawyer._id.toString() === req.user.id ||
                      req.user.role === 'admin';
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, case: caseDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/cases/:id/milestone — lawyer adds a milestone note */
exports.addMilestone = async (req, res) => {
  try {
    const { stage, note } = req.body;
    const caseDoc = await Case.findById(req.params.id);

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can add milestones' });
    }

    caseDoc.milestones.push({
      stage: stage || caseDoc.status,
      note,
      addedBy: req.user.id,
      timestamp: new Date()
    });

    await caseDoc.save();
    const populated = await caseDoc.populate('milestones.addedBy', 'name role');

    res.json({ success: true, case: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/cases/:id/status
 * Advances case to next stage. Must follow STATUS_ORDER
 * unless jumping directly to 'closed' (allowed from any stage).
 */
exports.advanceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const caseDoc = await Case.findById(req.params.id);

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can advance the case' });
    }

    const currentIdx = STATUS_ORDER.indexOf(caseDoc.status);
    const newIdx = STATUS_ORDER.indexOf(status);

    if (status !== 'closed' && newIdx !== currentIdx + 1) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${caseDoc.status}' to '${status}'. Next valid stage: '${STATUS_ORDER[currentIdx + 1]}'`
      });
    }

    caseDoc.status = status;
    caseDoc.milestones.push({
      stage: status,
      note: `Case advanced to ${status}`,
      addedBy: req.user.id,
      timestamp: new Date()
    });

    await caseDoc.save();
    res.json({ success: true, case: caseDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
