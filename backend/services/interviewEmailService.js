/**
 * Interview Email Service
 * Sends scheduled/rescheduled interview notification emails to candidates and interviewers,
 * attaching an .ics calendar file. All sends are fire-and-forget (non-blocking).
 */

import emailService from './emailService.js';
import { generateICS } from './icsGenerator.js';
import { emailConfig } from '../email-config.js';

/**
 * Sends a single email with an in-memory attachment via the shared transporter.
 */
async function sendWithAttachment({ to, subject, text, html, attachments }) {
  if (!emailService.transporter) {
    console.error('[interviewEmailService] Email transporter is not initialized. Check SMTP credentials.');
    throw new Error('Email transporter not initialized');
  }

  const fromAddress = emailConfig.EMAIL_FROM || emailConfig.EMAIL_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'HR Workflow Management';

  console.log(`[interviewEmailService] Sending email to: ${to}, subject: "${subject}"`);
  if (attachments && attachments.length > 0) {
    console.log(`[interviewEmailService] Attachments: ${attachments.map(a => `${a.filename} (${a.contentType})`).join(', ')}`);
  } else {
    console.warn('[interviewEmailService] ⚠️ No attachments on this email!');
  }

  const result = await emailService.transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html: html || text,
    attachments: attachments || [],
  });

  console.log(`[interviewEmailService] ✅ Email sent to ${to} — messageId: ${result.messageId}`);
}

/**
 * Builds a Google Calendar deep-link URL for the interview.
 */
function buildGoogleCalendarLink(interview) {
  const { date, time, duration, type, job_role, mode, meeting_link, location, candidate_name } = interview;

  try {
    const timeParts = time.split(':');
    const [year, month, day] = date.split('-').map(Number);
    const dtStart = new Date(Date.UTC(year, month - 1, day, parseInt(timeParts[0]), parseInt(timeParts[1]), 0));
    const dtEnd = new Date(dtStart.getTime() + duration * 60 * 1000);

    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const details = mode === 'Virtual'
      ? `Interview with ${candidate_name} for ${job_role}. Join: ${meeting_link || ''}`
      : `Interview with ${candidate_name} for ${job_role}. Location: ${location || ''}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${type} Interview - ${candidate_name}`,
      dates: `${fmt(dtStart)}/${fmt(dtEnd)}`,
      details,
      location: mode === 'Virtual' ? (meeting_link || '') : (location || ''),
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return null;
  }
}

/**
 * Formats a date string 'YYYY-MM-DD' to a readable format.
 */
