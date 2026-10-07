// Loaded by the generated service worker (workbox.importScripts). Handles taps on notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.url) || '#/';
  const target = self.registration.scope + hash;

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        if ('navigate' in client) {
          // eslint-disable-next-line no-unused-vars
          try { await client.navigate(target); } catch (e) { /* the window is already focused */ }
        }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});