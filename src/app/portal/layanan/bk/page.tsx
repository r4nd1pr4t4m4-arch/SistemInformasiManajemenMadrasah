'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

interface StudentOpt {
  id: string;
  full_name: string;
  nis?: string | null;
}

interface AcademicYearOpt {
  id: string;
  name: string;
  semester: string;
  is_active: boolean;
}

interface BkRecordRow {
  id: string;
  student_id?: string;
  academic_year_id?: string | null;
  is_archived?: boolean;
  record_type: string;
  title: string;
  points: number;
  incident_date: string;
  description?: string | null;
  is_confidential?: boolean;
  student?: { id?: string; full_name: string; nis?: string | null } | null;
  counselor?: { full_name: string } | null;
  academic_year?: { id: string; name: string; semester: string; is_active: boolean } | null;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type BkRecordType = 'PELANGGARAN' | 'PRESTASI' | 'KONSULTASI';

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BkPage() {
  const { roles, hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BK_MANAGE);
  const isGuruBk = roles.includes('GURU_BK');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [records, setRecords] = useState<BkRecordRow[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOpt[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYearOpt | null>(null);

  // Default hanya menampilkan data pada tahun pelajaran yang aktif sekarang
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('ACTIVE');
  const [recordSearch, setRecordSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | BkRecordType>('ALL');

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<BkRecordRow | null>(null);

  const [bkForm, setBkForm] = useState(() => ({
    student_id: '',
    record_type: 'PELANGGARAN' as BkRecordType,
    title: '',
    points: 0,
    incident_date: getTodayIsoDate(),
    description: '',
    is_confidential: false,
  }));

  const effectiveRecordType: BkRecordType =
    !isGuruBk && bkForm.record_type === 'KONSULTASI' ? 'PELANGGARAN' : bkForm.record_type;

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteRecord) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteRecord(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteRecord, deletingId]);

  const fetchBkData = useCallback(async (targetAcademicYearId: string) => {
    const qs = `?academicYearId=${encodeURIComponent(targetAcademicYearId)}`;
    const [biRes, bkRes] = await Promise.all([
      fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
      fetch(`/api/layanan/bk${qs}`, { cache: 'no-store' }),
    ]);

    const bi = await biRes.json().catch(() => null);
    const bk = await bkRes.json().catch(() => null);

    if (!bkRes.ok || !bk) {
      throw new Error(bk?.error || 'Gagal memuat data Bimbingan Konseling dari server.');
    }
    if (!biRes.ok || !bi) {
      throw new Error(bi?.error || 'Gagal memuat daftar siswa dari server.');
    }

    return {
      students: (bi.students || []) as StudentOpt[],
      records: (bk.records || []) as BkRecordRow[],
      academicYears: (bk.academicYears || []) as AcademicYearOpt[],
      activeAcademicYear: (bk.activeAcademicYear || null) as AcademicYearOpt | null,
    };
  }, []);

  const loadData = useCallback(
    async (
      mode: 'initial' | 'refresh' = 'refresh',
      targetYear: string = academicYearFilter
    ) => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchBkData(targetYear);
        setStudents(data.students);
        setRecords(data.records);
        setAcademicYears(data.academicYears);
        setActiveAcademicYear(data.activeAcademicYear);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data BK.';
        if (mode === 'initial') {
          setLoadError(message);
        } else {
          showToast(message, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [academicYearFilter, fetchBkData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBkData(academicYearFilter);
        if (!cancelled) {
          setStudents(data.students);
          setRecords(data.records);
          setAcademicYears(data.academicYears);
          setActiveAcademicYear(data.activeAcademicYear);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data BK.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearFilter, fetchBkData]);

  function resetForm() {
    setEditingRecordId(null);
    setBkForm({
      student_id: '',
      record_type: 'PELANGGARAN',
      title: '',
      points: 0,
      incident_date: getTodayIsoDate(),
      description: '',
      is_confidential: false,
    });
  }

  function startEditRecord(r: BkRecordRow) {
    if (r.is_archived) return;
    if (r.record_type === 'KONSULTASI' && !isGuruBk) {
      showToast('Hanya Guru BK yang dapat mengedit catatan Konsultasi BK.', 'error');
      return;
    }
    setEditingRecordId(r.id);
    setBkForm({
      student_id: r.student_id || r.student?.id || '',
      record_type: (r.record_type as BkRecordType) || 'PELANGGARAN',
      title: r.title || '',
      points: Number(r.points) || 0,
      incident_date: r.incident_date || getTodayIsoDate(),
      description: r.description || '',
      is_confidential: Boolean(r.is_confidential),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submitting) return;

    const trimmedTitle = bkForm.title.trim();
    const trimmedDesc = bkForm.description.trim();

    if (!editingRecordId && !bkForm.student_id) {
      showToast('Pilih siswa terlebih dahulu.', 'error');
      return;
    }
    if (trimmedTitle.length < 2) {
      showToast('Judul catatan BK minimal 2 karakter.', 'error');
      return;
    }
    if (trimmedDesc.length < 3) {
      showToast('Deskripsi & tindak lanjut minimal 3 karakter.', 'error');
      return;
    }
    const safePoints = Number.isFinite(bkForm.points) ? Math.round(bkForm.points) : 0;

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingRecordId);
      const res = await fetch('/api/layanan/bk', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing
            ? {
                id: editingRecordId,
                record_type: effectiveRecordType,
                title: trimmedTitle,
                points: safePoints,
                description: trimmedDesc,
                is_confidential:
                  effectiveRecordType === 'KONSULTASI' ? bkForm.is_confidential : false,
              }
            : {
                ...bkForm,
                record_type: effectiveRecordType,
                is_confidential:
                  effectiveRecordType === 'KONSULTASI' ? bkForm.is_confidential : false,
                title: trimmedTitle,
                description: trimmedDesc,
                points: safePoints,
              }
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan catatan BK.', 'error');
        return;
      }
      showToast(
        isEditing ? 'Catatan BK berhasil diperbarui.' : 'Catatan BK berhasil disimpan.',
        'success'
      );
      resetForm();
      await loadData('refresh', academicYearFilter);
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDeleteRecord() {
    if (!confirmDeleteRecord || deletingId) return;
    setDeletingId(confirmDeleteRecord.id);
    try {
      const res = await fetch(
        `/api/layanan/bk?id=${encodeURIComponent(confirmDeleteRecord.id)}&target=record`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menghapus catatan BK.', 'error');
        return;
      }
      if (editingRecordId === confirmDeleteRecord.id) resetForm();
      setConfirmDeleteRecord(null);
      showToast('Catatan BK berhasil dihapus.', 'success');
      await loadData('refresh', academicYearFilter);
    } catch {
      showToast('Koneksi ke server terputus saat menghapus catatan BK.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const inactiveAcademicYears = useMemo(
    () => academicYears.filter((y) => !y.is_active && y.id !== activeAcademicYear?.id),
    [academicYears, activeAcademicYear]
  );

  const selectedArchivedYear = useMemo(() => {
    if (academicYearFilter === 'ACTIVE' || academicYearFilter === 'ALL') return null;
    return inactiveAcademicYears.find((y) => y.id === academicYearFilter) || null;
  }, [academicYearFilter, inactiveAcademicYears]);

  const bkSummary = useMemo(() => {
    let konsultasi = 0;
    let pelanggaran = 0;
    let prestasi = 0;
    for (const r of records) {
      if (r.record_type === 'KONSULTASI') konsultasi += 1;
      else if (r.record_type === 'PELANGGARAN') pelanggaran += 1;
      else if (r.record_type === 'PRESTASI') prestasi += 1;
    }
    return { konsultasi, pelanggaran, prestasi };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = recordSearch.trim().toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== 'ALL' && r.record_type !== typeFilter) return false;
      if (q) {
        const haystack = `${r.student?.full_name || ''} ${r.title} ${r.description || ''} ${r.incident_date}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [recordSearch, records, typeFilter]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat data Bimbingan Konseling...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Bimbingan Konseling</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData('refresh', academicYearFilter)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 [overflow-wrap:anywhere]">{toast.message}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Bimbingan Konseling &amp; Poin Siswa</span>
            </h1>
            {activeAcademicYear && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                TA Aktif: {activeAcademicYear.name} ({activeAcademicYear.semester})
              </span>
            )}
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Catat sesi konsultasi, pelanggaran tata tertib, dan poin prestasi siswa yang terikat pada tahun pelajaran aktif.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
            <span className="text-slate-500">Konsultasi: </span>
            <span className="font-bold text-sky-800">{bkSummary.konsultasi}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px]">
            <span className="text-slate-500">Pelanggaran: </span>
            <span className="font-bold text-rose-800">{bkSummary.pelanggaran}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Prestasi: </span>
            <span className="font-bold text-emerald-800">{bkSummary.prestasi}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData('refresh', academicYearFilter)}
            disabled={refreshing || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang catatan BK"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-3.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingRecordId ? 'Edit Catatan BK' : 'Catat Konsultasi / Poin BK'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {activeAcademicYear
                    ? `Otomatis tercatat pada TA ${activeAcademicYear.name} (${activeAcademicYear.semester}).`
                    : 'Lengkapi detail siswa, jenis catatan, tanggal, dan tindak lanjutnya.'}
                </p>
              </div>
              {editingRecordId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 shrink-0"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="bk-student" className="block text-[11px] font-semibold text-slate-700">
                Nama Siswa
              </label>
              <select
                id="bk-student"
                required={!editingRecordId}
                disabled={submitting || Boolean(editingRecordId)}
                value={bkForm.student_id}
                onChange={(e) => setBkForm({ ...bkForm, student_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nis ? `(${s.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="bk-record-type"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Jenis Catatan
                </label>
                <select
                  id="bk-record-type"
                  disabled={submitting}
                  value={effectiveRecordType}
                  onChange={(e) => {
                    const nextType = e.target.value as BkRecordType;
                    setBkForm({
                      ...bkForm,
                      record_type: nextType,
                      is_confidential: nextType === 'KONSULTASI' ? bkForm.is_confidential : false,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  {isGuruBk && <option value="KONSULTASI">Konsultasi BK</option>}
                  <option value="PELANGGARAN">Pelanggaran</option>
                  <option value="PRESTASI">Poin Prestasi</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="bk-points"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Poin
                </label>
                <input
                  id="bk-points"
                  type="number"
                  disabled={submitting}
                  placeholder="0"
                  value={bkForm.points}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBkForm({ ...bkForm, points: Number.isFinite(val) ? val : 0 });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="bk-incident-date"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Tanggal
                </label>
                <input
                  id="bk-incident-date"
                  type="date"
                  required
                  disabled={submitting || Boolean(editingRecordId)}
                  value={bkForm.incident_date}
                  onChange={(e) => setBkForm({ ...bkForm, incident_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="bk-title" className="block text-[11px] font-semibold text-slate-700">
                Judul Kasus / Prestasi / Konsultasi
              </label>
              <input
                id="bk-title"
                required
                minLength={2}
                disabled={submitting}
                placeholder="Judul Kasus / Prestasi / Konsultasi"
                value={bkForm.title}
                onChange={(e) => setBkForm({ ...bkForm, title: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="bk-description"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Deskripsi &amp; Tindak Lanjut
              </label>
              <textarea
                id="bk-description"
                required
                minLength={3}
                rows={3}
                disabled={submitting}
                placeholder="Deskripsi & tindak lanjut"
                value={bkForm.description}
                onChange={(e) => setBkForm({ ...bkForm, description: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            {isGuruBk && effectiveRecordType === 'KONSULTASI' && (
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium py-1 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={submitting}
                  checked={bkForm.is_confidential}
                  onChange={(e) => setBkForm({ ...bkForm, is_confidential: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Tandai sebagai catatan rahasia (khusus BK &amp; Pimpinan)</span>
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{editingRecordId ? 'Simpan Perubahan Catatan BK' : 'Simpan Catatan BK'}</span>
            </button>
          </form>
        )}

        <div
          className={`${
            canManage ? 'lg:col-span-7' : 'lg:col-span-12'
          } glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Riwayat BK &amp; Poin Siswa ({filteredRecords.length})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'KONSULTASI', label: 'Konsultasi' },
                  { key: 'PELANGGARAN', label: 'Pelanggaran' },
                  { key: 'PRESTASI', label: 'Prestasi' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    typeFilter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Tahun Pelajaran (default: aktif saja) & Pencarian */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 min-w-0">
              <label htmlFor="bk-academic-year-filter" className="sr-only">
                Filter Tahun Pelajaran
              </label>
              <select
                id="bk-academic-year-filter"
                value={academicYearFilter}
                onChange={(e) => setAcademicYearFilter(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              >
                <option value="ACTIVE">
                  {activeAcademicYear
                    ? `TA Aktif: ${activeAcademicYear.name} (${activeAcademicYear.semester})`
                    : 'Tahun Pelajaran Aktif'}
                </option>
                {inactiveAcademicYears.length > 0 && (
                  <optgroup label="Arsip Tahun Pelajaran Sebelumnya (Hanya Lihat)">
                    {inactiveAcademicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        Arsip: {y.name} ({y.semester})
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="ALL">Semua Tahun Pelajaran</option>
              </select>
            </div>

            <div className="relative sm:col-span-7 min-w-0">
              <label htmlFor="bk-record-search" className="sr-only">
                Cari riwayat catatan BK
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="bk-record-search"
                type="search"
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                placeholder="Cari nama siswa, judul catatan, atau deskripsi..."
                className="w-full min-h-[38px] rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Banner Arsip saat memilih Tahun Pelajaran yang sudah tidak aktif */}
          {selectedArchivedYear && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Archive className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Menampilkan arsip{' '}
                  <strong>
                    TA {selectedArchivedYear.name} ({selectedArchivedYear.semester})
                  </strong>
                  . Data tahun pelajaran tidak aktif hanya dapat dilihat (tidak dapat diedit maupun dihapus).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAcademicYearFilter('ACTIVE')}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 transition"
              >
                Kembali ke TA Aktif
              </button>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {records.length === 0
                  ? 'Belum ada catatan Bimbingan Konseling pada tahun pelajaran ini.'
                  : 'Tidak ada catatan BK yang cocok dengan filter pencarian.'}
              </p>
              {(recordSearch || typeFilter !== 'ALL' || academicYearFilter !== 'ACTIVE') && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordSearch('');
                    setTypeFilter('ALL');
                    setAcademicYearFilter('ACTIVE');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter ke TA Aktif
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[34rem] overflow-y-auto pr-0.5">
              {filteredRecords.map((r) => {
                const badgeClass =
                  r.record_type === 'PELANGGARAN'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : r.record_type === 'PRESTASI'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200';
                const canModifyRecord =
                  canManage &&
                  !r.is_archived &&
                  (r.record_type !== 'KONSULTASI' || isGuruBk);

                return (
                  <div
                    key={r.id}
                    className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeClass}`}
                        >
                          {r.record_type}
                        </span>
                        {r.is_confidential && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                            <Lock className="w-2.5 h-2.5" /> Rahasia
                          </span>
                        )}
                        {r.is_archived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold">
                            <Archive className="w-2.5 h-2.5" />
                            Arsip{r.academic_year ? ` ${r.academic_year.name}` : ''} • Hanya Lihat
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-slate-400">
                          {r.incident_date}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                        {r.student?.full_name || 'Siswa'} — {r.title}
                      </p>
                      {r.description && (
                        <p className="text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-start">
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 font-bold font-mono text-[11px]">
                        {r.points} Poin
                      </span>
                      {canModifyRecord && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => startEditRecord(r)}
                            aria-label={`Edit catatan ${r.title}`}
                            title="Edit catatan BK"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-600 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(deletingId)}
                            onClick={() => setConfirmDeleteRecord(r)}
                            aria-label={`Hapus catatan ${r.title}`}
                            title="Hapus catatan BK"
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Catatan BK (hanya untuk TA Aktif) */}
      {confirmDeleteRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-delete-record-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setConfirmDeleteRecord(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h2 id="bk-delete-record-title" className="text-base font-bold text-slate-900">
                Hapus Catatan BK?
              </h2>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRecord(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Catatan <strong>&ldquo;{confirmDeleteRecord.title}&rdquo;</strong> untuk{' '}
              <strong>{confirmDeleteRecord.student?.full_name || 'Siswa'}</strong> akan dihapus
              permanen.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleConfirmDeleteRecord()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingId ? (
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
