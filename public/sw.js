/* SIMMS Native Service Worker — Offline-First & Background Sync */
const SW_VERSION = 'simms-pwa-v1';
const STATIC_CACHE = `simms-static-${SW_VERSION}`;
const PAGES_CACHE = `simms-pages-${SW_VERSION}`;
const PUBLIC_API_CACHE = `simms-public-api-${SW_VERSION}`;
const AUTH_CACHE = `simms-auth-${SW_VERSION}`;
const ACTIVE_CACHES = [STATIC_CACHE, PAGES_CACHE, PUBLIC_API_CACHE, AUTH_CACHE];

const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [
  OFFLINE_URL,
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
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
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

function isPublicApi(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isNeverCache(pathname) {
  return NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function cacheFirstOrRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
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
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackOfflinePage) {
      const staticCache = await caches.open(STATIC_CACHE);
      const offlineRes = await staticCache.match(OFFLINE_URL);
      if (offlineRes) return offlineRes;
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

  // Navigasi halaman (HTML)
  if (request.mode === 'navigate') {
    const targetCache = url.pathname.startsWith('/portal')
      ? AUTH_CACHE
      : PAGES_CACHE;
    event.respondWith(networkFirstWithCache(request, targetCache, true));
    return;
  }

  // Aset statis (JS, CSS, Font, Gambar, Ikon)
  if (isStaticAsset(url.pathname)) {
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
