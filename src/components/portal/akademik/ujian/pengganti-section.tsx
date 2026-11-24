'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import type {
  CommitteeAttRow,
  CommitteeRow,
  SupervisorRow,
  TeacherOpt,
} from './types';

export interface PenggantiSectionProps {
  canManageCommittees: boolean;
  geofenceEnabled: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  teachers: TeacherOpt[];
  supervisors: SupervisorRow[];
  committees: CommitteeRow[];
  bapSupervisorIds: Set<string>;
  confirmedCommitteeAtts: CommitteeAttRow[];
}

export function PenggantiSection({
  canManageCommittees,
  geofenceEnabled,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  teachers,
  supervisors,
  committees,
  bapSupervisorIds,
  confirmedCommitteeAtts,
}: PenggantiSectionProps) {
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

  const eligibleSupervisors = supervisors.filter((s) => !bapSupervisorIds.has(s.id));
  const selectedSup = eligibleSupervisors.find(
    (s) => s.id === subForm.exam_supervisor_id
  );
  const selectedCom = committees.find(
    (c) => c.id === subCommitteeForm.exam_committee_id
  );
  const isSameSupTeacher =
    Boolean(selectedSup) && selectedSup!.teacher_id === subForm.substitute_teacher_id;
  const isSameComTeacher =
    Boolean(selectedCom) &&
    selectedCom!.teacher_id === subCommitteeForm.substitute_teacher_id;

  const substitutedSupervisors = supervisors.filter((s) =>
    Boolean(s.original_teacher_id)
  );
  const substitutedCommittees = committees.filter((c) => Boolean(c.original_teacher_id));

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Penunjukkan Pengawas &amp; Panitia Pengganti</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kelola penunjukkan pengganti apabila pengawas ruang ujian atau anggota
              panitia ujian berhalangan hadir.
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
            <p className="text-[11px] font-medium text-slate-500">Pengawas Pengganti</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {substitutedSupervisors.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Panitia Pengganti</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {substitutedCommittees.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Jadwal Belum BAP</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {eligibleSupervisors.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Panitia Aktif</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {confirmedCommitteeAtts.length}
            </p>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${canManageCommittees ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Penunjukkan Pengawas Pengganti (Panitia Ujian)</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {geofenceEnabled
                ? 'Hanya Panitia Ujian yang sudah presensi GPS & dikonfirmasi Admin yang dapat menunjuk pengawas pengganti.'
                : 'Hanya Panitia Ujian yang sudah dikonfirmasi kehadirannya oleh Admin yang dapat menunjuk pengawas pengganti.'}
            </p>
          </div>

          {confirmedCommitteeAtts.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              {geofenceEnabled
                ? 'Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin di menu Presensi GPS.'
                : 'Belum ada Panitia Ujian yang dikonfirmasi kehadirannya oleh Admin (konfirmasi melalui menu Konfirmasi Pengawas atau Presensi).'}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!subForm.committee_attendance_id) {
                showToast(
                  'error',
                  'Pilih Panitia Ujian terkonfirmasi Admin terlebih dahulu.'
                );
                return;
              }
              if (!subForm.exam_supervisor_id || !subForm.substitute_teacher_id) {
                showToast('error', 'Pilih jadwal pengawas dan guru pengganti.');
                return;
              }
              if (isSameSupTeacher) {
                showToast(
                  'error',
                  'Pengawas pengganti tidak boleh sama dengan pengawas saat ini.'
                );
                return;
              }
              const ok = await postUjian(
                {
                  action: 'SUBSTITUTE_SUPERVISOR',
                  committee_attendance_id: subForm.committee_attendance_id,
                  exam_supervisor_id: subForm.exam_supervisor_id,
                  substitute_teacher_id: subForm.substitute_teacher_id,
                  reason: subForm.reason.trim() || null,
                },
                geofenceEnabled
                  ? 'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti wajib presensi GPS & isi BAP.'
                  : 'Pengawas pengganti berhasil ditunjuk. Pengawas pengganti siap dikonfirmasi & mengisi BAP.'
              );
              if (ok) {
                setSubForm({
                  committee_attendance_id: '',
                  exam_supervisor_id: '',
                  substitute_teacher_id: '',
                  reason: '',
                });
              }
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label
                htmlFor="ujian-sub-committee-att"
                className="block text-xs font-semibold text-slate-700"
              >
                Panitia Ujian Terkonfirmasi Admin <span className="text-rose-500">*</span>
              </label>
              <select
                id="ujian-sub-committee-att"
                required
                value={subForm.committee_attendance_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, committee_attendance_id: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Panitia Ujian Terkonfirmasi Admin --</option>
                {confirmedCommitteeAtts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.attendance_date} • {c.teacher?.full_name || 'Panitia'} (Terkonfirmasi)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ujian-sub-supervisor-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Jadwal Pengawas yang Berhalangan{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="ujian-sub-supervisor-select"
                required
                value={subForm.exam_supervisor_id}
                onChange={(e) => {
                  const nextSupId = e.target.value;
                  const nextSup = eligibleSupervisors.find((s) => s.id === nextSupId);
                  setSubForm({
                    ...subForm,
                    exam_supervisor_id: nextSupId,
                    substitute_teacher_id:
                      nextSup && nextSup.teacher_id === subForm.substitute_teacher_id
                        ? ''
                        : subForm.substitute_teacher_id,
                  });
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Jadwal Pengawas yang Berhalangan --</option>
                {eligibleSupervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.exam_date} • {s.session_name}
                    {s.room?.room_name ? ` (${s.room.room_name})` : ''} •{' '}
                    {s.teacher?.full_name || 'Pengawas'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ujian-sub-teacher-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Guru Pengawas Pengganti <span className="text-rose-500">*</span>
              </label>
              <select
                id="ujian-sub-teacher-select"
                required
                value={subForm.substitute_teacher_id}
                onChange={(e) =>
                  setSubForm({ ...subForm, substitute_teacher_id: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Guru Pengawas Pengganti --</option>
                {teachers
                  .filter((t) => !selectedSup || t.id !== selectedSup.teacher_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ujian-sub-reason-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Alasan Penggantian (Opsional)
              </label>
              <input
                id="ujian-sub-reason-input"
                placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                value={subForm.reason}
                onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                confirmedCommitteeAtts.length === 0 ||
                !subForm.committee_attendance_id ||
                !subForm.exam_supervisor_id ||
                !subForm.substitute_teacher_id ||
                isSameSupTeacher
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Tunjuk Pengawas Pengganti
            </button>
          </form>
        </div>

        {/* Penunjukkan Panitia Ujian Pengganti (Admin / Kurikulum / TU) */}
        {canManageCommittees && (
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-700 shrink-0" />
                <span>Penunjukkan Panitia Ujian Pengganti</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Jika ada anggota Panitia Ujian berhalangan, Admin/Kurikulum dapat menunjuk
                Panitia Pengganti.{' '}
                {geofenceEnabled
                  ? 'Panitia Pengganti wajib presensi GPS (`PANITIA_UJIAN`) dan dikonfirmasi Admin agar JTM-nya dihitung.'
                  : 'Panitia Pengganti wajib dikonfirmasi Admin agar JTM-nya dihitung (tanpa wajib presensi GPS geofencing).'}
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  !subCommitteeForm.exam_committee_id ||
                  !subCommitteeForm.substitute_teacher_id
                ) {
                  showToast('error', 'Pilih panitia berhalangan dan guru pengganti.');
                  return;
                }
                if (isSameComTeacher) {
                  showToast(
                    'error',
                    'Panitia pengganti tidak boleh sama dengan panitia saat ini.'
                  );
                  return;
                }
                const ok = await postUjian(
                  {
                    action: 'SUBSTITUTE_COMMITTEE',
                    exam_committee_id: subCommitteeForm.exam_committee_id,
                    substitute_teacher_id: subCommitteeForm.substitute_teacher_id,
                    reason: subCommitteeForm.reason.trim() || null,
                  },
                  geofenceEnabled
                    ? 'Panitia Ujian Pengganti berhasil ditunjuk. Wajib presensi GPS & konfirmasi Admin.'
                    : 'Panitia Ujian Pengganti berhasil ditunjuk. Siap dikonfirmasi Admin.'
                );
                if (ok) {
                  setSubCommitteeForm({
                    exam_committee_id: '',
                    substitute_teacher_id: '',
                    reason: '',
                  });
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label
                  htmlFor="ujian-sub-com-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Panitia Ujian yang Berhalangan{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ujian-sub-com-select"
                  required
                  value={subCommitteeForm.exam_committee_id}
                  onChange={(e) => {
                    const nextComId = e.target.value;
                    const nextCom = committees.find((c) => c.id === nextComId);
                    setSubCommitteeForm({
                      ...subCommitteeForm,
                      exam_committee_id: nextComId,
                      substitute_teacher_id:
                        nextCom &&
                        nextCom.teacher_id === subCommitteeForm.substitute_teacher_id
                          ? ''
                          : subCommitteeForm.substitute_teacher_id,
                    });
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                >
                  <option value="">-- Pilih Panitia Ujian yang Berhalangan --</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.committee_role} • {c.teacher?.full_name || 'Panitia'} (
                      {c.jtm_allocated} JTM)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="ujian-sub-com-teacher"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Guru Panitia Pengganti <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ujian-sub-com-teacher"
                  required
                  value={subCommitteeForm.substitute_teacher_id}
                  onChange={(e) =>
                    setSubCommitteeForm({
                      ...subCommitteeForm,
                      substitute_teacher_id: e.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                >
                  <option value="">-- Pilih Guru Panitia Pengganti --</option>
                  {teachers
                    .filter((t) => !selectedCom || t.id !== selectedCom.teacher_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="ujian-sub-com-reason"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Alasan Penggantian (Opsional)
                </label>
                <input
                  id="ujian-sub-com-reason"
                  placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                  value={subCommitteeForm.reason}
                  onChange={(e) =>
                    setSubCommitteeForm({ ...subCommitteeForm, reason: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  !subCommitteeForm.exam_committee_id ||
                  !subCommitteeForm.substitute_teacher_id ||
                  isSameComTeacher
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Tunjuk Panitia Ujian Pengganti
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Riwayat Penggantian Pengawas & Panitia */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">
          Riwayat Penunjukkan Pengganti Ujian (
          {substitutedSupervisors.length + substitutedCommittees.length})
        </h2>
        {substitutedSupervisors.length === 0 && substitutedCommittees.length === 0 ? (
          <AkademikEmptyState
            icon={<UserCheck className="w-6 h-6 text-slate-400" />}
            message="Belum ada riwayat penunjukkan pengawas atau panitia ujian pengganti."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-2.5">
            {substitutedSupervisors.map((s) => (
              <div
                key={`sub-sup-${s.id}`}
                className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-slate-900 truncate">
                    {s.teacher?.full_name || 'Pengganti'}{' '}
                    <span className="font-normal text-slate-500">
                      (menggantikan {s.original_teacher?.full_name || 'Pengawas'})
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.exam_date} • {s.session_name}
                    {s.room?.room_name ? ` • ${s.room.room_name}` : ''}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                  Pengawas ({s.jtm_allocated} JTM)
                </span>
              </div>
            ))}
            {substitutedCommittees.map((c) => (
              <div
                key={`sub-com-${c.id}`}
                className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-slate-900 truncate">
                    {c.teacher?.full_name || 'Pengganti'}{' '}
                    <span className="font-normal text-slate-500">
                      (menggantikan {c.original_teacher?.full_name || 'Panitia'})
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.committee_role}
                    {c.period?.name ? ` • ${c.period.name}` : ''}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold shrink-0">
                  Panitia ({c.jtm_allocated} JTM)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
