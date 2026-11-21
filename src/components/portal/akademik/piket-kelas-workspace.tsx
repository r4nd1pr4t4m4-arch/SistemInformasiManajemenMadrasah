'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikModal,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

interface Classroom {
  id: string;
  name: string;
  grade_level?: string | null;
}

interface Student {
  id: string;
  full_name: string;
  nis?: string | null;
}

interface PicketItem {
  id: string;
  classroom_id: string;
  student_id: string;
  day_of_week: number;
  task_notes?: string | null;
  student?: Student | null;
  classroom?: Classroom | null;
}

export function PiketKelasWorkspace() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [pickets, setPickets] = useState<PicketItem[]>([]);
  const [myStudentIds, setMyStudentIds] = useState<string[]>([]);
  const [activeYearName, setActiveYearName] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picketSearch, setPicketSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PicketItem | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();
  const requestIdRef = useRef(0);

  const [form, setForm] = useState({
    student_id: '',
    day_of_week: 1,
    task_notes: '',
  });

  const loadData = useCallback(async (classroomId?: string) => {
    const reqId = ++requestIdRef.current;
    try {
      const url = classroomId
        ? `/api/akademik/piket-kelas?classroom_id=${encodeURIComponent(classroomId)}`
        : '/api/akademik/piket-kelas';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal piket.');
      setLoadError(null);
      setActiveYearName(data.activeYear?.name || null);
      setCanManage(Boolean(data.canManage));
      setMyStudentIds(data.myStudentIds || []);
      setClassrooms(data.classrooms || []);
      if (data.classroomId && !classroomId) {
        setSelectedClassroomId(data.classroomId);
      }
      setStudents(data.students || []);
      setPickets(data.pickets || []);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data.');
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(
    (classroomId?: string) => {
      setRefreshing(true);
      void loadData(classroomId ?? (selectedClassroomId || undefined));
    },
    [loadData, selectedClassroomId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!selectedClassroomId || !form.student_id) {
      showToast('error', 'Pilih kelas dan siswa terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/piket-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD',
          classroom_id: selectedClassroomId,
          student_id: form.student_id,
          day_of_week: Number(form.day_of_week),
          task_notes: form.task_notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan jadwal piket.');
      showToast('success', 'Jadwal piket siswa berhasil ditambahkan.');
      setForm((prev) => ({ ...prev, student_id: '', task_notes: '' }));
      await loadData(selectedClassroomId);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (submitting || !deleteTarget) return;
    const name = deleteTarget.student?.full_name || 'siswa ini';
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/piket-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', id: deleteTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus.');
      }
      showToast('success', `Jadwal piket ${name} dihapus.`);
      setDeleteTarget(null);
      await loadData(selectedClassroomId);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus.');
    } finally {
      setSubmitting(false);
    }
  }

  const myStudentIdSet = useMemo(() => new Set(myStudentIds), [myStudentIds]);

  const picketStats = useMemo(() => {
    const scheduledStudentIds = new Set<string>();
    const activeDays = new Set<number>();
    for (const p of pickets) {
      scheduledStudentIds.add(p.student_id);
      activeDays.add(p.day_of_week);
    }
    const unscheduledStudents = students.filter((s) => !scheduledStudentIds.has(s.id)).length;
    return {
      totalEntries: pickets.length,
      scheduledStudents: scheduledStudentIds.size,
      unscheduledStudents,
      activeDays: activeDays.size,
    };
  }, [pickets, students]);

  const filteredPickets = useMemo(() => {
    const q = picketSearch.trim().toLowerCase();
    if (!q) return pickets;
    return pickets.filter(
      (p) =>
        (p.student?.full_name || '').toLowerCase().includes(q) ||
        (p.student?.nis || '').toLowerCase().includes(q) ||
        (p.task_notes || '').toLowerCase().includes(q)
    );
  }, [pickets, picketSearch]);

  const activeClassroomName =
    classrooms.find((c) => c.id === selectedClassroomId)?.name ||
    pickets[0]?.classroom?.name ||
    '';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Manajemen Jadwal Piket Kelas Siswa</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Atur pembagian jadwal piket kebersihan kelas per hari (Senin–Sabtu).
            {activeYearName ? ` Tahun ajaran aktif: ${activeYearName}.` : ''} Siswa dan orang tua
            akan melihat penanda khusus pada hari piket masing-masing.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 shrink-0">
          {canManage && (
            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <label
                htmlFor="piket-classroom-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Pilih Rombel / Kelas:
              </label>
              <select
                id="piket-classroom-select"
                value={selectedClassroomId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedClassroomId(nextId);
                  setForm((prev) => ({ ...prev, student_id: '' }));
                  setRefreshing(true);
                  void loadData(nextId);
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {classrooms.length === 0 ? (
                  <option value="">Belum ada rombel</option>
                ) : (
                  classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          {!canManage && activeClassroomName && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold self-start sm:self-end">
              Kelas: {activeClassroomName}
            </div>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => handleRefresh()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={() => handleRefresh()} />

      {/* Ringkasan Statistik Piket */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Total Penugasan</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{picketStats.totalEntries}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Siswa Terjadwal</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">
              {picketStats.scheduledStudents}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Belum Terjadwal</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">
              {canManage ? picketStats.unscheduledStudents : '-'}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500">Hari Terisi</p>
            <p className="text-xl font-black text-sky-700 mt-0.5">{picketStats.activeDays} / 6</p>
          </div>
        </div>
      )}

      {/* Form Tambah Jadwal Piket */}
      {canManage && (
        <form
          onSubmit={handleAdd}
          className="glass-card rounded-3xl p-5 sm:p-6 space-y-3"
        >
          {selectedClassroomId && students.length === 0 && !loading && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Rombel <strong>{activeClassroomName || 'ini'}</strong> belum memiliki siswa aktif.
              Tambahkan anggota siswa di menu <strong>Kelas &amp; Jadwal → Rombel</strong> terlebih
              dahulu.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label
                htmlFor="piket-day"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Hari Piket
              </label>
              <select
                id="piket-day"
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {Object.entries(DAY_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="piket-student"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Pilih Siswa <span className="text-rose-600">*</span>
              </label>
              <select
                id="piket-student"
                required
                disabled={students.length === 0}
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nis ? `(${s.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="piket-notes"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Catatan Tugas (Opsional)
              </label>
              <input
                id="piket-notes"
                type="text"
                placeholder="Misal: Sapu lantai & papan tulis"
                value={form.task_notes}
                onChange={(e) => setForm({ ...form, task_notes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedClassroomId || students.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 text-xs transition"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Tambah ke Piket
            </button>
          </div>
        </form>
      )}

      {/* Pencarian Petugas Piket */}
      {!loading && pickets.length > 0 && (
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={picketSearch}
            onChange={(e) => setPicketSearch(e.target.value)}
            placeholder="Cari nama siswa, NIS, atau catatan tugas..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          {picketSearch && (
            <button
              type="button"
              onClick={() => setPicketSearch('')}
              aria-label="Hapus pencarian piket"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-3xl p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat jadwal piket kelas...
        </div>
      ) : pickets.length > 0 && filteredPickets.length === 0 ? (
        <AkademikEmptyState
          icon={<ClipboardCheck className="w-6 h-6" />}
          message="Tidak ada jadwal piket siswa yang sesuai dengan pencarian."
          compact
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((day) => {
            const list = filteredPickets.filter((p) => p.day_of_week === day);
            return (
              <div key={day} className="glass-card rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    {DAY_NAMES[day]}
                  </h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {list.length} siswa
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada siswa</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((item) => {
                      const isMine = myStudentIdSet.has(item.student_id);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                            isMine
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold text-slate-800 break-words">
                                {item.student?.full_name || 'Siswa'}
                              </p>
                              {isMine && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                                  Jadwal Anda
                                </span>
                              )}
                            </div>
                            {item.task_notes && (
                              <p className="text-[10px] text-slate-500 break-words">
                                {item.task_notes}
                              </p>
                            )}
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              disabled={submitting}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 disabled:opacity-40 transition shrink-0"
                              title="Hapus"
                              aria-label={`Hapus piket ${item.student?.full_name || 'siswa'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Jadwal Piket */}
      <AkademikModal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!submitting) setDeleteTarget(null);
        }}
        title="Konfirmasi Hapus Jadwal Piket"
      >
        {deleteTarget && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-slate-600 leading-relaxed">
                Anda yakin ingin menghapus siswa berikut dari daftar piket hari{' '}
                <strong className="text-slate-900">
                  {DAY_NAMES[deleteTarget.day_of_week] || '-'}
                </strong>
                ?
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Nama Siswa</span>
                <span className="font-bold text-slate-900 text-right break-words">
                  {deleteTarget.student?.full_name || 'Siswa'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Hari Piket</span>
                <span className="font-semibold text-emerald-700">
                  {DAY_NAMES[deleteTarget.day_of_week] || '-'}
                </span>
              </div>
              {deleteTarget.task_notes && (
                <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                  <span className="text-slate-500 shrink-0">Catatan Tugas</span>
                  <span className="text-slate-700 text-right break-words">
                    {deleteTarget.task_notes}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmDelete}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Piket'}</span>
              </button>
            </div>
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
