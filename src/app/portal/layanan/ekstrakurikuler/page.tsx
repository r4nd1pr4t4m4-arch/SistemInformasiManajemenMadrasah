'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';

interface EkskulRow {
  id: string;
  name: string;
  category: string;
  schedule_info: string | null;
  coach?: { full_name: string } | null;
}

interface MemberRow {
  id: string;
  extracurricular_id: string;
  student_id: string;
  grade: string;
  attendance_count: number;
  student?: { full_name: string; nis: string | null } | null;
  extracurricular?: { name: string } | null;
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
    target: 'member' | 'portfolio';
    label: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [ekskuls, setEkskuls] = useState<EkskulRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([]);

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
        setEkskuls(data.extracurriculars || []);
        setMembers(data.members || []);
        setPortfolios(data.portfolios || []);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
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
      showToast(
        confirmDelete.target === 'member'
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

  async function handleCreateEkskul(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'CREATE_EKSKUL', ...ekskulForm, coach_teacher_id: ekskulForm.coach_teacher_id || null },
      'Ekstrakurikuler berhasil ditambahkan.'
    );
    if (ok) setEkskulForm({ name: '', category: 'OLAHRAGA', coach_teacher_id: '', schedule_info: '' });
  }

  async function handleEnrollMember(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'ENROLL_MEMBER', ...memberForm },
      'Anggota & nilai ekstrakurikuler berhasil disimpan.'
    );
    if (ok) setMemberForm((prev) => ({ ...prev, student_id: '' }));
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

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab('EKSKUL')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'EKSKUL'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Ekstrakurikuler &amp; Anggota ({ekskuls.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('PORTOFOLIO')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'PORTOFOLIO'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Portofolio Prestasi Siswa ({portfolios.length})
          </button>
        </div>

        {tab === 'EKSKUL' ? (
          <div className="space-y-6 text-xs">
            <div className="grid lg:grid-cols-2 gap-4">
              <form onSubmit={handleCreateEkskul} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h2 className="font-bold text-slate-900">Tambah Master Ekstrakurikuler</h2>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input
                    required
                    value={ekskulForm.name}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, name: e.target.value })}
                    placeholder="Nama Ekskul (mis. Pramuka)"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                  <select
                    value={ekskulForm.coach_teacher_id}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, coach_teacher_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="">-- Pembina (Opsional) --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={ekskulForm.schedule_info}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, schedule_info: e.target.value })}
                    placeholder="Jadwal (mis. Jumat 14:30)"
                    className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Simpan Ekskul
                </button>
              </form>

              <form onSubmit={handleEnrollMember} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h2 className="font-bold text-slate-900">Daftarkan / Nilai Anggota Ekskul</h2>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <select
                    required
                    value={memberForm.extracurricular_id}
                    onChange={(e) => setMemberForm({ ...memberForm, extracurricular_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="">-- Pilih Ekskul --</option>
                    {ekskuls.map((ek) => (
                      <option key={ek.id} value={ek.id}>
                        {ek.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={memberForm.student_id}
                    onChange={(e) => setMemberForm({ ...memberForm, student_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={memberForm.grade}
                    onChange={(e) => setMemberForm({ ...memberForm, grade: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={memberForm.attendance_count}
                    onChange={(e) => setMemberForm({ ...memberForm, attendance_count: Number(e.target.value) || 0 })}
                    placeholder="Jumlah Hadir Latihan"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Anggota &amp; Nilai
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Daftar Anggota &amp; Predikat ({members.length})</h3>
              {members.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat daftar anggota...' : 'Belum ada anggota ekstrakurikuler terdaftar.'}
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
                        {m.student?.full_name || 'Siswa'} —{' '}
                        <span className="text-emerald-700">{m.extracurricular?.name || '-'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Predikat: <strong>{m.grade}</strong> • Kehadiran latihan: <strong>{m.attendance_count}x</strong>
                      </p>
                    </div>
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
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 shrink-0 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            <form onSubmit={handleCreatePortfolio} className="grid sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <select
                required
                value={portForm.student_id}
                onChange={(e) => setPortForm({ ...portForm, student_id: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <input
                required
                value={portForm.title}
                onChange={(e) => setPortForm({ ...portForm, title: e.target.value })}
                placeholder="Judul Prestasi / Sertifikat *"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <select
                value={portForm.level}
                onChange={(e) => setPortForm({ ...portForm, level: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="SEKOLAH">Tingkat Sekolah</option>
                <option value="KECAMATAN">Kecamatan</option>
                <option value="KABUPATEN">Kabupaten/Kota</option>
                <option value="PROVINSI">Provinsi</option>
                <option value="NASIONAL">Nasional</option>
              </select>
              <input
                type="date"
                required
                value={portForm.achieved_date}
                onChange={(e) => setPortForm({ ...portForm, achieved_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <input
                type="url"
                value={portForm.certificate_url}
                onChange={(e) => setPortForm({ ...portForm, certificate_url: e.target.value })}
                placeholder="URL Sertifikat Digital (Opsional)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Tambah Portofolio Prestasi
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {portfolios.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat portofolio prestasi...' : 'Belum ada portofolio prestasi siswa tercatat.'}
                </div>
              ) : (
                portfolios.map((p) => (
                  <div
                    key={p.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
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
                  {confirmDelete.target === 'member'
                    ? 'Hapus Anggota Ekstrakurikuler?'
                    : 'Hapus Portofolio Prestasi?'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Anda akan menghapus data <strong className="text-slate-900">{confirmDelete.label}</strong>. Tindakan ini tidak dapat dibatalkan.
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
