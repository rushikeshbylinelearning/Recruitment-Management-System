import { query } from '../config/database.js';

/**
 * Create an in-app notification for a user.
 * Fire-and-forget safe — errors are logged, not thrown.
 *
 * @param {number} userId
 * @param {{ type?: string, title: string, message: string, link?: string }} opts
 */
export async function createNotification(userId, { type = 'info', title, message, link = null }) {
  try {
    await query(
      `INSERT INTO in_app_notifications (user_id, type, title, message, link)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, link]
    );
  } catch (err) {
    console.error('[inAppNotifications] Failed to create notification:', err.message);
  }
}

/**
 * Get unread count for a user.
 */
export async function getUnreadCount(userId) {
  const rows = await query(
    'SELECT COUNT(*) AS cnt FROM in_app_notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return rows[0].cnt;
}
