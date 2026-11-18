'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, GraduationCap, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

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
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<ActiveAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/akademik/buku-induk');
      const data = await res.json();
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setActiveAccounts(data.activeAccounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitEntity(body: unknown, msg: string) {
    const res = await fetch('/api/akademik/buku-induk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return false;
    }
    showToast(msg);
    await loadData();
    return true;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat Buku Induk Digital...
      </div>
    );
  }

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId) || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {section === 'penempatan-akun' && canManage && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-700" /> Penempatan Akun Aktif ke Buku Induk / E-Library
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
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
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800"
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
                disabled={!selectedAccount || selectedAccount.is_student}
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
                className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                Masukkan ke Siswa
              </button>

              <button
                type="button"
                disabled={!selectedAccount || selectedAccount.is_teacher}
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
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                Masukkan ke Guru / GTK
              </button>

              <button
                type="button"
                disabled={!selectedAccount || selectedAccount.is_library_member}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                <BookOpen className="w-3.5 h-3.5" /> Hanya Anggota E-Library
              </button>
            </div>
          </div>
        </div>
      )}

      {section === 'siswa' && (
        <div className="glass-card rounded-3xl p-6 space-y-5">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-emerald-700" /> Buku Induk Siswa ({students.length})
          </h1>

          {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await submitEntity(
                { type: 'STUDENT', ...studentForm },
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
            className="grid sm:grid-cols-2 gap-3"
          >
            <input
              required
              placeholder="Nama Lengkap Siswa"
              value={studentForm.full_name}
              onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
            />
            <input
              placeholder="NIS"
              value={studentForm.nis}
              onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              placeholder="NISN"
              value={studentForm.nisn}
              onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              placeholder="Nama Ayah"
              value={studentForm.father_name}
              onChange={(e) => setStudentForm({ ...studentForm, father_name: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <select
              value={studentForm.gender}
              onChange={(e) =>
                setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs"
            >
              Simpan Siswa ke Buku Induk
            </button>
          </form>
          )}

          <div className="space-y-2 max-h-[32rem] overflow-y-auto">
            {students.map((s) => (
              <div
                key={s.id}
                className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{s.full_name}</p>
                  <p className="text-slate-500">
                    NIS: {s.nis || '-'} • NISN: {s.nisn || '-'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'gtk' && (
        <div className="glass-card rounded-3xl p-6 space-y-5">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700" /> Buku Induk GTK ({teachers.length})
          </h1>

          {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await submitEntity(
                { type: 'TEACHER', ...teacherForm },
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
            className="grid sm:grid-cols-2 gap-3"
          >
            <input
              required
              placeholder="Nama Lengkap & Gelar"
              value={teacherForm.full_name}
              onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
            />
            <select
              value={teacherForm.staff_type}
              onChange={(e) =>
                setTeacherForm({
                  ...teacherForm,
                  staff_type: e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="GURU">Guru</option>
              <option value="TATA_USAHA">Tata Usaha</option>
            </select>
            <input
              placeholder="NUPTK"
              value={teacherForm.nuptk}
              onChange={(e) => setTeacherForm({ ...teacherForm, nuptk: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              placeholder="NIP (Opsional)"
              value={teacherForm.nip}
              onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              placeholder="Riwayat Jabatan Awal"
              value={teacherForm.initial_position}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, initial_position: e.target.value })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs"
            >
              Simpan GTK ke Buku Induk
            </button>
          </form>
          )}

          <div className="space-y-2 max-h-[32rem] overflow-y-auto">
            {teachers.map((t) => (
              <div
                key={t.id}
                className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{t.full_name}</p>
                  <p className="text-slate-500">
                    {t.staff_type} • NUPTK: {t.nuptk || '-'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                  {t.employment_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
