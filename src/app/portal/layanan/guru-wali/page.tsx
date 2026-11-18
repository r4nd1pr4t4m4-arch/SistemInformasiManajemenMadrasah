'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

interface Opt {
  id: string;
  full_name: string;
}

interface AssignmentRow {
  id: string;
  teacher?: { full_name: string } | null;
  student?: { full_name: string } | null;
}

interface MentoringLogRow {
  id: string;
  mentoring_date: string;
  topic: string;
  notes: string;
  assignment?: {
    teacher?: { full_name: string } | null;
    student?: { full_name: string } | null;
  } | null;
}

export default function GuruWaliPage() {
  const { hasPermission } = usePortalSession();
  const canAssign = hasPermission(PERMISSIONS.GURU_WALI_ASSIGN);
  const canLog = hasPermission(PERMISSIONS.GURU_WALI_LOG);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<Opt[]>([]);
  const [teachers, setTeachers] = useState<Opt[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [logs, setLogs] = useState<MentoringLogRow[]>([]);

  const [assignForm, setAssignForm] = useState({ teacher_id: '', student_id: '' });
  const [logForm, setLogForm] = useState({
    assignment_id: '',
    topic: '',
    aspect: 'AKADEMIK' as 'AKADEMIK' | 'IBADAH_KARAKTER' | 'SOSIAL' | 'KESEHATAN' | 'LAINNYA',
    notes: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, gwRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/layanan/guru-wali'),
      ]);
      const bi = await biRes.json();
      const gw = await gwRes.json();
      setStudents(bi.students || []);
      setTeachers(bi.teachers || []);
      setAssignments(gw.assignments || []);
      setLogs(gw.logs || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postGw(body: unknown, msg: string) {
    const res = await fetch('/api/layanan/guru-wali', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return;
    }
    showToast(msg);
    await loadData();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat manajemen Guru Wali...
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

      <div className="grid lg:grid-cols-12 gap-6">
        {(canAssign || canLog) && (
          <div className="lg:col-span-5 space-y-5">
            {canAssign && (
              <div className="glass-card rounded-3xl p-6 space-y-3">
                <h1 className="text-sm font-bold text-slate-900">
                  Tetapkan Guru Wali Siswa (Terpisah dari BK)
                </h1>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postGw(
                      { action: 'ASSIGN_GURU_WALI', ...assignForm },
                      'Guru Wali siswa berhasil ditetapkan.'
                    );
                  }}
                  className="space-y-2.5"
                >
                  <select
                    required
                    value={assignForm.teacher_id}
                    onChange={(e) => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Guru Wali --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={assignForm.student_id}
                    onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                  >
                    Simpan Penugasan
                  </button>
                </form>
              </div>
            )}

            {canLog && (
              <div className="glass-card rounded-3xl p-6 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Catat Bimbingan Guru Wali</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postGw(
                      { action: 'ADD_MENTORING_LOG', ...logForm },
                      'Rekam jejak bimbingan Guru Wali tersimpan.'
                    );
                    setLogForm({ ...logForm, topic: '', notes: '' });
                  }}
                  className="space-y-2.5"
                >
                  <select
                    required
                    value={logForm.assignment_id}
                    onChange={(e) => setLogForm({ ...logForm, assignment_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Siswa Bimbingan --</option>
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.student?.full_name} (Wali: {a.teacher?.full_name})
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    placeholder="Topik Bimbingan"
                    value={logForm.topic}
                    onChange={(e) => setLogForm({ ...logForm, topic: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <textarea
                    required
                    rows={3}
                    placeholder="Catatan Perkembangan"
                    value={logForm.notes}
                    onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                  >
                    Simpan Log Bimbingan
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <div
          className={`${
            canAssign || canLog ? 'lg:col-span-7' : 'lg:col-span-12'
          } glass-card rounded-3xl p-6 space-y-3`}
        >
          <h2 className="text-base font-bold text-slate-900">
            Rekam Jejak Bimbingan Guru Wali ({logs.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="modular-card rounded-xl p-3.5 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {l.assignment?.student?.full_name} — {l.topic}
                </p>
                <p className="text-slate-600">{l.notes}</p>
                <p className="text-[11px] text-slate-400">
                  Guru Wali: {l.assignment?.teacher?.full_name} • {l.mentoring_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
