'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileWarning,
  Home,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface BkSummaryRow {
  student_id: string;
  full_name: string;
  nis: string | null;
  violation_points: number;
  achievement_points: number;
  consultation_count: number;
  recommended_action: string;
}

interface BkRuleRow {
  id: string;
  code: string;
  rule_type: 'PELANGGARAN' | 'PRESTASI';
  title: string;
  default_points: number;
  sanction_hint: string | null;
}

interface BookingRow {
  id: string;
  student_id: string;
  preferred_date: string;
  topic: string;
  status: 'MENUNGGU' | 'DIJADWALKAN' | 'SELESAI' | 'DIBATALKAN';
  counselor_notes: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface HomeVisitRow {
  id: string;
  visit_date: string;
  visited_address: string | null;
  met_with: string | null;
  summary: string;
  follow_up: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
}

type SpLevel = 'SP1' | 'SP2' | 'SP3' | 'PANGGILAN_ORTU';

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function BkKasusLanjutanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BK_MANAGE);

  const [tab, setTab] = useState<'POIN' | 'KATALOG' | 'BOOKING' | 'HOMEVISIT'>('POIN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [summaries, setSummaries] = useState<BkSummaryRow[]>([]);
  const [catalog, setCatalog] = useState<BkRuleRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisitRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);

  const [spModal, setSpModal] = useState<{
    student: BkSummaryRow;
    level: SpLevel;
    reason: string;
  } | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<BkRuleRow | null>(null);

  const [ruleForm, setRuleForm] = useState({
    code: '',
    rule_type: 'PELANGGARAN' as 'PELANGGARAN' | 'PRESTASI',
    title: '',
    default_points: 10,
    sanction_hint: '',
  });

  const [bookingForm, setBookingForm] = useState(() => ({
    student_id: '',
    preferred_date: getTodayWibIso(),
    topic: '',
  }));

  const [visitForm, setVisitForm] = useState(() => ({
    student_id: '',
    visit_date: getTodayWibIso(),
    visited_address: '',
    met_with: '',
    summary: '',
    follow_up: '',
  }));

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const [bkRes, stRes] = await Promise.all([
        fetch('/api/layanan/bk', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/akademik/buku-induk', { cache: 'no-store', signal: controller.signal }),
      ]);
      const bkData = await bkRes.json().catch(() => ({}));
      const stData = await stRes.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!bkRes.ok) {
        setLoadError(bkData.error || 'Gagal memuat data kasus BK.');
      } else {
        setSummaries(bkData.studentPointSummary || []);
        setCatalog(bkData.catalog || []);
        setBookings(bkData.bookings || []);
        setHomeVisits(bkData.homeVisits || []);
      }
      if (stRes.ok) setStudents(stData.students || []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadAll]);

  useEffect(() => {
    if (!spModal && !confirmDeleteRule) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (spModal && !busy) setSpModal(null);
      if (confirmDeleteRule && !deletingRuleId) setConfirmDeleteRule(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [spModal, confirmDeleteRule, busy, deletingRuleId]);

  async function postBk(payload: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/layanan/bk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses permintaan.', 'err');
        return null;
      }
      showToast(msg);
      await loadAll();
      return data;
    } catch {
      showToast('Terjadi kesalahan jaringan saat memproses permintaan.', 'err');
      return null;
    } finally {
      setBusy(false);
    }
  }

  function openSpModal(student: BkSummaryRow, level: SpLevel) {
    setSpModal({
      student,
      level,
      reason: `Akumulasi poin pelanggaran mencapai ${student.violation_points} poin.`,
    });
  }

  async function handleSubmitSp(e: FormEvent) {
    e.preventDefault();
    if (!spModal) return;
    const reason = spModal.reason.trim();
    if (!reason) {
      showToast('Alasan penerbitan surat wajib diisi.', 'err');
      return;
    }
    const { student, level } = spModal;
    const res = await postBk(
      { action: 'ISSUE_SP_LETTER', student_id: student.student_id, letter_level: level, reason },
      `${level.replace('_', ' ')} berhasil diterbitkan ke E-Office Persuratan & notifikasi keluarga terkirim.`
    );
    if (res) {
      setSpModal(null);
      if (res?.letter?.letter_number) {
        showToast(`Draf ${level.replace('_', ' ')} (${res.letter.letter_number}) berhasil dibuat di E-Office Persuratan.`);
      }
    }
  }

  async function handleConfirmDeleteRule() {
    if (!confirmDeleteRule) return;
    setDeletingRuleId(confirmDeleteRule.id);
    try {
      const res = await fetch(
        `/api/layanan/bk?id=${encodeURIComponent(confirmDeleteRule.id)}&target=rule`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus aturan tata tertib.', 'err');
        return;
      }
      showToast(`Aturan "${confirmDeleteRule.code}" berhasil dihapus.`);
      setConfirmDeleteRule(null);
      await loadAll();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus aturan.', 'err');
    } finally {
      setDeletingRuleId(null);
    }
  }

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_RULE', ...ruleForm }, 'Aturan poin berhasil ditambahkan.');
    if (ok) setRuleForm({ code: '', rule_type: 'PELANGGARAN', title: '', default_points: 10, sanction_hint: '' });
  }

  async function handleCreateBooking(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_BOOKING', ...bookingForm }, 'Jadwal konseling berhasil dibuat.');
    if (ok) setBookingForm({ student_id: '', preferred_date: getTodayWibIso(), topic: '' });
  }

  async function handleCreateVisit(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_HOME_VISIT', ...visitForm }, 'Laporan Home Visit berhasil disimpan.');
    if (ok) {
      setVisitForm({
        student_id: '',
        visit_date: getTodayWibIso(),
        visited_address: '',
        met_with: '',
        summary: '',
        follow_up: '',
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
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

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Manajemen Kasus BK, SP1–SP3, Konseling &amp; Home Visit</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau akumulasi poin siswa, terbitkan SP otomatis ke Persuratan, kelola katalog tata tertib, jadwal konseling, &amp; kunjungan rumah.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'POIN', label: `Akumulasi Poin & SP (${summaries.length})`, icon: FileWarning },
              { id: 'KATALOG', label: `Katalog Tata Tertib (${catalog.length})`, icon: BookOpen },
              { id: 'BOOKING', label: `Jadwal Konseling (${bookings.length})`, icon: Calendar },
              { id: 'HOMEVISIT', label: `Home Visit (${homeVisits.length})`, icon: Home },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'POIN' && (
          <div className="space-y-3 text-xs">
            {summaries.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {loading ? 'Memuat rekap poin siswa...' : 'Belum ada rekap poin siswa.'}
              </div>
            ) : (
              summaries.map((s) => (
                <div
                  key={s.student_id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm break-words">{s.full_name}</span>
                      <span className="font-mono text-[10px] text-slate-400">NIS: {s.nis || '-'}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.violation_points >= 50
                            ? 'bg-rose-100 text-rose-800'
                            : s.violation_points >= 25
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Rekomendasi: {s.recommended_action}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Pelanggaran: <strong className="text-rose-700">{s.violation_points} poin</strong> • Prestasi:{' '}
                      <strong className="text-emerald-700">+{s.achievement_points} poin</strong> • Konsultasi:{' '}
                      <strong>{s.consultation_count}x</strong>
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {(['SP1', 'SP2', 'SP3', 'PANGGILAN_ORTU'] as const).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          disabled={busy}
                          onClick={() => openSpModal(s, lv)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 font-semibold text-[11px] transition"
                        >
                          Terbitkan {lv.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'KATALOG' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateRule}
                className="grid sm:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Kode *</label>
                  <input
                    required
                    value={ruleForm.code}
                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                    placeholder="P-01"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Jenis *</label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, rule_type: e.target.value as 'PELANGGARAN' | 'PRESTASI' })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="PELANGGARAN">Pelanggaran</option>
                    <option value="PRESTASI">Prestasi</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">Nama Tata Tertib / Prestasi *</label>
                  <input
                    required
                    value={ruleForm.title}
                    onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                    placeholder="mis. Terlambat masuk > 15 menit"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Poin *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={ruleForm.default_points}
                    onChange={(e) => setRuleForm({ ...ruleForm, default_points: Number(e.target.value) || 5 })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {catalog.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada katalog aturan tata tertib atau prestasi.
                </div>
              ) : (
                catalog.map((r) => (
                  <div
                    key={r.id}
                    className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {r.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          r.rule_type === 'PELANGGARAN'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {r.rule_type} ({r.default_points} poin)
                      </span>
                      <span className="font-semibold text-slate-900 break-words">{r.title}</span>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        disabled={Boolean(deletingRuleId)}
                        onClick={() => setConfirmDeleteRule(r)}
                        aria-label={`Hapus aturan ${r.code}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 shrink-0 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'BOOKING' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateBooking}
                className="grid sm:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">Siswa *</label>
                  <select
                    required
                    value={bookingForm.student_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, student_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Sesi *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.preferred_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, preferred_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Topik Konseling *</label>
                  <input
                    required
                    value={bookingForm.topic}
                    onChange={(e) => setBookingForm({ ...bookingForm, topic: e.target.value })}
                    placeholder="mis. Motivasi belajar / karir"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Jadwalkan
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {bookings.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada jadwal konseling tercatat.
                </div>
              ) : (
                bookings.map((b) => (
                  <div
                    key={b.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
                        {b.student?.full_name || 'Siswa'} — {b.topic}
                      </p>
                      <p className="text-[11px] text-slate-500">Tanggal: {b.preferred_date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 font-bold text-[10px]">
                        {b.status}
                      </span>
                      {canManage && b.status !== 'SELESAI' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void postBk(
                              { action: 'UPDATE_BOOKING', id: b.id, status: 'SELESAI' },
                              'Sesi konseling ditandai selesai.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-[11px] transition"
                        >
                          Selesai
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'HOMEVISIT' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateVisit}
                className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Siswa *</label>
                  <select
                    required
                    value={visitForm.student_id}
                    onChange={(e) => setVisitForm({ ...visitForm, student_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Kunjungan *</label>
                  <input
                    type="date"
                    required
                    value={visitForm.visit_date}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Dikunjungi</label>
                  <input
                    value={visitForm.visited_address}
                    onChange={(e) => setVisitForm({ ...visitForm, visited_address: e.target.value })}
                    placeholder="Alamat rumah orang tua/wali"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bertemu Dengan</label>
                  <input
                    value={visitForm.met_with}
                    onChange={(e) => setVisitForm({ ...visitForm, met_with: e.target.value })}
                    placeholder="mis. Ayah / Ibu Kandung"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Hasil Kunjungan / Berita Acara *</label>
                  <textarea
                    required
                    rows={2}
                    value={visitForm.summary}
                    onChange={(e) => setVisitForm({ ...visitForm, summary: e.target.value })}
                    placeholder="Ringkasan hasil kunjungan rumah..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Simpan Laporan Home Visit
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {homeVisits.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  Belum ada laporan Home Visit tercatat.
                </div>
              ) : (
                homeVisits.map((v) => (
                  <div key={v.id} className="modular-card rounded-2xl p-4 space-y-1 border border-slate-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">{v.student?.full_name || 'Siswa'}</p>
                      <span className="text-[11px] text-slate-400">{v.visit_date}</span>
                    </div>
                    <p className="text-slate-700 break-words">{v.summary}</p>
                    {v.met_with && <p className="text-[11px] text-slate-500">Bertemu: {v.met_with}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Terbitkan SP / Panggilan Orang Tua */}
      {spModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-sp-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setSpModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                  PENERBITAN SURAT BK OTOMATIS
                </span>
                <h2 id="bk-sp-modal-title" className="text-base font-bold text-slate-900 mt-1 break-words">
                  Terbitkan {spModal.level.replace('_', ' ')} — {spModal.student.full_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Akumulasi pelanggaran saat ini: <strong>{spModal.student.violation_points} poin</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSpModal(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSp} className="space-y-4">
              <div>
                <label htmlFor="bk-sp-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penerbitan Surat *
                </label>
                <textarea
                  id="bk-sp-reason"
                  required
                  rows={3}
                  value={spModal.reason}
                  onChange={(e) =>
                    setSpModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                  placeholder="Tuliskan alasan penerbitan surat peringatan / panggilan orang tua..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSpModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Terbitkan {spModal.level.replace('_', ' ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Aturan Tata Tertib */}
      {confirmDeleteRule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-delete-rule-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingRuleId) setConfirmDeleteRule(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 id="bk-delete-rule-title" className="text-base font-bold text-slate-900">
                  Hapus Aturan Tata Tertib?
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Anda akan menghapus aturan{' '}
                  <strong className="font-mono text-slate-900">{confirmDeleteRule.code}</strong> (
                  {confirmDeleteRule.title}). Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingRuleId)}
                onClick={() => setConfirmDeleteRule(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingRuleId)}
                onClick={() => void handleConfirmDeleteRule()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingRuleId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
