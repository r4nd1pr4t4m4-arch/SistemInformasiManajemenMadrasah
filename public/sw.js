/* SIMMS Native Service Worker — Offline-First, Background Sync & Web Push */
const SW_VERSION = 'simms-pwa-v5';
const STATIC_CACHE = `simms-static-${SW_VERSION}`;
const PAGES_CACHE = `simms-pages-${SW_VERSION}`;
const PUBLIC_API_CACHE = `simms-public-api-${SW_VERSION}`;
const AUTH_CACHE = `simms-auth-${SW_VERSION}`;
const ACTIVE_CACHES = [STATIC_CACHE, PAGES_CACHE, PUBLIC_API_CACHE, AUTH_CACHE];

const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico',
];

const IDB_NAME = 'simms_pwa_db';
const IDB_VERSION = 1;
const IDB_STORE = 'sync_queue';
const BG_SYNC_TAG = 'simms-bg-sync';

const PUBLIC_API_PREFIXES = [
  '/api/cms/settings',
  '/api/cms/posts',
  '/api/cms/facilities',
  '/api/public/',
];

const NEVER_CACHE_PREFIXES = [
  '/api/auth/',
  '/api/storage/presign',
  '/api/push/',
  '/api/notifikasi',
  '/api/admin/notifikasi',
  '/manifest.webmanifest',
];

/**
 * Ekstrak seluruh URL aset statis (CSS, JS, Font, Ikon) yang direferensikan di dalam HTML
 * agar halaman yang di-precache (seperti /offline) memiliki seluruh bundle CSS & JS di STATIC_CACHE.
 */
function extractHtmlAssetUrls(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return [];
  const urls = new Set();
  const attrRegex = /(?:href|src)=["']([^"']+)["']/gi;
  let match = attrRegex.exec(htmlText);
  while (match !== null) {
    const raw = match[1];
    if (
      raw &&
      (raw.startsWith('/_next/static/') ||
        raw.startsWith('/icons/') ||
        /\.(?:css|js|woff2?|ttf|otf|svg|png|ico)(?:\?[^"']*)?$/i.test(raw))
    ) {
      try {
        const normalized = new URL(raw, self.location.origin);
        if (normalized.origin === self.location.origin) {
          urls.add(normalized.pathname + normalized.search);
        }
      } catch {
        // Abaikan URL tidak valid
      }
    }
    match = attrRegex.exec(htmlText);
  }
  return Array.from(urls);
}

async function precacheAppShell() {
  const staticCache = await caches.open(STATIC_CACHE);
  const pagesCache = await caches.open(PAGES_CACHE);
  const discoveredAssets = new Set();

  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res || !res.ok) return;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const cloneForStatic = res.clone();
          const cloneForPages = res.clone();
          await staticCache.put(url, cloneForStatic);
          await pagesCache.put(url, cloneForPages);

          const html = await res.text();
          for (const assetUrl of extractHtmlAssetUrls(html)) {
            discoveredAssets.add(assetUrl);
          }
        } else {
          await staticCache.put(url, res);
        }
      } catch {
        // Abaikan kegagalan individual saat install
      }
    })
  );

  if (discoveredAssets.size > 0) {
    await Promise.allSettled(
      Array.from(discoveredAssets).map(async (assetUrl) => {
        try {
          const existing = await staticCache.match(assetUrl);
          if (existing) return;
          const res = await fetch(assetUrl, { credentials: 'same-origin' });
          if (res && res.ok) {
            await staticCache.put(assetUrl, res);
          }
        } catch {
          // Abaikan jika gagal memuat salah satu chunk
        }
      })
    );
  }
}

/**
 * Fallback HTML Mandiri (Zero-External-Dependency) apabila cache /offline belum sempat terisi
 * atau chunk CSS eksternal gagal dimuat, sehingga pengguna tidak pernah melihat HTML mentah.
 */
