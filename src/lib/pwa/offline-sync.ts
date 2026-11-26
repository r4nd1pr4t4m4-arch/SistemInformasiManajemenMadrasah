'use client';

const IDB_NAME = 'simms_pwa_db';
const IDB_VERSION = 1;
const IDB_STORE = 'sync_queue';
export const BG_SYNC_TAG = 'simms-bg-sync';
export const OFFLINE_QUEUE_EVENT = 'simms-offline-queue-changed';
export const LAST_PATH_STORAGE_KEY = 'simms_pwa_last_path';

export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  label?: string;
  createdAt: number;
}

export interface FlushQueueResult {
  syncedCount: number;
  remainingCount: number;
  authRequired: boolean;
}

const EXCLUDED_QUEUE_PREFIXES = [
  '/api/auth/',
  '/api/storage/',
  '/api/public/',
  '/api/pwa/',
];

const QUEUEABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
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

function dispatchQueueChanged(detail?: {
  count?: number;
  syncedCount?: number;
  authRequired?: boolean;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail }));
}

export function shouldQueueOfflineMutation(
  urlPath: string,
  method?: string,
  body?: BodyInit | null
): boolean {
  const normalizedMethod = (method || 'GET').toUpperCase();
  if (!QUEUEABLE_METHODS.has(normalizedMethod)) return false;
  if (!urlPath.startsWith('/api/')) return false;
  if (EXCLUDED_QUEUE_PREFIXES.some((prefix) => urlPath.startsWith(prefix))) {
    return false;
  }
  // Jangan antrekan unggahan file biner/FormData
  if (
    typeof FormData !== 'undefined' &&
    body instanceof FormData
  ) {
    return false;
  }
  if (
    typeof Blob !== 'undefined' &&
    body instanceof Blob
  ) {
    return false;
  }
  return true;
}

export async function enqueueOfflineMutation(input: {
  url: string;
  method: string;
  headers?: HeadersInit;
  body?: string | null;
  label?: string;
}): Promise<OfflineQueueItem | null> {
  try {
    const db = await openDb();
    const headerRecord: Record<string, string> = {};
    if (input.headers) {
      const h = new Headers(input.headers);
      h.forEach((value, key) => {
        headerRecord[key] = value;
      });
    }
    if (!headerRecord['content-type'] && !headerRecord['Content-Type']) {
      headerRecord['Content-Type'] = 'application/json';
    }

    const item: OfflineQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      url: input.url,
      method: input.method.toUpperCase(),
      headers: headerRecord,
      body: input.body ?? null,
      label: input.label,
      createdAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    // Daftarkan Background Sync API pada browser yang mendukung (Android/Chromium)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const syncManager = (
          reg as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          }
        ).sync;
        if (syncManager) {
          await syncManager.register(BG_SYNC_TAG);
        }
      } catch {
        // Fallback otomatis via online event di client
      }
    }

    const count = await getOfflineQueueCount();
    dispatchQueueChanged({ count });
    return item;
  } catch {
    return null;
  }
}

export async function getOfflineQueueItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDb();
    const items = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as OfflineQueueItem[]) : [];
        list.sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
  } catch {
    return [];
  }
}

export async function getOfflineQueueCount(): Promise<number> {
  const items = await getOfflineQueueItems();
  return items.length;
}

async function deleteQueueItemById(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  try {
    await deleteQueueItemById(id);
    const count = await getOfflineQueueCount();
    dispatchQueueChanged({ count });
  } catch {
    // abaikan jika IndexedDB tidak tersedia
  }
}

let flushInFlight: Promise<FlushQueueResult> | null = null;

export async function flushOfflineQueue(): Promise<FlushQueueResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const count = await getOfflineQueueCount();
    return { syncedCount: 0, remainingCount: count, authRequired: false };
  }

  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const items = await getOfflineQueueItems();
    if (items.length === 0) {
      return { syncedCount: 0, remainingCount: 0, authRequired: false };
    }

    let syncedCount = 0;
    let remainingCount = items.length;
    let authRequired = false;

    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body ?? undefined,
          credentials: 'include',
        });

        if (res.status === 401) {
          authRequired = true;
          break;
        }

        if (
          res.ok ||
          (res.status >= 400 &&
            res.status < 500 &&
            res.status !== 408 &&
            res.status !== 429)
        ) {
          await deleteQueueItemById(item.id);
          syncedCount += 1;
          remainingCount -= 1;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    dispatchQueueChanged({ count: remainingCount, syncedCount, authRequired });
    return { syncedCount, remainingCount, authRequired };
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}

export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    dispatchQueueChanged({ count: 0 });
  } catch {
    // abaikan jika IndexedDB tidak tersedia
  }
}

export async function clearServiceWorkerAuthCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_PATH_STORAGE_KEY);
  } catch {
    // abaikan
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_AUTH_CACHES' });
    }
  } catch {
    // abaikan
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('simms-auth-'))
          .map((key) => window.caches.delete(key))
      );
    }
  } catch {
    // abaikan
  }
}
