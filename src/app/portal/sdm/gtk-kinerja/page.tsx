'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Award,
  Briefcase,
  CalendarOff,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import { normalizeDecimalInput, parseDecimalInput } from '@/lib/validation/decimal';

interface TeacherOpt {
  id: string;
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  staff_type: string;
  employment_status: string | null;
}

interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  teacher?: { full_name: string; nip: string | null } | null;
}

interface HistoryRow {
  id: string;
  position_title: string;
  unit_or_institution: string | null;
  start_date: string | null;
  end_date: string | null;
  teacher?: { full_name: string } | null;
}

interface EvalRow {
  id: string;
  record_type: string;
  title: string;
  period_year: number;
  score: number | null;
  organizer: string | null;
  teacher?: { full_name: string } | null;
}

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

export default function SdmGtkModernPage() {
  const [tab, setTab] = useState<'CUTI' | 'RIWAYAT' | 'PKG' | 'IDCARD'>('CUTI');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvalRow[]>([]);

  const [selectedCardTeacherId, setSelectedCardTeacherId] = useState('');
  const [cardQrUrl, setCardQrUrl] = useState('');

  const [leaveForm, setLeaveForm] = useState(() => {
    const today = getTodayWibIso();
    return {
      teacher_id: '',
      leave_type: 'TAHUNAN' as 'TAHUNAN' | 'SAKIT' | 'MELAHIRKAN' | 'DINAS' | 'LAINNYA',
      start_date: today,
      end_date: today,
      reason: '',
    };
  });
  const [histForm, setHistForm] = useState({
    teacher_id: '',
    position_title: '',
    unit_or_institution: '',
    start_date: '',
    end_date: '',
  });
  const [evalForm, setEvalForm] = useState({
    teacher_id: '',
    record_type: 'PKG' as 'PKG' | 'SUPERVISI' | 'DIKLAT' | 'SERTIFIKASI',
    title: '',
    period_year: new Date().getFullYear(),
    score: '90',
    organizer: '',
  });

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/sdm/gtk-modern', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat data SDM GTK.');
      } else {
        setIsAdmin(Boolean(data.isAdmin));
        const tList = (data.teachers || []) as TeacherOpt[];
        setTeachers(tList);
        setLeaves(data.leaves || []);
        setHistories(data.histories || []);
        setEvaluations(data.evaluations || []);
        if (tList.length > 0) {
          setSelectedCardTeacherId((prev) => prev || tList[0].id);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  const activeCardTeacher = teachers.find((t) => t.id === selectedCardTeacherId) || teachers[0] || null;

  useEffect(() => {
    if (!activeCardTeacher) return;
    let cancelled = false;
    const ref = activeCardTeacher.nip || activeCardTeacher.nuptk || activeCardTeacher.id;
    const url = buildVerificationUrl({ ref });
    QRCode.toDataURL(url, { width: 160, margin: 1 })
      .then((u) => {
        if (!cancelled) setCardQrUrl(u);
      })
      .catch(() => {
        if (!cancelled) setCardQrUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeCardTeacher]);

  async function postAction(payload: Record<string, unknown>, msg: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/sdm/gtk-modern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan data.', 'err');
        return false;
      }
      showToast(msg);
      await loadData();
      return true;
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan data.', 'err');
      return false;
    } finally {
      setSaving(false);
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
            onClick={() => void loadData()}
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
              <Briefcase className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Manajemen SDM GTK Modern (Cuti, Riwayat, PKG &amp; ID Card)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola cuti/izin GTK, riwayat jabatan kepegawaian, PKG/Supervisi/Diklat, dan Kartu Identitas Digital GTK ber-QR.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'CUTI', label: `Cuti & Izin (${leaves.length})`, icon: CalendarOff },
              { id: 'RIWAYAT', label: `Riwayat Jabatan (${histories.length})`, icon: Briefcase },
              { id: 'PKG', label: `PKG & Diklat (${evaluations.length})`, icon: Award },
              { id: 'IDCARD', label: 'ID Card Digital GTK', icon: CreditCard },
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
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'CUTI' && (
          <div className="space-y-4 text-xs">
            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                if (leaveForm.end_date < leaveForm.start_date) {
                  showToast('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.', 'err');
                  return;
                }
                const ok = await postAction(
                  { action: 'CREATE_LEAVE', ...leaveForm, teacher_id: leaveForm.teacher_id || undefined },
                  'Pengajuan cuti/izin GTK berhasil dikirim.'
                );
                if (ok) setLeaveForm((p) => ({ ...p, reason: '' }));
              }}
              className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
            >
              {isAdmin && (
                <select
                  value={leaveForm.teacher_id}
                  onChange={(e) => setLeaveForm({ ...leaveForm, teacher_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Pilih GTK --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={leaveForm.leave_type}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, leave_type: e.target.value as typeof leaveForm.leave_type })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="TAHUNAN">Cuti Tahunan</option>
                <option value="SAKIT">Cuti Sakit</option>
                <option value="MELAHIRKAN">Cuti Melahirkan</option>
                <option value="DINAS">Tugas Dinas</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
              <input
                type="date"
                required
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <input
                type="date"
                required
                min={leaveForm.start_date}
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <input
                required
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Alasan cuti/izin *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Ajukan Cuti / Izin
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {leaves.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat data cuti & izin...' : 'Belum ada pengajuan cuti atau izin GTK.'}
                </div>
              ) : (
                leaves.map((l) => (
                  <div
                    key={l.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
                        {l.teacher?.full_name || 'GTK'} — {l.leave_type} ({l.start_date} s/d {l.end_date})
                      </p>
                      <p className="text-slate-600 break-words">{l.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'DISETUJUI'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'DITOLAK'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.status}
                      </span>
                      {isAdmin && l.status === 'MENUNGGU' && (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void postAction({ action: 'REVIEW_LEAVE', id: l.id, status: 'DISETUJUI' }, 'Cuti disetujui.')
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void postAction({ action: 'REVIEW_LEAVE', id: l.id, status: 'DITOLAK' }, 'Cuti ditolak.')
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-semibold transition"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'RIWAYAT' && (
          <div className="space-y-4 text-xs">
            {isAdmin && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  const ok = await postAction(
                    { action: 'CREATE_HISTORY', ...histForm },
                    'Riwayat jabatan kepegawaian berhasil ditambahkan.'
                  );
                  if (ok) setHistForm({ teacher_id: '', position_title: '', unit_or_institution: '', start_date: '', end_date: '' });
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <select
                  required
                  value={histForm.teacher_id}
                  onChange={(e) => setHistForm({ ...histForm, teacher_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Pilih GTK --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={histForm.position_title}
                  onChange={(e) => setHistForm({ ...histForm, position_title: e.target.value })}
                  placeholder="Jabatan (mis. Waka Kurikulum) *"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  value={histForm.unit_or_institution}
                  onChange={(e) => setHistForm({ ...histForm, unit_or_institution: e.target.value })}
                  placeholder="Unit / Lembaga"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  type="date"
                  value={histForm.start_date}
                  onChange={(e) => setHistForm({ ...histForm, start_date: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah
                </button>
              </form>
            )}
            <div className="space-y-2">
              {histories.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat riwayat jabatan...' : 'Belum ada riwayat jabatan kepegawaian tercatat.'}
                </div>
              ) : (
                histories.map((h) => (
                  <div key={h.id} className="modular-card rounded-2xl p-4 border border-slate-200/80">
                    <p className="font-bold text-slate-900 break-words">
                      {h.teacher?.full_name || 'GTK'} — {h.position_title}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {h.unit_or_institution || '-'} • {h.start_date || '-'} s/d {h.end_date || 'Sekarang'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'PKG' && (
          <div className="space-y-4 text-xs">
            {isAdmin && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  const trimmedScore = evalForm.score.trim();
                  const parsedScore =
                    trimmedScore === '' ? null : parseDecimalInput(trimmedScore);
                  if (
                    trimmedScore !== '' &&
                    (parsedScore === null || parsedScore < 0 || parsedScore > 100)
                  ) {
                    showToast('Nilai harus berupa angka antara 0 sampai 100.', 'err');
                    return;
                  }
                  const ok = await postAction(
                    {
                      action: 'CREATE_EVALUATION',
                      ...evalForm,
                      score:
                        parsedScore !== null ? Math.round(parsedScore * 100) / 100 : null,
                    },
                    'Data PKG / Supervisi / Diklat berhasil disimpan.'
                  );
                  if (ok) setEvalForm((p) => ({ ...p, title: '', organizer: '' }));
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <select
                  required
                  value={evalForm.teacher_id}
                  onChange={(e) => setEvalForm({ ...evalForm, teacher_id: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="">-- Pilih GTK --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <select
                  value={evalForm.record_type}
                  onChange={(e) =>
                    setEvalForm({ ...evalForm, record_type: e.target.value as typeof evalForm.record_type })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="PKG">PKG (Kinerja Guru)</option>
                  <option value="SUPERVISI">Supervisi Kelas</option>
                  <option value="DIKLAT">Diklat / Pelatihan</option>
                  <option value="SERTIFIKASI">Sertifikasi</option>
                </select>
                <input
                  required
                  value={evalForm.title}
                  onChange={(e) => setEvalForm({ ...evalForm, title: e.target.value })}
                  placeholder="Judul PKG / Diklat *"
                  className="lg:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={evalForm.score}
                  onChange={(e) =>
                    setEvalForm({ ...evalForm, score: normalizeDecimalInput(e.target.value) })
                  }
                  placeholder="Nilai (0-100, mis. 88.5)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Simpan
                </button>
              </form>
            )}
            <div className="space-y-2">
              {evaluations.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat data PKG & diklat...' : 'Belum ada data PKG, supervisi, atau diklat tercatat.'}
                </div>
              ) : (
                evaluations.map((ev) => (
                  <div
                    key={ev.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] mr-2">
                        {ev.record_type} {ev.period_year}
                      </span>
                      <span className="font-bold text-slate-900 break-words">
                        {ev.teacher?.full_name || 'GTK'} — {ev.title}
                      </span>
                    </div>
                    {ev.score !== null && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-mono font-bold shrink-0">
                        Nilai: {ev.score}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'IDCARD' && (
          <div className="space-y-4 text-xs">
            {teachers.length > 1 && (
              <select
                value={selectedCardTeacherId}
                onChange={(e) => setSelectedCardTeacherId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-semibold max-w-full"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.staff_type})
                  </option>
                ))}
              </select>
            )}
            {activeCardTeacher ? (
              <div className="max-w-md rounded-3xl overflow-hidden shadow-xl border border-emerald-200 bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">
                      Kartu Identitas Digital GTK
                    </p>
                    <p className="text-sm font-extrabold">SIMMS — Resmi Lembaga</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-bold shrink-0">
                    {activeCardTeacher.staff_type}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-lg font-black leading-tight break-words">
                      {activeCardTeacher.full_name}
                    </p>
                    <p className="text-xs text-emerald-100 font-mono break-all">
                      NIP: {activeCardTeacher.nip || '-'}
                    </p>
                    <p className="text-xs text-emerald-100 font-mono break-all">
                      NUPTK: {activeCardTeacher.nuptk || '-'}
                    </p>
                    <p className="text-[11px] text-emerald-200">
                      Status: {activeCardTeacher.employment_status || 'AKTIF'}
                    </p>
                  </div>
                  {cardQrUrl && (
                    <div className="bg-white p-2 rounded-2xl shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cardQrUrl} alt="QR GTK" className="w-24 h-24" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {loading ? 'Memuat data GTK...' : 'Belum ada data GTK untuk ditampilkan.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
