// backend/controllers/consultation.controller.js
const Consultation = require('../models/Consultation.model');
const User = require('../models/User.model');

// Helper to get YYYY-MM-DD in IST regardless of server timezone (Render runs in UTC)
const getISTDateStr = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  return parts; // returns YYYY-MM-DD
};

// Helper to get current hour in IST (0-23)
const getISTHour = () => {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric', hour12: false
    }).format(new Date()),
    10
  );
};

// Available 60-min time slots (9 AM to 6 PM)
const ALL_SLOTS = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00',
  '15:00-16:00', '16:00-17:00', '17:00-18:00'
];

// @desc    Book a consultation
// @route   POST /api/consultations
exports.bookConsultation = async (req, res) => {
  try {
    const { lawyerId, date, timeSlot, reason } = req.body;

    // Verify lawyer exists
    const lawyer = await User.findOne({ _id: lawyerId, role: 'lawyer' });
    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Lawyer not found' });
    }

    // Check if client is verified by admin
    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your profile is pending admin verification. You can browse lawyers but cannot book consultations yet.'
      });
    }

    // Check slot is not already booked
    const existing = await Consultation.findOne({
      lawyer: lawyerId,
      date: new Date(date),
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'This slot is already booked' });
    }

    const consultation = await Consultation.create({
      client: req.user.id,
      lawyer: lawyerId,
      date: new Date(date),
      timeSlot,
      reason
    });

    const populated = await consultation.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'lawyer', select: 'name email practiceAreas feePerHour' }
    ]);

    res.status(201).json({ success: true, consultation: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Slot already booked' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    List consultations (role-filtered)
// @route   GET /api/consultations
exports.getConsultations = async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (status) filter.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const consultations = await Consultation.find(filter)
      .populate('client', 'name email phone')
      .populate('lawyer', 'name email practiceAreas feePerHour')
      .sort({ date: 1, timeSlot: 1 });

    res.json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update consultation status
// @route   PUT /api/consultations/:id
exports.updateConsultation = async (req, res) => {
  try {
    const { status, notes, billableHours } = req.body;
    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    // Verify ownership
    const isOwner = consultation.client.toString() === req.user.id ||
                    consultation.lawyer.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Status transition validation
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled', 'no-show'],
    };

    if (status && validTransitions[consultation.status]) {
      if (!validTransitions[consultation.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from ${consultation.status} to ${status}`
        });
      }
      consultation.status = status;
    }

    if (notes) consultation.notes = notes;
    if (billableHours !== undefined) consultation.billableHours = billableHours;

    await consultation.save();

    const populated = await consultation.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'lawyer', select: 'name email practiceAreas feePerHour' }
    ]);

    res.json({ success: true, consultation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get lawyer availability for a date range
// @route   GET /api/consultations/availability/:lawyerId
exports.getAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const lawyerId = req.params.lawyerId;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate || startDate);
    end.setHours(23, 59, 59, 999);

    const booked = await Consultation.find({
      lawyer: lawyerId,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] }
    }).select('date timeSlot status');

    const availability = {};
    const now = new Date();
    const todayStr = getISTDateStr(now);
    const currentHour = getISTHour();

    const current = new Date(start);
    while (current <= end) {
      const dateStr = getISTDateStr(current);
      const bookedSlots = booked
        .filter(b => getISTDateStr(b.date) === dateStr)
        .map(b => b.timeSlot);

      const unbookedSlots = ALL_SLOTS.filter(s => !bookedSlots.includes(s));

      if (dateStr === todayStr) {
        const pastSlots = unbookedSlots.filter(slot => parseInt(slot.split(':')[0]) <= currentHour);
        const futureSlots = unbookedSlots.filter(slot => parseInt(slot.split(':')[0]) > currentHour);
        availability[dateStr] = { available: futureSlots, booked: bookedSlots, past: pastSlots };
      } else {
        availability[dateStr] = { available: unbookedSlots, booked: bookedSlots, past: [] };
      }

      current.setDate(current.getDate() + 1);
    }

    res.json({ success: true, availability });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get upcoming consultations
// @route   GET /api/consultations/upcoming
exports.getUpcoming = async (req, res) => {
  try {
    const filter = {
      date: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed'] }
    };

    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const consultations = await Consultation.find(filter)
      .populate('client', 'name email')
      .populate('lawyer', 'name email practiceAreas')
      .sort({ date: 1 })
      .limit(5);

    res.json({ success: true, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
