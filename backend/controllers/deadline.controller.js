const Deadline = require('../models/Deadline.model');
const Case = require('../models/Case.model');

exports.createDeadline = async (req, res) => {
  try {
    const { caseId, title, description, deadlineDate, type } = req.body;

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can add deadlines' });
    }

    const deadline = await Deadline.create({
      case: caseId,
      addedBy: req.user.id,
      title,
      description,
      deadlineDate: new Date(deadlineDate),
      type,
      participants: [caseDoc.lawyer, caseDoc.client]
    });

    const populated = await deadline.populate([
      { path: 'case', select: 'title caseNumber' },
      { path: 'addedBy', select: 'name' },
      { path: 'participants', select: 'name email' }
    ]);

    res.status(201).json({ success: true, deadline: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDeadlines = async (req, res) => {
  try {
    const { caseId, upcoming } = req.query;
    const filter = {};

    if (caseId) {
      filter.case = caseId;
    } else {
      filter.participants = req.user.id;
    }

    if (upcoming === 'true') {
      filter.deadlineDate = { $gte: new Date() };
    }

    const deadlines = await Deadline.find(filter)
      .populate('case', 'title caseNumber legalArea')
      .populate('addedBy', 'name')
      .sort({ deadlineDate: 1 });

    res.json({ success: true, count: deadlines.length, deadlines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDeadline = async (req, res) => {
  try {
    const deadline = await Deadline.findOneAndDelete({
      _id: req.params.id,
      addedBy: req.user.id
    });

    if (!deadline) {
      return res.status(404).json({ success: false, message: 'Deadline not found or not authorized' });
    }

    res.json({ success: true, message: 'Deadline deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
