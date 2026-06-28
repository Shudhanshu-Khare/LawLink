const Consultation = require('../models/Consultation.model');
const User = require('../models/User.model');

// Helper to get YYYY-MM-DD in local timezone (avoids UTC mismatch with IST)
const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Available 60-min time slots (9 AM to 6 PM)
const ALL_SLOTS = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00',
  '15:00-16:00', '16:00-17:00', '17:00-18:00'
];

exports.bookConsultation = async (req, res) => {
  try {
    const { lawyerId, date, timeSlot, reason } = req.body;

    const lawyer = await User.findOne({ _id: lawyerId, role: 'lawyer' });
    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Lawyer not found' });
    }

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

exports.getConsultations = async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};

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
      .populate('client', 'name email phone profilePhoto')
      .populate('lawyer', 'name email practiceAreas feePerHour profilePhoto')
      .sort({ date: 1, timeSlot: 1 });

    res.json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateConsultation = async (req, res) => {
  try {
    const { status, notes, billableHours } = req.body;
    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    const isOwner = consultation.client.toString() === req.user.id ||
                    consultation.lawyer.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

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
    const todayStr = getLocalDateStr(now);
    const currentHour = now.getHours();

    const current = new Date(start);
    while (current <= end) {
      const dateStr = getLocalDateStr(current);
      const bookedSlots = booked
        .filter(b => getLocalDateStr(b.date) === dateStr)
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

exports.getUpcoming = async (req, res) => {
  try {
    const filter = {
      date: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed'] }
    };

    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const consultations = await Consultation.find(filter)
      .populate('client', 'name email profilePhoto')
      .populate('lawyer', 'name email practiceAreas profilePhoto')
      .sort({ date: 1 })
      .limit(5);

    res.json({ success: true, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
