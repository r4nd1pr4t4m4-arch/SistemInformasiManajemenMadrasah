'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AkademikErrorBanner, AkademikToast, useAkademikToast } from './akademik-ui';

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
}

export function PiketKelasWorkspace() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [pickets, setPickets] = useState<PicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      }
    }
  }, []);

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
          task_notes: form.task_notes,
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

  async function handleDelete(item: PicketItem) {
    if (submitting) return;
    const name = item.student?.full_name || 'siswa ini';
    if (!window.confirm(`Hapus jadwal piket ${name}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/piket-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', id: item.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus.');
      }
      showToast('success', `Jadwal piket ${name} dihapus.`);
      await loadData(selectedClassroomId);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Manajemen Jadwal Piket Kelas Siswa</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Atur pembagian jadwal piket kebersihan kelas per hari (Senin–Sabtu). Siswa dan orang tua akan melihat penanda khusus pada hari piket masing-masing.
          </p>
        </div>

        <div className="w-full md:w-auto md:min-w-[220px]">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Pilih Rombel / Kelas:
          </label>
          <select
            value={selectedClassroomId}
            onChange={(e) => {
              setSelectedClassroomId(e.target.value);
              loadData(e.target.value);
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
      </div>

      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={() => loadData(selectedClassroomId)} />

      {/* Form Tambah Jadwal Piket */}
      <form
        onSubmit={handleAdd}
        className="glass-card rounded-3xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Hari Piket</label>
          <select
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            {Object.entries(DAY_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
          <select
            required
            value={form.student_id}
            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Tugas (Opsional)
          </label>
          <input
            type="text"
            placeholder="Misal: Sapu lantai & papan tulis"
            value={form.task_notes}
            onChange={(e) => setForm({ ...form, task_notes: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedClassroomId}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 text-xs transition"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Tambah ke Piket
        </button>
      </form>

      {loading ? (
        <div className="glass-card rounded-3xl p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat jadwal piket kelas...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((day) => {
            const list = pickets.filter((p) => p.day_of_week === day);
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
                    {list.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate">
                            {item.student?.full_name || 'Siswa'}
                          </p>
                          {item.task_notes && (
                            <p className="text-[10px] text-slate-500 break-words">
                              {item.task_notes}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={submitting}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 disabled:opacity-40 transition shrink-0"
                          title="Hapus"
                          aria-label={`Hapus piket ${item.student?.full_name || 'siswa'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
