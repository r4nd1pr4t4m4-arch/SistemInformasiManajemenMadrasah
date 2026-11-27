'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface InquiryRow {
  id: string;
  ticket_code: string | null;
  sender_name: string;
  sender_email: string | null;
  sender_phone: string | null;
  category: 'ASPIRASI' | 'PENGADUAN' | 'INFORMASI';
  subject: string;
  message: string;
  status: 'BARU' | 'DIPROSES' | 'SELESAI';
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

function formatSafeDateTime(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID');
}

export default function CmsPengaduanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BARU' | 'DIPROSES' | 'SELESAI'>('ALL');
  const [search, setSearch] = useState('');
  const [activeRow, setActiveRow] = useState<InquiryRow | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<InquiryRow | null>(null);
  const [replyStatus, setReplyStatus] = useState<InquiryRow['status']>('DIPROSES');
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeRow && !confirmDeleteRow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || saving || deletingId) return;
      if (confirmDeleteRow) setConfirmDeleteRow(null);
      else if (activeRow) setActiveRow(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeRow, confirmDeleteRow, saving, deletingId]);

  const loadRows = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/inquiries', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setRows(Array.isArray(data.inquiries) ? data.inquiries : []);
      } else {
        setLoadError(data.error || 'Gagal memuat kotak masuk pengaduan.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat pengaduan.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return `${r.ticket_code || ''} ${r.sender_name} ${r.subject} ${r.message}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, statusFilter, search]);

  async function handleSaveResponse() {
    if (!canManage || !activeRow || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRow.id,
          status: replyStatus,
          response: replyText.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan tindak lanjut.', 'err');
        return;
      }
      showToast('Status & tanggapan pengaduan berhasil disimpan.');
      setActiveRow(null);
      await loadRows();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan tindak lanjut.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: InquiryRow) {
    if (!canManage || deletingId) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/inquiries?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteRow(null);
        if (activeRow?.id === row.id) setActiveRow(null);
        showToast('Pengaduan berhasil dihapus.');
        await loadRows();
      } else {
        showToast(data.error || 'Gagal menghapus pengaduan.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus pengaduan.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="[overflow-wrap:anywhere]">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Kotak Masuk Pengaduan &amp; Aspirasi Publik</span>
            </h1>
            <p className="text-xs text-slate-500">
              Tindak lanjuti pesan masyarakat dari halaman /kontak; tanggapan dapat dilacak publik via nomor tiket.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadRows()}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Cari pengaduan atau aspirasi"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode tiket, pengirim, subjek, atau pesan..."
              className="w-full min-h-[40px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'BARU', 'DIPROSES', 'SELESAI'] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                  statusFilter === st
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {st === 'ALL' ? `Semua (${rows.length})` : st}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat kotak masuk...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada pengaduan atau aspirasi yang sesuai filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="modular-card rounded-2xl p-4 space-y-2 text-xs border border-slate-200/80 min-w-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.ticket_code && (
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                          {row.ticket_code}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {row.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          row.status === 'SELESAI'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'DIPROSES'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.status}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatSafeDateTime(row.created_at)}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                      {row.subject}
                    </p>
                    <p className="text-slate-600 [overflow-wrap:anywhere]">
                      Pengirim: <strong>{row.sender_name}</strong>
                      {row.sender_email ? ` • ${row.sender_email}` : ''}
                      {row.sender_phone ? ` • ${row.sender_phone}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRow(row);
                          setReplyStatus(row.status === 'BARU' ? 'DIPROSES' : row.status);
                          setReplyText(row.response || '');
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
                      >
                        <Send className="w-3 h-3" /> Tindak Lanjuti
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => setConfirmDeleteRow(row)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
                        title="Hapus"
                        aria-label={`Hapus pengaduan ${row.subject}`}
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-slate-700 bg-slate-50 rounded-xl p-3 whitespace-pre-line [overflow-wrap:anywhere]">
                  {row.message}
                </p>
                {row.response && (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-950">
                    <p className="text-[10px] font-bold uppercase text-emerald-700 mb-0.5">
                      Tanggapan Resmi Lembaga:
                    </p>
                    <p className="whitespace-pre-line [overflow-wrap:anywhere]">{row.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-reply-title"
          onClick={() => {
            if (!saving) setActiveRow(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="inquiry-reply-title" className="text-base font-bold text-slate-900">
                Tindak Lanjut Pengaduan {activeRow.ticket_code ? `(${activeRow.ticket_code})` : ''}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setActiveRow(null)}
                aria-label="Tutup dialog"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 space-y-1">
              <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">{activeRow.subject}</p>
              <p className="text-slate-600 whitespace-pre-line [overflow-wrap:anywhere]">
                {activeRow.message}
              </p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Penanganan</label>
              <select
                value={replyStatus}
                onChange={(e) => setReplyStatus(e.target.value as InquiryRow['status'])}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="BARU">BARU</option>
                <option value="DIPROSES">DIPROSES</option>
                <option value="SELESAI">SELESAI</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tanggapan Resmi (Akan tampil saat pengirim melacak nomor tiket)
              </label>
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Tuliskan tanggapan atau tindak lanjut resmi dari lembaga..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setActiveRow(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveResponse()}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Tanggapan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-inquiry-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteRow(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 id="delete-inquiry-title" className="text-base font-bold text-slate-900">
              Hapus Pengaduan / Aspirasi?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Pesan <strong>&ldquo;{confirmDeleteRow.subject}&rdquo;</strong> dari{' '}
              <strong>{confirmDeleteRow.sender_name}</strong> akan dihapus permanen.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRow(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDelete(confirmDeleteRow)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
