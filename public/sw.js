const CACHE_NAME = 'car-racing-v2'

const PRECACHE_URLS = ['/']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
  )
  self.clients.claim()
})

function isAssetRequest(url) {
  const path = url.pathname
  return (
    path.endsWith('.wasm') ||
    path.endsWith('.glb') ||
    path.endsWith('.gltf') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.ico') ||
    path.endsWith('.woff2') ||
    path.endsWith('.woff') ||
    path.endsWith('.mp3') ||
    path.endsWith('.ogg') ||
    path.endsWith('.wav')
  )
}

function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/')
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  if (isAssetRequest(url) || isHashedAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          })
        }),
      ),
    )
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')))
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
