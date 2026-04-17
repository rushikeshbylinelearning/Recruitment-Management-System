import cron from 'node-cron';
import webpush from 'web-push';
import { query } from '../config/database.js';
import { createNotification } from './inAppNotifications.js';
import emailService from './emailService.js';

// ── VAPID setup ──────────────────────────────────────────────────────────────
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.warn(
    '⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set. ' +
    'Web Push notifications will not work. ' +
    'Generate keys with: node -e "const wp=require(\'web-push\'); console.log(wp.generateVAPIDKeys())"'
  );
} else {
  webpush.setVapidDetails('mailto:admin@company.com', publicKey, privateKey);
}

// ── In-memory deduplication ──────────────────────────────────────────────────
// Map<cronWindowKey, Set<interviewId>>
// cronWindowKey format: "YYYY-MM-DDTHH:MM" (rounded to 10-min boundary)
const sentNotifications = new Map();

/**
 * Returns the cron-window key for a given Date (rounded down to 10-min boundary).
 * e.g. 10:14 → "2026-04-09T10:10"
 */
function getCronWindowKey(now) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// ── Pure filter function ─────────────────────────────────────────────────────

/**
 * getTodaysPendingInterviews(interviews, now)
 *
 * Returns only interviews where:
 *   - interview.date equals today's date (YYYY-MM-DD)
 *   - interview.time (HH:MM or HH:MM:SS) is strictly after `now`
 *   - interview.status === 'Scheduled'
 *
 * @param {Array<{date: string, time: string, status: string}>} interviews
 * @param {Date} now
 * @returns {Array}
 */
export function getTodaysPendingInterviews(interviews, now) {
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Build a comparable time string from `now` (HH:MM:SS)
  const nowTimeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  return interviews.filter((interview) => {
    if (interview.status !== 'Scheduled') return false;
    if (interview.date !== todayStr) return false;

    // Normalise interview.time to HH:MM:SS for comparison
    const timeParts = interview.time.split(':');
    const normalised = [
      timeParts[0].padStart(2, '0'),
      (timeParts[1] || '00').padStart(2, '0'),
      (timeParts[2] || '00').padStart(2, '0')
    ].join(':');

    return normalised > nowTimeStr;
  });
}

// ── Cron job ─────────────────────────────────────────────────────────────────

/**
 * startNotificationCron()
 *
 * Schedules a node-cron job that runs every 10 minutes.
 * Only executes notification logic between 10:00 AM and 11:00 AM server time.
 */
export function startNotificationCron() {
  cron.schedule('*/10 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();

    // Only active between 10:00 and 10:59 (i.e. hour === 10)
    if (hour !== 10) return;

    const windowKey = getCronWindowKey(now);
    if (!sentNotifications.has(windowKey)) {
      sentNotifications.set(windowKey, new Set());
    }
    const sentInWindow = sentNotifications.get(windowKey);

    try {
      const todayStr = now.toISOString().slice(0, 10);

      // Query today's Scheduled interviews joined with candidates for candidate_name
      const interviews = await query(
        `SELECT i.id, i.date, i.time, i.status, i.interviewer_id,
                COALESCE(c.name, c.full_name, 'Unknown') AS candidate_name
         FROM interviews i
         LEFT JOIN candidates c ON i.candidate_id = c.id
         WHERE i.date = ? AND i.status = 'Scheduled'`,
        [todayStr]
      );

      const pending = getTodaysPendingInterviews(interviews, now);

      for (const interview of pending) {
        const interviewKey = String(interview.id);

        // Skip if already notified in this cron window
        if (sentInWindow.has(interviewKey)) continue;

        // Fetch push subscriptions for the interviewer
        let subscriptions;
        try {
          subscriptions = await query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
            [interview.interviewer_id]
          );
        } catch (dbErr) {
          console.error(`Error fetching subscriptions for interviewer ${interview.interviewer_id}:`, dbErr);
          continue;
        }

        const payload = JSON.stringify({
          title: 'Interview Reminder',
          body: `Interview with ${interview.candidate_name} at ${interview.time}`
        });

        for (const sub of subscriptions) {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          };

          try {
            await webpush.sendNotification(pushSubscription, payload);
          } catch (pushErr) {
            console.error(
              `Failed to send push notification to endpoint ${sub.endpoint}:`,
              pushErr.message
            );
            // Continue — don't crash the cron job
          }
        }

        // Also create an in-app notification for the interviewer
        await createNotification(interview.interviewer_id, {
          type: 'interview_reminder',
          title: 'Interview Reminder',
          message: `You have an interview with ${interview.candidate_name} at ${interview.time} today.`,
          link: '/interviews',
        });

        sentInWindow.add(interviewKey);
      }
    } catch (err) {
      console.error('Notification cron job error:', err);
    }
  });

  console.log('🔔 Notification cron job started (runs every 10 min, active 10:00–11:00 AM)');
}

