const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestPermission(): Promise<NotificationPermission> {
  try {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

export async function subscribeToPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('VITE_VAPID_PUBLIC_KEY is not set — skipping push subscription');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const token = localStorage.getItem('authToken');
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(subscription),
    });
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
  }
}
