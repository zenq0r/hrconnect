// ZENQOR HRMS/CDTS - Service Worker (installability + light app-shell caching)
// Deliberately network-first for everything: this is a live data system (Firestore/Auth),
// so we never want a stale cached response to shadow real data. Caching only speeds up the
// static shell (HTML/CSS/JS/logo) on repeat visits and satisfies PWA "installable" criteria.

const SHELL_CACHE = 'zenqor-shell-v5';
const SHELL_ASSETS = ['/', '/index.html', '/app.js', '/custom.css', '/tailwind.css', '/logo.png', '/icon-192.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isShellAsset = url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname);
    if (!isShellAsset) return; // let Firebase/API/everything else hit the network normally

    event.respondWith(
        fetch(request, { cache: 'no-store' })
            .then((response) => {
                const clone = response.clone();
                caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
                return response;
            })
            .catch(() => caches.match(request))
    );
});