function formatDate(dateStr) {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a time string 'HH:MM' to 12-hour format.
 */
function formatTime(timeStr) {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
}

/**
 * Builds clean corporate HTML + plain-text email body.
 */
function buildEmailBody(interview, recipientType, googleCalendarLink) {
  const {
    candidate_name,
    interviewer_name,
    job_role,
    date,
    time,
    duration,
    mode,
    meeting_link,
    location,
    type,
  } = interview;

  const recipientName = recipientType === 'candidate' ? candidate_name : interviewer_name;
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);
  const locationValue = mode === 'Virtual'
    ? (meeting_link || 'Link to be provided')
    : (location || 'To be confirmed');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#000000; line-height:1.6;">
  <div style="max-width:600px; margin:30px auto; padding:30px;">

    <p>Dear ${recipientName},</p>

    <p>This is to inform you that your interview has been scheduled. Please find the details below:</p>

    <table style="border-collapse:collapse; margin-top:10px; width:100%;">
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Candidate</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${candidate_name}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Role</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${job_role}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Interview Type</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${type}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Date</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Time</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${formattedTime} UTC</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Duration</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${duration} minutes</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Mode</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${mode}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>${mode === 'Virtual' ? 'Meeting Link' : 'Location'}</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000; word-break:break-all;">${locationValue}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #000000;"><strong>Interviewer</strong></td>
        <td style="padding:6px 10px; border:1px solid #000000;">${interviewer_name}</td>
      </tr>
    </table>

    <p style="margin-top:15px;">
      A calendar invitation (.ics file) is attached with this email. Please add it to your calendar.
    </p>

    <p>
      Kindly confirm your availability by replying to this email.
    </p>

    <p style="margin-top:20px;">
      Regards,<br>
      HR Team<br>
      HR Workflow Management
    </p>

  </div>
</body>
</html>`;

  // Plain-text fallback
  const modeDetail = mode === 'Virtual'
    ? `Meeting Link: ${meeting_link || 'To be provided'}`
    : `Location: ${location || 'To be provided'}`;

  const text = [
    `Dear ${recipientName},`,
    '',
    'This is to inform you that your interview has been scheduled. Please find the details below:',
    '',
    `Candidate:       ${candidate_name}`,
    `Role:            ${job_role}`,
    `Interview Type:  ${type}`,
    `Date:            ${formattedDate}`,
    `Time:            ${formattedTime} UTC`,
    `Duration:        ${duration} minutes`,
    `Mode:            ${mode}`,
    modeDetail,
    `Interviewer:     ${interviewer_name}`,
    '',
    'A calendar invitation (.ics file) is attached with this email. Please add it to your calendar.',
    '',
    'Kindly confirm your availability by replying to this email.',
    '',
    'Regards,',
    'HR Team',
    'HR Workflow Management',
  ].join('\n');

  return { text, html };
}

/**
 * Builds the rescheduled variant of the email body.
 */
function buildRescheduledEmailBody(interview, recipientType, googleCalendarLink) {
  const { type, candidate_name, interviewer_name } = interview;
  const recipientName = recipientType === 'candidate' ? candidate_name : interviewer_name;

  // Reuse the same builder but swap the header text via a small wrapper
  const { text, html } = buildEmailBody(interview, recipientType, googleCalendarLink);

  const updatedHtml = html
    .replace(
      'This is to inform you that your interview has been scheduled.',
      'This is to inform you that your interview has been <strong>rescheduled</strong>. Please update your calendar accordingly.'
    );

  const updatedText = text.replace(
    'This is to inform you that your interview has been scheduled. Please find the details below:',
    'This is to inform you that your interview has been RESCHEDULED. Please update your calendar accordingly. The new details are below:'
  );

  return { text: updatedText, html: updatedHtml };
}

/**
 * Builds ICS attachments array. Returns [] on failure.
 */
function buildICSAttachments(interview) {
  try {
    console.log('[interviewEmailService] Generating ICS file...');
    console.log('[interviewEmailService] ICS input — date:', interview.date, 'time:', interview.time, 'duration:', interview.duration);
    const icsContent = generateICS(interview);
    console.log('[interviewEmailService] ICS generated successfully, length:', icsContent.length);
    console.log('[interviewEmailService] ICS preview:\n', icsContent.slice(0, 300));
    return [{
      filename: 'interview.ics',
      content: icsContent,          // pass raw string — nodemailer handles encoding
      contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
      contentDisposition: 'attachment',
    }];
  } catch (err) {
    console.error('[interviewEmailService] ❌ ICS generation FAILED:', err.message, err.stack);
    return [];
  }
}

/**
 * Sends scheduled interview emails to both candidate and interviewer.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function sendScheduledEmails(interview) {
  const { candidate_name, candidate_email, interviewer_name, interviewer_email, job_role } = interview;

  console.log('[interviewEmailService] Sending scheduled interview emails...');
  console.log(`[interviewEmailService]   candidate_email: ${candidate_email || '(none)'}`);
  console.log(`[interviewEmailService]   interviewer_email: ${interviewer_email || '(none)'}`);

  if (!candidate_email && !interviewer_email) {
    console.warn('[interviewEmailService] No recipient emails found, skipping send.');
    return;
  }

  const attachments = buildICSAttachments(interview);
  const googleCalendarLink = buildGoogleCalendarLink(interview);

  if (candidate_email) {
    const { text, html } = buildEmailBody(interview, 'candidate', googleCalendarLink);
    sendWithAttachment({
      to: candidate_email,
      subject: `Interview Scheduled: ${interview.type} for ${job_role} on ${interview.date}`,
      text,
      html,
      attachments,
    }).catch(err => {
      console.error(`[interviewEmailService] Failed to send to candidate (${candidate_email}):`, err.message);
    });
  }

  if (interviewer_email) {
    const { text, html } = buildEmailBody(interview, 'interviewer', googleCalendarLink);
    sendWithAttachment({
      to: interviewer_email,
      subject: `Interview Scheduled: ${candidate_name} — ${job_role} on ${interview.date}`,
      text,
      html,
      attachments,
    }).catch(err => {
      console.error(`[interviewEmailService] Failed to send to interviewer (${interviewer_email}):`, err.message);
    });
  }
}

/**
 * Sends rescheduled interview emails to both candidate and interviewer.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function sendRescheduledEmails(interview) {
  const { candidate_name, candidate_email, interviewer_name, interviewer_email, job_role } = interview;

  if (!candidate_email && !interviewer_email) {
    console.warn('[interviewEmailService] No recipient emails found, skipping send.');
    return;
  }

  const attachments = buildICSAttachments(interview);
  const googleCalendarLink = buildGoogleCalendarLink(interview);

  if (candidate_email) {
    const { text, html } = buildRescheduledEmailBody(interview, 'candidate', googleCalendarLink);
    sendWithAttachment({
      to: candidate_email,
      subject: `Interview Rescheduled: ${interview.type} for ${job_role} on ${interview.date}`,
      text,
      html,
      attachments,
    }).catch(err => {
      console.error(`[interviewEmailService] Failed to send rescheduled email to candidate (${candidate_email}):`, err.message);
    });
  }

  if (interviewer_email) {
    const { text, html } = buildRescheduledEmailBody(interview, 'interviewer', googleCalendarLink);
    sendWithAttachment({
      to: interviewer_email,
      subject: `Interview Rescheduled: ${candidate_name} — ${job_role} on ${interview.date}`,
      text,
      html,
      attachments,
    }).catch(err => {
      console.error(`[interviewEmailService] Failed to send rescheduled email to interviewer (${interviewer_email}):`, err.message);
    });
  }
}

export { sendScheduledEmails, sendRescheduledEmails };
