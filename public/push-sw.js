/* global clients */
// Push Notification Handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Troll City Notification';
  const options = {
    body: data.body || 'New update from Troll City!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: data.url || '/',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = (event.notification && event.notification.data) || '/';

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Prefer a visible/focused client if we can
    let client = clientList.find(c => 'focus' in c) || null;

    if (client) {
      await client.focus();

      // Navigate the existing client to the intended URL
      if ('navigate' in client) {
        try { await client.navigate(urlToOpen); } catch {}
      }

      // Optional: tell the app to route internally (if you handle this message client-side)
      client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
      return;
    }

    // No existing window → open a new one
    if (clients.openWindow) {
      await clients.openWindow(urlToOpen);
    }
  })());
});
