'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardCheck, Loader2, MapPin, UserCheck } from 'lucide-react';
import { calculateLateJtm, getWibTodayDateString, isSundayDate } from '@/lib/domain/jtm-late-penalty';

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface ExamPeriodRow {
  id: string;
  name: string;
}

interface SupervisorRow {
  id: string;
  teacher_id: string;
  exam_date: string;
  session_name: string;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

interface CommitteeRow {
  id: string;
  teacher_id: string;
  committee_role: string;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

interface BapRow {
  id: string;
  exam_supervisor_id: string;
  report_date: string;
  present_students_count: number;
  absent_students_count: number;
  incidents: string | null;
  teacher?: { full_name: string } | null;
}

interface SupervisorAttRow {
  id: string;
  teacher_id: string;
  exam_supervisor_id: string | null;
}

interface CommitteeAttRow {
  id: string;
  teacher_id: string;
  exam_committee_id: string | null;
  attendance_date: string;
  admin_confirmed: boolean;
  teacher?: { full_name: string } | null;
}

export default function UjianPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriodRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [bapReports, setBapReports] = useState<BapRow[]>([]);
  const [supervisorAttendances, setSupervisorAttendances] = useState<SupervisorAttRow[]>([]);
  const [committeeAttendances, setCommitteeAttendances] = useState<CommitteeAttRow[]>([]);

  const [bapForm, setBapForm] = useState({
    exam_supervisor_id: '',
    present_students_count: 30,
    absent_students_count: 0,
    incidents: '',
  });

  const [subForm, setSubForm] = useState({
    committee_attendance_id: '',
    exam_supervisor_id: '',
    substitute_teacher_id: '',
    reason: '',
  });
  const [subCommitteeForm, setSubCommitteeForm] = useState({
    exam_committee_id: '',
    substitute_teacher_id: '',
    reason: '',
  });
  const [canManageCommittees, setCanManageCommittees] = useState(false);

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
      setBapReports(uj.bapReports || []);
      setSupervisorAttendances(uj.supervisorAttendances || []);
      setCommitteeAttendances(uj.committeeAttendances || []);
      setCanManageCommittees(Boolean(uj.canManageCommittees));
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

  const bapSupervisorIds = useMemo(
    () => new Set(bapReports.map((b) => b.exam_supervisor_id)),
    [bapReports]
  );

  const attendedSupervisorIds = useMemo(
    () =>
      new Set(
        supervisorAttendances
          .map((a) => a.exam_supervisor_id)
          .filter((x): x is string => Boolean(x))
      ),
    [supervisorAttendances]
  );

  const confirmedCommitteeAtts = useMemo(
    () => committeeAttendances.filter((c) => c.admin_confirmed),
    [committeeAttendances]
  );

  const confirmedCommitteeIds = useMemo(
    () =>
      new Set(
        confirmedCommitteeAtts
          .map((c) => c.exam_committee_id)
          .filter((x): x is string => Boolean(x))
      ),
    [confirmedCommitteeAtts]
  );

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

