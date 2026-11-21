'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

export type KelasJadwalSection = 'rombel' | 'mapel' | 'jadwal';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface StudentOpt {
  id: string;
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
  status?: string | null;
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  classroom_id: string;
  student?: { full_name: string; nis?: string | null; nisn?: string | null } | null;
  classroom?: { name: string } | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);

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

  const loadData = useCallback(async () => {
    try {
      const [biRes, kjRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
        fetch('/api/akademik/kelas-jadwal', { cache: 'no-store' }),
      ]);
      const bi = await biRes.json();
      const kj = await kjRes.json();
      if (!biRes.ok) throw new Error(bi.error || 'Gagal memuat data GTK & siswa.');
      if (!kjRes.ok) throw new Error(kj.error || 'Gagal memuat data kelas & jadwal.');

      setLoadError(null);
      setTeachers(bi.teachers || []);
      setStudents((bi.students || []).filter((s: StudentOpt) => !s.status || s.status === 'AKTIF'));
      const loadedClassrooms: ClassroomRow[] = kj.classrooms || [];
      setClassrooms(loadedClassrooms);
      setEnrollments(kj.enrollments || []);
      setSubjects(kj.subjects || []);
      setSchedules(kj.schedules || []);
      setSelectedClassroomId((prev) =>
        prev && loadedClassrooms.some((c) => c.id === prev)
          ? prev
          : loadedClassrooms[0]?.id || ''
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data.');
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

  async function postAction(body: unknown, msg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/kelas-jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan.');
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

  const enrollmentByStudentId = useMemo(() => {
    const map = new Map<string, EnrollmentRow>();
    for (const en of enrollments) {
      map.set(en.student_id, en);
    }
    return map;
  }, [enrollments]);

  const countByClassroomId = useMemo(() => {
    const map = new Map<string, number>();
    for (const en of enrollments) {
      map.set(en.classroom_id, (map.get(en.classroom_id) || 0) + 1);
    }
    return map;
  }, [enrollments]);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroomId) || null,
    [classrooms, selectedClassroomId]
  );

  const selectedRoomEnrollments = useMemo(
    () =>
      enrollments
        .filter((en) => en.classroom_id === selectedClassroomId)
        .sort((a, b) =>
          (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id')
        ),
    [enrollments, selectedClassroomId]
  );

  const availableStudentsForRombel = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((st) => {
      const en = enrollmentByStudentId.get(st.id);
      if (en?.classroom_id === selectedClassroomId) return false;
      if (onlyUnassigned && en) return false;
      if (!q) return true;
      return (
        st.full_name.toLowerCase().includes(q) ||
        (st.nis || '').toLowerCase().includes(q) ||
        (st.nisn || '').toLowerCase().includes(q)
      );
    });
  }, [students, enrollmentByStudentId, selectedClassroomId, onlyUnassigned, studentSearch]);

  if (loading) {
    return <AkademikLoading label="Memuat kelas & jadwal pelajaran..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      {section === 'rombel' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Rombel &amp; Wali Kelas ({classrooms.length})</span>
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
                      name: classForm.name.trim(),
                      grade_level: classForm.grade_level.trim(),
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
                      name: classForm.name.trim(),
                      grade_level: classForm.grade_level.trim(),
                      homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                    },
                    'Rombongan belajar berhasil dibuat.'
                  );
                  if (ok) setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                }
              }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
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
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingClassroomId ? 'Simpan Perubahan' : 'Tambah Rombel'}
                </button>
                {editingClassroomId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassroomId(null);
                      setClassForm({ name: '', grade_level: 'X', homeroom_teacher_id: '' });
                    }}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
                    title="Batal Edit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          )}

          {classrooms.length === 0 ? (
            <AkademikEmptyState
              icon={<Users className="w-6 h-6" />}
              message="Belum ada rombongan belajar. Tambahkan rombel terlebih dahulu."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {classrooms.map((c) => {
                const isEditingThis = editingClassroomId === c.id;
                const isSelectedForMembers = selectedClassroomId === c.id;
                const memberCount = countByClassroomId.get(c.id) || 0;
                return (
                  <div
                    key={c.id}
                    className={`modular-card rounded-2xl p-4 flex flex-col justify-between gap-2.5 text-xs border transition ${
                      isEditingThis || isSelectedForMembers
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 break-words">
                          Wali Kelas:{' '}
                          <strong className="text-slate-800">
                            {c.homeroom_teacher?.full_name || 'Belum ditetapkan'}
                          </strong>
                        </p>
                        <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                          {memberCount} Siswa terdaftar
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold shrink-0">
                        Tingkat {c.grade_level}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClassroomId(c.id);
                          setSelectedStudentIds([]);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-[11px] transition ${
                          isSelectedForMembers
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Users className="w-3 h-3" /> Kelola Anggota ({memberCount})
                      </button>
                      {canManage && (
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
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {classrooms.length > 0 && (
            <div className="mt-4 pt-5 border-t border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Penempatan &amp; Anggota Siswa Rombel</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih rombel lalu tambahkan siswa aktif ke dalam rombel tersebut pada tahun ajaran berjalan.
                  </p>
                </div>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => {
                    setSelectedClassroomId(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Tingkat {c.grade_level}) — {countByClassroomId.get(c.id) || 0} Siswa
                    </option>
                  ))}
                </select>
              </div>

              <div className={`grid gap-4 ${canManage ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {canManage && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">
                        Tambah Siswa ke {selectedClassroom?.name || 'Rombel'}
                      </p>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyUnassigned}
                          onChange={(e) => setOnlyUnassigned(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        Hanya siswa belum punya rombel
                      </label>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari nama siswa / NIS / NISN..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{availableStudentsForRombel.length} siswa tersedia</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudentIds(availableStudentsForRombel.map((s) => s.id))
                          }
                          className="text-emerald-700 font-semibold hover:underline"
                        >
                          Pilih Semua
                        </button>
                        {selectedStudentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds([])}
                            className="text-slate-500 hover:underline"
                          >
                            Reset ({selectedStudentIds.length})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {availableStudentsForRombel.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">
                          Tidak ada siswa yang sesuai filter.
                        </p>
                      ) : (
                        availableStudentsForRombel.map((st) => {
                          const checked = selectedStudentIds.includes(st.id);
                          const currentEn = enrollmentByStudentId.get(st.id);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedStudentIds((prev) =>
                                      prev.includes(st.id)
                                        ? prev.filter((id) => id !== st.id)
                                        : [...prev, st.id]
                                    )
                                  }
                                  className="rounded border-slate-300 text-emerald-600 shrink-0"
                                />
                                <div className="truncate">
                                  <span className="font-semibold text-slate-900">{st.full_name}</span>
                                  {(st.nis || st.nisn) && (
                                    <span className="text-slate-400 ml-1.5">
                                      ({st.nis || st.nisn})
                                    </span>
                                  )}
                                </div>
                              </div>
                              {currentEn?.classroom?.name && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold shrink-0">
                                  Pindah dari {currentEn.classroom.name}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={enrolling || selectedStudentIds.length === 0 || !selectedClassroomId}
                      onClick={async () => {
                        setEnrolling(true);
                        try {
                          const ok = await postAction(
                            {
                              action: 'ENROLL_STUDENTS_BATCH',
                              classroom_id: selectedClassroomId,
                              student_ids: selectedStudentIds,
                            },
                            `${selectedStudentIds.length} siswa berhasil ditambahkan ke rombel ${selectedClassroom?.name || ''}.`
                          );
                          if (ok) setSelectedStudentIds([]);
                        } finally {
                          setEnrolling(false);
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
                    >
                      {enrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {enrolling
                        ? 'Menyimpan...'
                        : `Tambahkan ke Rombel (${selectedStudentIds.length} Siswa)`}
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">
                      Anggota {selectedClassroom?.name || 'Rombel'} ({selectedRoomEnrollments.length})
                    </p>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {selectedRoomEnrollments.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">
                        Belum ada siswa di rombel ini.
                      </p>
                    ) : (
                      selectedRoomEnrollments.map((en, idx) => (
                        <div
                          key={en.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200/80 text-xs"
                        >
                          <div className="truncate min-w-0 flex-1">
                            <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                            <span className="font-semibold text-slate-900">
                              {en.student?.full_name || 'Siswa'}
                            </span>
                            {(en.student?.nis || en.student?.nisn) && (
                              <span className="text-slate-400 ml-1.5">
                                ({en.student?.nis || en.student?.nisn})
                              </span>
                            )}
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => {
                                const studentName = en.student?.full_name || 'siswa ini';
                                if (!window.confirm(`Keluarkan ${studentName} dari rombel?`)) return;
                                postAction(
                                  { action: 'UNENROLL_STUDENT', enrollment_id: en.id },
                                  `Siswa ${en.student?.full_name || ''} dikeluarkan dari rombel.`
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 text-[11px] font-semibold shrink-0 transition"
                              title="Keluarkan dari rombel"
                            >
                              <Trash2 className="w-3 h-3" /> Keluarkan
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'mapel' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Mata Pelajaran ({subjects.length})</span>
          </h1>
          {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAction(
                  {
                    action: 'CREATE_SUBJECT',
                    code: subjectForm.code.trim(),
                    name: subjectForm.name.trim(),
                  },
                  'Mata pelajaran ditambahkan.'
                );
                if (ok) setSubjectForm({ code: '', name: '' });
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                required
                placeholder="Kode (MTK)"
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                className="w-full sm:w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <input
                required
                placeholder="Nama Mata Pelajaran"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full sm:flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan
              </button>
            </form>
          )}

          {subjects.length === 0 ? (
            <AkademikEmptyState
              icon={<BookOpen className="w-6 h-6" />}
              message="Belum ada mata pelajaran yang terdaftar."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-bold text-slate-900 truncate">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold shrink-0">
                    {s.code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'jadwal' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Penyusunan Jadwal Pelajaran (JTM)</span>
          </h1>
          {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (scheduleForm.end_time <= scheduleForm.start_time) {
                  showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
                  return;
                }
                await postAction(
                  { action: 'CREATE_SCHEDULE', ...scheduleForm },
                  'Jadwal pelajaran berhasil ditambahkan.'
                );
              }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
            >
              <select
                required
                value={scheduleForm.classroom_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, classroom_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                    setScheduleForm({ ...scheduleForm, jtm_count: Number(e.target.value) || 1 })
                  }
                  className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                  title="JTM"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2 text-xs transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          )}

          {schedules.length === 0 ? (
            <AkademikEmptyState
              icon={<BookOpenCheck className="w-6 h-6" />}
              message="Belum ada jadwal pelajaran yang disusun."
            />
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pt-2 pr-1">
              {schedules.map((sch) => (
                <div
                  key={sch.id}
                  className="modular-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 break-words">
                      {DAY_NAMES[sch.day_of_week] || '-'} • {sch.classroom?.name || '-'} —{' '}
                      {sch.subject?.name || '-'}
                    </p>
                    <p className="text-slate-500">
                      {sch.teacher?.full_name || '-'} ({(sch.start_time || '').slice(0, 5)} -{' '}
                      {(sch.end_time || '').slice(0, 5)})
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold shrink-0">
                    {sch.jtm_count} JTM
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
