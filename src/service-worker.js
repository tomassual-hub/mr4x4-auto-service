// ServisPro Service Worker
// Caches the app shell so it can load offline after the first visit.
// The app now loads live data from Supabase, so real offline USE of the
// data is limited (see the in-app offline-fallback banner for that) — this
// worker's job is narrower: make sure the app shell itself (HTML + the
// external Supabase SDK script it depends on) still opens with no network,
// instead of a blank page.

// __BUILD_ID__ is substituted by build/build.js on every build. This MUST
// change every time the app shell changes — the fetch handler below is
// cache-first, so a returning user's browser keeps serving whatever HTML
// was cached under this name forever, no matter how many fixes ship,
// until this string itself changes and forces a fresh precache. A static
// version string here previously meant every code fix shipped was
// invisible to anyone with the app already installed/cached.
const CACHE_NAME = 'servispro-cache-__BUILD_ID__';
const APP_SHELL = [
  './',
  './ServisPro.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];
// Cross-origin scripts the app can't boot without. Browsers usually keep
// these in the plain HTTP cache too, but that's incidental, not guaranteed
// (eviction, revalidation, private browsing) — caching it ourselves means
// the app shell reliably opens offline instead of depending on that luck.
const THIRD_PARTY_SHELL = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

// Safari refuses to let a service worker answer a page-navigation request
// with a Response whose `redirected` flag is true ("response served by
// service worker has redirections") — Chrome tolerates it, which is why
// this only showed up in Safari. Netlify 301-redirects some of our own
// URLs (e.g. the .html path to a lowercase extensionless one), so a plain
// fetch() following that redirect produces exactly that "redirected"
// response. Rebuilding a fresh Response from its body strips the flag.
async function stripRedirect(response) {
  if (!response || !response.redirected) return response;
  const body = await response.clone().blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          const res = await fetch(url);
          await cache.put(url, await stripRedirect(res));
        } catch (e) { /* best-effort precache; the fetch handler still works live */ }
      }));
      // no-cors so an opaque response is accepted even without CORS headers
      // (opaque responses can't be introspected/rebuilt, but they're never
      // used for navigations, so Safari's redirect restriction doesn't apply)
      await Promise.all(THIRD_PARTY_SHELL.map((url) =>
        fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res)).catch(() => {})
      ));
    })
  );
  self.skipWaiting();
});

// Displays a real OS-level notification for a push sent by the
// notify-support-message Edge Function (see backend/schema.sql and
// supabase/functions/notify-support-message/) -- this fires even if no tab
// of the app is open at all, unlike the in-app unread badge. The payload
// shape (title/body/tag) is produced by that same Edge Function; a missing
// or unparsable payload still shows a generic notification rather than
// silently doing nothing, since some push services deliver an empty push
// as a liveness check.
self.addEventListener('push', (event) => {
  let payload = {};
  try{ payload = event.data ? event.data.json() : {}; }catch(e){ /* not JSON -- fall through to defaults below */ }
  const title = payload.title || 'ServisPro';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'servispro-notification',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: payload.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focuses an already-open tab if one exists, rather than always opening a
// new one -- this app is usually kept open as an installed PWA, so most
// clicks should just bring that existing window forward.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for(const client of clientList){
        if('focus' in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for app shell files, network-first fallback for everything else
// (e.g. Google Fonts, QR code images, Supabase API calls) so the app still
// opens offline once loaded, even though live data obviously needs a network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return stripRedirect(cached);
      try {
        const response = await fetch(request);
        const isSameOrigin = request.url.startsWith(self.location.origin);
        const isThirdPartyShell = THIRD_PARTY_SHELL.includes(request.url);
        if (isSameOrigin && response && response.status === 200) {
          const clean = await stripRedirect(response.clone());
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clean));
          return clean;
        }
        if (isThirdPartyShell) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      } catch (e) {
        return cached; // offline and not cached — fails gracefully, same as before
      }
    })
  );
});
