import { query } from '../config/database.js';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          INT           NOT NULL AUTO_INCREMENT,
  user_id     INT           NOT NULL,
  type        VARCHAR(50)   NOT NULL DEFAULT 'info',
  title       VARCHAR(255)  NOT NULL,
  message     TEXT          NOT NULL,
  link        VARCHAR(500)  NULL,
  is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_id  (user_id),
  INDEX idx_is_read  (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

let tableReady = false;

async function ensureNotifTable() {
  if (tableReady) return;
  try {
    await query(CREATE_TABLE_SQL);
    tableReady = true;
  } catch (err) {
    console.error('[inAppNotifications] Failed to ensure table:', err.message);
  }
}

// Initialise table on module load (non-blocking)
ensureNotifTable().catch(() => {});

/**
 * Create an in-app notification for a user.
 * Fire-and-forget safe — errors are logged, not thrown.
 *
 * @param {number} userId
 * @param {{ type?: string, title: string, message: string, link?: string }} opts
 */
export async function createNotification(userId, { type = 'info', title, message, link = null }) {
  try {
    await ensureNotifTable();
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
  await ensureNotifTable();
  const rows = await query(
    'SELECT COUNT(*) AS cnt FROM in_app_notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return rows[0].cnt;
}
