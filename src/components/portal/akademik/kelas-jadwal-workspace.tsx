'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
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
  AkademikModal,
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
  subject_group?: string | null;
}

interface ScheduleRow {
  id: string;
  classroom_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  jtm_count: number;
  classroom?: { name: string } | null;
  subject?: { name: string; code?: string | null } | null;
  teacher?: { full_name: string } | null;
}

const SCHEDULE_PAGE_SIZE = 20;

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

export function KelasJadwalWorkspace({ section }: { section: KelasJadwalSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.KELAS_JADWAL_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [homeroomTeacherCandidates, setHomeroomTeacherCandidates] = useState<TeacherOpt[]>([]);
  const [canManageScheduleApi, setCanManageScheduleApi] = useState(false);
  const [homeroomClassroomIds, setHomeroomClassroomIds] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [rombelSearch, setRombelSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState<EnrollmentRow | null>(null);

  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 'X',
    homeroom_teacher_id: '',
    room_location: '',
  });
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<SubjectRow | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    subject_group: 'Umum',
  });
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectGroupFilter, setSubjectGroupFilter] = useState('ALL');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ScheduleRow | null>(null);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [batchDeleteScheduleOpen, setBatchDeleteScheduleOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDayFilter, setScheduleDayFilter] = useState<string>('ALL');
  const [scheduleClassroomFilter, setScheduleClassroomFilter] = useState<string>('ALL');
  const [schedulePage, setSchedulePage] = useState(1);
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
      setHomeroomTeacherCandidates(kj.homeroomTeacherCandidates || []);
      setCanManageScheduleApi(Boolean(kj.canManageSchedule));
      setHomeroomClassroomIds(
        Array.isArray(kj.homeroomClassroomIds) ? kj.homeroomClassroomIds : []
      );
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
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

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

  const homeroomDropdownOptions = useMemo(() => {
    const list = homeroomTeacherCandidates.map((t) => ({
      id: t.id,
      label: t.full_name,
    }));
    const currentId = classForm.homeroom_teacher_id;
    if (currentId && !list.some((item) => item.id === currentId)) {
      const existing = teachers.find((t) => t.id === currentId);
      if (existing) {
        list.unshift({
          id: existing.id,
          label: `${existing.full_name} (Saat ini)`,
        });
      }
    }
    return list;
  }, [classForm.homeroom_teacher_id, homeroomTeacherCandidates, teachers]);

  const canManageSchedule = canManage || canManageScheduleApi;
  const homeroomClassroomSet = useMemo(
    () => new Set(homeroomClassroomIds),
    [homeroomClassroomIds]
  );
  const manageableScheduleClassrooms = useMemo(
    () =>
      canManage ? classrooms : classrooms.filter((c) => homeroomClassroomSet.has(c.id)),
    [canManage, classrooms, homeroomClassroomSet]
  );
  const canManageScheduleRow = useCallback(
    (classroomId?: string | null) =>
      canManage ||
      (Boolean(classroomId) && canManageSchedule && homeroomClassroomSet.has(classroomId!)),
    [canManage, canManageSchedule, homeroomClassroomSet]
  );

  const selectedSchedulesList = useMemo(() => {
    if (selectedScheduleIds.length === 0) return [];
    const selectedSet = new Set(selectedScheduleIds);
    return schedules.filter((sch) => selectedSet.has(sch.id));
  }, [schedules, selectedScheduleIds]);

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

  const rombelStats = useMemo(() => {
    let withoutHomeroom = 0;
    for (const c of classrooms) {
      if (!c.homeroom_teacher_id && !c.homeroom_teacher?.id) withoutHomeroom++;
    }
    const enrolledStudentCount = enrollmentByStudentId.size;
    const unassignedStudentCount = students.filter((s) => !enrollmentByStudentId.has(s.id)).length;
    return {
      totalClassrooms: classrooms.length,
      withoutHomeroom,
      enrolledStudentCount,
      unassignedStudentCount,
    };
  }, [classrooms, students, enrollmentByStudentId]);

  const filteredClassrooms = useMemo(() => {
    const q = rombelSearch.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.grade_level.toLowerCase().includes(q) ||
        (c.homeroom_teacher?.full_name || '').toLowerCase().includes(q) ||
        (c.room_location || '').toLowerCase().includes(q)
    );
  }, [classrooms, rombelSearch]);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroomId) || null,
    [classrooms, selectedClassroomId]
  );

  const selectedRoomEnrollments = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return enrollments
      .filter((en) => {
        if (en.classroom_id !== selectedClassroomId) return false;
        if (!q) return true;
        return (
          (en.student?.full_name || '').toLowerCase().includes(q) ||
          (en.student?.nis || '').toLowerCase().includes(q) ||
          (en.student?.nisn || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id')
      );
  }, [enrollments, selectedClassroomId, memberSearch]);

  const scheduleCountBySubjectId = useMemo(() => {
    const map = new Map<string, number>();
    for (const sch of schedules) {
      if (sch.subject_id) {
        map.set(sch.subject_id, (map.get(sch.subject_id) || 0) + 1);
      }
    }
    return map;
  }, [schedules]);

  const subjectStats = useMemo(() => {
    const groups = new Set<string>();
    let scheduledCount = 0;
    for (const s of subjects) {
      groups.add((s.subject_group || 'Umum').trim() || 'Umum');
      if ((scheduleCountBySubjectId.get(s.id) || 0) > 0) scheduledCount++;
    }
    return {
      total: subjects.length,
      groups: Array.from(groups).sort((a, b) => a.localeCompare(b, 'id')),
      scheduledCount,
      unscheduledCount: subjects.length - scheduledCount,
    };
  }, [subjects, scheduleCountBySubjectId]);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjects.filter((s) => {
      const grp = (s.subject_group || 'Umum').trim() || 'Umum';
      if (subjectGroupFilter !== 'ALL' && grp !== subjectGroupFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        grp.toLowerCase().includes(q)
      );
    });
  }, [subjects, subjectSearch, subjectGroupFilter]);

  const scheduleStats = useMemo(() => {
    let totalJtm = 0;
    const roomSet = new Set<string>();
    const teacherSet = new Set<string>();
    for (const sch of schedules) {
      totalJtm += Number(sch.jtm_count || 0);
      if (sch.classroom_id) roomSet.add(sch.classroom_id);
      if (sch.teacher_id) teacherSet.add(sch.teacher_id);
    }
    return {
      totalSessions: schedules.length,
      totalJtm,
      activeClassrooms: roomSet.size,
      activeTeachers: teacherSet.size,
    };
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return schedules.filter((sch) => {
      if (scheduleDayFilter !== 'ALL' && String(sch.day_of_week) !== scheduleDayFilter) {
        return false;
      }
      if (scheduleClassroomFilter !== 'ALL' && sch.classroom_id !== scheduleClassroomFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (sch.classroom?.name || '').toLowerCase().includes(q) ||
        (sch.subject?.name || '').toLowerCase().includes(q) ||
        (sch.teacher?.full_name || '').toLowerCase().includes(q) ||
        (DAY_NAMES[sch.day_of_week] || '').toLowerCase().includes(q)
      );
    });
  }, [schedules, scheduleSearch, scheduleDayFilter, scheduleClassroomFilter]);

  const totalSchedulePages = Math.max(1, Math.ceil(filteredSchedules.length / SCHEDULE_PAGE_SIZE));
  const safeSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const paginatedSchedules = useMemo(() => {
    const start = (safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE;
    return filteredSchedules.slice(start, start + SCHEDULE_PAGE_SIZE);
  }, [filteredSchedules, safeSchedulePage]);

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
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {section === 'rombel' && (
        <div className="space-y-5">
          {/* Ringkasan Statistik Rombel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total Rombel</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {rombelStats.totalClassrooms}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Siswa Punya Rombel</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                {rombelStats.enrolledStudentCount}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Belum Punya Rombel</p>
              <p className="text-xl font-black text-amber-600 mt-0.5">
                {rombelStats.unassignedStudentCount}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Tanpa Wali Kelas</p>
              <p className="text-xl font-black text-rose-600 mt-0.5">
                {rombelStats.withoutHomeroom}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Rombel &amp; Wali Kelas ({classrooms.length})</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola rombongan belajar, wali kelas, dan penempatan siswa aktif.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {editingClassroomId && canManage && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <Pencil className="w-3 h-3" /> Mode Edit Rombel
                  </span>
                )}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
              </div>
            </div>

            {canManage && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmedName = classForm.name.trim();
                  const trimmedGrade = classForm.grade_level.trim();
                  if (!trimmedName || !trimmedGrade) {
                    showToast('error', 'Nama rombel dan tingkat wajib diisi.');
                    return;
                  }
                  if (editingClassroomId) {
                    const ok = await postAction(
                      {
                        action: 'UPDATE_CLASSROOM',
                        id: editingClassroomId,
                        name: trimmedName,
                        grade_level: trimmedGrade,
                        homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                        room_location: classForm.room_location.trim() || null,
                      },
                      'Data rombel & wali kelas berhasil diperbarui.'
                    );
                    if (ok) {
                      setEditingClassroomId(null);
                      setClassForm({
                        name: '',
                        grade_level: 'X',
                        homeroom_teacher_id: '',
                        room_location: '',
                      });
                    }
                  } else {
                    const ok = await postAction(
                      {
                        action: 'CREATE_CLASSROOM',
                        name: trimmedName,
                        grade_level: trimmedGrade,
                        homeroom_teacher_id: classForm.homeroom_teacher_id || null,
                        room_location: classForm.room_location.trim() || null,
                      },
                      'Rombongan belajar berhasil dibuat.'
                    );
                    if (ok) {
                      setClassForm({
                        name: '',
                        grade_level: 'X',
                        homeroom_teacher_id: '',
                        room_location: '',
                      });
                    }
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 items-end"
              >
                <div>
                  <label
                    htmlFor="rombel-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Rombel <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rombel-name"
                    required
                    placeholder="Contoh: X-A"
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rombel-grade"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Tingkat <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rombel-grade"
                    required
                    placeholder="Contoh: X / XI / XII"
                    value={classForm.grade_level}
                    onChange={(e) => setClassForm({ ...classForm, grade_level: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rombel-homeroom"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Wali Kelas
                  </label>
                  <select
                    id="rombel-homeroom"
                    value={classForm.homeroom_teacher_id}
                    onChange={(e) =>
                      setClassForm({ ...classForm, homeroom_teacher_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">-- Tanpa Wali Kelas --</option>
                    {homeroomDropdownOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {homeroomTeacherCandidates.length === 0 && (
                    <p className="mt-1 text-[10px] text-amber-700 leading-relaxed">
                      Belum ada guru dengan tugas tambahan Wali Kelas aktif. Atur terlebih dahulu di
                      menu{' '}
                      <Link
                        href="/portal/keuangan/honorarium/tugas-tambahan"
                        className="font-semibold underline hover:text-amber-800"
                      >
                        Tugas Tambahan
                      </Link>
                      .
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="rombel-location"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Lokasi Ruang (Opsional)
                  </label>
                  <input
                    id="rombel-location"
                    placeholder="Contoh: Gedung A Lt. 2"
                    value={classForm.room_location}
                    onChange={(e) => setClassForm({ ...classForm, room_location: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
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
                        setClassForm({
                          name: '',
                          grade_level: 'X',
                          homeroom_teacher_id: '',
                          room_location: '',
                        });
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

            {classrooms.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rombelSearch}
                  onChange={(e) => setRombelSearch(e.target.value)}
                  placeholder="Cari rombel, tingkat, wali kelas, atau ruang..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                {rombelSearch && (
                  <button
                    type="button"
                    onClick={() => setRombelSearch('')}
                    aria-label="Hapus pencarian rombel"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {classrooms.length === 0 ? (
              <AkademikEmptyState
                icon={<Users className="w-6 h-6" />}
                message="Belum ada rombongan belajar. Tambahkan rombel terlebih dahulu."
              />
            ) : filteredClassrooms.length === 0 ? (
              <AkademikEmptyState
                icon={<Users className="w-6 h-6" />}
                message="Tidak ada rombel yang sesuai dengan pencarian."
                compact
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {filteredClassrooms.map((c) => {
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
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-bold text-slate-900 text-sm break-words">{c.name}</p>
                          <p className="text-[11px] text-slate-600 break-words">
                            Wali Kelas:{' '}
                            <strong className="text-slate-800">
                              {c.homeroom_teacher?.full_name || 'Belum ditetapkan'}
                            </strong>
                          </p>
                          {c.room_location && (
                            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 break-words">
                              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                              <span>{c.room_location}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-emerald-700 font-semibold pt-0.5">
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
                                room_location: c.room_location || '',
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
                    aria-label="Pilih rombel untuk kelola anggota"
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
                            onChange={(e) => {
                              setOnlyUnassigned(e.target.checked);
                              setSelectedStudentIds([]);
                            }}
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
                          className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-8 py-2 text-xs"
                        />
                        {studentSearch && (
                          <button
                            type="button"
                            onClick={() => setStudentSearch('')}
                            aria-label="Hapus pencarian siswa"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>{availableStudentsForRombel.length} siswa tersedia</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={availableStudentsForRombel.length === 0}
                            onClick={() =>
                              setSelectedStudentIds(availableStudentsForRombel.map((s) => s.id))
                            }
                            className="text-emerald-700 font-semibold hover:underline disabled:opacity-40"
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
                                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
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
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900 truncate">
                                      {st.full_name}
                                    </p>
                                    {(st.nis || st.nisn) && (
                                      <p className="text-[11px] text-slate-400 truncate">
                                        {st.nis || st.nisn}
                                      </p>
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
                        disabled={
                          enrolling ||
                          submitting ||
                          selectedStudentIds.length === 0 ||
                          !selectedClassroomId
                        }
                        onClick={async () => {
                          if (enrolling || submitting) return;
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">
                        Anggota {selectedClassroom?.name || 'Rombel'} (
                        {countByClassroomId.get(selectedClassroomId) || 0})
                      </p>
                    </div>

                    {(countByClassroomId.get(selectedClassroomId) || 0) > 0 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Cari anggota rombel..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-8 py-1.5 text-xs"
                        />
                        {memberSearch && (
                          <button
                            type="button"
                            onClick={() => setMemberSearch('')}
                            aria-label="Hapus pencarian anggota"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                      {selectedRoomEnrollments.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">
                          {memberSearch.trim()
                            ? 'Tidak ada anggota rombel yang sesuai pencarian.'
                            : 'Belum ada siswa di rombel ini.'}
                        </p>
                      ) : (
                        selectedRoomEnrollments.map((en, idx) => (
                          <div
                            key={en.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 truncate">
                                <span className="text-slate-400 font-normal mr-1.5">
                                  {idx + 1}.
                                </span>
                                {en.student?.full_name || 'Siswa'}
                              </p>
                              {(en.student?.nis || en.student?.nisn) && (
                                <p className="text-[11px] text-slate-400 pl-5 truncate">
                                  {en.student?.nis || en.student?.nisn}
                                </p>
                              )}
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                disabled={submitting || enrolling}
                                onClick={() => setUnenrollTarget(en)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 text-[11px] font-semibold shrink-0 transition"
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

          {/* Modal Konfirmasi Keluarkan Siswa dari Rombel */}
          <AkademikModal
            open={Boolean(unenrollTarget)}
            onClose={() => {
              if (!submitting) setUnenrollTarget(null);
            }}
            title="Konfirmasi Keluarkan Siswa dari Rombel"
          >
            {unenrollTarget && (
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Anda akan mengeluarkan siswa berikut dari daftar anggota rombongan belajar{' '}
                    <strong className="text-slate-900">
                      {selectedClassroom?.name || unenrollTarget.classroom?.name || 'ini'}
                    </strong>
                    .
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Nama Siswa</span>
                    <span className="font-bold text-slate-900 text-right break-words">
                      {unenrollTarget.student?.full_name || 'Siswa'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">NIS / NISN</span>
                    <span className="font-mono font-semibold text-slate-700 text-right">
                      {unenrollTarget.student?.nis || '-'} / {unenrollTarget.student?.nisn || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                    <span className="text-slate-500 shrink-0">Rombel</span>
                    <span className="font-semibold text-emerald-700 text-right">
                      {selectedClassroom?.name || unenrollTarget.classroom?.name || '-'}
                      {selectedClassroom?.grade_level
                        ? ` (Tingkat ${selectedClassroom.grade_level})`
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 leading-relaxed">
                  <strong>Catatan:</strong> Data induk siswa di <strong>Buku Induk</strong> tidak
                  akan terhapus. Siswa hanya dilepas dari rombel ini dan dapat ditempatkan kembali ke
                  rombel mana pun kapan saja.
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setUnenrollTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      if (submitting) return;
                      const ok = await postAction(
                        { action: 'UNENROLL_STUDENT', enrollment_id: unenrollTarget.id },
                        `Siswa ${unenrollTarget.student?.full_name || ''} dikeluarkan dari rombel.`
                      );
                      if (ok) setUnenrollTarget(null);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{submitting ? 'Memproses...' : 'Ya, Keluarkan Siswa'}</span>
                  </button>
                </div>
              </div>
            )}
          </AkademikModal>
        </div>
      )}

      {section === 'mapel' && (
        <div className="space-y-5">
          {/* Ringkasan Statistik Mata Pelajaran */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total Mapel</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{subjectStats.total}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Kelompok Mapel</p>
              <p className="text-xl font-black text-sky-700 mt-0.5">
                {subjectStats.groups.length}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Sudah Terjadwal</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                {subjectStats.scheduledCount}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Belum Ada Jadwal</p>
              <p className="text-xl font-black text-amber-600 mt-0.5">
                {subjectStats.unscheduledCount}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Mata Pelajaran ({subjects.length})</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola daftar kode, nama, dan kelompok mata pelajaran yang digunakan pada penyusunan jadwal.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                {editingSubjectId && canManage && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <Pencil className="w-3 h-3" /> Mode Edit Mapel
                  </span>
                )}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
              </div>
            </div>

            {canManage && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmedCode = subjectForm.code.trim().toUpperCase();
                  const trimmedName = subjectForm.name.trim();
                  if (trimmedCode.length < 2) {
                    showToast('error', 'Kode mata pelajaran minimal 2 karakter.');
                    return;
                  }
                  if (trimmedName.length < 2) {
                    showToast('error', 'Nama mata pelajaran minimal 2 karakter.');
                    return;
                  }
                  if (
                    subjects.some(
                      (s) => s.id !== editingSubjectId && s.code.toUpperCase() === trimmedCode
                    )
                  ) {
                    showToast('error', `Kode mapel "${trimmedCode}" sudah terdaftar.`);
                    return;
                  }
                  if (editingSubjectId) {
                    const ok = await postAction(
                      {
                        action: 'UPDATE_SUBJECT',
                        id: editingSubjectId,
                        code: trimmedCode,
                        name: trimmedName,
                        subject_group: subjectForm.subject_group.trim() || 'Umum',
                      },
                      'Mata pelajaran berhasil diperbarui.'
                    );
                    if (ok) {
                      setEditingSubjectId(null);
                      setSubjectForm({
                        code: '',
                        name: '',
                        subject_group: 'Umum',
                      });
                    }
                  } else {
                    const ok = await postAction(
                      {
                        action: 'CREATE_SUBJECT',
                        code: trimmedCode,
                        name: trimmedName,
                        subject_group: subjectForm.subject_group.trim() || 'Umum',
                      },
                      'Mata pelajaran ditambahkan.'
                    );
                    if (ok) {
                      setSubjectForm({
                        code: '',
                        name: '',
                        subject_group: subjectForm.subject_group,
                      });
                    }
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 items-end"
              >
                <div className="lg:col-span-2">
                  <label
                    htmlFor="mapel-code"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Kode <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="mapel-code"
                    required
                    minLength={2}
                    placeholder="Contoh: MTK"
                    value={subjectForm.code}
                    onChange={(e) =>
                      setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="lg:col-span-4">
                  <label
                    htmlFor="mapel-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Mata Pelajaran <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="mapel-name"
                    required
                    minLength={2}
                    placeholder="Contoh: Matematika Wajib"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label
                    htmlFor="mapel-group"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Kelompok Mapel
                  </label>
                  <select
                    id="mapel-group"
                    value={subjectForm.subject_group}
                    onChange={(e) =>
                      setSubjectForm({ ...subjectForm, subject_group: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="Umum">Umum</option>
                    <option value="Agama / Keagamaan">Agama / Keagamaan</option>
                    <option value="Peminatan">Peminatan</option>
                    <option value="Muatan Lokal">Muatan Lokal</option>
                    <option value="Ekstrakurikuler">Ekstrakurikuler</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingSubjectId ? 'Simpan Perubahan' : 'Simpan'}
                  </button>
                  {editingSubjectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubjectId(null);
                        setSubjectForm({ code: '', name: '', subject_group: 'Umum' });
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

            {/* Pencarian & Filter Kelompok */}
            {subjects.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder="Cari nama, kode, atau kelompok mata pelajaran..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {subjectSearch && (
                    <button
                      type="button"
                      onClick={() => setSubjectSearch('')}
                      aria-label="Hapus pencarian mata pelajaran"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  aria-label="Filter kelompok mata pelajaran"
                  value={subjectGroupFilter}
                  onChange={(e) => setSubjectGroupFilter(e.target.value)}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="ALL">Semua Kelompok ({subjects.length})</option>
                  {subjectStats.groups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {subjects.length === 0 ? (
              <AkademikEmptyState
                icon={<BookOpen className="w-6 h-6" />}
                message="Belum ada mata pelajaran yang terdaftar."
              />
            ) : filteredSubjects.length === 0 ? (
              <AkademikEmptyState
                icon={<BookOpen className="w-6 h-6" />}
                message="Tidak ada mata pelajaran yang sesuai dengan filter atau pencarian."
                compact
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSubjects.map((s) => {
                  const grp = (s.subject_group || 'Umum').trim() || 'Umum';
                  const schCount = scheduleCountBySubjectId.get(s.id) || 0;
                  const isEditingThis = editingSubjectId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`modular-card rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 text-xs border transition ${
                        isEditingThis
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                          : 'border-slate-200/80'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 break-words leading-snug flex-1 min-w-0">
                            {s.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold shrink-0">
                            {s.code}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold">
                            {grp}
                          </span>
                          <span
                            className={`font-semibold ${
                              schCount > 0 ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {schCount > 0 ? `${schCount} sesi jadwal` : 'Belum terjadwal'}
                          </span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setEditingSubjectId(s.id);
                              setSubjectForm({
                                code: s.code,
                                name: s.name,
                                subject_group: grp,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 disabled:opacity-40 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setDeleteSubjectTarget(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-semibold text-[11px] transition"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Konfirmasi Hapus Mata Pelajaran */}
          <AkademikModal
            open={Boolean(deleteSubjectTarget)}
            onClose={() => {
              if (!submitting) setDeleteSubjectTarget(null);
            }}
            title="Konfirmasi Hapus Mata Pelajaran"
          >
            {deleteSubjectTarget && (
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Anda yakin ingin menghapus mata pelajaran{' '}
                    <strong className="text-slate-900">{deleteSubjectTarget.name}</strong> dari
                    daftar mata pelajaran?
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Kode</span>
                    <span className="font-mono font-bold text-slate-900">
                      {deleteSubjectTarget.code}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Nama Mapel</span>
                    <span className="font-bold text-slate-900 text-right break-words">
                      {deleteSubjectTarget.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                    <span className="text-slate-500">Kelompok</span>
                    <span className="font-semibold text-sky-700">
                      {(deleteSubjectTarget.subject_group || 'Umum').trim() || 'Umum'}
                    </span>
                  </div>
                </div>

                {(scheduleCountBySubjectId.get(deleteSubjectTarget.id) || 0) > 0 ? (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-3 text-rose-900 leading-relaxed">
                    <strong>Tidak dapat dihapus:</strong> Mata pelajaran ini masih digunakan pada{' '}
                    <strong>{scheduleCountBySubjectId.get(deleteSubjectTarget.id)}</strong> sesi
                    jadwal pelajaran. Hapus/ubah jadwal terkait terlebih dahulu sebelum menghapus
                    mata pelajaran ini.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 leading-relaxed">
                    <strong>Perhatian:</strong> Tindakan ini akan menghapus data mata pelajaran secara
                    permanen.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setDeleteSubjectTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={
                      submitting || (scheduleCountBySubjectId.get(deleteSubjectTarget.id) || 0) > 0
                    }
                    onClick={async () => {
                      if (submitting) return;
                      const ok = await postAction(
                        { action: 'DELETE_SUBJECT', id: deleteSubjectTarget.id },
                        `Mata pelajaran "${deleteSubjectTarget.name}" berhasil dihapus.`
                      );
                      if (ok) {
                        if (editingSubjectId === deleteSubjectTarget.id) {
                          setEditingSubjectId(null);
                          setSubjectForm({ code: '', name: '', subject_group: 'Umum' });
                        }
                        setDeleteSubjectTarget(null);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold transition"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Mapel'}</span>
                  </button>
                </div>
              </div>
            )}
          </AkademikModal>
        </div>
      )}

      {section === 'jadwal' && (
        <div className="space-y-5">
          {/* Ringkasan Statistik Jadwal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total Sesi Jadwal</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {scheduleStats.totalSessions}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total Beban JTM</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                {scheduleStats.totalJtm}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Rombel Terjadwal</p>
              <p className="text-xl font-black text-sky-700 mt-0.5">
                {scheduleStats.activeClassrooms}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Guru Mengajar</p>
              <p className="text-xl font-black text-indigo-700 mt-0.5">
                {scheduleStats.activeTeachers}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpenCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Penyusunan Jadwal Pelajaran (JTM)</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Susun jadwal mengajar per rombel, mata pelajaran, guru pengampu, dan alokasi JTM.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                {editingScheduleId && canManageSchedule && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <Pencil className="w-3 h-3" /> Mode Edit Jadwal
                  </span>
                )}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
              </div>
            </div>

            {canManageSchedule && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (scheduleForm.end_time <= scheduleForm.start_time) {
                    showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
                    return;
                  }
                  const clampedJtm = Math.min(12, Math.max(1, Number(scheduleForm.jtm_count) || 1));
                  const startHHMM = scheduleForm.start_time.slice(0, 5);
                  const endHHMM = scheduleForm.end_time.slice(0, 5);

                  // Deteksi bentrok jadwal pada rombel atau guru yang sama di hari & jam tumpang tindih
                  const conflict = schedules.find((sch) => {
                    if (sch.id === editingScheduleId) return false;
                    if (sch.day_of_week !== scheduleForm.day_of_week) return false;
                    const sStart = (sch.start_time || '').slice(0, 5);
                    const sEnd = (sch.end_time || '').slice(0, 5);
                    const overlaps = startHHMM < sEnd && endHHMM > sStart;
                    if (!overlaps) return false;
                    return (
                      sch.classroom_id === scheduleForm.classroom_id ||
                      sch.teacher_id === scheduleForm.teacher_id
                    );
                  });

                  if (conflict) {
                    const who =
                      conflict.classroom_id === scheduleForm.classroom_id
                        ? `Rombel ${conflict.classroom?.name || ''}`
                        : `Guru ${conflict.teacher?.full_name || ''}`;
                    showToast(
                      'error',
                      `Bentrok jadwal: ${who} sudah memiliki jadwal pada hari ${
                        DAY_NAMES[conflict.day_of_week]
                      } (${(conflict.start_time || '').slice(0, 5)}–${(
                        conflict.end_time || ''
                      ).slice(0, 5)}).`
                    );
                    return;
                  }

                  if (editingScheduleId) {
                    const ok = await postAction(
                      {
                        action: 'UPDATE_SCHEDULE',
                        id: editingScheduleId,
                        ...scheduleForm,
                        jtm_count: clampedJtm,
                      },
                      'Jadwal pelajaran berhasil diperbarui.'
                    );
                    if (ok) {
                      setEditingScheduleId(null);
                      setScheduleForm({
                        classroom_id: '',
                        subject_id: '',
                        teacher_id: '',
                        day_of_week: 1,
                        start_time: '07:30',
                        end_time: '09:00',
                        jtm_count: 2,
                      });
                    }
                  } else {
                    const ok = await postAction(
                      {
                        action: 'CREATE_SCHEDULE',
                        ...scheduleForm,
                        jtm_count: clampedJtm,
                      },
                      'Jadwal pelajaran berhasil ditambahkan.'
                    );
                    if (ok) {
                      setSchedulePage(1);
                      setScheduleForm((prev) => ({
                        ...prev,
                        subject_id: '',
                      }));
                    }
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 items-end"
              >
                <div className="lg:col-span-4">
                  <label
                    htmlFor="jadwal-classroom"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Rombel <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="jadwal-classroom"
                    required
                    value={scheduleForm.classroom_id}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, classroom_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">-- Pilih Rombel --</option>
                    {manageableScheduleClassrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label
                    htmlFor="jadwal-subject"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Mata Pelajaran <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="jadwal-subject"
                    required
                    value={scheduleForm.subject_id}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, subject_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label
                    htmlFor="jadwal-teacher"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Guru Pengampu <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="jadwal-teacher"
                    required
                    value={scheduleForm.teacher_id}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, teacher_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">-- Pilih Guru Pengampu --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label
                    htmlFor="jadwal-day"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Hari
                  </label>
                  <select
                    id="jadwal-day"
                    value={scheduleForm.day_of_week}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, day_of_week: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {DAY_NAMES[d]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="jadwal-start"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Jam Mulai
                  </label>
                  <input
                    id="jadwal-start"
                    type="time"
                    required
                    value={scheduleForm.start_time}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, start_time: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="jadwal-end"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Jam Selesai
                  </label>
                  <input
                    id="jadwal-end"
                    type="time"
                    required
                    value={scheduleForm.end_time}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, end_time: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="jadwal-jtm"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    JTM (1–12)
                  </label>
                  <input
                    id="jadwal-jtm"
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={scheduleForm.jtm_count}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        jtm_count: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2 text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingScheduleId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                  </button>
                  {editingScheduleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScheduleId(null);
                        setScheduleForm({
                          classroom_id: '',
                          subject_id: '',
                          teacher_id: '',
                          day_of_week: 1,
                          start_time: '07:30',
                          end_time: '09:00',
                          jtm_count: 2,
                        });
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

            {/* Pencarian & Filter Jadwal */}
            {schedules.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scheduleSearch}
                    onChange={(e) => {
                      setScheduleSearch(e.target.value);
                      setSchedulePage(1);
                    }}
                    placeholder="Cari rombel, mapel, guru, atau hari..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {scheduleSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleSearch('');
                        setSchedulePage(1);
                      }}
                      aria-label="Hapus pencarian jadwal"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
                  <select
                    aria-label="Filter hari jadwal"
                    value={scheduleDayFilter}
                    onChange={(e) => {
                      setScheduleDayFilter(e.target.value);
                      setSchedulePage(1);
                    }}
                    className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Hari</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={String(d)}>
                        {DAY_NAMES[d]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter rombel jadwal"
                    value={scheduleClassroomFilter}
                    onChange={(e) => {
                      setScheduleClassroomFilter(e.target.value);
                      setSchedulePage(1);
                    }}
                    className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="ALL">Semua Rombel</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {schedules.length === 0 ? (
              <AkademikEmptyState
                icon={<BookOpenCheck className="w-6 h-6" />}
                message="Belum ada jadwal pelajaran yang disusun."
              />
            ) : filteredSchedules.length === 0 ? (
              <AkademikEmptyState
                icon={<BookOpenCheck className="w-6 h-6" />}
                message="Tidak ada jadwal pelajaran yang sesuai dengan filter atau pencarian."
                compact
              />
            ) : (
              <div className="space-y-3">
                {canManageSchedule &&
                  filteredSchedules.some((s) => canManageScheduleRow(s.classroom_id)) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3.5 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          const manageableIds = filteredSchedules
                            .filter((s) => canManageScheduleRow(s.classroom_id))
                            .map((s) => s.id);
                          const selectedSet = new Set(selectedScheduleIds);
                          const allSelected =
                            manageableIds.length > 0 &&
                            manageableIds.every((id) => selectedSet.has(id));
                          if (allSelected) {
                            const manageableSet = new Set(manageableIds);
                            setSelectedScheduleIds((prev) =>
                              prev.filter((id) => !manageableSet.has(id))
                            );
                          } else {
                            setSelectedScheduleIds((prev) =>
                              Array.from(new Set([...prev, ...manageableIds]))
                            );
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 font-semibold text-slate-700 transition"
                      >
                        {(() => {
                          const manageableIds = filteredSchedules
                            .filter((s) => canManageScheduleRow(s.classroom_id))
                            .map((s) => s.id);
                          return manageableIds.length > 0 &&
                            manageableIds.every((id) => selectedScheduleIds.includes(id))
                            ? 'Batal Pilih Semua'
                            : `Pilih Semua (${manageableIds.length})`;
                        })()}
                      </button>
                      {selectedSchedulesList.length > 0 && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => setSelectedScheduleIds([])}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 font-medium text-slate-600 transition"
                        >
                          Reset ({selectedSchedulesList.length})
                        </button>
                      )}
                    </div>
                    {selectedSchedulesList.length > 0 && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setBatchDeleteScheduleOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Terpilih ({selectedSchedulesList.length})</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {paginatedSchedules.map((sch) => {
                    const isEditingThis = editingScheduleId === sch.id;
                    const isSelected = selectedScheduleIds.includes(sch.id);
                    const canEditThisRow = canManageScheduleRow(sch.classroom_id);
                    return (
                      <div
                        key={sch.id}
                        className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs border transition ${
                          isEditingThis
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                            : isSelected
                            ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/30'
                            : 'border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex items-start gap-2.5">
                          {canEditThisRow && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={submitting}
                              onChange={() =>
                                setSelectedScheduleIds((prev) =>
                                  prev.includes(sch.id)
                                    ? prev.filter((id) => id !== sch.id)
                                    : [...prev, sch.id]
                                )
                              }
                              aria-label={`Pilih jadwal ${sch.classroom?.name || ''} ${sch.subject?.name || ''}`}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {DAY_NAMES[sch.day_of_week] || '-'}
                              </span>
                              <p className="font-bold text-slate-900 break-words">
                                {sch.classroom?.name || '-'} — {sch.subject?.name || '-'}
                              </p>
                            </div>
                            <p className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="break-words">{sch.teacher?.full_name || '-'}</span>
                              <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {(sch.start_time || '').slice(0, 5)}–
                                {(sch.end_time || '').slice(0, 5)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 shrink-0">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            {sch.jtm_count} JTM
                          </span>
                          {canEditThisRow && (
                            <>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                  setEditingScheduleId(sch.id);
                                  setScheduleForm({
                                    classroom_id: sch.classroom_id || '',
                                    subject_id: sch.subject_id || '',
                                    teacher_id: sch.teacher_id || '',
                                    day_of_week: sch.day_of_week || 1,
                                    start_time: (sch.start_time || '07:30').slice(0, 5),
                                    end_time: (sch.end_time || '09:00').slice(0, 5),
                                    jtm_count: sch.jtm_count || 2,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 disabled:opacity-40 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setDeleteScheduleTarget(sch)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-semibold text-[11px] transition"
                              >
                                <Trash2 className="w-3 h-3" /> Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Menampilkan{' '}
                    <strong className="text-slate-800">
                      {(safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE + 1}–
                      {Math.min(safeSchedulePage * SCHEDULE_PAGE_SIZE, filteredSchedules.length)}
                    </strong>{' '}
                    dari <strong className="text-slate-800">{filteredSchedules.length}</strong>{' '}
                    jadwal
                  </span>
                  {totalSchedulePages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeSchedulePage <= 1}
                        onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                      </button>
                      <span className="px-2 font-semibold text-slate-700">
                        {safeSchedulePage} / {totalSchedulePages}
                      </span>
                      <button
                        type="button"
                        disabled={safeSchedulePage >= totalSchedulePages}
                        onClick={() => setSchedulePage((p) => Math.min(totalSchedulePages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                      >
                        Berikutnya <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Konfirmasi Hapus Jadwal Pelajaran */}
          <AkademikModal
            open={Boolean(deleteScheduleTarget)}
            onClose={() => {
              if (!submitting) setDeleteScheduleTarget(null);
            }}
            title="Konfirmasi Hapus Jadwal Pelajaran"
          >
            {deleteScheduleTarget && (
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Anda yakin ingin menghapus sesi jadwal pelajaran berikut?
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Hari &amp; Jam</span>
                    <span className="font-bold text-slate-900">
                      {DAY_NAMES[deleteScheduleTarget.day_of_week] || '-'} (
                      {(deleteScheduleTarget.start_time || '').slice(0, 5)}–
                      {(deleteScheduleTarget.end_time || '').slice(0, 5)})
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Rombel / Mapel</span>
                    <span className="font-bold text-slate-900 text-right break-words">
                      {deleteScheduleTarget.classroom?.name || '-'} —{' '}
                      {deleteScheduleTarget.subject?.name || '-'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                    <span className="text-slate-500 shrink-0">Guru Pengampu</span>
                    <span className="font-semibold text-emerald-700 text-right break-words">
                      {deleteScheduleTarget.teacher?.full_name || '-'} (
                      {deleteScheduleTarget.jtm_count} JTM)
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 leading-relaxed">
                  <strong>Catatan:</strong> Jadwal yang sudah terhubung dengan data presensi atau
                  jurnal pembelajaran tidak dapat dihapus untuk menjaga integritas riwayat JTM.
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setDeleteScheduleTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      if (submitting) return;
                      const ok = await postAction(
                        { action: 'DELETE_SCHEDULE', id: deleteScheduleTarget.id },
                        'Jadwal pelajaran berhasil dihapus.'
                      );
                      if (ok) {
                        if (editingScheduleId === deleteScheduleTarget.id) {
                          setEditingScheduleId(null);
                          setScheduleForm({
                            classroom_id: '',
                            subject_id: '',
                            teacher_id: '',
                            day_of_week: 1,
                            start_time: '07:30',
                            end_time: '09:00',
                            jtm_count: 2,
                          });
                        }
                        setSelectedScheduleIds((prev) =>
                          prev.filter((id) => id !== deleteScheduleTarget.id)
                        );
                        setDeleteScheduleTarget(null);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Jadwal'}</span>
                  </button>
                </div>
              </div>
            )}
          </AkademikModal>

          {/* Modal Konfirmasi Hapus Batch Jadwal Pelajaran */}
          <AkademikModal
            open={batchDeleteScheduleOpen && selectedSchedulesList.length > 0}
            onClose={() => {
              if (!submitting) setBatchDeleteScheduleOpen(false);
            }}
            title={`Konfirmasi Hapus ${selectedSchedulesList.length} Jadwal Pelajaran`}
          >
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">
                    Hapus {selectedSchedulesList.length} sesi jadwal pelajaran terpilih?
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Seluruh jadwal yang dipilih akan dihapus permanen. Jika ada jadwal yang sudah
                    terhubung dengan data presensi atau jurnal, penghapusan batch akan dibatalkan.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 max-h-52 overflow-y-auto space-y-2">
                {selectedSchedulesList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {DAY_NAMES[item.day_of_week] || '-'} · {item.classroom?.name || '-'} —{' '}
                        {item.subject?.name || '-'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.teacher?.full_name || '-'} · {(item.start_time || '').slice(0, 5)}–
                        {(item.end_time || '').slice(0, 5)}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                      {item.jtm_count} JTM
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setBatchDeleteScheduleOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    if (submitting || selectedSchedulesList.length === 0) return;
                    const ids = selectedSchedulesList.map((s) => s.id);
                    const ok = await postAction(
                      { action: 'DELETE_SCHEDULES_BATCH', ids },
                      `${ids.length} jadwal pelajaran berhasil dihapus.`
                    );
                    if (ok) {
                      if (editingScheduleId && ids.includes(editingScheduleId)) {
                        setEditingScheduleId(null);
                        setScheduleForm({
                          classroom_id: '',
                          subject_id: '',
                          teacher_id: '',
                          day_of_week: 1,
                          start_time: '07:30',
                          end_time: '09:00',
                          jtm_count: 2,
                        });
                      }
                      setSelectedScheduleIds([]);
                      setBatchDeleteScheduleOpen(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {submitting
                      ? 'Menghapus...'
                      : `Ya, Hapus ${selectedSchedulesList.length} Jadwal`}
                  </span>
                </button>
              </div>
            </div>
          </AkademikModal>
        </div>
      )}
    </div>
  );
}
