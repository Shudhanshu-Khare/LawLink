// backend/services/reminderService.js
const cron = require('node-cron');
const Deadline = require('../models/Deadline.model');

let io = null; // Set from server.js

const initReminderService = (socketIo) => {
  io = socketIo;

  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running daily deadline reminder job...');
    await processDeadlineReminders();
  });

  console.log('Reminder service initialized — runs daily at 08:00');
};

const processDeadlineReminders = async () => {
  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find deadlines within 48 hours that haven't had reminders sent
    const upcomingDeadlines = await Deadline.find({
      deadlineDate: { $gte: now, $lte: in48Hours },
      reminderSent: false
    })
      .populate('case', 'title caseNumber')
      .populate('participants', 'name email');

    console.log(`[CRON] Found ${upcomingDeadlines.length} deadlines needing reminders`);

    for (const deadline of upcomingDeadlines) {
      const caseName = `${deadline.case?.caseNumber} — ${deadline.case?.title}`;

      // Socket.io push notification to online participants
      for (const participant of deadline.participants) {
        if (io) {
          io.to(participant._id.toString()).emit('deadline:reminder', {
            deadlineId: deadline._id,
            title: deadline.title,
            deadlineDate: deadline.deadlineDate,
            type: deadline.type,
            caseName
          });
        }
      }

      // Mark as sent
      deadline.reminderSent = true;
      await deadline.save();
    }

    console.log(`[CRON] Processed ${upcomingDeadlines.length} deadline reminders`);
  } catch (err) {
    console.error('[CRON] Reminder job error:', err);
  }
};

module.exports = { initReminderService, processDeadlineReminders };
