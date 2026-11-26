'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Trash2,
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

export default function CmsPengaduanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BARU' | 'DIPROSES' | 'SELESAI'>('ALL');
  const [search, setSearch] = useState('');
  const [activeRow, setActiveRow] = useState<InquiryRow | null>(null);
  const [replyStatus, setReplyStatus] = useState<InquiryRow['status']>('DIPROSES');
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inquiries', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRows(Array.isArray(data.inquiries) ? data.inquiries : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
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
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm('Hapus pengaduan/aspirasi ini?')) return;
    const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Pengaduan berhasil dihapus.');
      await loadRows();
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-700" />
              <span>Kotak Masuk Pengaduan &amp; Aspirasi Publik</span>
            </h1>
            <p className="text-xs text-slate-500">
              Tindak lanjuti pesan masyarakat dari halaman /kontak; tanggapan dapat dilacak publik via nomor tiket.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode tiket, pengirim, subjek, atau pesan..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'BARU', 'DIPROSES', 'SELESAI'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                  statusFilter === st
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Memuat kotak masuk...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada pengaduan atau aspirasi yang sesuai filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="modular-card rounded-2xl p-4 space-y-2 text-xs border border-slate-200/80"
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
                        {new Date(row.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{row.subject}</p>
                    <p className="text-slate-600">
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        <Send className="w-3 h-3" /> Tindak Lanjuti
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row.id)}
                        className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-slate-700 bg-slate-50 rounded-xl p-3 whitespace-pre-line">
                  {row.message}
                </p>
                {row.response && (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-950">
                    <p className="text-[10px] font-bold uppercase text-emerald-700 mb-0.5">
                      Tanggapan Resmi Lembaga:
                    </p>
                    <p className="whitespace-pre-line">{row.response}</p>
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
          onClick={() => setActiveRow(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-slate-900">
              Tindak Lanjut Pengaduan {activeRow.ticket_code ? `(${activeRow.ticket_code})` : ''}
            </h2>
            <div className="rounded-2xl bg-slate-50 p-3 space-y-1">
              <p className="font-bold text-slate-900">{activeRow.subject}</p>
              <p className="text-slate-600">{activeRow.message}</p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Penanganan</label>
              <select
                value={replyStatus}
                onChange={(e) => setReplyStatus(e.target.value as InquiryRow['status'])}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveResponse()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Tanggapan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
