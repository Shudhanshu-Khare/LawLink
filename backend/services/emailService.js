const nodemailer = require('nodemailer');

let transporter;

const initTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('Email transporter initialized');
  } else {
    console.warn('Email credentials not set — emails will be logged to console');
  }
};

const sendDeadlineReminder = async (to, recipientName, deadline, caseName) => {
  const subject = `Upcoming Deadline: ${deadline.title}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Deadline Reminder</h2>
      <p>Hi <strong>${recipientName}</strong>,</p>
      <p>This is a reminder that the following deadline is approaching:</p>
      
      <div style="background: #f8f7f4; border-left: 4px solid #e67e22; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
        <h3 style="margin: 0 0 8px; color: #1a1a1a;">${deadline.title}</h3>
        <p style="margin: 4px 0; color: #555;">
          <strong>Case:</strong> ${caseName}<br>
          <strong>Type:</strong> ${deadline.type.replace(/_/g, ' ')}<br>
          <strong>Date:</strong> ${new Date(deadline.deadlineDate).toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}<br>
          ${deadline.description ? `<strong>Notes:</strong> ${deadline.description}` : ''}
        </p>
      </div>
      
      <p style="color: #666; font-size: 13px;">
        This deadline is within <strong>48 hours</strong>. Please take necessary action.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 11px;">LawLink — Legal Services Platform</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"LawLink" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
      });
      console.log(`Reminder email sent to ${to}`);
    } catch (err) {
      console.error(`Failed to send email to ${to}:`, err.message);
    }
  } else {
    console.log(`[EMAIL LOG] To: ${to} | Subject: ${subject}`);
  }
};

const sendEmail = async (to, subject, html) => {
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"LawLink" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
      });
    } catch (err) {
      console.error('Email send error:', err.message);
    }
  } else {
    console.log(`[EMAIL LOG] To: ${to} | Subject: ${subject}`);
  }
};

module.exports = { initTransporter, sendDeadlineReminder, sendEmail };
