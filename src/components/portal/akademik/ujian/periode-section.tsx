'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  DoorOpen,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import type {
  ClassroomOpt,
  EnrollmentRow,
  ExamPeriodRow,
  ExamRoomRow,
  ExamRoomStudentRow,
  RemoveRoomMemberModalState,
  StudentOpt,
} from './types';

export interface PeriodeSectionProps {
  canManageUjian: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  examPeriods: ExamPeriodRow[];
  rooms: ExamRoomRow[];
  examRoomStudents: ExamRoomStudentRow[];
  students: StudentOpt[];
  classrooms: ClassroomOpt[];
  enrollments: EnrollmentRow[];
  selectedExamPeriodId: string;
  setSelectedExamPeriodId: (id: string) => void;
  selectedExamRoomId: string;
  setSelectedExamRoomId: (id: string) => void;
  roomForm: {
    exam_period_id: string;
    room_name: string;
    capacity: number;
  };
  setRoomForm: React.Dispatch<
    React.SetStateAction<{
      exam_period_id: string;
      room_name: string;
      capacity: number;
    }>
  >;
  setRemoveRoomMemberModal: (modal: RemoveRoomMemberModalState | null) => void;
}

export function PeriodeSection({
  canManageUjian,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  examPeriods,
  rooms,
  examRoomStudents,
  students,
  classrooms,
  enrollments,
  selectedExamPeriodId,
  setSelectedExamPeriodId,
  selectedExamRoomId,
  setSelectedExamRoomId,
  roomForm,
  setRoomForm,
  setRemoveRoomMemberModal,
}: PeriodeSectionProps) {
  const [periodForm, setPeriodForm] = useState({
    name: 'PAS Ganjil 2026/2027',
    start_date: '2026-12-01',
    end_date: '2026-12-10',
  });
  const [examRoomClassroomFilter, setExamRoomClassroomFilter] = useState('');
  const [examRoomSearch, setExamRoomSearch] = useState('');
  const [examRoomOnlyUnassigned, setExamRoomOnlyUnassigned] = useState(true);
  const [selectedExamStudentIds, setSelectedExamStudentIds] = useState<string[]>([]);
  const [assigningExamStudents, setAssigningExamStudents] = useState(false);

  const studentClassroomMap = useMemo(() => {
    const clsNameById = new Map(classrooms.map((c) => [c.id, c.name]));
    const map = new Map<string, { classroom_id: string; classroom_name: string }>();
    for (const en of enrollments) {
      map.set(en.student_id, {
        classroom_id: en.classroom_id,
        classroom_name: clsNameById.get(en.classroom_id) || '-',
      });
    }
    return map;
  }, [classrooms, enrollments]);

  const roomsForSelectedPeriod = useMemo(
    () =>
      selectedExamPeriodId
        ? rooms.filter((r) => r.exam_period_id === selectedExamPeriodId)
        : rooms,
    [rooms, selectedExamPeriodId]
  );

  const countByExamRoomId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of examRoomStudents) {
      map.set(row.exam_room_id, (map.get(row.exam_room_id) || 0) + 1);
    }
    return map;
  }, [examRoomStudents]);

  const examAssignmentByStudentInPeriod = useMemo(() => {
    const map = new Map<string, { exam_room_id: string; room_name: string }>();
    for (const row of examRoomStudents) {
      if (row.exam_period_id === selectedExamPeriodId) {
        map.set(row.student_id, {
          exam_room_id: row.exam_room_id,
          room_name: row.room?.room_name || '-',
        });
      }
    }
    return map;
  }, [examRoomStudents, selectedExamPeriodId]);

  const selectedExamRoom = useMemo(
    () => rooms.find((r) => r.id === selectedExamRoomId) || null,
    [rooms, selectedExamRoomId]
  );

  const selectedExamRoomMembers = useMemo(
    () =>
      examRoomStudents
        .filter((row) => row.exam_room_id === selectedExamRoomId)
        .sort((a, b) =>
          (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id')
        ),
    [examRoomStudents, selectedExamRoomId]
  );

  const availableStudentsForExamRoom = useMemo(() => {
    const q = examRoomSearch.trim().toLowerCase();
    return students.filter((st) => {
      const assigned = examAssignmentByStudentInPeriod.get(st.id);
      if (assigned?.exam_room_id === selectedExamRoomId) return false;
      if (examRoomOnlyUnassigned && assigned) return false;
      if (examRoomClassroomFilter) {
        const rombel = studentClassroomMap.get(st.id);
        if (!rombel || rombel.classroom_id !== examRoomClassroomFilter) return false;
      }
      if (!q) return true;
      return (
        st.full_name.toLowerCase().includes(q) ||
        (st.nis || '').toLowerCase().includes(q)
      );
    });
  }, [
    students,
    examAssignmentByStudentInPeriod,
    selectedExamRoomId,
    examRoomOnlyUnassigned,
    examRoomClassroomFilter,
    studentClassroomMap,
    examRoomSearch,
  ]);

  const totalSeatsInPeriod = roomsForSelectedPeriod.reduce(
    (sum, r) => sum + (Number(r.capacity) || 0),
    0
  );
  const totalAssignedInPeriod = roomsForSelectedPeriod.reduce(
    (sum, r) => sum + (countByExamRoomId.get(r.id) || 0),
    0
  );
  const selectedRoomProjectedCount =
    selectedExamRoomMembers.length + selectedExamStudentIds.length;
  const isOverCapacity =
    Boolean(selectedExamRoom) &&
    selectedExamStudentIds.length > 0 &&
    selectedRoomProjectedCount > (selectedExamRoom?.capacity || 0);

  const handlePeriodSelection = (pid: string) => {
    setSelectedExamPeriodId(pid);
    setRoomForm((prev) => ({ ...prev, exam_period_id: pid }));
    const firstRoom = rooms.find((r) => r.exam_period_id === pid);
    setSelectedExamRoomId(firstRoom?.id || '');
    setSelectedExamStudentIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Header & Ringkasan Periode Ujian */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Periode &amp; Ruang Ujian</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kelola periode pelaksanaan ujian, buat ruang ujian terpisah dari rombel reguler,
              dan tempatkan peserta ujian dari berbagai rombel.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Memuat...' : 'Muat Ulang'}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Periode</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {examPeriods.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Ruang Periode Ini</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {roomsForSelectedPeriod.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total Kursi</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {totalSeatsInPeriod}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Peserta Terdaftar</p>
            <p className="text-xl font-bold text-indigo-700 mt-0.5 tabular-nums">
              {totalAssignedInPeriod}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Buat Periode Ujian</span>
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedName = periodForm.name.trim();
                if (trimmedName.length < 3) {
                  showToast('error', 'Nama periode ujian minimal 3 karakter.');
                  return;
                }
                if (!periodForm.start_date || !periodForm.end_date) {
                  showToast('error', 'Tanggal mulai dan tanggal selesai wajib diisi.');
                  return;
                }
                if (periodForm.end_date < periodForm.start_date) {
                  showToast(
                    'error',
                    'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'
                  );
                  return;
                }
                await postUjian(
                  {
                    action: 'CREATE_PERIOD',
                    name: trimmedName,
                    start_date: periodForm.start_date,
                    end_date: periodForm.end_date,
                  },
                  'Periode ujian dibuat.'
                );
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label
                  htmlFor="ujian-period-name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nama Periode Ujian <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ujian-period-name"
                  required
                  minLength={3}
                  placeholder="Contoh: PAS Ganjil 2026/2027"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="ujian-period-start"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ujian-period-start"
                    required
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) =>
                      setPeriodForm({ ...periodForm, start_date: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="ujian-period-end"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ujian-period-end"
                    required
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) =>
                      setPeriodForm({ ...periodForm, end_date: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Periode Ujian
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-4 sm:p-6 space-y-3`}
        >
          <h2 className="text-base font-bold text-slate-900">
            Daftar Periode Ujian ({examPeriods.length})
          </h2>
          {examPeriods.length === 0 ? (
            <AkademikEmptyState
              icon={<Calendar className="w-6 h-6 text-slate-400" />}
              message="Belum ada periode ujian yang dibuat."
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {examPeriods.map((p) => {
                const isSelected = selectedExamPeriodId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePeriodSelection(p.id)}
                    className={`w-full text-left modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs cursor-pointer border transition ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-slate-900 truncate">{p.name}</span>
                    <span className="text-slate-500 shrink-0">
                      {p.start_date || '-'} s.d. {p.end_date || '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Buat Ruang Ujian</span>
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ruang ujian terpisah dari rombel reguler (dapat berisi campuran siswa dari
              beberapa rombel).
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetPeriodId = roomForm.exam_period_id || selectedExamPeriodId;
                if (!targetPeriodId) {
                  showToast('error', 'Pilih periode ujian terlebih dahulu.');
                  return;
                }
                const trimmedRoomName = roomForm.room_name.trim();
                if (!trimmedRoomName) {
                  showToast('error', 'Nama ruang ujian wajib diisi.');
                  return;
                }
                const safeCapacity = Math.max(
                  1,
                  Number.isFinite(roomForm.capacity) ? roomForm.capacity : 30
                );
                const ok = await postUjian(
                  {
                    action: 'CREATE_ROOM',
                    exam_period_id: targetPeriodId,
                    room_name: trimmedRoomName,
                    capacity: safeCapacity,
                  },
                  'Ruang ujian berhasil ditambahkan.'
                );
                if (ok) {
                  setRoomForm((prev) => ({ ...prev, room_name: '', capacity: 30 }));
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label
                  htmlFor="ujian-room-period-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Periode Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ujian-room-period-select"
                  required
                  value={roomForm.exam_period_id || selectedExamPeriodId}
                  onChange={(e) => handlePeriodSelection(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Periode Ujian --</option>
                  {examPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 space-y-1">
                  <label
                    htmlFor="ujian-room-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nama Ruang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ujian-room-name"
                    required
                    placeholder="Nama Ruang (cth: Ruang 01)"
                    value={roomForm.room_name}
                    onChange={(e) => setRoomForm({ ...roomForm, room_name: e.target.value })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="ujian-room-capacity"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Kapasitas
                  </label>
                  <input
                    id="ujian-room-capacity"
                    type="number"
                    min={1}
                    required
                    placeholder="Kapasitas"
                    value={roomForm.capacity}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setRoomForm({
                        ...roomForm,
                        capacity: Number.isFinite(val) ? Math.max(1, val) : 1,
                      });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    title="Kapasitas Ruang"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || !(roomForm.exam_period_id || selectedExamPeriodId)}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Ruang Ujian
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-4 sm:p-6 space-y-3`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Daftar Ruang Ujian ({roomsForSelectedPeriod.length})</span>
            </h2>
            <select
              aria-label="Filter daftar ruang berdasarkan periode ujian"
              value={selectedExamPeriodId}
              onChange={(e) => handlePeriodSelection(e.target.value)}
              className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              {examPeriods.length === 0 ? (
                <option value="">Belum ada periode</option>
              ) : (
                examPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {roomsForSelectedPeriod.length === 0 ? (
            <AkademikEmptyState
              icon={<DoorOpen className="w-6 h-6 text-slate-400" />}
              message="Belum ada ruang ujian pada periode ini. Silakan buat ruang ujian terlebih dahulu."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {roomsForSelectedPeriod.map((r) => {
                const count = countByExamRoomId.get(r.id) || 0;
                const isSelected = selectedExamRoomId === r.id;
                const isFull = count >= r.capacity;
                return (
                  <div
                    key={r.id}
                    className={`modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 text-xs border transition ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                        : 'border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{r.room_name}</p>
                      <p className="text-[11px] text-slate-500">
                        Peserta:{' '}
                        <strong className={isFull ? 'text-amber-700' : 'text-emerald-700'}>
                          {count}
                        </strong>{' '}
                        / {r.capacity} kursi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExamRoomId(r.id);
                        setSelectedExamStudentIds([]);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-[11px] shrink-0 transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <Users className="w-3 h-3" /> Kelola Peserta
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {roomsForSelectedPeriod.length > 0 && (
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Penempatan Siswa ke Ruang Ujian</span>
              </h2>
              <p className="text-xs text-slate-500">
                Masukkan siswa ke ruang ujian pada periode terpilih. Siswa dapat diambil dari
                rombel mana saja (tidak terikat rombel).
              </p>
            </div>
            <select
              aria-label="Pilih ruang ujian aktif"
              value={selectedExamRoomId}
              onChange={(e) => {
                setSelectedExamRoomId(e.target.value);
                setSelectedExamStudentIds([]);
              }}
              className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              {roomsForSelectedPeriod.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_name} ({countByExamRoomId.get(r.id) || 0}/{r.capacity} Siswa)
                </option>
              ))}
            </select>
          </div>

          <div className={`grid gap-4 ${canManageUjian ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {canManageUjian && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">
                    Pilih Siswa untuk {selectedExamRoom?.room_name || 'Ruang Ujian'}
                  </p>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examRoomOnlyUnassigned}
                      onChange={(e) => setExamRoomOnlyUnassigned(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    Belum dapat ruang di periode ini
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    aria-label="Filter rombel asal siswa"
                    value={examRoomClassroomFilter}
                    onChange={(e) => setExamRoomClassroomFilter(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">-- Filter Rombel Asal (Semua) --</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        Rombel {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari nama siswa / NIS..."
                      value={examRoomSearch}
                      onChange={(e) => setExamRoomSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-8 py-2 text-xs text-slate-900"
                    />
                    {examRoomSearch && (
                      <button
                        type="button"
                        onClick={() => setExamRoomSearch('')}
                        aria-label="Hapus pencarian siswa"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{availableStudentsForExamRoom.length} siswa tersedia</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedExamStudentIds(
                          availableStudentsForExamRoom.map((s) => s.id)
                        )
                      }
                      className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    {selectedExamStudentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedExamStudentIds([])}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Reset ({selectedExamStudentIds.length})
                      </button>
                    )}
                  </div>
                </div>

                {isOverCapacity && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Jumlah peserta ({selectedRoomProjectedCount}) akan melebihi kapasitas
                      ruang ({selectedExamRoom?.capacity} kursi).
                    </span>
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {availableStudentsForExamRoom.length === 0 ? (
                    <AkademikEmptyState
                      compact
                      message="Tidak ada siswa yang sesuai filter."
                    />
                  ) : (
                    availableStudentsForExamRoom.map((st) => {
                      const checked = selectedExamStudentIds.includes(st.id);
                      const rombel = studentClassroomMap.get(st.id);
                      const currentRoom = examAssignmentByStudentInPeriod.get(st.id);
                      return (
                        <label
                          key={st.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                            checked
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedExamStudentIds((prev) =>
                                  prev.includes(st.id)
                                    ? prev.filter((id) => id !== st.id)
                                    : [...prev, st.id]
                                )
                              }
                              className="rounded border-slate-300 text-emerald-600"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-slate-900">
                                {st.full_name}
                              </span>
                              {st.nis && (
                                <span className="text-slate-400 ml-1.5">({st.nis})</span>
                              )}
                              {rombel && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                  {rombel.classroom_name}
                                </span>
                              )}
                            </div>
                          </div>
                          {currentRoom && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold shrink-0">
                              Pindah dari {currentRoom.room_name}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  aria-busy={assigningExamStudents || undefined}
                  disabled={
                    assigningExamStudents ||
                    selectedExamStudentIds.length === 0 ||
                    !selectedExamRoomId ||
                    !selectedExamPeriodId
                  }
                  onClick={async () => {
                    setAssigningExamStudents(true);
                    try {
                      const ok = await postUjian(
                        {
                          action: 'ASSIGN_EXAM_ROOM_STUDENTS',
                          exam_period_id: selectedExamPeriodId,
                          exam_room_id: selectedExamRoomId,
                          student_ids: selectedExamStudentIds,
                        },
                        `${selectedExamStudentIds.length} siswa berhasil ditempatkan ke ${selectedExamRoom?.room_name || 'ruang ujian'}.`
                      );
                      if (ok) setSelectedExamStudentIds([]);
                    } finally {
                      setAssigningExamStudents(false);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  {assigningExamStudents && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {assigningExamStudents
                      ? 'Menyimpan...'
                      : `Masukkan ke Ruang Ujian (${selectedExamStudentIds.length} Siswa)`}
                  </span>
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">
                  Peserta {selectedExamRoom?.room_name || 'Ruang Ujian'} (
                  {selectedExamRoomMembers.length} / {selectedExamRoom?.capacity ?? '-'})
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {selectedExamRoomMembers.length === 0 ? (
                  <AkademikEmptyState
                    compact
                    message="Belum ada siswa ditempatkan di ruang ujian ini."
                  />
                ) : (
                  selectedExamRoomMembers.map((member, idx) => {
                    const rombel = studentClassroomMap.get(member.student_id);
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200/80 text-xs"
                      >
                        <div className="truncate min-w-0">
                          <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                          <span className="font-semibold text-slate-900">
                            {member.student?.full_name || 'Siswa'}
                          </span>
                          {member.student?.nis && (
                            <span className="text-slate-400 ml-1.5">({member.student.nis})</span>
                          )}
                          {rombel && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {rombel.classroom_name}
                            </span>
                          )}
                        </div>
                        {canManageUjian && (
                          <button
                            type="button"
                            onClick={() =>
                              setRemoveRoomMemberModal({
                                id: member.id,
                                studentName: member.student?.full_name || 'Siswa',
                                roomName: selectedExamRoom?.room_name || 'Ruang Ujian',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold shrink-0 transition cursor-pointer"
                            title="Keluarkan dari ruang ujian"
                          >
                            <Trash2 className="w-3 h-3" /> Keluarkan
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
