/**
 * Service worker: the app shell, offline, and push notifications.
 *
 * Two jobs, and they are unrelated to each other:
 *
 *  1. Make the app open instantly on a phone. The database sleeps after five
 *     minutes idle and takes up to two seconds to wake, so a cold open used to
 *     be two seconds of white screen. The shell is cached here, which means the
 *     interface is on screen while the data is still coming.
 *
 *  2. Receive push notifications. On iOS this only works for a site added to
 *     the home screen, and only through a service worker — there is no other
 *     route to a notification on that platform.
 *
 * Nothing that returns data is cached. Every page and every API response is
 * fetched from the network: a journal showing yesterday's P&L because it came
 * from a cache would be worse than one that is briefly blank.
 */

const VERSION = 'v1'
const SHELL_CACHE = `tj-shell-${VERSION}`

/** Static, content-addressed or versioned assets — safe to serve from cache. */
const SHELL_ASSETS = ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Next's build output is content-hashed, so a hit is always the right file
  // and a miss simply fetches. Everything else — pages, API, actions — goes to
  // the network so the numbers on screen are the numbers in the database.
  const isStatic =
    url.pathname.startsWith('/_next/static/') || SHELL_ASSETS.includes(url.pathname)
  if (!isStatic) return

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

// ---------------------------------------------------------------------------
// Push

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Trading Journal', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Trading Journal'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Same tag replaces rather than stacks: three balance updates in a row
      // should be one notification showing the latest, not three to dismiss.
      tag: payload.tag || 'trading-journal',
      data: { url: payload.url || '/' },
      timestamp: Date.now(),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  // Focus the app if it is already open rather than opening a second copy.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