function createSelfContainedOfflineResponse() {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#059669" />
  <title>Mode Offline — SiM-M</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f6f8fb;
      background-image:
        radial-gradient(at 10% 0%, rgba(16, 185, 129, 0.10) 0px, transparent 48%),
        radial-gradient(at 90% 10%, rgba(14, 165, 233, 0.08) 0px, transparent 45%),
        radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.06) 0px, transparent 50%);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      line-height: 1.5;
    }
    .card {
      width: 100%;
      max-width: 28rem;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #e2e8f0;
      border-radius: 1.5rem;
      padding: 2rem 1.75rem;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08);
    }
    .icon-box {
      width: 4rem;
      height: 4rem;
      margin: 0 auto 1.25rem;
      border-radius: 1rem;
      background: #fffbeb;
      border: 1px solid rgba(253, 230, 138, 0.9);
      color: #d97706;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #047857;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.625rem;
    }
    .dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 9999px;
      background: #f59e0b;
    }
    .dot.online { background: #10b981; }
    h1 {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    p.desc {
      font-size: 0.875rem;
      color: #475569;
      margin-bottom: 1.5rem;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 0.875rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      color: #475569;
      margin-bottom: 1.5rem;
    }
    .info-box strong { color: #0f172a; display: block; margin-bottom: 0.25rem; }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }
    @media (min-width: 480px) {
      .actions { flex-direction: row; }
    }
    .btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: #059669;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(5, 150, 105, 0.22);
    }
    .btn-primary:hover { background: #047857; }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
      border-color: #cbd5e1;
    }
    .btn-secondary:hover { background: #f8fafc; }
    .divider {
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
    }
    .shortcut-title {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 0.625rem;
    }
    .shortcuts {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
    .shortcut-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.55rem 0.75rem;
      border-radius: 0.75rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
    }
    .shortcut-link:hover {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #047857;
    }
  </style>
</head>
<body>
  <main class="card" role="main">
    <div class="icon-box" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2" y1="2" x2="22" y2="22"></line>
        <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
        <path d="M2 8.82a15 15 0 0 1 4.17-2.65"></path>
        <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"></path>
        <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"></path>
        <path d="M5 13a10 10 0 0 1 5.24-2.76"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <div class="badge">
      <span id="status-dot" class="dot"></span>
      <span id="status-text">Mode Offline PWA</span>
    </div>
    <h1 id="heading-title">Koneksi Internet Terputus</h1>
    <p id="heading-desc" class="desc">
      Halaman yang Anda tuju belum tersimpan di cache perangkat. Periksa jaringan Wi-Fi atau data seluler Anda, atau kembali ke halaman yang sudah tersimpan.
    </p>
    <div class="info-box">
      <strong>Tips Mode Offline SiM-M:</strong>
      Halaman yang pernah Anda buka saat online akan otomatis tersimpan dan tetap bisa diakses tanpa internet. Halaman ini juga akan memuat ulang otomatis begitu koneksi pulih.
    </div>
    <div class="actions">
      <button type="button" class="btn btn-primary" onclick="window.location.reload()">
        Coba Muat Ulang
      </button>
      <button type="button" class="btn btn-secondary" onclick="if (window.history.length > 1) { window.history.back(); } else { window.location.href = '/'; }">
        Halaman Sebelumnya
      </button>
    </div>
    <div class="divider">
      <p class="shortcut-title">Pintasan Halaman Tersimpan</p>
      <div class="shortcuts">
        <a class="shortcut-link" href="/">Beranda</a>
        <a class="shortcut-link" href="/portal">Dashboard Portal</a>
        <a class="shortcut-link" href="/berita">Berita</a>
        <a class="shortcut-link" href="/verifikasi">Verifikasi QR</a>
      </div>
    </div>
  </main>
  <script>
    window.addEventListener('online', function () {
      var dot = document.getElementById('status-dot');
      var txt = document.getElementById('status-text');
      var title = document.getElementById('heading-title');
      if (dot) dot.className = 'dot online';
      if (txt) txt.textContent = 'Koneksi Kembali Aktif';
      if (title) title.textContent = 'Memuat Ulang Halaman...';
      setTimeout(function () { window.location.reload(); }, 600);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !ACTIVE_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CLEAR_AUTH_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('simms-auth-'))
            .map((k) => caches.delete(k))
        );
      })()
    );
    return;
  }

  if (data.type === 'WARM_STATIC_ASSETS' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        await Promise.allSettled(
          data.urls.map(async (rawUrl) => {
            if (typeof rawUrl !== 'string' || !rawUrl) return;
            try {
              const parsed = new URL(rawUrl, self.location.origin);
              if (parsed.origin !== self.location.origin) return;
              const existing = await cache.match(parsed.href);
              if (existing) return;
              const res = await fetch(parsed.href, { credentials: 'same-origin' });
              if (res && res.ok) {
                await cache.put(parsed.href, res);
              }
            } catch {
              // Abaikan aset yang gagal di-cache
            }
          })
        );
      })()
    );
    return;
  }

  if (data.type === 'TRIGGER_SYNC') {
    event.waitUntil(processSyncQueue());
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/api/pwa/icon') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|css|js)$/i.test(pathname)
  );
}

