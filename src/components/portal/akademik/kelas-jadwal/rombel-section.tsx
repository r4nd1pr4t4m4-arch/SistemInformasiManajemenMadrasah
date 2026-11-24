'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
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
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import type {
  ClassroomRow,
  EnrollmentRow,
  PostActionFn,
  ShowToastFn,
  StudentOpt,
  TeacherOpt,
} from './types';

interface RombelSectionProps {
  canManage: boolean;
  refreshing: boolean;
  submitting: boolean;
  teachers: TeacherOpt[];
  homeroomTeacherCandidates: TeacherOpt[];
  students: StudentOpt[];
  enrollments: EnrollmentRow[];
  classrooms: ClassroomRow[];
  onRefresh: () => void;
  postAction: PostActionFn;
  showToast: ShowToastFn;
}

export function RombelSection({
  canManage,
  refreshing,
  submitting,
  teachers,
  homeroomTeacherCandidates,
  students,
  enrollments,
  classrooms,
  onRefresh,
  postAction,
  showToast,
}: RombelSectionProps) {
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

  const effectiveSelectedClassroomId = useMemo(() => {
    if (selectedClassroomId && classrooms.some((c) => c.id === selectedClassroomId)) {
      return selectedClassroomId;
    }
    return classrooms[0]?.id || '';
  }, [classrooms, selectedClassroomId]);

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
    () => classrooms.find((c) => c.id === effectiveSelectedClassroomId) || null,
    [classrooms, effectiveSelectedClassroomId]
  );

  const selectedRoomEnrollments = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return enrollments
      .filter((en) => {
        if (en.classroom_id !== effectiveSelectedClassroomId) return false;
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
  }, [enrollments, effectiveSelectedClassroomId, memberSearch]);

  const availableStudentsForRombel = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((st) => {
      const en = enrollmentByStudentId.get(st.id);
      if (en?.classroom_id === effectiveSelectedClassroomId) return false;
      if (onlyUnassigned && en) return false;
      if (!q) return true;
      return (
        st.full_name.toLowerCase().includes(q) ||
        (st.nis || '').toLowerCase().includes(q) ||
        (st.nisn || '').toLowerCase().includes(q)
      );
    });
  }, [students, enrollmentByStudentId, effectiveSelectedClassroomId, onlyUnassigned, studentSearch]);

  return (
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
              onClick={onRefresh}
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
              const isSelectedForMembers = effectiveSelectedClassroomId === c.id;
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
                  Pilih rombel lalu tambahkan siswa aktif ke dalam rombel tersebut pada tahun ajaran
                  berjalan.
                </p>
              </div>
              <select
                aria-label="Pilih rombel untuk kelola anggota"
                value={effectiveSelectedClassroomId}
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
                      !effectiveSelectedClassroomId
                    }
                    onClick={async () => {
                      if (enrolling || submitting) return;
                      setEnrolling(true);
                      try {
                        const ok = await postAction(
                          {
                            action: 'ENROLL_STUDENTS_BATCH',
                            classroom_id: effectiveSelectedClassroomId,
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
                    {countByClassroomId.get(effectiveSelectedClassroomId) || 0})
                  </p>
                </div>

                {(countByClassroomId.get(effectiveSelectedClassroomId) || 0) > 0 && (
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
                            <span className="text-slate-400 font-normal mr-1.5">{idx + 1}.</span>
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
              <strong>Catatan:</strong> Data induk siswa di <strong>Buku Induk</strong> tidak akan
              terhapus. Siswa hanya dilepas dari rombel ini dan dapat ditempatkan kembali ke rombel
              mana pun kapan saja.
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
  );
}
