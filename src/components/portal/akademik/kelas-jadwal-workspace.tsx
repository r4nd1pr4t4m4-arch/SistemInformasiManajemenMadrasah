'use client';

import { useEffect, useState } from 'react';
import { BookOpen, BookOpenCheck, CheckCircle2, Loader2, Pencil, Users, X } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

export type KelasJadwalSection = 'rombel' | 'mapel' | 'jadwal';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface ClassroomRow {
  id: string;
  name: string;
  grade_level: string;
  homeroom_teacher_id?: string | null;
  room_location?: string | null;
  homeroom_teacher?: { id: string; full_name: string } | null;
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

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

export function KelasJadwalWorkspace({ section }: { section: KelasJadwalSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.KELAS_JADWAL_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 'X',
    homeroom_teacher_id: '',
  });
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '' });
  const [scheduleForm, setScheduleForm] = useState({
    classroom_id: '',
    subject_id: '',
    teacher_id: '',
    day_of_week: 1,
    start_time: '07:30',
    end_time: '09:00',
    jtm_count: 2,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, kjRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/akademik/kelas-jadwal'),
      ]);
      const bi = await biRes.json();
      const kj = await kjRes.json();
      setTeachers(bi.teachers || []);
      setClassrooms(kj.classrooms || []);
      setSubjects(kj.subjects || []);
      setSchedules(kj.schedules || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postAction(body: unknown, msg: string) {
    const res = await fetch('/api/akademik/kelas-jadwal', {
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat kelas &amp; jadwal pelajaran...
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

      {section === 'rombel' && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" /> Rombel &amp; Wali Kelas ({classrooms.length})
            </h1>
            {editingClassroomId && canManage && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Pencil className="w-3 h-3" /> Mode Edit Rombel &amp; Wali Kelas
              </span>
            )}
          </div>

          {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingClassroomId) {
                  const ok = await postAction(
                    {
                      action: 'UPDATE_CLASSROOM',
                      id: editingClassroomId,
                      name: classForm.name,
                      grade_level: classForm.grade_level,
                      homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                    },
                    'Data rombel & wali kelas berhasil diperbarui.'
                  );
                  if (ok) {
                    setEditingClassroomId(null);
                    setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                  }
                } else {
                  const ok = await postAction(
                    {
                      action: 'CREATE_CLASSROOM',
                      name: classForm.name,
                      grade_level: classForm.grade_level,
                      homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                    },
                    'Rombongan belajar berhasil dibuat.'
                  );
                  if (ok) setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                }
              }}
              className="grid sm:grid-cols-4 gap-2.5"
            >
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
                onChange={(e) => setClassForm({ ...classForm, grade_level: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <select
                value={classForm.homeroom_teacher_id}
                onChange={(e) =>
                  setClassForm({ ...classForm, homeroom_teacher_id: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Wali Kelas (Tanpa Wali Kelas) --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition"
                >
                  {editingClassroomId ? 'Simpan Perubahan' : 'Tambah Rombel'}
                </button>
                {editingClassroomId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassroomId(null);
                      setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                    }}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    title="Batal Edit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {classrooms.map((c) => {
              const isEditingThis = editingClassroomId === c.id;
              return (
                <div
                  key={c.id}
                  className={`modular-card rounded-2xl p-4 flex flex-col justify-between gap-2.5 text-xs border transition ${
                    isEditingThis
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Wali Kelas:{' '}
                        <strong className="text-slate-800">
                          {c.homeroom_teacher?.full_name || 'Belum ditetapkan'}
                        </strong>
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold shrink-0">
                      Tingkat {c.grade_level}
                    </span>
                  </div>

                  {canManage && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClassroomId(c.id);
                          setClassForm({
                            name: c.name,
                            grade_level: c.grade_level,
                            homeroom_teacher_id:
                              c.homeroom_teacher_id || c.homeroom_teacher?.id || '',
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                      >
                        <Pencil className="w-3 h-3" /> Edit Rombel / Wali Kelas
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section === 'mapel' && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" /> Mata Pelajaran ({subjects.length})
          </h1>
          {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await postAction(
                { action: 'CREATE_SUBJECT', ...subjectForm },
                'Mata pelajaran ditambahkan.'
              );
              if (ok) setSubjectForm({ code: '', name: '' });
            }}
            className="flex flex-wrap sm:flex-nowrap gap-2"
          >
            <input
              required
              placeholder="Kode (MTK)"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
              className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs"
            >
              Simpan
            </button>
          </form>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <span className="font-bold text-slate-900">{s.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold">
                  {s.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'jadwal' && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-emerald-700" /> Penyusunan Jadwal Pelajaran (JTM)
          </h1>
          {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await postAction(
                { action: 'CREATE_SCHEDULE', ...scheduleForm },
                'Jadwal pelajaran berhasil ditambahkan.'
              );
            }}
            className="grid sm:grid-cols-3 gap-2.5"
          >
            <select
              required
              value={scheduleForm.classroom_id}
              onChange={(e) => setScheduleForm({ ...scheduleForm, classroom_id: e.target.value })}
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
              onChange={(e) => setScheduleForm({ ...scheduleForm, subject_id: e.target.value })}
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
              onChange={(e) => setScheduleForm({ ...scheduleForm, teacher_id: e.target.value })}
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
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                className="w-1/2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
              />
              <input
                type="time"
                value={scheduleForm.end_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
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
          )}

          <div className="space-y-2 max-h-[28rem] overflow-y-auto pt-2">
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {DAY_NAMES[sch.day_of_week]} • {sch.classroom?.name} — {sch.subject?.name}
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
      )}
    </div>
  );
}