function isNextRscFlightRequest(request, url) {
  return (
    request.headers.get('RSC') === '1' ||
    url.searchParams.has('_rsc')
  );
}

function isPublicApi(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isNeverCache(pathname) {
  return NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function cacheFirstOrRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached =
    (await cache.match(request)) ||
    (await cache.match(request, { ignoreSearch: true }));

  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type !== 'opaque') {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }
  const networkRes = await networkPromise;
  if (networkRes) return networkRes;
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function networkFirstWithCache(request, cacheName, fallbackOfflinePage) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type !== 'opaque') {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (fallbackOfflinePage
        ? await cache.match(request, { ignoreSearch: true })
        : null);
    if (cached) return cached;

    if (fallbackOfflinePage) {
      const staticCache = await caches.open(STATIC_CACHE);
      const offlineRes =
        (await staticCache.match(OFFLINE_URL)) ||
        (await caches.match(OFFLINE_URL));
      if (offlineRes) return offlineRes;
      return createSelfContainedOfflineResponse();
    }
    return new Response(
      JSON.stringify({
        error: 'Anda sedang offline dan data ini belum tersedia di cache.',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCache(url.pathname)) return;

  // Jangan intercept stream webpack/turbopack HMR di local dev
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  const isLocalDevHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';

  // Navigasi halaman (HTML)
  if (request.mode === 'navigate') {
    const targetCache = url.pathname.startsWith('/portal')
      ? AUTH_CACHE
      : PAGES_CACHE;
    event.respondWith(networkFirstWithCache(request, targetCache, true));
    return;
  }

  // Payload navigasi client-side Next.js App Router (RSC flight data)
  if (isNextRscFlightRequest(request, url)) {
    const targetCache = url.pathname.startsWith('/portal')
      ? AUTH_CACHE
      : PAGES_CACHE;
    event.respondWith(networkFirstWithCache(request, targetCache, false));
    return;
  }

  // Aset statis (JS, CSS, Font, Gambar, Ikon):
  // Pada local dev gunakan network-first (agar perubahan kode tetap segar saat online,
  // namun tetap ter-cache dan berfungsi penuh saat diuji dalam mode Offline).
  // Pada production gunakan cache-first + background revalidate karena nama chunk sudah di-hash.
  if (isStaticAsset(url.pathname)) {
    if (isLocalDevHost && url.pathname.startsWith('/_next/')) {
      event.respondWith(networkFirstWithCache(request, STATIC_CACHE, false));
      return;
    }
    event.respondWith(cacheFirstOrRevalidate(request, STATIC_CACHE));
    return;
  }

  // API publik baca-saja
  if (isPublicApi(url.pathname)) {
    event.respondWith(networkFirstWithCache(request, PUBLIC_API_CACHE, false));
    return;
  }

  // API internal terautentikasi (GET) -> fallback cache terpisah yang dihapus saat logout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, AUTH_CACHE, false));
  }
});

