import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../services/inAppNotifications.js';

const router = express.Router();

// ── Web Push subscription ────────────────────────────────────────────────────

// POST /api/notifications/subscribe
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription: endpoint and keys (p256dh, auth) are required'
      });
    }

    const userId = req.user.id;

    await query(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );

    return res.status(201).json({ success: true, message: 'Subscription saved' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return res.status(500).json({ success: false, message: 'Failed to save subscription' });
  }
});

// ── In-app notifications ─────────────────────────────────────────────────────

// GET /api/notifications — fetch latest 30 notifications for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await query(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM in_app_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId]
    );

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all — mark all as read for the logged-in user
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await query(
      `UPDATE in_app_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
});

// PATCH /api/notifications/:id/read — mark a single notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await query(
      `UPDATE in_app_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
});

export default router;
