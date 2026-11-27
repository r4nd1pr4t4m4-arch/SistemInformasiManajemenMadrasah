'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  clearOfflineQueue,
  flushOfflineQueue,
  getOfflineQueueItems,
  OFFLINE_QUEUE_EVENT,
  removeOfflineQueueItem,
  type OfflineQueueItem,
} from '@/lib/pwa/offline-sync';

function formatQueueTime(createdAt: number | string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OfflineQueuePanel() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);

  const loadItems = useCallback(async () => {
    const list = await getOfflineQueueItems();
    setItems(list);
    if (list.length === 0) setConfirmClear(false);
  }, []);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      void loadItems();
    }, 0);

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
      window.clearTimeout(initTimer);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadItems]);

  async function handleFlush() {
    if (syncing) return;
    setSyncing(true);
    setStatusMsg(null);
    setConfirmClear(false);
    try {
      const res = await flushOfflineQueue();
      if (res.authRequired) {
        setStatusMsg({
          type: 'warn',
          text: 'Sesi login kedaluwarsa. Silakan login ulang sebelum menyinkronkan antrean.',
        });
      } else {
        setStatusMsg({
          type: 'ok',
          text: `Sinkronisasi selesai: ${res.syncedCount} berhasil dikirim, ${res.remainingCount} tersisa.`,
        });
      }
      await loadItems();
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearAll() {
    if (syncing) return;
    await clearOfflineQueue();
    setConfirmClear(false);
    setStatusMsg({ type: 'ok', text: 'Seluruh antrean offline berhasil dikosongkan.' });
    await loadItems();
  }

  async function handleDeleteOne(id: string) {
    if (syncing) return;
    await removeOfflineQueueItem(id);
    await loadItems();
  }

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <CloudOff className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Antrean Sinkronisasi Offline (PWA)</span>
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Daftar transaksi atau input data yang tersimpan lokal saat perangkat offline dan menunggu dikirim ke server.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold ${
              online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-amber-50 text-amber-800 border border-amber-200/70'
            }`}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? 'Perangkat Online' : 'Mode Offline'}
          </span>
          <button
            type="button"
            disabled={syncing || !online || items.length === 0}
            aria-busy={syncing}
            onClick={() => void handleFlush()}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Sinkronkan</span>
          </button>
          {items.length > 0 && !confirmClear && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => setConfirmClear(true)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          )}
        </div>
      </div>

      {confirmClear && items.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span className="font-medium leading-relaxed">
            Hapus permanen <strong>{items.length}</strong> data tertunda yang belum tersinkronisasi?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleClearAll()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Ya, Kosongkan
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div
          role={statusMsg.type === 'warn' ? 'alert' : 'status'}
          className={`p-3 rounded-2xl border text-xs flex items-start justify-between gap-2 ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {statusMsg.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="[overflow-wrap:anywhere]">{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            aria-label="Tutup pesan status sinkronisasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          Tidak ada data tertunda di antrean offline. Seluruh perubahan sudah tersinkronisasi dengan server.
        </div>
      ) : (
        <>
          {/* Kartu Mobile (< sm) */}
          <div className="sm:hidden space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white border border-slate-200 p-3.5 flex items-start justify-between gap-3 min-w-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                      {item.method}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatQueueTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 text-xs [overflow-wrap:anywhere]">
                    {item.label || item.url}
                  </p>
                  <p className="font-mono text-[10px] text-slate-400 [overflow-wrap:anywhere]">
                    {item.url}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleDeleteOne(item.id)}
                  aria-label={`Hapus antrean ${item.label || item.url}`}
                  className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Tabel Desktop (sm+) */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
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
                      {formatQueueTime(item.createdAt)}
                    </td>
                    <td className="px-3.5 py-2.5 min-w-0">
                      <p className="font-semibold text-slate-800 [overflow-wrap:anywhere]">
                        {item.label || item.url}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400 [overflow-wrap:anywhere]">
                        {item.url}
                      </p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                        {item.method}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={syncing}
                        onClick={() => void handleDeleteOne(item.id)}
                        aria-label={`Hapus antrean ${item.label || item.url}`}
                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
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
        </>
      )}
    </div>
  );
}
