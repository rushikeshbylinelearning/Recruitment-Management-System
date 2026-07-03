/**
 * pushNotificationService.js
 *
 * Centralised helper for sending Web Push notifications to a user.
 * Reuses the VAPID setup already initialised in notificationCron.js.
 * Safe to call fire-and-forget — errors are logged, never thrown.
 *
 * Usage:
 *   import { sendPushToUser } from './pushNotificationService.js';
 *   await sendPushToUser(userId, { title, body, icon, url, tag, type });
 */

import webpush from 'web-push';
import { query } from '../config/database.js';

// ── VAPID init (idempotent — safe to call multiple times) ────────────────────
const publicKey  = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return true;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.EMAIL_USER || 'admin@company.com'}`,
      publicKey,
      privateKey
    );
    vapidReady = true;
    return true;
  } catch {
    return false;
  }
}

// ── Icon map by notification type ────────────────────────────────────────────
const ICON_MAP = {
  task_update:            '/icons/icon-192.png',
  task_assigned:          '/icons/icon-192.png',
  interview_scheduled:    '/icons/icon-192.png',
  interview_rescheduled:  '/icons/icon-192.png',
  interview_reminder:     '/icons/icon-192.png',
  duplicate_application:  '/icons/icon-192.png',
};

const DEFAULT_ICON  = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/badge-72.png';

// ── Route map by notification type ───────────────────────────────────────────
const URL_MAP = {
  task_update:            '/tasks',
  task_assigned:          '/tasks',
  interview_scheduled:    '/interviews',
  interview_rescheduled:  '/interviews',
  interview_reminder:     '/interviews',
};

/**
 * Send a Web Push notification to all active subscriptions for `userId`.
 *
 * @param {number} userId
 * @param {{ title: string, body: string, type?: string, url?: string, tag?: string }} opts
 */
export async function sendPushToUser(userId, { title, body, type = 'info', url, tag }) {
  if (!ensureVapid()) return; // VAPID not configured — silently skip

  let subscriptions;
  try {
    subscriptions = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
  } catch (err) {
    console.error(`[push] DB error fetching subscriptions for user ${userId}:`, err.message);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) return;

  const icon      = ICON_MAP[type] || DEFAULT_ICON;
  const targetUrl = url || URL_MAP[type] || '/';

  const payload = JSON.stringify({
    title,
    body,
    icon,
    badge:  DEFAULT_BADGE,
    url:    targetUrl,
    tag:    tag || type,
    type,
    timestamp: Date.now(),
  });

  const staleEndpoints = [];

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSub, payload);
    } catch (err) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription has expired / been unregistered — clean it up
        staleEndpoints.push(sub.endpoint);
      } else {
        console.error(`[push] Failed to push to user ${userId} (${sub.endpoint.slice(-20)}):`, err.message);
      }
    }
  }

  // Remove stale subscriptions asynchronously
  for (const ep of staleEndpoints) {
    query('DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]).catch(() => {});
  }
}

/**
 * Send a Web Push notification to ALL Admin users.
 * Useful for broadcasting events (task submitted, etc.).
 *
 * @param {{ title: string, body: string, type?: string, url?: string, tag?: string }} opts
 */
export async function sendPushToAdmins(opts) {
  try {
    const admins = await query(
      "SELECT id FROM users WHERE role = 'Admin' AND status = 'Active'"
    );
    await Promise.allSettled(admins.map(a => sendPushToUser(a.id, opts)));
  } catch (err) {
    console.error('[push] sendPushToAdmins error:', err.message);
  }
}
