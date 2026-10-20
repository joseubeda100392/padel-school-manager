self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Pádel'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/', notificationId: data.notificationId || null },
    requireInteraction: false,
  }
  // Si la app está abierta, se le avisa también para que lo enseñe dentro y
  // actualice la campanita (si no, solo se enteraba el sistema del móvil).
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) client.postMessage({ type: 'push', title, body: options.body, url: options.data.url })
    }),
  ]))
})

// Que una versión nueva de este archivo se use en cuanto se descarga, sin
// esperar a que se cierren todas las pestañas de la app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  const notificationId = event.notification.data?.notificationId
  // Se marca como leída ANTES de abrir la app, para que la campanita ya no la
  // cuente al cargar. Si falla, se abre igual.
  const markRead = notificationId
    ? fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: notificationId }),
      }).catch(() => {})
    : Promise.resolve()
  event.waitUntil(
    markRead.then(() => clients.matchAll({ type: 'window', includeUncontrolled: true })).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          client.postMessage({ type: 'refresh' })
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
