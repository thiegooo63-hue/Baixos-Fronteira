const CACHE = 'baixos-fronteira-v10'
const CORE = ['/', '/agenda', '/e/quinta', '/offline.html', '/assets/logo-baixos-fronteira.png', '/assets/favicon.svg', '/icons/pwa-192.png', '/icons/pwa-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => null))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/admin')) return
  if (url.pathname.startsWith('/rest/') || url.pathname.includes('supabase.co')) return
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
      return response
    }).catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html'))))
    return
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/_next/static/'))) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
    }
    return response
  })))
})

self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting() })

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification?.data?.url || '/e/quinta'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      existing.navigate(target)
      return existing.focus()
    }
    return clients.openWindow(target)
  }))
})
