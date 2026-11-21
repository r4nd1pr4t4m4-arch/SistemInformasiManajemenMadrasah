'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, Loader2, Search, ShieldAlert, UserCheck, UserPlus } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

export type BukuIndukSection = 'siswa' | 'gtk' | 'penempatan-akun';

interface StudentRow {
  id: string;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  status: string;
}

interface TeacherRow {
  id: string;
  staff_type: string;
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  employment_status: string | null;
}

interface ActiveAccountRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  is_student: boolean;
  is_teacher: boolean;
  is_library_member: boolean;
}

export function BukuIndukWorkspace({ section }: { section: BukuIndukSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BUKU_INDUK_MANAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<ActiveAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [studentForm, setStudentForm] = useState({
    profile_id: null as string | null,
    full_name: '',
    nis: '',
    nisn: '',
    nik: '',
    gender: 'L' as 'L' | 'P',
    father_name: '',
    mother_name: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    profile_id: null as string | null,
    full_name: '',
    staff_type: 'GURU' as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
    nuptk: '',
    nip: '',
    gender: 'L' as 'L' | 'P',
    employment_status: 'GTY',
    initial_position: 'Guru Mata Pelajaran',
    email: '',
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/buku-induk', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data Buku Induk Digital.');
      }
      setLoadError(null);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setActiveAccounts(data.activeAccounts || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function submitEntity(body: unknown, msg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/buku-induk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan saat menyimpan data.');
        return false;
      }
      showToast('success', msg);
      await loadData();
      return true;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.nisn || '').toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        (t.nip || '').toLowerCase().includes(q) ||
        (t.nuptk || '').toLowerCase().includes(q)
    );
  }, [teachers, searchQuery]);

  if (loading) {
    return <AkademikLoading label="Memuat Buku Induk Digital..." />;
  }

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId) || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      {section === 'penempatan-akun' && !canManage && (
        <div className="glass-card rounded-3xl p-6 flex items-center gap-3 text-xs text-slate-600">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Anda tidak memiliki izin untuk mengelola penempatan akun ke Buku Induk.</span>
        </div>
      )}

      {section === 'penempatan-akun' && canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Penempatan Akun Aktif ke Buku Induk / E-Library</span>
              </h1>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Pilih akun yang sudah disetujui &amp; aktif untuk dimasukkan sebagai Siswa, Guru/GTK, atau hanya Anggota Perpustakaan Digital.
              </p>
            </div>
            <Link
              href="/portal/akun/manajemen-pengguna"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline shrink-0"
            >
              Kelola Persetujuan Akun →
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Pilih Akun Aktif ({activeAccounts.length} akun tersedia) --</option>
              {activeAccounts.map((acc) => {
                const tags = [
                  acc.is_student ? 'Sudah Siswa' : '',
                  acc.is_teacher ? 'Sudah GTK' : '',
                  acc.is_library_member ? 'Sudah E-Library' : '',
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <option key={acc.id} value={acc.id}>
                    {acc.full_name} ({acc.email || 'tanpa email'}) • Role: {acc.primary_role}
                    {tags ? ` [${tags}]` : ' [Belum ditempatkan]'}
                  </option>
                );
              })}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting || !selectedAccount || selectedAccount.is_student}
                onClick={async () => {
                  if (!selectedAccount) return;
                  const ok = await submitEntity(
                    {
                      type: 'STUDENT',
                      profile_id: selectedAccount.id,
                      full_name: selectedAccount.full_name,
                      gender: 'L',
                    },
                    `Akun "${selectedAccount.full_name}" berhasil dimasukkan ke Buku Induk Siswa.`
                  );
                  if (ok) setSelectedAccountId('');
                }}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                Masukkan ke Siswa
              </button>

              <button
                type="button"
                disabled={submitting || !selectedAccount || selectedAccount.is_teacher}
                onClick={async () => {
                  if (!selectedAccount) return;
                  const ok = await submitEntity(
                    {
                      type: 'TEACHER',
                      profile_id: selectedAccount.id,
                      full_name: selectedAccount.full_name,
                      staff_type: 'GURU',
                      gender: 'L',
                      employment_status: 'GTY',
                      initial_position: 'Guru Mata Pelajaran',
                      email: selectedAccount.email || '',
                    },
                    `Akun "${selectedAccount.full_name}" berhasil dimasukkan ke Buku Induk GTK.`
                  );
                  if (ok) setSelectedAccountId('');
                }}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                Masukkan ke Guru / GTK
              </button>

              <button
                type="button"
                disabled={submitting || !selectedAccount || selectedAccount.is_library_member}
                onClick={async () => {
                  if (!selectedAccount) return;
                  const ok = await submitEntity(
                    {
                      type: 'LIBRARY_ONLY',
                      profile_id: selectedAccount.id,
                      phone: selectedAccount.phone,
                    },
                    `Akun "${selectedAccount.full_name}" berhasil didaftarkan sebagai Anggota Perpustakaan Digital.`
                  );
                  if (ok) setSelectedAccountId('');
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" /> Hanya Anggota E-Library
              </button>
            </div>
          </div>
        </div>
      )}

      {section === 'siswa' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Buku Induk Siswa ({students.length})</span>
            </h1>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, atau NISN..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!studentForm.full_name.trim()) {
                  showToast('error', 'Nama lengkap siswa wajib diisi.');
                  return;
                }
                const ok = await submitEntity(
                  { type: 'STUDENT', ...studentForm, full_name: studentForm.full_name.trim() },
                  'Siswa ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                );
                if (ok) {
                  setStudentForm({
                    profile_id: null,
                    full_name: '',
                    nis: '',
                    nisn: '',
                    nik: '',
                    gender: 'L',
                    father_name: '',
                    mother_name: '',
                  });
                }
              }}
              className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
            >
              <input
                required
                placeholder="Nama Lengkap Siswa"
                value={studentForm.full_name}
                onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                placeholder="NIS"
                value={studentForm.nis}
                onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                placeholder="NISN"
                value={studentForm.nisn}
                onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                placeholder="Nama Ayah"
                value={studentForm.father_name}
                onChange={(e) => setStudentForm({ ...studentForm, father_name: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <select
                value={studentForm.gender}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Siswa ke Buku Induk
              </button>
            </form>
          )}

          {filteredStudents.length === 0 ? (
            <AkademikEmptyState
              icon={<GraduationCap className="w-6 h-6" />}
              message={
                searchQuery
                  ? 'Tidak ada siswa yang sesuai dengan pencarian.'
                  : 'Belum ada data siswa di Buku Induk.'
              }
            />
          ) : (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="modular-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{s.full_name}</p>
                    <p className="text-slate-500">
                      NIS: {s.nis || '-'} • NISN: {s.nisn || '-'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold shrink-0">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'gtk' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Buku Induk GTK ({teachers.length})</span>
            </h1>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIP, atau NUPTK..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!teacherForm.full_name.trim()) {
                  showToast('error', 'Nama lengkap GTK wajib diisi.');
                  return;
                }
                const ok = await submitEntity(
                  { type: 'TEACHER', ...teacherForm, full_name: teacherForm.full_name.trim() },
                  'GTK ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                );
                if (ok) {
                  setTeacherForm({
                    profile_id: null,
                    full_name: '',
                    staff_type: 'GURU',
                    nuptk: '',
                    nip: '',
                    gender: 'L',
                    employment_status: 'GTY',
                    initial_position: 'Guru Mata Pelajaran',
                    email: '',
                  });
                }
              }}
              className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
            >
              <input
                required
                placeholder="Nama Lengkap & Gelar"
                value={teacherForm.full_name}
                onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <select
                value={teacherForm.staff_type}
                onChange={(e) =>
                  setTeacherForm({
                    ...teacherForm,
                    staff_type: e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="GURU">Guru</option>
                <option value="TATA_USAHA">Tata Usaha</option>
              </select>
              <input
                placeholder="NUPTK"
                value={teacherForm.nuptk}
                onChange={(e) => setTeacherForm({ ...teacherForm, nuptk: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                placeholder="NIP (Opsional)"
                value={teacherForm.nip}
                onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                placeholder="Riwayat Jabatan Awal"
                value={teacherForm.initial_position}
                onChange={(e) =>
                  setTeacherForm({ ...teacherForm, initial_position: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="submit"
                disabled={submitting}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan GTK ke Buku Induk
              </button>
            </form>
          )}

          {filteredTeachers.length === 0 ? (
            <AkademikEmptyState
              icon={<UserCheck className="w-6 h-6" />}
              message={
                searchQuery
                  ? 'Tidak ada data GTK yang sesuai dengan pencarian.'
                  : 'Belum ada data GTK di Buku Induk.'
              }
            />
          ) : (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {filteredTeachers.map((t) => (
                <div
                  key={t.id}
                  className="modular-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{t.full_name}</p>
                    <p className="text-slate-500">
                      {t.staff_type} • NUPTK: {t.nuptk || '-'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold shrink-0">
                    {t.employment_status || '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
