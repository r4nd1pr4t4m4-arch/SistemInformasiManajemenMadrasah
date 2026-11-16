'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  MapPin,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';

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

interface ClassroomRow {
  id: string;
  name: string;
  grade_level: string;
  homeroom_teacher?: { full_name: string } | null;
}

interface SubjectRow {
  id: string;
  code: string;
  name: string;
}

interface ScheduleRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  jtm_count: number;
  classroom?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { full_name: string } | null;
}

interface ExamPeriodRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

export function PortalAkademikClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'buku_induk' | 'kelas_jadwal' | 'presensi' | 'ujian'>(
    'buku_induk'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'buku_induk' || t === 'kelas_jadwal' || t === 'presensi' || t === 'ujian') {
      setTab(t);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriodRow[]>([]);
  const [supervisors, setSupervisors] = useState<
    {
      id: string;
      exam_date: string;
      session_name: string;
      jtm_allocated: number;
      teacher?: { full_name: string } | null;
    }[]
  >([]);
  const [committees, setCommittees] = useState<
    {
      id: string;
      committee_role: string;
      jtm_allocated: number;
      teacher?: { full_name: string } | null;
    }[]
  >([]);

  // Form states
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
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 'X',
    homeroom_teacher_id: '',
  });
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    classroom_id: '',
    subject_id: '',
    teacher_id: '',
    day_of_week: 1,
    start_time: '07:30',
    end_time: '09:00',
    jtm_count: 2,
  });

  // Presensi GPS & Delegasi
  const [teacherAttForm, setTeacherAttForm] = useState({
    teacher_id: '',
    attendance_type: 'MENGAJAR' as 'HARIAN' | 'MENGAJAR' | 'PIKET',
    jtm_earned: 2,
    latitude: -6.2,
    longitude: 106.816666,
  });
  const [delegationForm, setDelegationForm] = useState({
    delegation_date: new Date().toISOString().slice(0, 10),
    delegation_type: 'MENGAJAR' as 'MENGAJAR' | 'PIKET',
    original_teacher_id: '',
    substitute_teacher_id: '',
    jtm_transferred: 2,
    reason: '',
  });

  // Ujian
  const [periodForm, setPeriodForm] = useState({
    name: 'PAS Ganjil 2026/2027',
    start_date: '2026-12-01',
    end_date: '2026-12-10',
  });
  const [supervisorForm, setSupervisorForm] = useState({
    exam_period_id: '',
    teacher_id: '',
    exam_date: '2026-12-01',
    session_name: 'Sesi 1',
    jtm_allocated: 2,
  });
  const [committeeForm, setCommitteeForm] = useState({
    exam_period_id: '',
    teacher_id: '',
    committee_role: 'Ketua Panitia',
    jtm_allocated: 6,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchAndApplyData() {
    const [biRes, kjRes, ujRes] = await Promise.all([
      fetch('/api/akademik/buku-induk'),
      fetch('/api/akademik/kelas-jadwal'),
      fetch('/api/akademik/ujian'),
    ]);
    const bi = await biRes.json();
    const kj = await kjRes.json();
    const uj = await ujRes.json();
    setStudents(bi.students || []);
    setTeachers(bi.teachers || []);
    setClassrooms(kj.classrooms || []);
    setSubjects(kj.subjects || []);
    setSchedules(kj.schedules || []);
    setExamPeriods(uj.periods || []);
    setSupervisors(uj.supervisors || []);
    setCommittees(uj.committees || []);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await fetchAndApplyData();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [biRes, kjRes, ujRes] = await Promise.all([
          fetch('/api/akademik/buku-induk'),
          fetch('/api/akademik/kelas-jadwal'),
          fetch('/api/akademik/ujian'),
        ]);
        const bi = await biRes.json();
        const kj = await kjRes.json();
        const uj = await ujRes.json();
        if (!cancelled) {
          setStudents(bi.students || []);
          setTeachers(bi.teachers || []);
          setClassrooms(kj.classrooms || []);
          setSubjects(kj.subjects || []);
          setSchedules(kj.schedules || []);
          setExamPeriods(uj.periods || []);
          setSupervisors(uj.supervisors || []);
          setCommittees(uj.committees || []);
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
  }, []);

  async function postJson(url: string, body: unknown, successMessage: string) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return null;
    }
    showToast(successMessage);
    await refreshAll();
    return data;
  }

  function captureBrowserGps() {
    if (!navigator.geolocation) {
      showToast('Browser tidak mendukung geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTeacherAttForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        showToast('Koordinat GPS berhasil diambil.');
      },
      () => showToast('Izin lokasi GPS ditolak atau tidak tersedia.')
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-white/80 p-1 rounded-2xl border border-slate-200/80">
            {[
              { id: 'buku_induk', label: 'Buku Induk', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'kelas_jadwal', label: 'Kelas & Jadwal', icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'presensi', label: 'Presensi GPS & Delegasi', icon: <MapPin className="w-3.5 h-3.5" /> },
              { id: 'ujian', label: 'Periode Ujian (JTM)', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                  tab === item.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data akademik...
          </div>
        ) : (
          <>
            {/* TAB 1: BUKU INDUK DIGITAL */}
            {tab === 'buku_induk' && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Siswa */}
                <div className="glass-card rounded-3xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-700" /> Buku Induk Siswa (
                      {students.length})
                    </h2>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await postJson(
                        '/api/akademik/buku-induk',
                        { type: 'STUDENT', ...studentForm },
                        'Siswa ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                      );
                      if (res) {
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

                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
                      const res = await postJson(
                        '/api/akademik/buku-induk',
                        { type: 'TEACHER', ...teacherForm },
                        'GTK ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                      );
                      if (res) {
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

                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
            )}

            {/* TAB 2: KELAS & JADWAL */}
            {tab === 'kelas_jadwal' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-6">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">Buat Rombel &amp; Wali Kelas</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/akademik/kelas-jadwal',
                          {
                            action: 'CREATE_CLASSROOM',
                            name: classForm.name,
                            grade_level: classForm.grade_level,
                            homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                          },
                          'Rombongan belajar berhasil dibuat.'
                        );
                        setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                      }}
                      className="space-y-2.5"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="Nama Rombel (cth: X-A)"
                          value={classForm.name}
                          onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        <input
                          required
                          placeholder="Tingkat (X/XI/XII)"
                          value={classForm.grade_level}
                          onChange={(e) =>
                            setClassForm({ ...classForm, grade_level: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <select
                        value={classForm.homeroom_teacher_id}
                        onChange={(e) =>
                          setClassForm({ ...classForm, homeroom_teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Wali Kelas --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Tambah Rombel
                      </button>
                    </form>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">Tambah Mata Pelajaran</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/akademik/kelas-jadwal',
                          { action: 'CREATE_SUBJECT', ...subjectForm },
                          'Mata pelajaran ditambahkan.'
                        );
                        setSubjectForm({ code: '', name: '' });
                      }}
                      className="flex gap-2"
                    >
                      <input
                        required
                        placeholder="Kode (MTK)"
                        value={subjectForm.code}
                        onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                        className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <input
                        required
                        placeholder="Nama Mata Pelajaran"
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-600 text-white font-semibold px-4 rounded-xl text-xs"
                      >
                        Simpan
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpenCheck className="w-4 h-4 text-emerald-700" /> Penyusunan Jadwal Pelajaran (JTM)
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await postJson(
                        '/api/akademik/kelas-jadwal',
                        { action: 'CREATE_SCHEDULE', ...scheduleForm },
                        'Jadwal pelajaran berhasil ditambahkan.'
                      );
                    }}
                    className="grid sm:grid-cols-3 gap-2.5"
                  >
                    <select
                      required
                      value={scheduleForm.classroom_id}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, classroom_id: e.target.value })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Rombel --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      value={scheduleForm.subject_id}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, subject_id: e.target.value })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Mapel --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      value={scheduleForm.teacher_id}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, teacher_id: e.target.value })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Guru Pengampu --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={scheduleForm.day_of_week}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, day_of_week: Number(e.target.value) })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      {[1, 2, 3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>
                          {DAY_NAMES[d]}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <input
                        type="time"
                        value={scheduleForm.start_time}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, start_time: e.target.value })
                        }
                        className="w-1/2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                      />
                      <input
                        type="time"
                        value={scheduleForm.end_time}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, end_time: e.target.value })
                        }
                        className="w-1/2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={scheduleForm.jtm_count}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, jtm_count: Number(e.target.value) })
                        }
                        className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                        title="JTM"
                      />
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-600 text-white font-semibold rounded-xl text-xs"
                      >
                        Simpan
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-64 overflow-y-auto pt-2">
                    {schedules.map((sch) => (
                      <div
                        key={sch.id}
                        className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {DAY_NAMES[sch.day_of_week]} • {sch.classroom?.name} —{' '}
                            {sch.subject?.name}
                          </p>
                          <p className="text-slate-500">
                            {sch.teacher?.full_name} ({sch.start_time.slice(0, 5)} -{' '}
                            {sch.end_time.slice(0, 5)})
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                          {sch.jtm_count} JTM
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PRESENSI GPS & DELEGASI PENGGANTI */}
            {tab === 'presensi' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      Presensi Guru (GPS Geofencing Live)
                    </h2>
                    <button
                      type="button"
                      onClick={captureBrowserGps}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Ambil GPS Perangkat
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await postJson(
                        '/api/akademik/presensi',
                        { action: 'TEACHER_ATTENDANCE', ...teacherAttForm },
                        'Presensi guru tercatat!'
                      );
                      if (res?.geofence) {
                        showToast(
                          res.geofence.isWithinGeofence
                            ? `Presensi VALID (jarak ${res.geofence.distanceMeters}m dari sekolah).`
                            : `Di luar radius geofence (${res.geofence.distanceMeters}m > ${res.geofence.radiusMeters}m), JTM = 0.`
                        );
                      }
                    }}
                    className="space-y-3"
                  >
                    <select
                      required
                      value={teacherAttForm.teacher_id}
                      onChange={(e) =>
                        setTeacherAttForm({ ...teacherAttForm, teacher_id: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={teacherAttForm.attendance_type}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            attendance_type: e.target.value as 'HARIAN' | 'MENGAJAR' | 'PIKET',
                          })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="MENGAJAR">Mengajar</option>
                        <option value="PIKET">Guru Piket</option>
                        <option value="HARIAN">Harian</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={teacherAttForm.jtm_earned}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            jtm_earned: Number(e.target.value),
                          })
                        }
                        placeholder="JTM"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={teacherAttForm.latitude}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            latitude: Number(e.target.value),
                          })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={teacherAttForm.longitude}
                        onChange={(e) =>
                          setTeacherAttForm({
                            ...teacherAttForm,
                            longitude: Number(e.target.value),
                          })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs"
                    >
                      Catat Presensi GPS
                    </button>
                  </form>
                </div>

                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Delegasi Guru Pengganti (Mengajar / Piket)
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await postJson(
                        '/api/akademik/presensi',
                        { action: 'CREATE_DELEGATION', ...delegationForm },
                        'Delegasi guru pengganti berhasil dicatat.'
                      );
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={delegationForm.delegation_date}
                        onChange={(e) =>
                          setDelegationForm({ ...delegationForm, delegation_date: e.target.value })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <select
                        value={delegationForm.delegation_type}
                        onChange={(e) =>
                          setDelegationForm({
                            ...delegationForm,
                            delegation_type: e.target.value as 'MENGAJAR' | 'PIKET',
                          })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="MENGAJAR">Pengganti Mengajar</option>
                        <option value="PIKET">Pengganti Piket</option>
                      </select>
                    </div>
                    <select
                      required
                      value={delegationForm.original_teacher_id}
                      onChange={(e) =>
                        setDelegationForm({
                          ...delegationForm,
                          original_teacher_id: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Guru Berhalangan --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      value={delegationForm.substitute_teacher_id}
                      onChange={(e) =>
                        setDelegationForm({
                          ...delegationForm,
                          substitute_teacher_id: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Guru Pengganti --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        value={delegationForm.jtm_transferred}
                        onChange={(e) =>
                          setDelegationForm({
                            ...delegationForm,
                            jtm_transferred: Number(e.target.value),
                          })
                        }
                        placeholder="JTM Dialihkan"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <input
                        placeholder="Alasan (Sakit/Dinas)"
                        value={delegationForm.reason}
                        onChange={(e) =>
                          setDelegationForm({ ...delegationForm, reason: e.target.value })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      Simpan Delegasi Pengganti
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 4: PERIODE UJIAN (PENGAWAS & PANITIA JTM) */}
            {tab === 'ujian' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">Buat Periode Ujian</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/akademik/ujian',
                          { action: 'CREATE_PERIOD', ...periodForm },
                          'Periode ujian dibuat.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <input
                        required
                        value={periodForm.name}
                        onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={periodForm.start_date}
                          onChange={(e) =>
                            setPeriodForm({ ...periodForm, start_date: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        <input
                          type="date"
                          value={periodForm.end_date}
                          onChange={(e) =>
                            setPeriodForm({ ...periodForm, end_date: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Simpan Periode Ujian
                      </button>
                    </form>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Tugaskan Pengawas Ruang Ujian (Atur JTM)
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/akademik/ujian',
                          { action: 'ASSIGN_SUPERVISOR', ...supervisorForm },
                          'Pengawas Ruang Ujian & alokasi JTM disimpan.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={supervisorForm.exam_period_id}
                        onChange={(e) =>
                          setSupervisorForm({ ...supervisorForm, exam_period_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Periode Ujian --</option>
                        {examPeriods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={supervisorForm.teacher_id}
                        onChange={(e) =>
                          setSupervisorForm({ ...supervisorForm, teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Guru Pengawas --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="date"
                          value={supervisorForm.exam_date}
                          onChange={(e) =>
                            setSupervisorForm({ ...supervisorForm, exam_date: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                        />
                        <input
                          value={supervisorForm.session_name}
                          onChange={(e) =>
                            setSupervisorForm({ ...supervisorForm, session_name: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          value={supervisorForm.jtm_allocated}
                          onChange={(e) =>
                            setSupervisorForm({
                              ...supervisorForm,
                              jtm_allocated: Number(e.target.value),
                            })
                          }
                          title="Alokasi JTM"
                          className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Simpan Pengawas Ujian
                      </button>
                    </form>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Tugaskan Panitia Ujian (Atur JTM)
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/akademik/ujian',
                          { action: 'ASSIGN_COMMITTEE', ...committeeForm },
                          'Panitia Ujian & alokasi JTM disimpan.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={committeeForm.exam_period_id}
                        onChange={(e) =>
                          setCommitteeForm({ ...committeeForm, exam_period_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Periode Ujian --</option>
                        {examPeriods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={committeeForm.teacher_id}
                        onChange={(e) =>
                          setCommitteeForm({ ...committeeForm, teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Guru Panitia --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Jabatan Panitia"
                          value={committeeForm.committee_role}
                          onChange={(e) =>
                            setCommitteeForm({ ...committeeForm, committee_role: e.target.value })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          value={committeeForm.jtm_allocated}
                          onChange={(e) =>
                            setCommitteeForm({
                              ...committeeForm,
                              jtm_allocated: Number(e.target.value),
                            })
                          }
                          placeholder="JTM"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Simpan Panitia Ujian
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-base font-bold text-slate-900">
                      Daftar Pengawas Ruang Ujian ({supervisors.length})
                    </h2>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {supervisors.map((sup) => (
                        <div
                          key={sup.id}
                          className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{sup.teacher?.full_name}</p>
                            <p className="text-slate-500">
                              {sup.exam_date} • {sup.session_name}
                            </p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            +{sup.jtm_allocated} JTM
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-base font-bold text-slate-900">
                      Daftar Panitia Ujian ({committees.length})
                    </h2>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {committees.map((com) => (
                        <div
                          key={com.id}
                          className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{com.teacher?.full_name}</p>
                            <p className="text-slate-500">{com.committee_role}</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold">
                            +{com.jtm_allocated} JTM
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
