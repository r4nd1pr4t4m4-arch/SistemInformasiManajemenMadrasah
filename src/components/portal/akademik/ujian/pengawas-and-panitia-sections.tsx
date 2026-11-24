'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState } from '../akademik-ui';
import type {
  CommitteeRow,
  ExamPeriodRow,
  ExamRoomRow,
  SupervisorRow,
  TeacherOpt,
} from './types';

export interface PengawasSectionProps {
  canManageUjian: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  teachers: TeacherOpt[];
  examPeriods: ExamPeriodRow[];
  rooms: ExamRoomRow[];
  supervisors: SupervisorRow[];
  attendedSupervisorIds: Set<string>;
  dailyCheckedInKeys: Set<string>;
  confirmedSupervisorIds: Set<string>;
  bapSupervisorIds: Set<string>;
}

export function PengawasSection({
  canManageUjian,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  teachers,
  examPeriods,
  rooms,
  supervisors,
  attendedSupervisorIds,
  dailyCheckedInKeys,
  confirmedSupervisorIds,
  bapSupervisorIds,
}: PengawasSectionProps) {
  const [supervisorForm, setSupervisorForm] = useState({
    exam_period_id: '',
    exam_room_id: '',
    teacher_id: '',
    exam_date: getWibTodayDateString(),
    session_name: 'Sesi 1',
    subject_name: '',
    jtm_allocated: 2,
  });
  const [pengawasSearch, setPengawasSearch] = useState('');
  const [pengawasFilter, setPengawasFilter] = useState<'ALL' | 'BAP' | 'CONFIRMED' | 'PENDING'>(
    'ALL'
  );
  const [pengawasPage, setPengawasPage] = useState(1);

  const PENGAWAS_PAGE_SIZE = 8;
  const supervisorRooms = supervisorForm.exam_period_id
    ? rooms.filter((r) => r.exam_period_id === supervisorForm.exam_period_id)
    : [];

  const enrichedSupervisors = supervisors.map((sup) => {
    const hasAtt =
      attendedSupervisorIds.has(sup.id) ||
      dailyCheckedInKeys.has(`${sup.teacher_id}:${sup.exam_date}`);
    const isConfirmed = confirmedSupervisorIds.has(sup.id);
    const hasBap = bapSupervisorIds.has(sup.id);
    const statusGroup: 'BAP' | 'CONFIRMED' | 'PENDING' = hasBap
      ? 'BAP'
      : isConfirmed
        ? 'CONFIRMED'
        : 'PENDING';
    return { sup, hasAtt, isConfirmed, hasBap, statusGroup };
  });

  const totalBapDone = enrichedSupervisors.filter((x) => x.statusGroup === 'BAP').length;
  const totalConfirmedOnly = enrichedSupervisors.filter(
    (x) => x.statusGroup === 'CONFIRMED'
  ).length;
  const totalPending = enrichedSupervisors.filter((x) => x.statusGroup === 'PENDING').length;

  const filteredByStatus =
    pengawasFilter === 'ALL'
      ? enrichedSupervisors
      : enrichedSupervisors.filter((x) => x.statusGroup === pengawasFilter);

  const query = pengawasSearch.trim().toLowerCase();
  const filteredSupervisors = query
    ? filteredByStatus.filter(({ sup }) => {
        const haystack = [
          sup.teacher?.full_name,
          sup.original_teacher?.full_name,
          sup.room?.room_name,
          sup.period?.name,
          sup.session_name,
          sup.subject_name,
          sup.exam_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalPengawasPages = Math.max(
    1,
    Math.ceil(filteredSupervisors.length / PENGAWAS_PAGE_SIZE)
  );
  const safePengawasPage = Math.min(pengawasPage, totalPengawasPages);
  const paginatedSupervisors = filteredSupervisors.slice(
    (safePengawasPage - 1) * PENGAWAS_PAGE_SIZE,
    safePengawasPage * PENGAWAS_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Penugasan Pengawas Ruang Ujian</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tugaskan guru sebagai pengawas ruang ujian beserta alokasi JTM per sesi. JTM
              dihitung setelah pengawas presensi, dikonfirmasi, dan mengisi BAP.
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
            <p className="text-[11px] font-medium text-slate-500">Total Penugasan</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {supervisors.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">BAP Selesai</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {totalBapDone}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Siap Input BAP</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {totalConfirmedOnly}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Menunggu Presensi/Konf.</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {totalPending}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
            <h2 className="text-sm font-bold text-slate-900">
              Tugaskan Pengawas Ruang Ujian (Atur JTM)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supervisorForm.exam_period_id) {
                  showToast('error', 'Pilih periode ujian terlebih dahulu.');
                  return;
                }
                if (!supervisorForm.teacher_id) {
                  showToast('error', 'Pilih guru pengawas terlebih dahulu.');
                  return;
                }
                if (!supervisorForm.exam_date) {
                  showToast('error', 'Tanggal ujian wajib diisi.');
                  return;
                }
                const trimmedSession = supervisorForm.session_name.trim();
                if (!trimmedSession) {
                  showToast('error', 'Nama sesi ujian wajib diisi.');
                  return;
                }
                const safeJtm = Math.min(
                  24,
                  Math.max(
                    1,
                    Number.isFinite(supervisorForm.jtm_allocated)
                      ? supervisorForm.jtm_allocated
                      : 2
                  )
                );
                const ok = await postUjian(
                  {
                    action: 'ASSIGN_SUPERVISOR',
                    exam_period_id: supervisorForm.exam_period_id,
                    exam_room_id: supervisorForm.exam_room_id || null,
                    teacher_id: supervisorForm.teacher_id,
                    exam_date: supervisorForm.exam_date,
                    session_name: trimmedSession,
                    subject_name: supervisorForm.subject_name.trim() || null,
                    jtm_allocated: safeJtm,
                  },
                  'Pengawas Ruang Ujian & alokasi JTM disimpan.'
                );
                if (ok) {
                  setSupervisorForm((prev) => ({
                    ...prev,
                    teacher_id: '',
                    subject_name: '',
                  }));
                  setPengawasPage(1);
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label
                  htmlFor="pengawas-period-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Periode Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  id="pengawas-period-select"
                  required
                  value={supervisorForm.exam_period_id}
                  onChange={(e) =>
                    setSupervisorForm({
                      ...supervisorForm,
                      exam_period_id: e.target.value,
                      exam_room_id: '',
                    })
                  }
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="pengawas-room-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Ruang Ujian (Opsional)
                  </label>
                  <select
                    id="pengawas-room-select"
                    disabled={!supervisorForm.exam_period_id}
                    value={supervisorForm.exam_room_id}
                    onChange={(e) =>
                      setSupervisorForm({ ...supervisorForm, exam_room_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Semua / Opsional --</option>
                    {supervisorRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="pengawas-subject-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mata Pelajaran (Opsional)
                  </label>
                  <input
                    id="pengawas-subject-input"
                    placeholder="Contoh: Matematika"
                    value={supervisorForm.subject_name}
                    onChange={(e) =>
                      setSupervisorForm({ ...supervisorForm, subject_name: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="pengawas-teacher-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Guru Pengawas <span className="text-rose-500">*</span>
                </label>
                <select
                  id="pengawas-teacher-select"
                  required
                  value={supervisorForm.teacher_id}
                  onChange={(e) =>
                    setSupervisorForm({ ...supervisorForm, teacher_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Guru Pengawas --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="pengawas-date-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="pengawas-date-input"
                    required
                    type="date"
                    value={supervisorForm.exam_date}
                    onChange={(e) =>
                      setSupervisorForm({ ...supervisorForm, exam_date: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="pengawas-session-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Sesi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="pengawas-session-input"
                    required
                    placeholder="Sesi 1"
                    value={supervisorForm.session_name}
                    onChange={(e) =>
                      setSupervisorForm({ ...supervisorForm, session_name: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="pengawas-jtm-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    JTM (1–24)
                  </label>
                  <input
                    id="pengawas-jtm-input"
                    type="number"
                    min={1}
                    max={24}
                    value={supervisorForm.jtm_allocated}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setSupervisorForm({
                        ...supervisorForm,
                        jtm_allocated: Number.isFinite(val)
                          ? Math.min(24, Math.max(1, val))
                          : 1,
                      });
                    }}
                    title="Alokasi JTM"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || examPeriods.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Pengawas Ujian
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 min-w-0`}
        >
          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Pengawas Ruang Ujian ({filteredSupervisors.length})
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${supervisors.length})` },
                    { id: 'BAP', label: `BAP (${totalBapDone})` },
                    { id: 'CONFIRMED', label: `Siap BAP (${totalConfirmedOnly})` },
                    { id: 'PENDING', label: `Menunggu (${totalPending})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPengawasFilter(tab.id);
                      setPengawasPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                      pengawasFilter === tab.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={pengawasSearch}
                  onChange={(e) => {
                    setPengawasSearch(e.target.value);
                    setPengawasPage(1);
                  }}
                  placeholder="Cari pengawas, ruang, sesi..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {pengawasSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPengawasSearch('');
                      setPengawasPage(1);
                    }}
                    aria-label="Hapus pencarian pengawas"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredSupervisors.length === 0 ? (
            <AkademikEmptyState
              icon={<UserCheck className="w-6 h-6 text-slate-400" />}
              message={
                supervisors.length === 0
                  ? 'Belum ada pengawas ruang ujian yang ditugaskan.'
                  : 'Tidak ada data pengawas yang cocok dengan filter atau pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedSupervisors.map(({ sup, hasAtt, isConfirmed, hasBap }) => (
                  <div
                    key={sup.id}
                    className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {sup.teacher?.full_name || 'Guru'}
                        {sup.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {sup.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {sup.exam_date} • {sup.session_name}
                        {sup.room?.room_name ? ` • ${sup.room.room_name}` : ''}
                        {sup.subject_name ? ` • ${sup.subject_name}` : ''} •{' '}
                        {hasBap
                          ? 'BAP Selesai (JTM Dihitung)'
                          : isConfirmed
                            ? 'Terkonfirmasi (Siap Input BAP)'
                            : hasAtt
                              ? 'Sudah Presensi (Menunggu Konfirmasi Admin/Panitia)'
                              : 'Belum Presensi GPS'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 self-start sm:self-center ${
                        hasBap
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isConfirmed
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {hasBap ? `+${sup.jtm_allocated} JTM` : `0/${sup.jtm_allocated} JTM`}
                    </span>
                  </div>
                ))}
              </div>

              {totalPengawasPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safePengawasPage}</strong> dari{' '}
                    <strong>{totalPengawasPages}</strong> ({filteredSupervisors.length}{' '}
                    pengawas)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePengawasPage <= 1}
                      onClick={() => setPengawasPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safePengawasPage >= totalPengawasPages}
                      onClick={() =>
                        setPengawasPage((p) => Math.min(totalPengawasPages, p + 1))
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
      </div>
    </div>
  );
}

export interface PanitiaSectionProps {
  canManageUjian: boolean;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  teachers: TeacherOpt[];
  examPeriods: ExamPeriodRow[];
  committees: CommitteeRow[];
  confirmedCommitteeIds: Set<string>;
  reportedCommitteeIds: Set<string>;
}

export function PanitiaSection({
  canManageUjian,
  submitting,
  refreshing,
  onRefresh,
  postUjian,
  showToast,
  teachers,
  examPeriods,
  committees,
  confirmedCommitteeIds,
  reportedCommitteeIds,
}: PanitiaSectionProps) {
  const [committeeForm, setCommitteeForm] = useState({
    exam_period_id: '',
    teacher_id: '',
    committee_role: 'Ketua Panitia',
    jtm_allocated: 6,
  });
  const [panitiaSearch, setPanitiaSearch] = useState('');
  const [panitiaFilter, setPanitiaFilter] = useState<'ALL' | 'LPJ' | 'CONFIRMED' | 'PENDING'>(
    'ALL'
  );
  const [panitiaPage, setPanitiaPage] = useState(1);

  const PANITIA_PAGE_SIZE = 8;
  const enrichedCommittees = committees.map((com) => {
    const isConfirmed = confirmedCommitteeIds.has(com.id);
    const hasLpj = reportedCommitteeIds.has(com.id);
    const statusGroup: 'LPJ' | 'CONFIRMED' | 'PENDING' = hasLpj
      ? 'LPJ'
      : isConfirmed
        ? 'CONFIRMED'
        : 'PENDING';
    return { com, isConfirmed, hasLpj, statusGroup };
  });

  const totalLpjCount = enrichedCommittees.filter((x) => x.statusGroup === 'LPJ').length;
  const totalConfirmedCount = enrichedCommittees.filter(
    (x) => x.statusGroup === 'CONFIRMED'
  ).length;
  const totalPendingCount = enrichedCommittees.filter(
    (x) => x.statusGroup === 'PENDING'
  ).length;

  const filteredByStatus =
    panitiaFilter === 'ALL'
      ? enrichedCommittees
      : enrichedCommittees.filter((x) => x.statusGroup === panitiaFilter);

  const query = panitiaSearch.trim().toLowerCase();
  const filteredCommittees = query
    ? filteredByStatus.filter(({ com }) => {
        const haystack = [
          com.teacher?.full_name,
          com.original_teacher?.full_name,
          com.committee_role,
          com.period?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalPanitiaPages = Math.max(
    1,
    Math.ceil(filteredCommittees.length / PANITIA_PAGE_SIZE)
  );
  const safePanitiaPage = Math.min(panitiaPage, totalPanitiaPages);
  const paginatedCommittees = filteredCommittees.slice(
    (safePanitiaPage - 1) * PANITIA_PAGE_SIZE,
    safePanitiaPage * PANITIA_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Penugasan Panitia Ujian</span>
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Atur susunan panitia ujian dan alokasi JTM per periode. JTM panitia dihitung
              setelah presensi dikonfirmasi Admin dan LPJ Harian Panitia dikirimkan.
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
            <p className="text-[11px] font-medium text-slate-500">Total Panitia</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {committees.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">LPJ Terkirim</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {totalLpjCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Terkonfirmasi</p>
            <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
              {totalConfirmedCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">Belum Konfirmasi</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
              {totalPendingCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canManageUjian && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 h-fit">
            <h2 className="text-sm font-bold text-slate-900">
              Tugaskan Panitia Ujian (Atur JTM)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!committeeForm.exam_period_id) {
                  showToast('error', 'Pilih periode ujian terlebih dahulu.');
                  return;
                }
                if (!committeeForm.teacher_id) {
                  showToast('error', 'Pilih guru panitia terlebih dahulu.');
                  return;
                }
                const trimmedRole = committeeForm.committee_role.trim();
                if (trimmedRole.length < 2) {
                  showToast('error', 'Jabatan panitia minimal 2 karakter.');
                  return;
                }
                const safeJtm = Math.min(
                  40,
                  Math.max(
                    1,
                    Number.isFinite(committeeForm.jtm_allocated)
                      ? committeeForm.jtm_allocated
                      : 4
                  )
                );
                const ok = await postUjian(
                  {
                    action: 'ASSIGN_COMMITTEE',
                    exam_period_id: committeeForm.exam_period_id,
                    teacher_id: committeeForm.teacher_id,
                    committee_role: trimmedRole,
                    jtm_allocated: safeJtm,
                  },
                  'Panitia Ujian & alokasi JTM disimpan.'
                );
                if (ok) {
                  setCommitteeForm((prev) => ({
                    ...prev,
                    teacher_id: '',
                  }));
                  setPanitiaPage(1);
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label
                  htmlFor="panitia-period-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Periode Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  id="panitia-period-select"
                  required
                  value={committeeForm.exam_period_id}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, exam_period_id: e.target.value })
                  }
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

              <div className="space-y-1">
                <label
                  htmlFor="panitia-teacher-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Guru Panitia <span className="text-rose-500">*</span>
                </label>
                <select
                  id="panitia-teacher-select"
                  required
                  value={committeeForm.teacher_id}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, teacher_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Guru Panitia --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="panitia-role-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Jabatan Panitia <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="panitia-role-input"
                    required
                    minLength={2}
                    placeholder="Contoh: Ketua Panitia"
                    value={committeeForm.committee_role}
                    onChange={(e) =>
                      setCommitteeForm({ ...committeeForm, committee_role: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="panitia-jtm-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Alokasi JTM (1–40)
                  </label>
                  <input
                    id="panitia-jtm-input"
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={committeeForm.jtm_allocated}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setCommitteeForm({
                        ...committeeForm,
                        jtm_allocated: Number.isFinite(val)
                          ? Math.min(40, Math.max(1, val))
                          : 1,
                      });
                    }}
                    placeholder="JTM"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || examPeriods.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Panitia Ujian
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManageUjian ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-4 sm:p-6 space-y-3.5 min-w-0`}
        >
          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Panitia Ujian ({filteredCommittees.length})
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${committees.length})` },
                    { id: 'LPJ', label: `LPJ (${totalLpjCount})` },
                    { id: 'CONFIRMED', label: `Terkonfirmasi (${totalConfirmedCount})` },
                    { id: 'PENDING', label: `Belum (${totalPendingCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPanitiaFilter(tab.id);
                      setPanitiaPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                      panitiaFilter === tab.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={panitiaSearch}
                  onChange={(e) => {
                    setPanitiaSearch(e.target.value);
                    setPanitiaPage(1);
                  }}
                  placeholder="Cari nama, jabatan, periode..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {panitiaSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPanitiaSearch('');
                      setPanitiaPage(1);
                    }}
                    aria-label="Hapus pencarian panitia"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredCommittees.length === 0 ? (
            <AkademikEmptyState
              icon={<Users className="w-6 h-6 text-slate-400" />}
              message={
                committees.length === 0
                  ? 'Belum ada panitia ujian yang ditugaskan.'
                  : 'Tidak ada data panitia yang cocok dengan filter atau pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedCommittees.map(({ com, isConfirmed, hasLpj }) => (
                  <div
                    key={com.id}
                    className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {com.teacher?.full_name || 'Guru'} — {com.committee_role}
                        {com.original_teacher?.full_name && (
                          <span className="font-normal text-slate-500">
                            {' '}
                            (menggantikan {com.original_teacher.full_name})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {com.period?.name ? `${com.period.name} • ` : ''}
                        {hasLpj
                          ? 'LPJ Harian Terkirim (JTM Dihitung)'
                          : isConfirmed
                            ? 'Terkonfirmasi Admin (Wajib Isi LPJ Harian)'
                            : 'Belum Dikonfirmasi Admin'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 self-start sm:self-center ${
                        hasLpj
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isConfirmed
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {hasLpj ? `+${com.jtm_allocated} JTM` : `0/${com.jtm_allocated} JTM`}
                    </span>
                  </div>
                ))}
              </div>

              {totalPanitiaPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safePanitiaPage}</strong> dari{' '}
                    <strong>{totalPanitiaPages}</strong> ({filteredCommittees.length} panitia)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePanitiaPage <= 1}
                      onClick={() => setPanitiaPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safePanitiaPage >= totalPanitiaPages}
                      onClick={() =>
                        setPanitiaPage((p) => Math.min(totalPanitiaPages, p + 1))
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
      </div>
    </div>
  );
}
