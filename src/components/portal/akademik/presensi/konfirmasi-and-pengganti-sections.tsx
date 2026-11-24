'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState } from '../akademik-ui';
import {
  DAY_NAMES,
  type DelegationRow,
  type ExamCommitteeOpt,
  type JtmAdjustModalState,
  type PendingScheduleSessionItem,
  type PostPresensiFn,
  type ScheduleRow,
  type ShowToastFn,
  type TeacherAttendanceRow,
  type TeacherOpt,
} from './types';

interface KonfirmasiSectionProps {
  activeDate: string;
  canAdminConfirm: boolean;
  confirmedPicketAttendances: TeacherAttendanceRow[];
  pendingScheduleSessionsToday: PendingScheduleSessionItem[];
  unconfirmedAdminAttendances: TeacherAttendanceRow[];
  examCommittees: ExamCommitteeOpt[];
  refreshing: boolean;
  handleRefresh: () => void;
  setJtmAdjustModal: Dispatch<SetStateAction<JtmAdjustModalState | null>>;
}

export function KonfirmasiSection({
  activeDate,
  canAdminConfirm,
  confirmedPicketAttendances,
  pendingScheduleSessionsToday,
  unconfirmedAdminAttendances,
  examCommittees,
  refreshing,
  handleRefresh,
  setJtmAdjustModal,
}: KonfirmasiSectionProps) {
  const [confirmPicketId, setConfirmPicketId] = useState('');
  const [konfirmasiSearch, setKonfirmasiSearch] = useState('');
  const [konfirmasiFilter, setKonfirmasiFilter] = useState<'ALL' | 'MENGAJAR' | 'ADMIN'>('ALL');
  const [konfirmasiPage, setKonfirmasiPage] = useState(1);

  const KONFIRMASI_PAGE_SIZE = 8;
  const confirmedPicketAttendancesToday = confirmedPicketAttendances.filter(
    (p) => p.attendance_date === activeDate
  );
  const effectivePicketId = confirmedPicketAttendancesToday.some(
    (p) => p.id === confirmPicketId
  )
    ? confirmPicketId
    : '';
  const canConfirmMengajar = canAdminConfirm || Boolean(effectivePicketId);
  const query = konfirmasiSearch.trim().toLowerCase();

  type KonfirmasiUnifiedItem =
    | { kind: 'MENGAJAR'; key: string; item: PendingScheduleSessionItem }
    | { kind: 'ADMIN'; key: string; att: TeacherAttendanceRow };

  const allItems: KonfirmasiUnifiedItem[] = [
    ...(konfirmasiFilter === 'ALL' || konfirmasiFilter === 'MENGAJAR'
      ? pendingScheduleSessionsToday.map((item) => ({
          kind: 'MENGAJAR' as const,
          key: `m-${item.key}`,
          item,
        }))
      : []),
    ...(konfirmasiFilter === 'ALL' || konfirmasiFilter === 'ADMIN'
      ? unconfirmedAdminAttendances.map((att) => ({
          kind: 'ADMIN' as const,
          key: `a-${att.id}`,
          att,
        }))
      : []),
  ];

  const filteredItems = query
    ? allItems.filter((entry) => {
        const haystack =
          entry.kind === 'MENGAJAR'
            ? [entry.item.teacher_name, entry.item.label, entry.item.session_date]
                .join(' ')
                .toLowerCase()
            : [
                entry.att.teacher?.full_name,
                entry.att.attendance_type,
                entry.att.attendance_date,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
        return haystack.includes(query);
      })
    : allItems;

  const totalKonfirmasiPages = Math.max(
    1,
    Math.ceil(filteredItems.length / KONFIRMASI_PAGE_SIZE)
  );
  const safeKonfirmasiPage = Math.min(konfirmasiPage, totalKonfirmasiPages);
  const paginatedItems = filteredItems.slice(
    (safeKonfirmasiPage - 1) * KONFIRMASI_PAGE_SIZE,
    safeKonfirmasiPage * KONFIRMASI_PAGE_SIZE
  );

  const totalPendingAll =
    pendingScheduleSessionsToday.length + unconfirmedAdminAttendances.length;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Konfirmasi Kehadiran (Admin / Guru Piket)</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Admin mengonfirmasi Guru Piket, Panitia Ujian, dan Guru Mengajar. Guru Piket /
            Piket Pengganti yang sudah dikonfirmasi hari ini juga dapat mengonfirmasi
            kehadiran Guru Mengajar agar guru dapat mengisi Jurnal Pembelajaran.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Antrean</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {totalPendingAll}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Jadwal Mengajar</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {pendingScheduleSessionsToday.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket &amp; Panitia</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {unconfirmedAdminAttendances.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket Aktif Hari Ini</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {confirmedPicketAttendancesToday.length}
          </p>
        </div>
      </div>

      {confirmedPicketAttendancesToday.length > 0 ? (
        <div className="space-y-1.5">
          <label
            htmlFor="konfirmasi-picket-select"
            className="block text-xs font-semibold text-slate-700"
          >
            Aktor Konfirmasi Jadwal Mengajar
          </label>
          <select
            id="konfirmasi-picket-select"
            value={effectivePicketId}
            onChange={(e) => setConfirmPicketId(e.target.value)}
            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="">
              {canAdminConfirm
                ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket hari ini) --'
                : '-- Pilih Presensi Guru Piket / Pengganti Hari Ini untuk Konfirmasi --'}
            </option>
            {confirmedPicketAttendancesToday.map((p) => (
              <option key={p.id} value={p.id}>
                Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
              </option>
            ))}
          </select>
        </div>
      ) : (
        !canAdminConfirm && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
            Belum ada Guru Piket / Piket Pengganti yang dikonfirmasi Admin untuk hari ini (
            <strong>{activeDate}</strong>). Konfirmasi Guru Mengajar memerlukan peran Admin
            atau Guru Piket yang sudah dikonfirmasi Admin.
          </div>
        )
      )}

      {!canAdminConfirm &&
        confirmedPicketAttendancesToday.length > 0 &&
        !effectivePicketId &&
        pendingScheduleSessionsToday.length > 0 && (
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed">
            Pilih presensi <strong>Guru Piket / Pengganti</strong> di atas terlebih dahulu
            untuk mengaktifkan tombol <strong>Konfirmasi Jadwal</strong>.
          </div>
        )}

      {/* Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `Semua (${totalPendingAll})` },
              {
                id: 'MENGAJAR',
                label: `Mengajar (${pendingScheduleSessionsToday.length})`,
              },
              {
                id: 'ADMIN',
                label: `Piket & Panitia (${unconfirmedAdminAttendances.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setKonfirmasiFilter(tab.id);
                setKonfirmasiPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                konfirmasiFilter === tab.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={konfirmasiSearch}
            onChange={(e) => {
              setKonfirmasiSearch(e.target.value);
              setKonfirmasiPage(1);
            }}
            placeholder="Cari nama guru, mapel, kelas..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          {konfirmasiSearch && (
            <button
              type="button"
              onClick={() => {
                setKonfirmasiSearch('');
                setKonfirmasiPage(1);
              }}
              aria-label="Hapus pencarian konfirmasi"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <AkademikEmptyState
          icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />}
          message={
            totalPendingAll === 0
              ? 'Tidak ada presensi atau jadwal hari ini yang menunggu konfirmasi kehadiran.'
              : 'Tidak ada item konfirmasi yang cocok dengan filter atau pencarian Anda.'
          }
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {paginatedItems.map((entry) => {
              if (entry.kind === 'MENGAJAR') {
                const { item } = entry;
                return (
                  <div
                    key={entry.key}
                    className="p-3.5 rounded-2xl bg-white/85 border border-emerald-200/80 hover:border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-slate-900 truncate">
                          {item.teacher_name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                          {item.delegation_id ? 'Guru Pengganti' : 'Mengajar'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {item.expectedJtm} JTM
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 break-words leading-relaxed">
                        {item.session_date} • {item.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canConfirmMengajar}
                      onClick={() =>
                        setJtmAdjustModal({
                          sessionItem: item,
                          teacherName: item.teacher_name,
                          label: item.label,
                          expectedJtm: item.expectedJtm,
                          approvedJtm: item.expectedJtm,
                          picketAttendanceId: effectivePicketId || null,
                        })
                      }
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold shrink-0 transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Konfirmasi Jadwal
                    </button>
                  </div>
                );
              }

              const { att: a } = entry;
              const comJtm = examCommittees.find(
                (ec) => ec.id === a.exam_committee_id
              )?.jtm_allocated;
              const expectedJtm =
                a.attendance_type === 'PANITIA_UJIAN'
                  ? comJtm || 4
                  : a.delegation?.jtm_transferred || 2;

              return (
                <div
                  key={entry.key}
                  className="p-3.5 rounded-2xl bg-white/85 border border-slate-200 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-slate-900 truncate">
                        {a.teacher?.full_name || 'Guru'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                        {a.attendance_type === 'PANITIA_UJIAN'
                          ? 'Panitia Ujian'
                          : 'Guru Piket'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {expectedJtm} JTM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 break-words">
                      {a.attendance_date} • Jarak {a.distance_meters ?? 0} m
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canAdminConfirm}
                    title={
                      !canAdminConfirm
                        ? 'Hanya Admin / Operator / Pimpinan / TU yang dapat mengonfirmasi Piket & Panitia Ujian'
                        : undefined
                    }
                    onClick={() =>
                      setJtmAdjustModal({
                        att: a,
                        teacherName: a.teacher?.full_name || 'Guru',
                        label: a.attendance_type,
                        expectedJtm,
                        approvedJtm: expectedJtm,
                        picketAttendanceId: null,
                      })
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold shrink-0 transition cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Konfirmasi Hadir
                  </button>
                </div>
              );
            })}
          </div>

          {totalKonfirmasiPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
              <span>
                Halaman <strong>{safeKonfirmasiPage}</strong> dari{' '}
                <strong>{totalKonfirmasiPages}</strong> ({filteredItems.length} item)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeKonfirmasiPage <= 1}
                  onClick={() => setKonfirmasiPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={safeKonfirmasiPage >= totalKonfirmasiPages}
                  onClick={() =>
                    setKonfirmasiPage((p) => Math.min(totalKonfirmasiPages, p + 1))
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
  );
}

interface PenggantiSectionProps {
  delegations: DelegationRow[];
  confirmedPicketAttendances: TeacherAttendanceRow[];
  schedules: ScheduleRow[];
  teachers: TeacherOpt[];
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function PenggantiSection({
  delegations,
  confirmedPicketAttendances,
  schedules,
  teachers,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: PenggantiSectionProps) {
  const [delegationForm, setDelegationForm] = useState(() => ({
    picket_attendance_id: '',
    delegation_date: getWibTodayDateString(),
    delegation_type: 'MENGAJAR' as 'MENGAJAR' | 'PIKET',
    original_teacher_id: '',
    substitute_teacher_id: '',
    schedule_id: '',
    jtm_transferred: 2,
    reason: '',
  }));
  const [penggantiSearch, setPenggantiSearch] = useState('');
  const [penggantiFilter, setPenggantiFilter] = useState<'ALL' | 'MENGAJAR' | 'PIKET'>('ALL');
  const [penggantiPage, setPenggantiPage] = useState(1);

  const PENGGANTI_PAGE_SIZE = 6;
  const mengajarDelegationCount = delegations.filter(
    (d) => d.delegation_type === 'MENGAJAR'
  ).length;
  const piketDelegationCount = delegations.filter(
    (d) => d.delegation_type === 'PIKET'
  ).length;

  const filteredByType =
    penggantiFilter === 'ALL'
      ? delegations
      : delegations.filter((d) => d.delegation_type === penggantiFilter);

  const query = penggantiSearch.trim().toLowerCase();
  const filteredDelegations = query
    ? filteredByType.filter((d) => {
        const haystack = [
          d.original?.full_name,
          d.substitute?.full_name,
          d.schedule?.classroom?.name,
          d.schedule?.subject?.name,
          d.reason,
          d.delegation_date,
          d.delegation_type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByType;

  const totalPenggantiPages = Math.max(
    1,
    Math.ceil(filteredDelegations.length / PENGGANTI_PAGE_SIZE)
  );
  const safePenggantiPage = Math.min(penggantiPage, totalPenggantiPages);
  const paginatedDelegations = filteredDelegations.slice(
    (safePenggantiPage - 1) * PENGGANTI_PAGE_SIZE,
    safePenggantiPage * PENGGANTI_PAGE_SIZE
  );

  const isSameTeacher =
    Boolean(delegationForm.original_teacher_id) &&
    delegationForm.original_teacher_id === delegationForm.substitute_teacher_id;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Penunjukkan Guru Pengganti oleh Guru Piket</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hanya Guru Piket yang sudah presensi &amp; dikonfirmasi Admin yang dapat menunjuk
            guru pengganti. Guru pengganti wajib presensi &amp; isi Jurnal agar JTM dihitung.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Delegasi</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {delegations.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Pengganti Mengajar</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {mengajarDelegationCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket Pengganti</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {piketDelegationCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket Terkonfirmasi</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {confirmedPicketAttendances.length}
          </p>
        </div>
      </div>

      {confirmedPicketAttendances.length === 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          Belum ada presensi Guru Piket yang dikonfirmasi Admin. Konfirmasi kehadiran Guru
          Piket terlebih dahulu pada menu <strong>Konfirmasi Kehadiran</strong> sebelum
          menunjuk guru pengganti.
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting) return;
          if (!delegationForm.picket_attendance_id) {
            showToast('error', 'Pilih Guru Piket terkonfirmasi Admin terlebih dahulu.');
            return;
          }
          if (!delegationForm.delegation_date) {
            showToast('error', 'Tanggal penunjukkan guru pengganti wajib diisi.');
            return;
          }
          if (!delegationForm.original_teacher_id || !delegationForm.substitute_teacher_id) {
            showToast('error', 'Pilih guru berhalangan dan guru pengganti.');
            return;
          }
          if (delegationForm.original_teacher_id === delegationForm.substitute_teacher_id) {
            showToast(
              'error',
              'Guru pengganti tidak boleh sama dengan guru yang berhalangan.'
            );
            return;
          }

          const safeJtm = Math.min(
            12,
            Math.max(
              1,
              Number.isFinite(delegationForm.jtm_transferred)
                ? delegationForm.jtm_transferred
                : 2
            )
          );

          setSubmitting(true);
          try {
            const res = await postPresensi({
              action: 'CREATE_DELEGATION',
              picket_attendance_id: delegationForm.picket_attendance_id,
              delegation_date: delegationForm.delegation_date,
              delegation_type: delegationForm.delegation_type,
              original_teacher_id: delegationForm.original_teacher_id,
              substitute_teacher_id: delegationForm.substitute_teacher_id,
              schedule_id:
                delegationForm.delegation_type === 'MENGAJAR' && delegationForm.schedule_id
                  ? delegationForm.schedule_id
                  : null,
              jtm_transferred: safeJtm,
              reason: delegationForm.reason.trim() || null,
            });
            if (res) {
              showToast(
                'success',
                'Guru pengganti berhasil ditunjuk. Guru pengganti wajib presensi & isi Jurnal Pembelajaran agar JTM dihitung.'
              );
              setDelegationForm((prev) => ({
                ...prev,
                original_teacher_id: '',
                substitute_teacher_id: '',
                schedule_id: '',
                jtm_transferred: 2,
                reason: '',
              }));
              setPenggantiPage(1);
            }
          } finally {
            setSubmitting(false);
          }
        }}
        className="rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="pengganti-picket-select"
            className="block text-xs font-semibold text-slate-700"
          >
            Guru Piket Terkonfirmasi Admin <span className="text-rose-500">*</span>
          </label>
          <select
            id="pengganti-picket-select"
            required
            value={delegationForm.picket_attendance_id}
            onChange={(e) =>
              setDelegationForm({ ...delegationForm, picket_attendance_id: e.target.value })
            }
            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="">-- Pilih Guru Piket Terkonfirmasi Admin --</option>
            {confirmedPicketAttendances.map((p) => (
              <option key={p.id} value={p.id}>
                {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'} (Terkonfirmasi)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-date-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Tanggal Tugas <span className="text-rose-500">*</span>
            </label>
            <input
              id="pengganti-date-input"
              required
              type="date"
              value={delegationForm.delegation_date}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, delegation_date: e.target.value })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-type-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Jenis Penunjukkan
            </label>
            <select
              id="pengganti-type-select"
              value={delegationForm.delegation_type}
              onChange={(e) =>
                setDelegationForm({
                  ...delegationForm,
                  delegation_type: e.target.value as 'MENGAJAR' | 'PIKET',
                  schedule_id: '',
                })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="MENGAJAR">Pengganti Mengajar</option>
              <option value="PIKET">Guru Piket Pengganti</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-schedule-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Jadwal Mengajar (Opsional)
            </label>
            <select
              id="pengganti-schedule-select"
              disabled={delegationForm.delegation_type === 'PIKET'}
              value={delegationForm.schedule_id}
              onChange={(e) => {
                const nextSchedId = e.target.value;
                const sched = schedules.find((s) => s.id === nextSchedId);
                setDelegationForm({
                  ...delegationForm,
                  schedule_id: nextSchedId,
                  original_teacher_id:
                    sched?.teacher_id || delegationForm.original_teacher_id,
                  substitute_teacher_id:
                    sched?.teacher_id &&
                    sched.teacher_id === delegationForm.substitute_teacher_id
                      ? ''
                      : delegationForm.substitute_teacher_id,
                  jtm_transferred: sched?.jtm_count || delegationForm.jtm_transferred,
                });
              }}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Jadwal Mengajar (Opsional) --</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)} • {s.classroom?.name}{' '}
                  • {s.subject?.name} ({s.jtm_count} JTM)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-original-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Guru Berhalangan <span className="text-rose-500">*</span>
            </label>
            <select
              id="pengganti-original-select"
              required
              value={delegationForm.original_teacher_id}
              onChange={(e) => {
                const nextOriginal = e.target.value;
                setDelegationForm({
                  ...delegationForm,
                  original_teacher_id: nextOriginal,
                  substitute_teacher_id:
                    delegationForm.substitute_teacher_id === nextOriginal
                      ? ''
                      : delegationForm.substitute_teacher_id,
                });
              }}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Pilih Guru Berhalangan --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-substitute-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Guru Pengganti <span className="text-rose-500">*</span>
            </label>
            <select
              id="pengganti-substitute-select"
              required
              value={delegationForm.substitute_teacher_id}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, substitute_teacher_id: e.target.value })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Pilih Guru Pengganti --</option>
              {teachers
                .filter((t) => t.id !== delegationForm.original_teacher_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {isSameTeacher && (
          <p className="text-xs text-rose-600 font-medium">
            Guru pengganti tidak boleh sama dengan guru yang berhalangan.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-jtm-input"
              className="block text-xs font-semibold text-slate-700"
            >
              JTM Dialihkan (1–12 JTM)
            </label>
            <input
              id="pengganti-jtm-input"
              type="number"
              min={1}
              max={12}
              value={delegationForm.jtm_transferred}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                setDelegationForm({
                  ...delegationForm,
                  jtm_transferred: Number.isFinite(val)
                    ? Math.min(12, Math.max(1, val))
                    : 1,
                });
              }}
              placeholder="JTM Jadwal"
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="pengganti-reason-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Alasan / Keterangan (Opsional)
            </label>
            <input
              id="pengganti-reason-input"
              placeholder="Contoh: Sakit, Dinas Luar, Izin Keluarga"
              value={delegationForm.reason}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, reason: e.target.value })
              }
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={
            submitting || confirmedPicketAttendances.length === 0 || isSameTeacher
          }
          className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Tunjuk Guru Pengganti
        </button>
      </form>

      {/* Daftar Penunjukkan Guru Pengganti */}
      <div className="pt-3 border-t border-slate-200/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `Semua (${delegations.length})` },
                { id: 'MENGAJAR', label: `Mengajar (${mengajarDelegationCount})` },
                { id: 'PIKET', label: `Piket (${piketDelegationCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPenggantiFilter(tab.id);
                  setPenggantiPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  penggantiFilter === tab.id
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={penggantiSearch}
              onChange={(e) => {
                setPenggantiSearch(e.target.value);
                setPenggantiPage(1);
              }}
              placeholder="Cari guru, kelas, alasan..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {penggantiSearch && (
              <button
                type="button"
                onClick={() => {
                  setPenggantiSearch('');
                  setPenggantiPage(1);
                }}
                aria-label="Hapus pencarian delegasi"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredDelegations.length === 0 ? (
          <AkademikEmptyState
            icon={<UserCheck className="w-6 h-6 text-slate-400" />}
            message={
              delegations.length === 0
                ? 'Belum ada penunjukkan guru pengganti yang tercatat.'
                : 'Tidak ada data penunjukkan guru pengganti yang cocok dengan filter atau pencarian Anda.'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {paginatedDelegations.map((del) => (
                <div
                  key={del.id}
                  className="p-3.5 rounded-2xl bg-white/85 border border-slate-200/80 hover:border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900">
                        {del.substitute?.full_name || 'Guru Pengganti'}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-700 font-medium">
                        menggantikan {del.original?.full_name || 'Guru'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          del.delegation_type === 'PIKET'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {del.delegation_type === 'PIKET' ? 'Piket Pengganti' : 'Mengajar'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 break-words">
                      {del.delegation_date}
                      {del.schedule?.classroom?.name || del.schedule?.subject?.name
                        ? ` • ${del.schedule?.classroom?.name || ''} ${del.schedule?.subject?.name || ''}`.trimEnd()
                        : ''}
                      {del.reason ? ` • Alasan: ${del.reason}` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0 self-start sm:self-center">
                    {del.jtm_transferred} JTM
                  </span>
                </div>
              ))}
            </div>

            {totalPenggantiPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                <span>
                  Halaman <strong>{safePenggantiPage}</strong> dari{' '}
                  <strong>{totalPenggantiPages}</strong> ({filteredDelegations.length}{' '}
                  delegasi)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePenggantiPage <= 1}
                    onClick={() => setPenggantiPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={safePenggantiPage >= totalPenggantiPages}
                    onClick={() =>
                      setPenggantiPage((p) => Math.min(totalPenggantiPages, p + 1))
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
  );
}
