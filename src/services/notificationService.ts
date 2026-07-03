/**
 * notificationService.ts
 *
 * Handles:
 *  1. Requesting the browser Notification permission
 *  2. Registering / re-registering the Push subscription with the backend
 *  3. Listening for SW pushsubscriptionchange messages (key rotation)
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// ── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output  = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function postSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  const token = localStorage.getItem('authToken');
  if (!token) return;
  try {
    await fetch('/api/notifications/subscribe', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });
  } catch (err) {
    console.warn('[push] Failed to save subscription to backend:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Request the browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error('[push] requestPermission failed:', err);
    return 'denied';
  }
}

/**
 * Subscribe the current browser to Web Push and register the subscription
 * with the backend.  Safe to call multiple times — no-ops if already subscribed
 * or if permission is not granted.
 */
export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — skipping push subscription');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Re-use existing subscription if still valid
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await postSubscriptionToBackend(existing);
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:    true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await postSubscriptionToBackend(subscription);
  } catch (err) {
    console.error('[push] subscribeToPush failed:', err);
  }
}

/**
 * Listen for PUSH_RESUBSCRIBED messages from the service worker.
 * Called once when the app boots so key-rotation is handled transparently.
 */
export function listenForResubscription(): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'PUSH_RESUBSCRIBED' && event.data.subscription) {
      // Reconstruct a PushSubscription-like object and re-post to backend
      postSubscriptionToBackend(event.data.subscription as PushSubscription);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
