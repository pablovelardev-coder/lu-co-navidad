// Service worker de Lu & Co.: solo recibe los avisos de pedidos nuevos (no guarda nada en caché).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let m = { title: '🎉 ¡Llegó un pedido nuevo!', body: 'Abre el panel de Lu para verlo.', url: './#panel' };
  try { m = { ...m, ...e.data.json() }; } catch (err) { /* aviso sin datos */ }
  e.waitUntil(self.registration.showNotification(m.title, {
    body: m.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pedido-' + Date.now(), data: { url: m.url },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './#panel', self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) { if ('focus' in v) { await v.focus(); if ('navigate' in v) await v.navigate(url); return; } }
    await self.clients.openWindow(url);
  })());
});
