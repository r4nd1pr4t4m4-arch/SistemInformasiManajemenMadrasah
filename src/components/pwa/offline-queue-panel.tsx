'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  clearOfflineQueue,
  flushOfflineQueue,
  getOfflineQueueItems,
  OFFLINE_QUEUE_EVENT,
  removeOfflineQueueItem,
  type OfflineQueueItem,
} from '@/lib/pwa/offline-sync';

export function OfflineQueuePanel() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const list = await getOfflineQueueItems();
    setItems(list);
  }, []);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    void loadItems();

    const handleQueueChange = () => void loadItems();
    const handleOnline = () => {
      setOnline(true);
      void loadItems();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadItems]);

  async function handleFlush() {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const res = await flushOfflineQueue();
      if (res.authRequired) {
        setStatusMsg('Sesi login kedaluwarsa. Silakan login ulang sebelum menyinkronkan antrean.');
      } else {
        setStatusMsg(
          `Sinkronisasi selesai: ${res.syncedCount} berhasil dikirim, ${res.remainingCount} tersisa.`
        );
      }
      await loadItems();
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearAll() {
    await clearOfflineQueue();
    setStatusMsg('Seluruh antrean offline berhasil dikosongkan.');
    await loadItems();
  }

  async function handleDeleteOne(id: string) {
    await removeOfflineQueueItem(id);
    await loadItems();
  }

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CloudOff className="w-5 h-5 text-emerald-700" />
            <span>Antrean Sinkronisasi Offline (PWA)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar transaksi atau input data yang tersimpan lokal saat perangkat offline dan menunggu dikirim ke server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? 'Perangkat Online' : 'Mode Offline'}
          </span>
          <button
            type="button"
            disabled={syncing || !online || items.length === 0}
            onClick={() => void handleFlush()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sinkronkan Sekarang
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearAll()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          Tidak ada data tertunda di antrean offline. Seluruh perubahan sudah tersinkronisasi dengan server.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Waktu Antre</th>
                <th className="px-3.5 py-2.5">Aksi / Endpoint</th>
                <th className="px-3.5 py-2.5">Metode</th>
                <th className="px-3.5 py-2.5 text-right">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold text-slate-800">{item.label || item.url}</p>
                    <p className="font-mono text-[10px] text-slate-400">{item.url}</p>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                      {item.method}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteOne(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus dari antrean"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
