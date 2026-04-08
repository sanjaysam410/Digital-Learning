import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { clientsClaim } from 'workbox-core';

// Claim clients so the SW takes control immediately upon activation
self.skipWaiting();
clientsClaim();

// Precache resources and app shell mapped by Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Strategy: Lesson API — Network First (Cache Fallback)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/lessons'),
    new NetworkFirst({
        cacheName: 'lessons-api',
        networkTimeoutSeconds: 5,
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 })
        ]
    })
);

// Strategy: Quizzes API — Network First (Cache Fallback)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/quizzes'),
    new NetworkFirst({
        cacheName: 'quizzes-api',
        networkTimeoutSeconds: 5,
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 })
        ]
    })
);

// Strategy: Custom Content Media (e.g. AWS S3 or relative media files) — Cache First
registerRoute(
    ({ request, url }) => request.destination === 'video' || request.destination === 'document' || url.pathname.match(/\.(mp4|pdf)$/),
    new CacheFirst({
        cacheName: 'lesson-media',
        plugins: [
            new RangeRequestsPlugin(),
            new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 3600 })
        ]
    })
);

// Strategy: User/Progress API — Network First
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/users') && !url.pathname.includes('/login'),
    new NetworkFirst({
        cacheName: 'user-data',
        networkTimeoutSeconds: 3,
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 3600 })
        ]
    })
);

// Strategy: Fonts/Icons — Stale While Revalidate
registerRoute(
    ({ request }) => request.destination === 'font' || request.destination === 'image',
    new StaleWhileRevalidate({
        cacheName: 'fonts-and-images',
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 365 * 24 * 3600 })
        ]
    })
);

// Strategy: Chat API — Network Only (never cache)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/chat'),
    new NetworkOnly()
);

self.addEventListener('sync', (event) => {
    // Basic background sync tag handling fallback
    console.log('[SW] Background sync event triggered:', event.tag);
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'nightly-sync') {
        event.waitUntil(
            (async () => {
                console.log('[SW] Nightly sync triggered');
                // Future: implement nightly data prefetch here
            })()
        );
    }
});