// ============================================================================
// IndexedDB Background Sync Queue Processor
// ============================================================================
function openSyncDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueuedItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => {
      const items = Array.isArray(req.result) ? req.result : [];
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueuedItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function notifyAllClients(message) {
  const allClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });
  for (const client of allClients) {
    client.postMessage(message);
  }
}

async function processSyncQueue() {
  let db;
  try {
    db = await openSyncDb();
  } catch {
    return;
  }

  const items = await getAllQueuedItems(db);
  if (items.length === 0) {
    db.close();
    return;
  }

  let syncedCount = 0;
  let remainingCount = items.length;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method || 'POST',
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: item.body ?? undefined,
        credentials: 'include',
      });

      if (res.status === 401) {
        await notifyAllClients({
          type: 'SYNC_AUTH_REQUIRED',
          remainingCount,
        });
        break;
      }

      // Hapus dari antrean jika berhasil (2xx) atau error klien permanen (4xx selain 408/429)
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        await deleteQueuedItem(db, item.id);
        syncedCount += 1;
        remainingCount -= 1;
      } else {
        // 5xx atau rate-limit -> hentikan dulu, coba lagi saat sync berikutnya
        break;
      }
    } catch {
      // Masih offline
      break;
    }
  }

  db.close();

  if (syncedCount > 0) {
    await notifyAllClients({
      type: 'SYNC_COMPLETED',
      syncedCount,
      remainingCount,
    });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
});

// ============================================================================
// Native Web Push Notification + Delivery & Click Tracking
// ============================================================================
async function sendPushTrackingBeacon(deliveryId, token, eventType) {
  if (!deliveryId || !token) return;
  try {
    await fetch('/api/push/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, token, event: eventType }),
      keepalive: true,
    });
  } catch {
    // Abaikan jika offline / gagal kirim beacon
  }
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'SIMMS',
    body: 'Ada pemberitahuan baru untuk Anda.',
    url: '/portal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'simms-notification',
    deliveryId: '',
    token: '',
    categoryKey: '',
    inAppNotificationId: null,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = { ...data, ...parsed };
      }
    } catch {
      const text = event.data.text();
      if (text) data.body = text;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    tag: data.tag || 'simms-notification',
    renotify: true,
    data: {
      url: data.url || '/portal',
      deliveryId: data.deliveryId || '',
      token: data.token || '',
      categoryKey: data.categoryKey || '',
      inAppNotificationId: data.inAppNotificationId || null,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'SIMMS', options);
      await Promise.allSettled([
        sendPushTrackingBeacon(data.deliveryId, data.token, 'delivered'),
        notifyAllClients({
          type: 'PUSH_RECEIVED',
          categoryKey: data.categoryKey || '',
          title: data.title || 'SIMMS',
          body: data.body || '',
          url: data.url || '/portal',
          inAppNotificationId: data.inAppNotificationId || null,
        }),
      ]);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = (event.notification && event.notification.data) || {};
  const rawUrl = typeof notifData.url === 'string' && notifData.url ? notifData.url : '/portal';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const trackPromise = sendPushTrackingBeacon(
        notifData.deliveryId,
        notifData.token,
        'clicked'
      );

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      let handled = false;
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          try {
            await client.focus();
            if ('navigate' in client && typeof client.navigate === 'function') {
              await client.navigate(targetUrl);
            } else {
              client.postMessage({ type: 'PUSH_NAVIGATE', url: rawUrl });
            }
            handled = true;
            break;
          } catch {
            // Lanjut buka window baru
          }
        }
      }

      if (!handled && self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }

      await trackPromise;
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    notifyAllClients({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
    })
  );
});