      {/* Banner Alur Presensi, BAP & Konfirmasi Panitia */}
      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900">
            Alur Wajib Periode Ujian (Pengawas &amp; Panitia Ujian)
          </p>
          <p className="text-xs text-slate-600">
            Pengawas &amp; Panitia Ujian tetap wajib melakukan <strong>Presensi GPS Geofencing</strong>.
            Pengawas Ujian wajib mengisi <strong>Berita Acara Pengawasan (BAP)</strong> agar JTM dihitung,
            sedangkan Panitia Ujian wajib <strong>dikonfirmasi Admin</strong> sebelum menunjuk pengawas pengganti.
          </p>
        </div>
        <Link
          href="/portal/akademik/presensi"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
        >
          <MapPin className="w-4 h-4" /> Buka Presensi GPS
        </Link>
      </div>

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
              {supervisors.map((sup) => {
                const hasAtt = attendedSupervisorIds.has(sup.id);
                const hasBap = bapSupervisorIds.has(sup.id);
                return (
                  <div
                    key={sup.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {sup.teacher?.full_name}
                        {sup.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {sup.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {sup.exam_date} • {sup.session_name} •{' '}
                        {hasBap
                          ? 'BAP Selesai (JTM Dihitung)'
                          : hasAtt
                          ? 'Sudah Presensi (Menunggu BAP)'
                          : 'Belum Presensi GPS'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        hasBap
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {hasBap ? `+${sup.jtm_allocated} JTM` : `0/${sup.jtm_allocated} JTM`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Panitia Ujian ({committees.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {committees.map((com) => {
                const isConfirmed = confirmedCommitteeIds.has(com.id);
                return (
                  <div
                    key={com.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {com.teacher?.full_name}
                        {com.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {com.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {com.committee_role} •{' '}
                        {isConfirmed
                          ? 'Hadir Dikonfirmasi Admin'
                          : 'Menunggu Presensi & Konfirmasi Admin'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        isConfirmed
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isConfirmed ? `+${com.jtm_allocated} JTM` : `0/${com.jtm_allocated} JTM`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Input Berita Acara Pengawasan (BAP) - Req #6 */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" /> Berita Acara Pengawasan (BAP)
            </h2>
            <p className="text-xs text-slate-600">
              Pengawas ujian wajib melakukan presensi GPS terlebih dahulu lalu mengisi BAP di bawah
              ini agar JTM pengawasan dihitung untuk honorarium. Keterlambatan input: H+1 (80%),
              H+2 (60%), H+3 (40%), H+4 (20%), H+5 (10%), Hari Minggu tidak dihitung.
            </p>
            {isSundayDate(getWibTodayDateString()) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Hari Minggu tidak ada pengisian BAP. Silakan input pada hari Senin atau hari aktif
                berikutnya.
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
                  { action: 'SUBMIT_BAP', ...bapForm },
                  'Berita Acara Pengawasan (BAP) disimpan & JTM pengawas dihitung.'
                );
                setBapForm({
                  exam_supervisor_id: '',
                  present_students_count: 30,
                  absent_students_count: 0,
                  incidents: '',
                });
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={bapForm.exam_supervisor_id}
                onChange={(e) => setBapForm({ ...bapForm, exam_supervisor_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Jadwal Pengawas (Sudah Presensi, Belum BAP) --</option>
                {supervisors
                  .filter((s) => attendedSupervisorIds.has(s.id) && !bapSupervisorIds.has(s.id))
                  .map((s) => {
                    const preview = calculateLateJtm(s.jtm_allocated, s.exam_date);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.exam_date} • {s.session_name} • {s.teacher?.full_name} (
                        {preview.creditedJtm}/{s.jtm_allocated} JTM •{' '}
                        {preview.delayDays === 0
                          ? 'Hari Ini 100%'
                          : `H+${preview.delayDays}: ${preview.percentage}%`}
                        )
                      </option>
                    );
                  })}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={bapForm.present_students_count}
                  onChange={(e) =>
                    setBapForm({ ...bapForm, present_students_count: Number(e.target.value) })
                  }
                  placeholder="Jumlah Siswa Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={bapForm.absent_students_count}
                  onChange={(e) =>
                    setBapForm({ ...bapForm, absent_students_count: Number(e.target.value) })
                  }
                  placeholder="Jumlah Siswa Tidak Hadir"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Catatan / kejadian selama pengawasan ujian (opsional)"
                value={bapForm.incidents}
                onChange={(e) => setBapForm({ ...bapForm, incidents: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={isSundayDate(getWibTodayDateString())}
                className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan BAP &amp; Hitung JTM Pengawas
              </button>
            </form>
          </div>

          {/* Penunjukkan Pengawas Pengganti oleh Panitia Ujian - Req #7 */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Penunjukkan Pengawas Pengganti (Panitia Ujian)
            </h2>
            <p className="text-xs text-slate-600">
              Hanya Panitia Ujian yang sudah presensi GPS &amp; dikonfirmasi Admin yang dapat menunjuk pengawas pengganti.
            </p>
            {confirmedCommitteeAtts.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin di menu Presensi GPS.
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postUjian(
                  { action: 'SUBSTITUTE_SUPERVISOR', ...subForm },
                  'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti wajib presensi & isi BAP.'
                );
                setSubForm({
                  committee_attendance_id: '',
                  exam_supervisor_id: '',
                  substitute_teacher_id: '',
                  reason: '',
                });
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={subForm.committee_attendance_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, committee_attendance_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Panitia Ujian Terkonfirmasi Admin --</option>
                {confirmedCommitteeAtts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.attendance_date} • {c.teacher?.full_name} (Terkonfirmasi)
                  </option>
                ))}
              </select>
              <select
                required
                value={subForm.exam_supervisor_id}
                onChange={(e) => setSubForm({ ...subForm, exam_supervisor_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Jadwal Pengawas yang Berhalangan --</option>
                {supervisors
                  .filter((s) => !bapSupervisorIds.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.exam_date} • {s.session_name} • {s.teacher?.full_name}
                    </option>
                  ))}
              </select>
              <select
                required
                value={subForm.substitute_teacher_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, substitute_teacher_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru Pengawas Pengganti --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                value={subForm.reason}
                onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={confirmedCommitteeAtts.length === 0}
                className="w-full bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Tunjuk Pengawas Pengganti
              </button>
            </form>
          </div>

          {/* Penunjukkan Panitia Ujian Pengganti (Admin / Kurikulum / TU) */}
          {canManageCommittees && (
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-700" /> Penunjukkan Panitia Ujian Pengganti
              </h2>
              <p className="text-xs text-slate-600">
                Jika ada anggota Panitia Ujian berhalangan, Admin/Kurikulum dapat menunjuk Panitia
                Pengganti. Panitia Pengganti wajib presensi GPS (`PANITIA_UJIAN`) dan dikonfirmasi
                Admin agar JTM-nya dihitung.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postUjian(
                    { action: 'SUBSTITUTE_COMMITTEE', ...subCommitteeForm },
                    'Panitia Ujian Pengganti berhasil ditunjuk. Wajib presensi GPS & konfirmasi Admin.'
                  );
                  setSubCommitteeForm({
                    exam_committee_id: '',
                    substitute_teacher_id: '',
                    reason: '',
                  });
                }}
                className="space-y-2.5"
              >
                <select
                  required
                  value={subCommitteeForm.exam_committee_id}
                  onChange={(e) =>
                    setSubCommitteeForm({ ...subCommitteeForm, exam_committee_id: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Panitia Ujian yang Berhalangan --</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.committee_role} • {c.teacher?.full_name} ({c.jtm_allocated} JTM)
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={subCommitteeForm.substitute_teacher_id}
                  onChange={(e) =>
                    setSubCommitteeForm({
                      ...subCommitteeForm,
                      substitute_teacher_id: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Guru Panitia Pengganti --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                  value={subCommitteeForm.reason}
                  onChange={(e) =>
                    setSubCommitteeForm({ ...subCommitteeForm, reason: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full bg-sky-700 hover:bg-sky-800 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Tunjuk Panitia Ujian Pengganti
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
