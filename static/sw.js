const CACHE_NAME = 'openxnet-shell-v20260515-theme-runtime3';
const urlsToCache = [
  '/source/icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const accept = request.headers.get('accept') || '';
  const isShellDocument = request.mode === 'navigate' || accept.includes('text/html');
  const isStaticSource = /\.(?:css|js|json|html)$/i.test(new URL(request.url).pathname);

  if (isShellDocument || isStaticSource) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});





