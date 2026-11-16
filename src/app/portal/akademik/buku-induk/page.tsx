'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, UserCheck } from 'lucide-react';

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

export default function BukuIndukPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  const [studentForm, setStudentForm] = useState({
    full_name: '',
    nis: '',
    nisn: '',
    nik: '',
    gender: 'L' as 'L' | 'P',
    father_name: '',
    mother_name: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    full_name: '',
    staff_type: 'GURU' as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
    nuptk: '',
    nip: '',
    gender: 'L' as 'L' | 'P',
    employment_status: 'GTY',
    initial_position: 'Guru Mata Pelajaran',
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Siswa */}
        <div className="glass-card rounded-3xl p-6 space-y-5">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-emerald-700" /> Buku Induk Siswa ({students.length})
          </h1>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await submitEntity(
                { type: 'STUDENT', ...studentForm },
                'Siswa ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
              );
              if (ok) {
                setStudentForm({
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

          <div className="space-y-2 max-h-72 overflow-y-auto">
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

        {/* GTK */}
        <div className="glass-card rounded-3xl p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700" /> Buku Induk GTK ({teachers.length})
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await submitEntity(
                { type: 'TEACHER', ...teacherForm },
                'GTK ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
              );
              if (ok) {
                setTeacherForm({
                  full_name: '',
                  staff_type: 'GURU',
                  nuptk: '',
                  nip: '',
                  gender: 'L',
                  employment_status: 'GTY',
                  initial_position: 'Guru Mata Pelajaran',
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

          <div className="space-y-2 max-h-72 overflow-y-auto">
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
      </div>
    </div>
  );
}
