'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';

interface EkskulRow {
  id: string;
  name: string;
  category: string;
  coach_teacher_id?: string | null;
  schedule_info: string | null;
  coach?: { id?: string; full_name: string } | null;
}

interface MemberRow {
  id: string;
  extracurricular_id: string;
  student_id: string;
  grade: string;
  attendance_count: number;
  student?: { id?: string; full_name: string; nis: string | null } | null;
  extracurricular?: { id?: string; name: string; coach_teacher_id?: string | null } | null;
}

interface PortfolioRow {
  id: string;
  title: string;
  category: string;
  level: string;
  achieved_date: string;
  organizer: string | null;
  certificate_url: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-700 mb-1';

const EKSKUL_CATEGORIES = [
  'OLAHRAGA',
  'SENI',
  'AKADEMIK',
  'KEAGAMAAN',
  'KEPANDUAN',
  'UMUM',
] as const;

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

function isSafeCertificateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

export default function EkstrakurikulerPage() {
  const [tab, setTab] = useState<'EKSKUL' | 'PORTOFOLIO'>('EKSKUL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    target: 'ekskul' | 'member' | 'portfolio';
    label: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [canManagePortfolio, setCanManagePortfolio] = useState(false);
  const [manageableEkskulIds, setManageableEkskulIds] = useState<string[]>([]);

  const [masterEkskuls, setMasterEkskuls] = useState<EkskulRow[]>([]);
  const [manageableEkskuls, setManageableEkskuls] = useState<EkskulRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; nis?: string | null }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([]);

  // Mode edit Master Ekskul (Admin) & Anggota Ekskul (Admin / Pembina)
  const [editingEkskulId, setEditingEkskulId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [ekskulForm, setEkskulForm] = useState({
    name: '',
    category: 'OLAHRAGA',
    coach_teacher_id: '',
    schedule_info: '',
  });
  const [memberForm, setMemberForm] = useState({
    extracurricular_id: '',
    student_id: '',
    grade: 'Baik',
    attendance_count: 1,
  });
  const [portForm, setPortForm] = useState(() => ({
    student_id: '',
    title: '',
    category: 'AKADEMIK',
    level: 'KABUPATEN',
    achieved_date: getTodayWibIso(),
    organizer: '',
    certificate_url: '',
  }));

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
      const res = await fetch('/api/layanan/ekstrakurikuler', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat data ekstrakurikuler.');
      } else {
        setIsAdmin(Boolean(data.isAdmin));
        setCanManagePortfolio(Boolean(data.canManagePortfolio));
        setManageableEkskulIds(
          Array.isArray(data.manageableEkskulIds) ? data.manageableEkskulIds : []
        );
        setMasterEkskuls(
          Array.isArray(data.masterExtracurriculars) ? data.masterExtracurriculars : []
        );
        setManageableEkskuls(Array.isArray(data.extracurriculars) ? data.extracurriculars : []);
        setMembers(Array.isArray(data.members) ? data.members : []);
        setPortfolios(Array.isArray(data.portfolios) ? data.portfolios : []);
        setStudents(Array.isArray(data.students) ? data.students : []);
        setTeachers(Array.isArray(data.teachers) ? data.teachers : []);
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

  useEffect(() => {
    if (!confirmDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDelete(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDelete, deletingId]);

  const manageableEkskulIdSet = useMemo(() => new Set(manageableEkskulIds), [manageableEkskulIds]);
  const canManageAnyMember = isAdmin || manageableEkskuls.length > 0;

  const memberCountByEkskul = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      counts.set(m.extracurricular_id, (counts.get(m.extracurricular_id) || 0) + 1);
    }
    return counts;
  }, [members]);

  async function postAction(payload: Record<string, unknown>, msg: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/layanan/ekstrakurikuler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan.', 'err');
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

  function resetEkskulForm() {
    setEditingEkskulId(null);
    setEkskulForm({ name: '', category: 'OLAHRAGA', coach_teacher_id: '', schedule_info: '' });
  }

  function startEditEkskul(ek: EkskulRow) {
    setEditingEkskulId(ek.id);
    setEkskulForm({
      name: ek.name || '',
      category: ek.category || 'UMUM',
      coach_teacher_id: ek.coach_teacher_id || ek.coach?.id || '',
      schedule_info: ek.schedule_info || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetMemberForm() {
    setEditingMemberId(null);
    setMemberForm({
      extracurricular_id: '',
      student_id: '',
      grade: 'Baik',
      attendance_count: 1,
    });
  }

  function startEditMember(m: MemberRow) {
    setEditingMemberId(m.id);
    setMemberForm({
      extracurricular_id: m.extracurricular_id,
      student_id: m.student_id,
      grade: m.grade || 'Baik',
      attendance_count: Number(m.attendance_count) || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      const res = await fetch(
        `/api/layanan/ekstrakurikuler?id=${encodeURIComponent(confirmDelete.id)}&target=${confirmDelete.target}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus data.', 'err');
        return;
      }
      if (confirmDelete.target === 'ekskul' && editingEkskulId === confirmDelete.id) {
        resetEkskulForm();
      }
      if (confirmDelete.target === 'member' && editingMemberId === confirmDelete.id) {
        resetMemberForm();
      }
      showToast(
        confirmDelete.target === 'ekskul'
          ? 'Master ekstrakurikuler berhasil dihapus.'
          : confirmDelete.target === 'member'
          ? 'Anggota ekstrakurikuler berhasil dihapus.'
          : 'Portofolio prestasi siswa berhasil dihapus.'
      );
      setConfirmDelete(null);
      await loadData();
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus data.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmitEkskul(e: FormEvent) {
    e.preventDefault();
    const isEditing = Boolean(editingEkskulId);
    const ok = await postAction(
      {
        action: isEditing ? 'UPDATE_EKSKUL' : 'CREATE_EKSKUL',
        ...(isEditing ? { id: editingEkskulId } : {}),
        ...ekskulForm,
        coach_teacher_id: ekskulForm.coach_teacher_id || null,
      },
      isEditing
        ? 'Master ekstrakurikuler berhasil diperbarui.'
        : 'Master ekstrakurikuler berhasil ditambahkan.'
    );
    if (ok) resetEkskulForm();
  }

  async function handleSubmitMember(e: FormEvent) {
    e.preventDefault();
    const isEditing = Boolean(editingMemberId);
    const ok = await postAction(
      {
        action: isEditing ? 'UPDATE_MEMBER' : 'ENROLL_MEMBER',
        ...(isEditing ? { id: editingMemberId } : {}),
        ...memberForm,
      },
      isEditing
        ? 'Data anggota & nilai ekstrakurikuler berhasil diperbarui.'
        : 'Anggota & nilai ekstrakurikuler berhasil disimpan.'
    );
    if (ok) {
      if (isEditing) resetMemberForm();
      else setMemberForm((prev) => ({ ...prev, student_id: '' }));
    }
  }

  async function handleCreatePortfolio(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'CREATE_PORTFOLIO', ...portForm },
      'Portofolio prestasi siswa berhasil ditambahkan.'
    );
    if (ok) {
      setPortForm({
        student_id: '',
        title: '',
        category: 'AKADEMIK',
        level: 'KABUPATEN',
        achieved_date: getTodayWibIso(),
        organizer: '',
        certificate_url: '',
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-w-0">
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

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{loadError}</span>
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

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Ekstrakurikuler &amp; Portofolio Prestasi Siswa</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola kegiatan ekstrakurikuler, pembina, presensi/predikat anggota, serta sertifikat prestasi digital siswa.
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

        {/* Tabulasi Horizontal Scrollable */}
        <div
          role="tablist"
          aria-label="Menu Ekstrakurikuler dan Portofolio Prestasi"
          className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3 -mx-1 px-1 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'EKSKUL'}
            onClick={() => setTab('EKSKUL')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              tab === 'EKSKUL'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>
              Ekstrakurikuler &amp; Anggota ({isAdmin ? masterEkskuls.length : members.length})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'PORTOFOLIO'}
            onClick={() => setTab('PORTOFOLIO')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              tab === 'PORTOFOLIO'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span>Portofolio Prestasi Siswa ({portfolios.length})</span>
          </button>
        </div>

        {tab === 'EKSKUL' ? (
          <div className="space-y-6 text-xs">
            {/* Form Master (Khusus Admin) & Form Anggota/Nilai (Admin + Guru Pembina Ekskul Terkait) */}
            {(isAdmin || canManageAnyMember) && (
              <div className={`grid gap-4 ${isAdmin ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {isAdmin && (
                  <form
                    onSubmit={handleSubmitEkskul}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-slate-900">
                        {editingEkskulId
                          ? 'Edit Master Ekstrakurikuler'
                          : 'Tambah Master Ekstrakurikuler'}
                      </h2>
                      {editingEkskulId && (
                        <button
                          type="button"
                          onClick={resetEkskulForm}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200/60"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="ekskul-name" className={LABEL_CLASS}>
                          Nama Ekstrakurikuler <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="ekskul-name"
                          required
                          value={ekskulForm.name}
                          onChange={(e) => setEkskulForm({ ...ekskulForm, name: e.target.value })}
                          placeholder="mis. Pramuka / Futsal"
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label htmlFor="ekskul-category" className={LABEL_CLASS}>
                          Kategori <span className="text-rose-600">*</span>
                        </label>
                        <select
                          id="ekskul-category"
                          value={ekskulForm.category}
                          onChange={(e) =>
                            setEkskulForm({ ...ekskulForm, category: e.target.value })
                          }
                          className={INPUT_CLASS}
                        >
                          {EKSKUL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="ekskul-coach" className={LABEL_CLASS}>
                          Guru Pembina (Opsional)
                        </label>
                        <select
                          id="ekskul-coach"
                          value={ekskulForm.coach_teacher_id}
                          onChange={(e) =>
                            setEkskulForm({ ...ekskulForm, coach_teacher_id: e.target.value })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">-- Pilih Guru Pembina --</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="ekskul-schedule" className={LABEL_CLASS}>
                          Jadwal Latihan (Opsional)
                        </label>
                        <input
                          id="ekskul-schedule"
                          value={ekskulForm.schedule_info}
                          onChange={(e) =>
                            setEkskulForm({ ...ekskulForm, schedule_info: e.target.value })
                          }
                          placeholder="mis. Jumat 14:30"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={saving}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : editingEkskulId ? (
                          <Save className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {editingEkskulId ? 'Simpan Perubahan' : 'Simpan Ekskul'}
                      </button>
                      {editingEkskulId && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={resetEkskulForm}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {canManageAnyMember && (
                  <form
                    onSubmit={handleSubmitMember}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          {editingMemberId
                            ? 'Edit Anggota & Nilai Ekstrakurikuler'
                            : 'Daftarkan / Nilai Anggota Ekstrakurikuler'}
                        </h2>
                        {!isAdmin && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Anda hanya dapat menginput, mengedit, dan menghapus anggota pada ekstrakurikuler yang Anda bina.
                          </p>
                        )}
                      </div>
                      {editingMemberId && (
                        <button
                          type="button"
                          onClick={resetMemberForm}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200/60 shrink-0"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="member-ekskul" className={LABEL_CLASS}>
                          Ekstrakurikuler <span className="text-rose-600">*</span>
                        </label>
                        <select
                          id="member-ekskul"
                          required
                          value={memberForm.extracurricular_id}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, extracurricular_id: e.target.value })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">-- Pilih Ekstrakurikuler --</option>
                          {manageableEkskuls.map((ek) => (
                            <option key={ek.id} value={ek.id}>
                              {ek.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="member-student" className={LABEL_CLASS}>
                          Nama Siswa <span className="text-rose-600">*</span>
                        </label>
                        <select
                          id="member-student"
                          required
                          value={memberForm.student_id}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, student_id: e.target.value })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">-- Pilih Siswa --</option>
                          {students.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.full_name} {st.nis ? `(${st.nis})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="member-grade" className={LABEL_CLASS}>
                          Predikat Nilai <span className="text-rose-600">*</span>
                        </label>
                        <select
                          id="member-grade"
                          value={memberForm.grade}
                          onChange={(e) => setMemberForm({ ...memberForm, grade: e.target.value })}
                          className={INPUT_CLASS}
                        >
                          <option value="Sangat Baik">Sangat Baik</option>
                          <option value="Baik">Baik</option>
                          <option value="Cukup">Cukup</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="member-attendance" className={LABEL_CLASS}>
                          Jumlah Hadir Latihan <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="member-attendance"
                          type="number"
                          min={0}
                          required
                          value={memberForm.attendance_count}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              attendance_count: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={saving}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : editingMemberId ? (
                          <Save className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {editingMemberId ? 'Simpan Perubahan Nilai' : 'Simpan Anggota & Nilai'}
                      </button>
                      {editingMemberId && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={resetMemberForm}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold transition"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Daftar Master Ekstrakurikuler — HANYA tampil untuk Admin (SUPERADMIN & OPERATOR) */}
            {isAdmin && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span>Daftar Master Ekstrakurikuler ({masterEkskuls.length})</span>
                  </h3>
                </div>
                {masterEkskuls.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-slate-500">
                    {loading
                      ? 'Memuat daftar master ekstrakurikuler...'
                      : 'Belum ada master ekstrakurikuler terdaftar.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {masterEkskuls.map((ek) => (
                      <article
                        key={ek.id}
                        className="modular-card rounded-2xl p-4 flex flex-col justify-between gap-3 border border-slate-200/80 min-w-0"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                              {ek.category || 'UMUM'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] tabular-nums">
                              {memberCountByEkskul.get(ek.id) || 0} anggota
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                            {ek.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                            Pembina:{' '}
                            <strong className="text-slate-700">
                              {ek.coach?.full_name || 'Belum ditentukan'}
                            </strong>
                          </p>
                          {ek.schedule_info && (
                            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{ek.schedule_info}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startEditEkskul(ek)}
                            className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold text-[11px] transition"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(deletingId)}
                            onClick={() =>
                              setConfirmDelete({
                                id: ek.id,
                                target: 'ekskul',
                                label: ek.name,
                              })
                            }
                            className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hapus
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Daftar Anggota & Predikat */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Daftar Anggota &amp; Predikat ({members.length})
              </h3>
              {members.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading
                    ? 'Memuat daftar anggota...'
                    : 'Belum ada anggota ekstrakurikuler terdaftar.'}
                </div>
              ) : (
                members.map((m) => {
                  const canEditThisMember =
                    isAdmin || manageableEkskulIdSet.has(m.extracurricular_id);
                  return (
                    <div
                      key={m.id}
                      className="modular-card rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                          {m.student?.full_name || 'Siswa'} —{' '}
                          <span className="text-emerald-700">{m.extracurricular?.name || '-'}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Predikat: <strong>{m.grade}</strong> • Kehadiran latihan:{' '}
                          <strong>{m.attendance_count}x</strong>
                        </p>
                      </div>
                      {canEditThisMember && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startEditMember(m)}
                            className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-semibold text-[11px] transition"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(deletingId)}
                            onClick={() =>
                              setConfirmDelete({
                                id: m.id,
                                target: 'member',
                                label: `${m.student?.full_name || 'Siswa'} (${m.extracurricular?.name || 'Ekskul'})`,
                              })
                            }
                            aria-label={`Hapus anggota ${m.student?.full_name || 'Siswa'}`}
                            className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] disabled:opacity-40 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            {canManagePortfolio && (
              <form
                onSubmit={handleCreatePortfolio}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900">
                  Tambah Portofolio Prestasi Siswa
                </h2>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="port-student" className={LABEL_CLASS}>
                      Nama Siswa <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="port-student"
                      required
                      value={portForm.student_id}
                      onChange={(e) => setPortForm({ ...portForm, student_id: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.nis ? `(${s.nis})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="port-title" className={LABEL_CLASS}>
                      Judul Prestasi / Sertifikat <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="port-title"
                      required
                      value={portForm.title}
                      onChange={(e) => setPortForm({ ...portForm, title: e.target.value })}
                      placeholder="mis. Juara 1 KSM Matematika Tingkat Kabupaten"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="port-level" className={LABEL_CLASS}>
                      Tingkat Prestasi <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="port-level"
                      value={portForm.level}
                      onChange={(e) => setPortForm({ ...portForm, level: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="SEKOLAH">Tingkat Sekolah</option>
                      <option value="KECAMATAN">Kecamatan</option>
                      <option value="KABUPATEN">Kabupaten/Kota</option>
                      <option value="PROVINSI">Provinsi</option>
                      <option value="NASIONAL">Nasional</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="port-date" className={LABEL_CLASS}>
                      Tanggal Perolehan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="port-date"
                      type="date"
                      required
                      value={portForm.achieved_date}
                      onChange={(e) => setPortForm({ ...portForm, achieved_date: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="port-certificate-url" className={LABEL_CLASS}>
                      URL Sertifikat Digital (Opsional)
                    </label>
                    <input
                      id="port-certificate-url"
                      type="url"
                      value={portForm.certificate_url}
                      onChange={(e) =>
                        setPortForm({ ...portForm, certificate_url: e.target.value })
                      }
                      placeholder="https://..."
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Tambah Portofolio Prestasi
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {portfolios.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading
                    ? 'Memuat portofolio prestasi...'
                    : 'Belum ada portofolio prestasi siswa tercatat.'}
                </div>
              ) : (
                portfolios.map((p) => (
                  <div
                    key={p.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">
                        {p.student?.full_name || 'Siswa'} — {p.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Tingkat {p.level} • {p.achieved_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSafeCertificateUrl(p.certificate_url) && (
                        <a
                          href={p.certificate_url!.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition"
                        >
                          Sertifikat <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {canManagePortfolio && (
                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() =>
                            setConfirmDelete({
                              id: p.id,
                              target: 'portfolio',
                              label: `${p.student?.full_name || 'Siswa'} — ${p.title}`,
                            })
                          }
                          aria-label={`Hapus portofolio ${p.title}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ekskul-delete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setConfirmDelete(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 id="ekskul-delete-modal-title" className="text-base font-bold text-slate-900">
                  {confirmDelete.target === 'ekskul'
                    ? 'Hapus Master Ekstrakurikuler?'
                    : confirmDelete.target === 'member'
                    ? 'Hapus Anggota Ekstrakurikuler?'
                    : 'Hapus Portofolio Prestasi?'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
                  Anda akan menghapus data{' '}
                  <strong className="text-slate-900">{confirmDelete.label}</strong>. Tindakan ini
                  tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleConfirmDelete()}
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
