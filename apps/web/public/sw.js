self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Pádel'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
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
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
