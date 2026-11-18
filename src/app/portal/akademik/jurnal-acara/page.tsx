'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface ConfirmationOpt {
  id: string;
  event_id: string;
  teacher_id: string;
  event_date: string;
  confirmed_by_role: 'ADMIN' | 'GURU_PIKET';
  event?: {
    id: string;
    title: string;
    event_type: 'RUTIN_MINGGUAN' | 'INSIDENTAL';
    location: string | null;
    jtm_allocated: number;
  } | null;
  teacher?: {
    id: string;
    full_name: string;
  } | null;
}

interface EventJournalRow {
  id: string;
  confirmation_id: string;
  teacher_id: string;
  journal_date: string;
  summary: string;
  outcomes: string | null;
  jtm_credited: number;
  event?: { title: string; event_type: string } | null;
  teacher?: { full_name: string } | null;
}

export default function JurnalAcaraPage() {
  const { hasPermission } = usePortalSession();
  const canSubmit = hasPermission(PERMISSIONS.JURNAL_ACARA_SUBMIT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [confirmations, setConfirmations] = useState<ConfirmationOpt[]>([]);
  const [journals, setJournals] = useState<EventJournalRow[]>([]);
  const [currentTeacher, setCurrentTeacher] = useState<{ id: string; full_name: string } | null>(
    null
  );
  const [canManageEvents, setCanManageEvents] = useState(false);

  const [form, setForm] = useState({
    confirmation_id: '',
    summary: '',
    outcomes: '',
  });

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/acara');
      const data = await res.json();
      setConfirmations(data.confirmations || []);
      setJournals(data.journals || []);
      setCurrentTeacher(data.currentTeacher || null);
      setCanManageEvents(Boolean(data.canManageEvents));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const journaledConfirmationIds = useMemo(
    () => new Set(journals.map((j) => j.confirmation_id)),
    [journals]
  );

  // Tampilkan hanya konfirmasi acara milik guru login (yang sudah dikonfirmasi Guru Piket / Admin) dan belum diisi jurnalnya
  const pendingConfirmations = useMemo(() => {
    if (!canManageEvents && !currentTeacher) return [];
    return confirmations.filter((c) => {
      if (journaledConfirmationIds.has(c.id)) return false;
      if (!canManageEvents && currentTeacher) {
        return c.teacher_id === currentTeacher.id;
      }
      return true;
    });
  }, [confirmations, journaledConfirmationIds, canManageEvents, currentTeacher]);

  const visibleJournals = useMemo(() => {
    if (!canManageEvents && !currentTeacher) return [];
    if (!canManageEvents && currentTeacher) {
      return journals.filter((j) => j.teacher_id === currentTeacher.id);
    }
    return journals;
  }, [journals, canManageEvents, currentTeacher]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/acara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_EVENT_JOURNAL',
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal menyimpan Jurnal Acara.');
        return;
      }
      showToast(
        'success',
        `Jurnal Acara berhasil disimpan (${data.percentage ?? 100}%)! +${data.jtmCredited} JTM telah dihitung.`
      );
      setForm({ confirmation_id: '', summary: '', outcomes: '' });
      await loadData();
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat Jurnal Acara...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-700" /> Input Jurnal Acara / Kegiatan
          </h1>
          <p className="text-xs text-slate-600">
            Pilih jadwal acara/kegiatan yang kehadiran Anda telah dikonfirmasi oleh Guru Piket hari
            itu atau Admin, lalu isi Jurnal Acara agar JTM dihitung ke honorarium.
          </p>
        </div>
        {canManageEvents && (
          <Link
            href="/portal/akademik/acara"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 transition"
          >
            <CalendarDays className="w-4 h-4" /> Kelola Acara &amp; Konfirmasi
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canSubmit && (
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Form Input Jurnal Acara</h2>

          {isSundayDate(getWibTodayDateString()) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Hari Minggu tidak ada pengisian Jurnal Acara. Silakan input pada hari Senin atau hari
              aktif berikutnya.
            </div>
          )}

          {!canManageEvents && !currentTeacher ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
              Akun Anda belum terhubung dengan data GTK di <strong>Buku Induk</strong>, sehingga
              Anda belum dapat mengisi Jurnal Acara. Silakan hubungi Admin/Operator untuk menautkan
              akun Anda.
            </div>
          ) : pendingConfirmations.length === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              Belum ada jadwal acara yang dikonfirmasi kehadirannya untuk diisi jurnalnya. Pastikan
              kehadiran Anda pada acara telah dikonfirmasi oleh <strong>Guru Piket hari itu</strong>{' '}
              atau <strong>Admin</strong> di menu Manajemen Acara.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jadwal Acara Terkonfirmasi
                </label>
                <select
                  required
                  value={form.confirmation_id}
                  onChange={(e) => setForm({ ...form, confirmation_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs"
                >
                  <option value="">
                    -- Pilih Acara Terkonfirmasi ({pendingConfirmations.length} tersedia) --
                  </option>
                  {pendingConfirmations.map((c) => {
                    const base = c.event?.jtm_allocated ?? 0;
                    const preview = calculateLateJtm(base, c.event_date);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.event_date} • {c.event?.title} ({c.teacher?.full_name}) •{' '}
                        {preview.creditedJtm}/{base} JTM [
                        {preview.delayDays === 0
                          ? 'Hari Ini 100%'
                          : `H+${preview.delayDays}: ${preview.percentage}%`}
                        ]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ringkasan / Laporan Pelaksanaan Acara
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tuliskan peran Anda dan ringkasan kegiatan acara yang telah dilaksanakan..."
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hasil / Catatan Tindak Lanjut (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan atau tindak lanjut kegiatan..."
                  value={form.outcomes}
                  onChange={(e) => setForm({ ...form, outcomes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || isSundayDate(getWibTodayDateString())}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Jurnal Acara & Hitung JTM'}
              </button>
            </form>
          )}
        </div>
        )}

        <div className={`${canSubmit ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-4`}>
          <h2 className="text-base font-bold text-slate-900">
            Riwayat Jurnal Acara &amp; Perolehan JTM ({visibleJournals.length})
          </h2>

          {visibleJournals.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">
              Belum ada Jurnal Acara yang dikirimkan.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {visibleJournals.map((j) => (
                <div
                  key={j.id}
                  className="modular-card rounded-2xl p-4 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">
                      {j.event?.title || 'Acara Lembaga'}
                    </p>
                    <p className="text-slate-500">
                      {j.journal_date} • {j.teacher?.full_name}
                    </p>
                    <p className="text-slate-700 leading-relaxed">{j.summary}</p>
                    {j.outcomes && (
                      <p className="text-[11px] text-slate-500 italic">Catatan: {j.outcomes}</p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold shrink-0">
                    +{j.jtm_credited} JTM
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
