self.addEventListener('push', (event) => {
  let title = 'Notification';
  let body = '';

  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || title;
    body = data.body || body;
  } catch (e) {
    body = event.data ? event.data.text() : '';
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
