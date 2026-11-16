'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface ExamPeriodRow {
  id: string;
  name: string;
}

export default function UjianPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
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

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, ujRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/akademik/ujian'),
      ]);
      const bi = await biRes.json();
      const uj = await ujRes.json();
      setTeachers(bi.teachers || []);
      setExamPeriods(uj.periods || []);
      setSupervisors(uj.supervisors || []);
      setCommittees(uj.committees || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postUjian(body: unknown, msg: string) {
    const res = await fetch('/api/akademik/ujian', {
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data periode ujian...
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
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h1 className="text-sm font-bold text-slate-900">Buat Periode Ujian</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
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
                  onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="date"
                  value={periodForm.end_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
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
                await postUjian(
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
                await postUjian(
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
    </div>
  );
}