// ── Assignment Notification Cron ─────────────────────────────────────────────

/**
 * startAssignmentNotificationCron()
 *
 * Schedules a cron job that runs every 15 minutes.
 * 1. Sends deadline reminder emails for assignments due within 24 hours.
 * 2. Sends expiry warning emails for assignment links expiring within 2 hours.
 */
export function startAssignmentNotificationCron() {
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date();

    // ── 1. Deadline reminders (within next 24 hours) ──────────────────────
    try {
      const deadlineRows = await query(
        `SELECT ca.id, ca.deadline,
                COALESCE(c.name, c.full_name, 'Candidate') AS candidate_name,
                c.email AS candidate_email,
                a.title AS assignment_title
         FROM candidate_assignments ca
         LEFT JOIN candidates  c ON ca.candidate_id  = c.id
         LEFT JOIN assignments a ON ca.assignment_id = a.id
         WHERE ca.notify_deadline   = 1
           AND ca.deadline_notified = 0
           AND ca.status            = 'Assigned'
           AND ca.deadline > NOW()
           AND ca.deadline <= DATE_ADD(NOW(), INTERVAL 24 HOUR)`,
        []
      );

      for (const row of deadlineRows) {
        const subject = 'Assignment Deadline Reminder';
        const body =
          `Hi ${row.candidate_name},\n\n` +
          `This is a reminder that your assignment "${row.assignment_title}" is due on ` +
          `${new Date(row.deadline).toUTCString()}.\n\n` +
          `Please submit before the deadline.\n\nRegards,\nHR Team`;

        await emailService.sendEmail(row.candidate_email, subject, body);

        await query(
          `UPDATE candidate_assignments SET deadline_notified = 1 WHERE id = ?`,
          [row.id]
        );

        console.log(`[AssignmentCron] Deadline reminder sent for assignment id=${row.id}`);
      }
    } catch (err) {
      console.error('[AssignmentCron] Deadline reminder error:', err);
    }

    // ── 2. Expiry warnings (within next 2 hours) ──────────────────────────
    try {
      const expiryRows = await query(
        `SELECT ca.id, ca.expiry_at,
                COALESCE(c.name, c.full_name, 'Candidate') AS candidate_name,
                c.email AS candidate_email,
                a.title AS assignment_title
         FROM candidate_assignments ca
         LEFT JOIN candidates  c ON ca.candidate_id  = c.id
         LEFT JOIN assignments a ON ca.assignment_id = a.id
         WHERE ca.notify_expiry   = 1
           AND ca.expiry_notified = 0
           AND ca.status          = 'Assigned'
           AND ca.expiry_at > NOW()
           AND ca.expiry_at <= DATE_ADD(NOW(), INTERVAL 2 HOUR)`,
        []
      );

      for (const row of expiryRows) {
        const subject = 'Assignment Link Expiring Soon';
        const body =
          `Hi ${row.candidate_name},\n\n` +
          `Your submission link for the assignment "${row.assignment_title}" will expire on ` +
          `${new Date(row.expiry_at).toUTCString()}.\n\n` +
          `Please submit your work before the link expires.\n\nRegards,\nHR Team`;

        await emailService.sendEmail(row.candidate_email, subject, body);

        await query(
          `UPDATE candidate_assignments SET expiry_notified = 1 WHERE id = ?`,
          [row.id]
        );

        console.log(`[AssignmentCron] Expiry warning sent for assignment id=${row.id}`);
      }
    } catch (err) {
      console.error('[AssignmentCron] Expiry warning error:', err);
    }
  });

  console.log('🔔 Assignment notification cron job started (runs every 15 min)');
}
