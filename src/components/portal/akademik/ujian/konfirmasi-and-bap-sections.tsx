'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import {
  calculateLateJtm,
  getWibTodayDateString,
  isSundayDate,
} from '@/lib/domain/jtm-late-penalty';
import {
  AkademikEmptyState,
  AkademikModal,
  BatchStudentAttendanceList,
} from '../akademik-ui';
import type {
  BapRow,
  ClassroomOpt,
  CommitteeAttRow,
  CommitteeRow,
  EnrollmentRow,
  SupAdjustModalState,
  SupervisorRow,
} from './types';

export interface KonfirmasiPengawasSectionProps {
  canManageCommittees: boolean;
  geofenceEnabled: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  committees: CommitteeRow[];
  pendingSupervisorSessions: SupervisorRow[];
  confirmedSupervisorIds: Set<string>;
  confirmedCommitteeAtts: CommitteeAttRow[];
  dailyCheckedInKeys: Set<string>;
  confirmCommitteeId: string;
  setConfirmCommitteeId: (id: string) => void;
  setSupAdjustModal: (modal: SupAdjustModalState | null) => void;
}

export function KonfirmasiPengawasSection({
  canManageCommittees,
  geofenceEnabled,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  committees,
  pendingSupervisorSessions,
  confirmedSupervisorIds,
  confirmedCommitteeAtts,
  dailyCheckedInKeys,
  confirmCommitteeId,
  setConfirmCommitteeId,
  setSupAdjustModal,
}: KonfirmasiPengawasSectionProps) {
  const [konfirmasiSupSearch, setKonfirmasiSupSearch] = useState('');
  const [konfirmasiSupPage, setKonfirmasiSupPage] = useState(1);
  const [committeeConfirmForm, setCommitteeConfirmForm] = useState({
    exam_committee_id: '',
    attendance_date: getWibTodayDateString(),
  });

  const KONF_SUP_PAGE_SIZE = 8;
  const canConfirmSup = canManageCommittees || Boolean(confirmCommitteeId);
  const query = konfirmasiSupSearch.trim().toLowerCase();
  const filteredPendingSup = query
    ? pendingSupervisorSessions.filter((sup) => {
        const haystack = [
          sup.teacher?.full_name,
          sup.room?.room_name,
          sup.session_name,
          sup.exam_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : pendingSupervisorSessions;

  const totalKonfSupPages = Math.max(
    1,
    Math.ceil(filteredPendingSup.length / KONF_SUP_PAGE_SIZE)
  );
  const safeKonfSupPage = Math.min(konfirmasiSupPage, totalKonfSupPages);
  const paginatedPendingSup = filteredPendingSup.slice(
    (safeKonfSupPage - 1) * KONF_SUP_PAGE_SIZE,
    safeKonfSupPage * KONF_SUP_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Konfirmasi Kehadiran Pengawas Ujian (Admin / Panitia)</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pengawas / Pengawas Pengganti wajib dikonfirmasi kehadirannya oleh Admin
              atau Panitia Ujian/Panitia Pengganti terkonfirmasi Admin sebelum dapat
              mengisi BAP.
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
            <p className="text-[11px] font-medium text-slate-500">Menunggu Konfirmasi</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {pendingSupervisorSessions.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Sudah Dikonfirmasi</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {confirmedSupervisorIds.size}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Panitia Aktif</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {confirmedCommitteeAtts.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Geofencing</p>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {geofenceEnabled ? 'Aktif' : 'Nonaktif'}
            </p>
          </div>
        </div>

        {confirmedCommitteeAtts.length > 0 ? (
          <div className="space-y-1.5">
            <label
              htmlFor="konf-pengawas-committee-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Aktor Konfirmasi Pengawas Ujian
            </label>
            <select
              id="konf-pengawas-committee-select"
              value={confirmCommitteeId}
              onChange={(e) => setConfirmCommitteeId(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">
                {canManageCommittees
                  ? '-- Konfirmasi sebagai Admin (atau pilih Panitia Ujian Terkonfirmasi) --'
                  : '-- Pilih Presensi Panitia Ujian Anda untuk Mengonfirmasi Pengawas --'}
              </option>
              {confirmedCommitteeAtts.map((c) => (
                <option key={c.id} value={c.id}>
                  Panitia: {c.teacher?.full_name || 'Panitia'} ({c.attendance_date})
                </option>
              ))}
            </select>
          </div>
        ) : (
          !canManageCommittees && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              Belum ada Panitia Ujian yang dikonfirmasi Admin. Konfirmasi pengawas hanya
              dapat dilakukan oleh Admin atau Panitia Ujian yang sudah dikonfirmasi Admin.
            </div>
          )
        )}

        {!canManageCommittees &&
          confirmedCommitteeAtts.length > 0 &&
          !confirmCommitteeId &&
          pendingSupervisorSessions.length > 0 && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
              Pilih presensi <strong>Panitia Ujian</strong> di atas terlebih dahulu untuk
              mengaktifkan tombol <strong>Konfirmasi Jadwal</strong>.
            </div>
          )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <h2 className="text-sm font-bold text-slate-900">
            Antrean Pengawas Menunggu Konfirmasi ({filteredPendingSup.length})
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={konfirmasiSupSearch}
              onChange={(e) => {
                setKonfirmasiSupSearch(e.target.value);
                setKonfirmasiSupPage(1);
              }}
              placeholder="Cari pengawas, ruang, sesi..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {konfirmasiSupSearch && (
              <button
                type="button"
                onClick={() => {
                  setKonfirmasiSupSearch('');
                  setKonfirmasiSupPage(1);
                }}
                aria-label="Hapus pencarian konfirmasi pengawas"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredPendingSup.length === 0 ? (
          <AkademikEmptyState
            icon={<UserCheck className="w-6 h-6 text-slate-400" />}
            message={
              pendingSupervisorSessions.length === 0
                ? geofenceEnabled
                  ? 'Tidak ada jadwal pengawas yang menunggu konfirmasi (pastikan pengawas sudah presensi geofencing 1x pada tanggal ujian).'
                  : 'Semua jadwal pengawas sudah dikonfirmasi atau belum ada jadwal pengawas yang dibuat.'
                : 'Tidak ada jadwal pengawas yang cocok dengan kata kunci pencarian Anda.'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {paginatedPendingSup.map((sup) => {
                const hasCheckedIn = dailyCheckedInKeys.has(
                  `${sup.teacher_id}:${sup.exam_date}`
                );
                return (
                  <div
                    key={sup.id}
                    className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 truncate">
                        {sup.teacher?.full_name || 'Pengawas'}
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {sup.exam_date} • {sup.session_name}
                        {sup.room?.room_name ? ` • ${sup.room.room_name}` : ''} (
                        {sup.jtm_allocated} JTM) •{' '}
                        {hasCheckedIn
                          ? 'Sudah Presensi Harian'
                          : 'Geofencing Nonaktif — Siap Dikonfirmasi'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canConfirmSup}
                      onClick={() => {
                        const expectedJtm = sup.jtm_allocated ?? 2;
                        setSupAdjustModal({
                          sup,
                          expectedJtm,
                          approvedJtm: expectedJtm,
                        });
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0 transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Konfirmasi Jadwal
                    </button>
                  </div>
                );
              })}
            </div>

            {totalKonfSupPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                <span>
                  Halaman <strong>{safeKonfSupPage}</strong> dari{' '}
                  <strong>{totalKonfSupPages}</strong> ({filteredPendingSup.length}{' '}
                  jadwal)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeKonfSupPage <= 1}
                    onClick={() => setKonfirmasiSupPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={safeKonfSupPage >= totalKonfSupPages}
                    onClick={() =>
                      setKonfirmasiSupPage((p) => Math.min(totalKonfSupPages, p + 1))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    Berikutnya
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!geofenceEnabled && canManageCommittees && (
        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-700 shrink-0" />
              <span>Konfirmasi Kehadiran Panitia Ujian (Tanpa Geofencing)</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Karena fitur geofencing dinonaktifkan Admin, Panitia Ujian / Panitia
              Pengganti tidak wajib presensi GPS terlebih dahulu. Admin dapat
              mengonfirmasi kehadiran panitia di sini agar dapat mengonfirmasi pengawas,
              menunjuk pengganti, dan mengisi LPJ Harian.
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!committeeConfirmForm.exam_committee_id) {
                showToast('error', 'Pilih Panitia Ujian terlebih dahulu.');
                return;
              }
              if (!committeeConfirmForm.attendance_date) {
                showToast('error', 'Tanggal kehadiran wajib diisi.');
                return;
              }
              const ok = await postUjian(
                {
                  action: 'CONFIRM_COMMITTEE_WITHOUT_GEOFENCE',
                  ...committeeConfirmForm,
                },
                'Kehadiran Panitia Ujian berhasil dikonfirmasi (tanpa geofencing).'
              );
              if (ok) {
                setCommitteeConfirmForm((prev) => ({
                  ...prev,
                  exam_committee_id: '',
                }));
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="konf-panitia-nogeo-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Panitia Ujian / Panitia Pengganti <span className="text-rose-500">*</span>
              </label>
              <select
                id="konf-panitia-nogeo-select"
                required
                value={committeeConfirmForm.exam_committee_id}
                onChange={(e) =>
                  setCommitteeConfirmForm({
                    ...committeeConfirmForm,
                    exam_committee_id: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              >
                <option value="">-- Pilih Panitia Ujian / Panitia Pengganti --</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.committee_role} • {c.teacher?.full_name || 'Guru'} (
                    {c.jtm_allocated} JTM)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="konf-panitia-nogeo-date"
                className="block text-xs font-semibold text-slate-700"
              >
                Tanggal Kehadiran <span className="text-rose-500">*</span>
              </label>
              <input
                id="konf-panitia-nogeo-date"
                type="date"
                required
                value={committeeConfirmForm.attendance_date}
                onChange={(e) =>
                  setCommitteeConfirmForm({
                    ...committeeConfirmForm,
                    attendance_date: e.target.value,
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !committeeConfirmForm.exam_committee_id}
              className="sm:col-span-3 inline-flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Konfirmasi Hadir Panitia Ujian
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export interface BapSectionProps {
  geofenceEnabled: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  supervisors: SupervisorRow[];
  bapReports: BapRow[];
  confirmedSupervisorIds: Set<string>;
  bapSupervisorIds: Set<string>;
  classrooms: ClassroomOpt[];
  enrollments: EnrollmentRow[];
}

export function BapSection({
  geofenceEnabled,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  supervisors,
  bapReports,
  confirmedSupervisorIds,
  bapSupervisorIds,
  classrooms,
  enrollments,
}: BapSectionProps) {
  const [bapForm, setBapForm] = useState({
    exam_supervisor_id: '',
    present_students_count: 30,
    absent_students_count: 0,
    incidents: '',
  });
  const [bapClassroomId, setBapClassroomId] = useState('');
  const [bapStudentStatuses, setBapStudentStatuses] = useState<
    Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>
  >({});
  const [bapSearch, setBapSearch] = useState('');
  const [bapPage, setBapPage] = useState(1);
  const [detailBap, setDetailBap] = useState<BapRow | null>(null);

  const BAP_PAGE_SIZE = 6;
  const pendingBapSupervisors = supervisors.filter(
    (s) => confirmedSupervisorIds.has(s.id) && !bapSupervisorIds.has(s.id)
  );
  const isSundayToday = isSundayDate(getWibTodayDateString());
  const selectedBapSup = pendingBapSupervisors.find(
    (s) => s.id === bapForm.exam_supervisor_id
  );
  const bapClassStudents = bapClassroomId
    ? enrollments
        .filter((en) => en.classroom_id === bapClassroomId && en.student)
        .map((en) => en.student!)
    : [];
  const bapAttendanceSummary = bapClassStudents.reduce(
    (acc, st) => {
      const status = bapStudentStatuses[st.id] || 'HADIR';
      acc[status] += 1;
      return acc;
    },
    { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0 }
  );

  const query = bapSearch.trim().toLowerCase();
  const filteredBaps = query
    ? bapReports.filter((b) => {
        const sup = supervisors.find((s) => s.id === b.exam_supervisor_id);
        const haystack = [
          b.report_date,
          b.teacher?.full_name,
          b.incidents,
          sup?.session_name,
          sup?.room?.room_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : bapReports;

  const totalBapPages = Math.max(1, Math.ceil(filteredBaps.length / BAP_PAGE_SIZE));
  const safeBapPage = Math.min(bapPage, totalBapPages);
  const paginatedBaps = filteredBaps.slice(
    (safeBapPage - 1) * BAP_PAGE_SIZE,
    safeBapPage * BAP_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Berita Acara Pengawasan (BAP)</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {geofenceEnabled
                ? 'Pengawas ujian wajib melakukan presensi GPS terlebih dahulu serta dikonfirmasi kehadirannya oleh Admin atau Panitia Ujian sebelum mengisi BAP di bawah ini.'
                : 'Pengawas ujian wajib dikonfirmasi kehadirannya oleh Admin atau Panitia Ujian sebelum mengisi BAP di bawah ini (presensi GPS geofencing tidak wajib karena fitur dinonaktifkan Admin).'}{' '}
              Keterlambatan input: H+1 (80%), H+2 (60%), H+3 (40%), H+4 (20%), H+5 (10%),
              Hari Minggu tidak dihitung.
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
            <p className="text-[11px] font-medium text-slate-500">Menunggu BAP</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {pendingBapSupervisors.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Total BAP Terkirim</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {bapReports.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Pengawas Terkonfirmasi</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {confirmedSupervisorIds.size}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Geofencing</p>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {geofenceEnabled ? 'Aktif' : 'Nonaktif'}
            </p>
          </div>
        </div>

        {isSundayToday && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Hari Minggu tidak ada pengisian BAP. Silakan input pada hari Senin atau hari
            aktif berikutnya.
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              if (!bapForm.exam_supervisor_id) {
                showToast(
                  'error',
                  'Pilih jadwal pengawas ujian terkonfirmasi terlebih dahulu.'
                );
                return;
              }
              if (bapForm.exam_supervisor_id && Object.keys(bapStudentStatuses).length > 0) {
                const records = Object.entries(bapStudentStatuses).map(
                  ([student_id, status]) => ({
                    student_id,
                    status,
                  })
                );
                const attOk = await postUjian(
                  {
                    action: 'BATCH_EXAM_STUDENT_ATTENDANCE',
                    exam_supervisor_id: bapForm.exam_supervisor_id,
                    records,
                  },
                  'Absensi batch siswa ujian disimpan.'
                );
                if (!attOk) return;
              }
              const safePresent = Math.max(
                0,
                Number.isFinite(bapForm.present_students_count)
                  ? bapForm.present_students_count
                  : 0
              );
              const safeAbsent = Math.max(
                0,
                Number.isFinite(bapForm.absent_students_count)
                  ? bapForm.absent_students_count
                  : 0
              );
              const bapOk = await postUjian(
                {
                  action: 'SUBMIT_BAP',
                  exam_supervisor_id: bapForm.exam_supervisor_id,
                  present_students_count: safePresent,
                  absent_students_count: safeAbsent,
                  incidents: bapForm.incidents.trim() || null,
                },
                'Berita Acara Pengawasan (BAP) & absensi siswa ujian disimpan, JTM pengawas dihitung.'
              );
              if (bapOk) {
                setBapClassroomId('');
                setBapStudentStatuses({});
                setBapForm({
                  exam_supervisor_id: '',
                  present_students_count: 30,
                  absent_students_count: 0,
                  incidents: '',
                });
                setBapPage(1);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="bap-supervisor-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Jadwal Pengawas Terkonfirmasi <span className="text-rose-500">*</span>
              </label>
              <select
                id="bap-supervisor-select"
                required
                value={bapForm.exam_supervisor_id}
                onChange={(e) => {
                  setBapClassroomId('');
                  setBapStudentStatuses({});
                  setBapForm({ ...bapForm, exam_supervisor_id: e.target.value });
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Jadwal Pengawas (Terkonfirmasi, Belum BAP) --
                </option>
                {pendingBapSupervisors.map((s) => {
                  const preview = calculateLateJtm(s.jtm_allocated, s.exam_date);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.exam_date} • {s.session_name} • {s.teacher?.full_name || 'Guru'}{' '}
                      ({preview.creditedJtm}/{s.jtm_allocated} JTM •{' '}
                      {preview.delayDays === 0
                        ? 'Hari Ini 100%'
                        : `H+${preview.delayDays}: ${preview.percentage}%`}
                      )
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedBapSup &&
              (() => {
                const preview = calculateLateJtm(
                  selectedBapSup.jtm_allocated,
                  selectedBapSup.exam_date
                );
                if (!preview.allowed) {
                  return (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {preview.reason}
                    </div>
                  );
                }
                return (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                    Estimasi JTM: <strong>{preview.creditedJtm}</strong> dari{' '}
                    {selectedBapSup.jtm_allocated} JTM (
                    {preview.delayDays === 0
                      ? 'Tepat waktu 100%'
                      : `Terlambat H+${preview.delayDays} → ${preview.percentage}%`}
                    )
                  </div>
                );
              })()}

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="bap-classroom-select"
                  className="text-[11px] font-semibold text-slate-700"
                >
                  Absensi Siswa Ujian per Kelas (Batch) oleh Pengawas / Pengganti
                </label>
                {bapClassStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allPresent: Record<
                        string,
                        'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
                      > = {};
                      for (const st of bapClassStudents) allPresent[st.id] = 'HADIR';
                      setBapStudentStatuses(allPresent);
                      setBapForm((prev) => ({
                        ...prev,
                        present_students_count: bapClassStudents.length,
                        absent_students_count: 0,
                      }));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                  >
                    Tandai Semua Hadir ({bapClassStudents.length})
                  </button>
                )}
              </div>

              <select
                id="bap-classroom-select"
                value={bapClassroomId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setBapClassroomId(cid);
                  const classStudents = cid
                    ? enrollments
                        .filter((en) => en.classroom_id === cid && en.student)
                        .map((en) => en.student!)
                    : [];
                  const next: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
                  for (const st of classStudents) next[st.id] = 'HADIR';
                  setBapStudentStatuses(next);
                  if (classStudents.length > 0) {
                    setBapForm((prev) => ({
                      ...prev,
                      present_students_count: classStudents.length,
                      absent_students_count: 0,
                    }));
                  }
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
              >
                <option value="">-- Pilih Kelas Peserta Ujian (Batch) --</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {bapClassroomId &&
                (bapClassStudents.length === 0 ? (
                  <p className="text-[11px] text-amber-700">
                    Belum ada siswa terdaftar di kelas ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Hadir: {bapAttendanceSummary.HADIR}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Sakit: {bapAttendanceSummary.SAKIT}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        Izin: {bapAttendanceSummary.IZIN}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        Alpa: {bapAttendanceSummary.ALPA}
                      </span>
                    </div>
                    <BatchStudentAttendanceList
                      students={bapClassStudents}
                      statuses={bapStudentStatuses}
                      onChangeStatus={(studentId, statusOpt) => {
                        const next = { ...bapStudentStatuses, [studentId]: statusOpt };
                        setBapStudentStatuses(next);
                        const presentCount = bapClassStudents.filter(
                          (x) => (next[x.id] || 'HADIR') === 'HADIR'
                        ).length;
                        const absentCount = bapClassStudents.length - presentCount;
                        setBapForm((prev) => ({
                          ...prev,
                          present_students_count: presentCount,
                          absent_students_count: absentCount,
                        }));
                      }}
                    />
                  </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="bap-present-count"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jumlah Siswa Hadir
                </label>
                <input
                  id="bap-present-count"
                  type="number"
                  min={0}
                  value={bapForm.present_students_count}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setBapForm({
                      ...bapForm,
                      present_students_count: Number.isFinite(val) ? Math.max(0, val) : 0,
                    });
                  }}
                  placeholder="Jumlah Siswa Hadir"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="bap-absent-count"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jumlah Siswa Tidak Hadir
                </label>
                <input
                  id="bap-absent-count"
                  type="number"
                  min={0}
                  value={bapForm.absent_students_count}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setBapForm({
                      ...bapForm,
                      absent_students_count: Number.isFinite(val) ? Math.max(0, val) : 0,
                    });
                  }}
                  placeholder="Jumlah Siswa Tidak Hadir"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="bap-incidents"
                className="block text-xs font-semibold text-slate-700"
              >
                Catatan / Kejadian Selama Pengawasan (Opsional)
              </label>
              <textarea
                id="bap-incidents"
                rows={2}
                placeholder="Catatan / kejadian selama pengawasan ujian (opsional)"
                value={bapForm.incidents}
                onChange={(e) => setBapForm({ ...bapForm, incidents: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !bapForm.exam_supervisor_id || isSundayToday}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan BAP &amp; Hitung JTM Pengawas
            </button>
          </form>

          {/* Riwayat BAP */}
          <div className="lg:col-span-6 space-y-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Riwayat BAP ({filteredBaps.length})
              </h2>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={bapSearch}
                  onChange={(e) => {
                    setBapSearch(e.target.value);
                    setBapPage(1);
                  }}
                  placeholder="Cari pengawas, tanggal, catatan..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {bapSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setBapSearch('');
                      setBapPage(1);
                    }}
                    aria-label="Hapus pencarian BAP"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredBaps.length === 0 ? (
              <AkademikEmptyState
                icon={<ClipboardCheck className="w-6 h-6 text-slate-400" />}
                message={
                  bapReports.length === 0
                    ? 'Belum ada Berita Acara Pengawasan (BAP) yang tersimpan.'
                    : 'Tidak ada riwayat BAP yang cocok dengan kata kunci pencarian Anda.'
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedBaps.map((b) => {
                    const sup = supervisors.find((s) => s.id === b.exam_supervisor_id);
                    return (
                      <div
                        key={b.id}
                        className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-bold text-slate-900 truncate">
                            {b.report_date} • {b.teacher?.full_name || 'Pengawas'}
                          </p>
                          <p className="text-[11px] text-slate-500 break-words">
                            {sup?.session_name || 'Sesi Ujian'}
                            {sup?.room?.room_name ? ` • ${sup.room.room_name}` : ''} •
                            Hadir {b.present_students_count} • Tidak Hadir{' '}
                            {b.absent_students_count}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailBap(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shrink-0 self-start sm:self-center cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Detail
                        </button>
                      </div>
                    );
                  })}
                </div>

                {totalBapPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span>
                      Halaman <strong>{safeBapPage}</strong> dari{' '}
                      <strong>{totalBapPages}</strong> ({filteredBaps.length} BAP)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeBapPage <= 1}
                        onClick={() => setBapPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={safeBapPage >= totalBapPages}
                        onClick={() => setBapPage((p) => Math.min(totalBapPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Berikutnya
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AkademikModal
        open={Boolean(detailBap)}
        onClose={() => setDetailBap(null)}
        title="Detail Berita Acara Pengawasan (BAP)"
      >
        {detailBap && (
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-medium text-slate-500">
                Tanggal &amp; Pengawas
              </p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {detailBap.report_date} • {detailBap.teacher?.full_name || 'Pengawas'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-medium text-emerald-700">Siswa Hadir</p>
                <p className="text-lg font-bold text-emerald-900 mt-0.5">
                  {detailBap.present_students_count}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-[11px] font-medium text-amber-700">Tidak Hadir</p>
                <p className="text-lg font-bold text-amber-900 mt-0.5">
                  {detailBap.absent_students_count}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600">
                Catatan / Kejadian Pengawasan
              </p>
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
                {detailBap.incidents || 'Tidak ada kejadian khusus.'}
              </p>
            </div>
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
