'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';

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
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    student_id: '',
    day_of_week: 1,
    task_notes: '',
  });

  const loadData = useCallback(async (classroomId?: string) => {
    setLoading(true);
    try {
      const url = classroomId
        ? `/api/akademik/piket-kelas?classroom_id=${encodeURIComponent(classroomId)}`
        : '/api/akademik/piket-kelas';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal piket.');
      setClassrooms(data.classrooms || []);
      if (data.classroomId && !classroomId) {
        setSelectedClassroomId(data.classroomId);
      }
      setStudents(data.students || []);
      setPickets(data.pickets || []);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClassroomId || !form.student_id) {
      setMsg({ type: 'err', text: 'Pilih kelas dan siswa terlebih dahulu.' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
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
      setMsg({ type: 'ok', text: 'Jadwal piket siswa berhasil ditambahkan.' });
      setForm((prev) => ({ ...prev, student_id: '', task_notes: '' }));
      await loadData(selectedClassroomId);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/piket-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', id }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Gagal menghapus.');
      }
      await loadData(selectedClassroomId);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-700" />
            Manajemen Jadwal Piket Kelas Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur pembagian jadwal piket kebersihan kelas per hari (Senin–Sabtu). Siswa dan orang tua akan melihat penanda khusus pada hari piket masing-masing.
          </p>
        </div>

        <div className="min-w-[220px]">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Pilih Rombel / Kelas:
          </label>
          <select
            value={selectedClassroomId}
            onChange={(e) => {
              setSelectedClassroomId(e.target.value);
              loadData(e.target.value);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-medium border ${
            msg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Form Tambah Jadwal Piket */}
      <form onSubmit={handleAdd} className="glass-card rounded-3xl p-6 grid sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Hari Piket</label>
          <select
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
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
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 text-xs transition"
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
                    <Sparkles className="w-4 h-4 text-emerald-600" />
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
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.student?.full_name || 'Siswa'}
                          </p>
                          {item.task_notes && (
                            <p className="text-[10px] text-slate-500">{item.task_notes}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={submitting}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                          title="Hapus"
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
