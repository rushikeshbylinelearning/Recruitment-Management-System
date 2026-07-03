/**
 * service-worker.js
 * Handles Web Push payloads and notification click events.
 *
 * Payload shape sent from the backend:
 * {
 *   title:     string,
 *   body:      string,
 *   icon?:     string,
 *   badge?:    string,
 *   url?:      string,
 *   tag?:      string,
 *   type?:     string,
 *   timestamp: number,
 * }
 */

const APP_ORIGIN  = self.location.origin;
const ICON_192    = '/icons/icon-192.png';
const BADGE_72    = '/icons/badge-72.png';

// ── Push received ────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'HR Portal', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'HR Portal';
  const body  = payload.body  || '';
  const type  = payload.type  || 'info';
  const url   = payload.url   || routeForType(type);
  const tag   = payload.tag   || type;

  const options = {
    body,
    icon:             ICON_192,
    badge:            BADGE_72,
    tag,
    renotify:         true,          // vibrate even if same tag replaces old one
    requireInteraction: false,
    silent:           false,
    vibrate:          [120, 60, 120],
    timestamp:        payload.timestamp || Date.now(),
    data:             { url, type },
    actions:          actionsForType(type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action       = event.action;
  const targetUrl    = notification.data?.url || '/';

  notification.close();

  if (action === 'dismiss') return;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Re-use an open app tab — navigate it to the target route
        for (const client of clientList) {
          if (client.url.startsWith(APP_ORIGIN) && 'navigate' in client) {
            client.navigate(APP_ORIGIN + targetUrl);
            return client.focus();
          }
        }
        // No open tab — open one
        if (clients.openWindow) {
          return clients.openWindow(APP_ORIGIN + targetUrl);
        }
      })
  );
});

// ── Push subscription key rotation ──────────────────────────────────────────

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resubscribe(event));
});

async function resubscribe(event) {
  try {
    const appServerKey = event.oldSubscription?.options?.applicationServerKey;
    const newSub = await self.registration.pushManager.subscribe({
      userVisibleOnly:    true,
      applicationServerKey: appServerKey,
    });
    const clientList = await clients.matchAll({ type: 'window' });
    for (const client of clientList) {
      client.postMessage({ type: 'PUSH_RESUBSCRIBED', subscription: newSub.toJSON() });
    }
  } catch (err) {
    console.error('[SW] resubscribe failed:', err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function routeForType(type) {
  if (type === 'task_update' || type === 'task_assigned') return '/tasks';
  if (type.startsWith('interview')) return '/interviews';
  return '/';
}

function actionsForType(type) {
  if (type === 'task_update' || type === 'task_assigned') {
    return [
      { action: 'view',    title: '📋  View Tasks' },
      { action: 'dismiss', title: 'Dismiss'         },
    ];
  }
  if (type.startsWith('interview')) {
    return [
      { action: 'view',    title: '📅  View Interview' },
      { action: 'dismiss', title: 'Dismiss'             },
    ];
  }
  return [
    { action: 'view',    title: 'Open' },
    { action: 'dismiss', title: 'Dismiss' },
  ];
}
