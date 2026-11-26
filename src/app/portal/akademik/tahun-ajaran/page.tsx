'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  UserMinus,
} from 'lucide-react';

interface AcademicYearRow {
  id: string;
  name: string;
  semester: 'GANJIL' | 'GENAP';
  is_active: boolean;
}

interface ClassroomRow {
  id: string;
  name: string;
  grade_level: string;
  academic_year_id: string;
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  classroom_id: string;
  academic_year_id: string;
  student?: { id: string; full_name: string; nis: string | null; status: string } | null;
}

interface ActiveStudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
}

export default function TahunAjaranPage() {
  const [tab, setTab] = useState<'TAHUN' | 'KENAIKAN' | 'MUTASI'>('TAHUN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudentOpt[]>([]);

  // Form Tahun Ajaran
  const [newYearForm, setNewYearForm] = useState({
    name: '',
    semester: 'GANJIL' as 'GANJIL' | 'GENAP',
    is_active: false,
  });

  // Form Kenaikan Kelas / Kelulusan
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetYearId, setTargetYearId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [graduationYear, setGraduationYear] = useState(new Date().getFullYear());

  // Form Mutasi Keluar
  const [mutasiForm, setMutasiForm] = useState({
    student_id: '',
    destination_school: '',
    reason: '',
    mutation_date: new Date().toISOString().slice(0, 10),
    create_letter: true,
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/akademik/tahun-ajaran', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setYears(data.academicYears || []);
        setClassrooms(data.classrooms || []);
        setEnrollments(data.enrollments || []);
        setActiveStudents(data.activeStudents || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sourceStudents = useMemo(() => {
    if (!sourceClassId) return [];
    return enrollments
      .filter((e) => e.classroom_id === sourceClassId)
      .map((e) => (Array.isArray(e.student) ? e.student[0] : e.student))
      .filter(
        (s): s is { id: string; full_name: string; nis: string | null; status: string } =>
          Boolean(s?.id) && s?.status === 'AKTIF'
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));
  }, [enrollments, sourceClassId]);

  const targetClassrooms = useMemo(() => {
    if (!targetYearId) return classrooms;
    return classrooms.filter((c) => c.academic_year_id === targetYearId);
  }, [classrooms, targetYearId]);

  async function postAction(payload: Record<string, unknown>, successMsg: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/tahun-ajaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Permintaan gagal diproses.', 'err');
        return null;
      }
      showToast(successMsg);
      await loadData();
      return data;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateYear(e: FormEvent) {
    e.preventDefault();
    const res = await postAction(
      { action: 'CREATE_YEAR', ...newYearForm },
      `Tahun Ajaran ${newYearForm.name} (${newYearForm.semester}) berhasil ditambahkan.`
    );
    if (res) setNewYearForm({ name: '', semester: 'GANJIL', is_active: false });
  }

  async function handlePromoteBatch() {
    if (selectedStudentIds.length === 0 || !targetClassId || !targetYearId) {
      showToast('Pilih siswa, tahun ajaran tujuan, dan rombel tujuan.', 'err');
      return;
    }
    const res = await postAction(
      {
        action: 'PROMOTE_CLASS_BATCH',
        student_ids: selectedStudentIds,
        target_classroom_id: targetClassId,
        target_academic_year_id: targetYearId,
      },
      `${selectedStudentIds.length} siswa berhasil dinaikkan/ditempatkan ke rombel tujuan.`
    );
    if (res) setSelectedStudentIds([]);
  }

  async function handleGraduateBatch() {
    if (selectedStudentIds.length === 0) {
      showToast('Pilih minimal 1 siswa untuk diluluskan.', 'err');
      return;
    }
    if (!confirm(`Luluskan ${selectedStudentIds.length} siswa terpilih ke status LULUS / Alumni?`)) {
      return;
    }
    const res = await postAction(
      {
        action: 'GRADUATE_CLASS_BATCH',
        student_ids: selectedStudentIds,
        graduation_year: graduationYear,
      },
      `${selectedStudentIds.length} siswa berhasil diluluskan (Angkatan ${graduationYear}).`
    );
    if (res) setSelectedStudentIds([]);
  }

  async function handleMutasiKeluar(e: FormEvent) {
    e.preventDefault();
    const res = await postAction(
      { action: 'MUTASI_KELUAR', ...mutasiForm },
      'Mutasi keluar siswa berhasil dicatat.'
    );
    if (res) {
      if (res.createdLetterNumber) {
        showToast(
          `Mutasi keluar ${res.studentName} berhasil. Draf Surat Mutasi (${res.createdLetterNumber}) otomatis dibuat di E-Office Persuratan.`
        );
      }
      setMutasiForm({
        student_id: '',
        destination_school: '',
        reason: '',
        mutation_date: new Date().toISOString().slice(0, 10),
        create_letter: true,
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-emerald-700" />
              <span>Tahun Ajaran, Kenaikan Kelas &amp; Mutasi Keluar</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola periode tahun ajaran/semester, promosi &amp; kelulusan massal, serta alur mutasi keluar siswa.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-3">
          {(
            [
              { id: 'TAHUN', label: 'Manajemen Tahun Ajaran', icon: CalendarRange },
              { id: 'KENAIKAN', label: 'Kenaikan Kelas & Kelulusan Massal', icon: GraduationCap },
              { id: 'MUTASI', label: 'Workflow Mutasi Keluar', icon: UserMinus },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  tab === item.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {tab === 'TAHUN' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateYear}
              className="grid sm:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs items-end"
            >
              <div className="sm:col-span-4">
                <label className="block font-semibold text-slate-700 mb-1">Tahun Ajaran *</label>
                <input
                  required
                  value={newYearForm.name}
                  onChange={(e) => setNewYearForm({ ...newYearForm, name: e.target.value })}
                  placeholder="mis. 2027/2028"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Semester *</label>
                <select
                  value={newYearForm.semester}
                  onChange={(e) =>
                    setNewYearForm({
                      ...newYearForm,
                      semester: e.target.value as 'GANJIL' | 'GENAP',
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="GANJIL">GANJIL</option>
                  <option value="GENAP">GENAP</option>
                </select>
              </div>
              <div className="sm:col-span-3 flex items-center pb-2">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newYearForm.is_active}
                    onChange={(e) => setNewYearForm({ ...newYearForm, is_active: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  Langsung Aktifkan
                </label>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {years.map((y) => (
                <div
                  key={y.id}
                  className="modular-card rounded-2xl p-4 flex items-center justify-between gap-3 text-xs border border-slate-200/80"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      Tahun Ajaran {y.name} — Semester {y.semester}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {y.is_active ? 'Sedang aktif digunakan sistem' : 'Arsip / Non-aktif'}
                    </p>
                  </div>
                  {y.is_active ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      AKTIF
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void postAction(
                          { action: 'SET_ACTIVE_YEAR', id: y.id },
                          `Tahun Ajaran ${y.name} (${y.semester}) berhasil diaktifkan.`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold"
                    >
                      Aktifkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'KENAIKAN' && (
          <div className="space-y-4 text-xs">
            <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">1. Rombel Asal</label>
                <select
                  value={sourceClassId}
                  onChange={(e) => {
                    setSourceClassId(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">-- Pilih Rombel Asal --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade_level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">2. Tahun Ajaran Tujuan</label>
                <select
                  value={targetYearId}
                  onChange={(e) => setTargetYearId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">-- Pilih Tahun Ajaran Tujuan --</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} ({y.semester})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">3. Rombel Tujuan (Naik Kelas)</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">-- Pilih Rombel Tujuan --</option>
                  {targetClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade_level})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sourceStudents.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStudentIds(
                        selectedStudentIds.length === sourceStudents.length
                          ? []
                          : sourceStudents.map((s) => s.id)
                      )
                    }
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700"
                  >
                    {selectedStudentIds.length === sourceStudents.length
                      ? 'Batal Pilih Semua'
                      : `Pilih Semua (${sourceStudents.length} siswa)`}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting || selectedStudentIds.length === 0}
                      onClick={() => void handlePromoteBatch()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Naikkan Kelas ({selectedStudentIds.length})
                    </button>
                    <input
                      type="number"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(Number(e.target.value) || new Date().getFullYear())}
                      className="w-20 rounded-xl border border-slate-300 px-2.5 py-2 font-mono"
                      title="Tahun Lulus"
                    />
                    <button
                      type="button"
                      disabled={submitting || selectedStudentIds.length === 0}
                      onClick={() => void handleGraduateBatch()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Luluskan ke Alumni ({selectedStudentIds.length})
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sourceStudents.map((st) => {
                    const checked = selectedStudentIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
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
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{st.full_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">NIS: {st.nis || '-'}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'MUTASI' && (
          <form onSubmit={handleMutasiKeluar} className="space-y-4 max-w-2xl text-xs">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Pilih Siswa Aktif *</label>
                <select
                  required
                  value={mutasiForm.student_id}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, student_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sekolah / Madrasah Tujuan *</label>
                <input
                  required
                  value={mutasiForm.destination_school}
                  onChange={(e) =>
                    setMutasiForm({ ...mutasiForm, destination_school: e.target.value })
                  }
                  placeholder="mis. MTsN 2 Kota ..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Mutasi *</label>
                <input
                  type="date"
                  required
                  value={mutasiForm.mutation_date}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, mutation_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Alasan Mutasi *</label>
                <textarea
                  required
                  rows={2}
                  value={mutasiForm.reason}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, reason: e.target.value })}
                  placeholder="mis. Mengikuti kepindahan domisili orang tua..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <label className="sm:col-span-2 inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mutasiForm.create_letter}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, create_letter: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Otomatis buat draf Surat Keterangan Pindah / Mutasi di E-Office Persuratan
              </label>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Proses Mutasi Keluar Siswa
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
