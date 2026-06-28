const Case = require('../models/Case.model');

const STATUS_ORDER = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];

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

exports.getCases = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const { status, legalArea } = req.query;
    if (status) filter.status = status;
    if (legalArea) filter.legalArea = legalArea;

    const cases = await Case.find(filter)
      .populate('client', 'name email profilePhoto')
      .populate('lawyer', 'name email profilePhoto practiceAreas')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: cases.length, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id)
      .populate('client', 'name email phone profilePhoto')
      .populate('lawyer', 'name email phone profilePhoto practiceAreas feePerHour')
      .populate('milestones.addedBy', 'name role');

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

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
