'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import type {
  PostPresensiFn,
  ShortLeaveRow,
  ShowToastFn,
  TeacherAttendanceRow,
} from './types';

interface JamManualSectionProps {
  teacherAttendances: TeacherAttendanceRow[];
  confirmedPicketAttendances: TeacherAttendanceRow[];
  confirmedCommitteeAttendances: TeacherAttendanceRow[];
  canAdminConfirm: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function JamManualSection({
  teacherAttendances,
  confirmedPicketAttendances,
  confirmedCommitteeAttendances,
  canAdminConfirm,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: JamManualSectionProps) {
  const [manualTimeForm, setManualTimeForm] = useState({
    attendance_id: '',
    check_in_hhmm: '07:30',
    check_out_hhmm: '12:30',
    actor_ref: '', // '' = Admin, 'picket:<id>', 'committee:<id>'
  });
  const [manualTimeSearch, setManualTimeSearch] = useState('');
  const [manualTimeFilter, setManualTimeFilter] = useState<'ALL' | 'MISSING' | 'FILLED'>('ALL');
  const [manualTimePage, setManualTimePage] = useState(1);

  const MANUAL_TIME_PAGE_SIZE = 6;
  const validAttendances = teacherAttendances.filter((a) => a.is_within_geofence);
  const missingCheckoutCount = validAttendances.filter((a) => !a.check_out_time).length;
  const filledCheckoutCount = validAttendances.filter((a) => Boolean(a.check_out_time)).length;
  const piketPanitiaCount = validAttendances.filter(
    (a) => a.attendance_type === 'PIKET' || a.attendance_type === 'PANITIA_UJIAN'
  ).length;

  const toWibHhmm = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return /^\d{2}:\d{2}$/.test(formatted) ? formatted : null;
  };

  const selectAttendanceForManualTime = (attendanceId: string) => {
    const target = validAttendances.find((a) => a.id === attendanceId);
    const existingIn = toWibHhmm(target?.check_in_time);
    const existingOut = toWibHhmm(target?.check_out_time);
    setManualTimeForm((prev) => ({
      ...prev,
      attendance_id: attendanceId,
      check_in_hhmm: existingIn || prev.check_in_hhmm || '07:30',
      check_out_hhmm: existingOut || prev.check_out_hhmm || '12:30',
    }));
  };

  const selectedAttendance = validAttendances.find(
    (a) => a.id === manualTimeForm.attendance_id
  );
  const isAdminOnlyTarget =
    selectedAttendance?.attendance_type === 'PIKET' ||
    selectedAttendance?.attendance_type === 'PANITIA_UJIAN';
  const [selectedActorKind, selectedActorId] = manualTimeForm.actor_ref.split(':');
  const selectedPicketActor =
    selectedActorKind === 'picket'
      ? confirmedPicketAttendances.find((p) => p.id === selectedActorId)
      : null;
  const isPicketDateMismatch =
    Boolean(selectedAttendance) &&
    Boolean(selectedPicketActor) &&
    selectedPicketActor!.attendance_date !== selectedAttendance!.attendance_date;

  const filteredByStatus =
    manualTimeFilter === 'ALL'
      ? validAttendances
      : manualTimeFilter === 'MISSING'
        ? validAttendances.filter((a) => !a.check_out_time)
        : validAttendances.filter((a) => Boolean(a.check_out_time));

  const query = manualTimeSearch.trim().toLowerCase();
  const filteredAttendances = query
    ? filteredByStatus.filter((a) => {
        const haystack = [a.teacher?.full_name, a.attendance_date, a.attendance_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalManualPages = Math.max(
    1,
    Math.ceil(filteredAttendances.length / MANUAL_TIME_PAGE_SIZE)
  );
  const safeManualPage = Math.min(manualTimePage, totalManualPages);
  const paginatedAttendances = filteredAttendances.slice(
    (safeManualPage - 1) * MANUAL_TIME_PAGE_SIZE,
    safeManualPage * MANUAL_TIME_PAGE_SIZE
  );

  const canAccessForm =
    canAdminConfirm ||
    confirmedPicketAttendances.length > 0 ||
    confirmedCommitteeAttendances.length > 0;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Input Manual Jam Masuk &amp; Jam Pulang</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Diisi manual oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>,
            atau <strong>Panitia Ujian/Pengganti</strong> (khusus jam masuk &amp; pulang Guru
            Piket dan Panitia Ujian wajib diisi manual oleh Admin).
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
          <p className="text-[11px] font-medium text-slate-500">Presensi Valid</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {validAttendances.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Belum Jam Pulang</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {missingCheckoutCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Sudah Jam Pulang</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {filledCheckoutCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket &amp; Panitia</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {piketPanitiaCount}
          </p>
        </div>
      </div>

      {canAccessForm ? (
        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              if (!manualTimeForm.attendance_id) {
                showToast('error', 'Pilih data presensi terlebih dahulu.');
                return;
              }
              if (!canAdminConfirm && !manualTimeForm.actor_ref) {
                showToast(
                  'error',
                  'Pilih peran Anda (Guru Piket / Panitia Terkonfirmasi) terlebih dahulu.'
                );
                return;
              }
              if (!canAdminConfirm && isAdminOnlyTarget) {
                showToast(
                  'error',
                  'Jam masuk dan jam pulang Guru Piket atau Panitia Ujian hanya dapat diisi manual oleh Admin.'
                );
                return;
              }
              if (isPicketDateMismatch) {
                showToast(
                  'error',
                  'Tanggal presensi Guru Piket harus sama dengan tanggal presensi target.'
                );
                return;
              }
              if (
                !/^\d{2}:\d{2}$/.test(manualTimeForm.check_in_hhmm) ||
                !/^\d{2}:\d{2}$/.test(manualTimeForm.check_out_hhmm)
              ) {
                showToast('error', 'Format jam masuk dan jam pulang harus HH:MM.');
                return;
              }
              if (manualTimeForm.check_out_hhmm <= manualTimeForm.check_in_hhmm) {
                showToast('error', 'Jam pulang harus lebih besar dari jam masuk.');
                return;
              }
              const [kind, refId] = manualTimeForm.actor_ref.split(':');
              setSubmitting(true);
              try {
                const res = await postPresensi({
                  action: 'SET_ATTENDANCE_TIMES',
                  attendance_id: manualTimeForm.attendance_id,
                  check_in_hhmm: manualTimeForm.check_in_hhmm,
                  check_out_hhmm: manualTimeForm.check_out_hhmm,
                  picket_attendance_id: kind === 'picket' ? refId : null,
                  committee_attendance_id: kind === 'committee' ? refId : null,
                });
                if (res) {
                  showToast('success', 'Jam masuk & jam pulang berhasil disimpan.');
                  setManualTimeForm((prev) => ({
                    ...prev,
                    attendance_id: '',
                  }));
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="jam-manual-att-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Presensi Target <span className="text-rose-500">*</span>
              </label>
              <select
                id="jam-manual-att-select"
                required
                value={manualTimeForm.attendance_id}
                onChange={(e) => selectAttendanceForManualTime(e.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Presensi Guru / Pengawas / Piket / Panitia --
                </option>
                {validAttendances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.attendance_date} • {a.teacher?.full_name || 'Guru'} ({a.attendance_type}
                    ) {a.check_out_time ? '[Sudah ada jam pulang]' : '[Belum ada jam pulang]'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="jam-manual-actor-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Peran Penginput
              </label>
              <select
                id="jam-manual-actor-select"
                value={manualTimeForm.actor_ref}
                onChange={(e) =>
                  setManualTimeForm({ ...manualTimeForm, actor_ref: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  {canAdminConfirm
                    ? '-- Input sebagai Admin --'
                    : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
                </option>
                {confirmedPicketAttendances.map((p) => (
                  <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                    Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                  </option>
                ))}
                {confirmedCommitteeAttendances.map((c) => (
                  <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                    Panitia Ujian: {c.teacher?.full_name || 'Panitia'} ({c.attendance_date})
                  </option>
                ))}
              </select>
            </div>

            {!canAdminConfirm && isAdminOnlyTarget && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                Jam masuk &amp; jam pulang untuk <strong>{selectedAttendance?.attendance_type}</strong>{' '}
                hanya dapat diisi manual oleh Admin.
              </div>
            )}

            {isPicketDateMismatch && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Tanggal Guru Piket (<strong>{selectedPicketActor?.attendance_date}</strong>)
                berbeda dengan tanggal presensi target (
                <strong>{selectedAttendance?.attendance_date}</strong>).
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="jam-manual-checkin"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jam Masuk (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="jam-manual-checkin"
                  type="time"
                  required
                  value={manualTimeForm.check_in_hhmm}
                  onChange={(e) =>
                    setManualTimeForm({ ...manualTimeForm, check_in_hhmm: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="jam-manual-checkout"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jam Pulang (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="jam-manual-checkout"
                  type="time"
                  required
                  value={manualTimeForm.check_out_hhmm}
                  onChange={(e) =>
                    setManualTimeForm({ ...manualTimeForm, check_out_hhmm: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !manualTimeForm.attendance_id ||
                (!canAdminConfirm && isAdminOnlyTarget) ||
                isPicketDateMismatch
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Jam Masuk &amp; Jam Pulang
            </button>
          </form>

          {/* Daftar Presensi untuk Pilih Cepat */}
          <div className="lg:col-span-6 space-y-3 min-w-0">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${validAttendances.length})` },
                    { id: 'MISSING', label: `Belum Pulang (${missingCheckoutCount})` },
                    { id: 'FILLED', label: `Sudah Pulang (${filledCheckoutCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setManualTimeFilter(tab.id);
                      setManualTimePage(1);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                      manualTimeFilter === tab.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={manualTimeSearch}
                  onChange={(e) => {
                    setManualTimeSearch(e.target.value);
                    setManualTimePage(1);
                  }}
                  placeholder="Cari nama guru, tanggal, tipe..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {manualTimeSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualTimeSearch('');
                      setManualTimePage(1);
                    }}
                    aria-label="Hapus pencarian presensi"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredAttendances.length === 0 ? (
              <AkademikEmptyState
                icon={<Clock className="w-6 h-6 text-slate-400" />}
                message={
                  validAttendances.length === 0
                    ? 'Belum ada data presensi valid dalam radius geofencing.'
                    : 'Tidak ada data presensi yang cocok dengan filter atau pencarian Anda.'
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedAttendances.map((a) => {
                    const inHhmm = toWibHhmm(a.check_in_time);
                    const outHhmm = toWibHhmm(a.check_out_time);
                    const isSelected = manualTimeForm.attendance_id === a.id;

                    return (
                      <div
                        key={a.id}
                        className={`modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                          isSelected ? 'ring-2 ring-emerald-500 border-emerald-400' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-slate-900 truncate">
                              {a.teacher?.full_name || 'Guru'}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {a.attendance_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {a.attendance_date} • Masuk: {inHhmm || '-'} • Pulang:{' '}
                            {outHhmm || 'Belum diisi'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectAttendanceForManualTime(a.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white'
                              : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {isSelected ? 'Dipilih' : 'Pilih'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {totalManualPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span>
                      Halaman <strong>{safeManualPage}</strong> dari{' '}
                      <strong>{totalManualPages}</strong> ({filteredAttendances.length} data)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeManualPage <= 1}
                        onClick={() => setManualTimePage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={safeManualPage >= totalManualPages}
                        onClick={() =>
                          setManualTimePage((p) => Math.min(totalManualPages, p + 1))
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
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          Hanya Admin, Guru Piket Terkonfirmasi, atau Panitia Ujian Terkonfirmasi yang dapat
          menginput jam masuk &amp; jam pulang manual.
        </div>
      )}
    </div>
  );
}

interface IzinKeluarSectionProps {
  activeDate: string;
  shortLeaves: ShortLeaveRow[];
  teacherAttendances: TeacherAttendanceRow[];
  confirmedPicketAttendances: TeacherAttendanceRow[];
  confirmedCommitteeAttendances: TeacherAttendanceRow[];
  canAdminConfirm: boolean;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  refreshing: boolean;
  handleRefresh: () => void;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function IzinKeluarSection({
  activeDate,
  shortLeaves,
  teacherAttendances,
  confirmedPicketAttendances,
  confirmedCommitteeAttendances,
  canAdminConfirm,
  submitting,
  setSubmitting,
  refreshing,
  handleRefresh,
  postPresensi,
  showToast,
}: IzinKeluarSectionProps) {
  const [shortLeaveForm, setShortLeaveForm] = useState({
    attendance_id: '',
    leave_start_time: '09:30',
    leave_end_time: '10:30',
    reason: '',
    actor_ref: '',
  });
  const [shortLeaveSearch, setShortLeaveSearch] = useState('');
  const [shortLeavePage, setShortLeavePage] = useState(1);

  const SHORT_LEAVE_PAGE_SIZE = 6;
  const validAttendances = teacherAttendances.filter((a) => a.is_within_geofence);
  const totalDurationMinutes = shortLeaves.reduce(
    (sum, lv) => sum + (Number(lv.duration_minutes) || 0),
    0
  );
  const todayShortLeavesCount = shortLeaves.filter(
    (lv) => lv.leave_date === activeDate
  ).length;

  const selectedAttendance = validAttendances.find(
    (a) => a.id === shortLeaveForm.attendance_id
  );
  const [selectedActorKind, selectedActorId] = shortLeaveForm.actor_ref.split(':');
  const selectedPicketActor =
    selectedActorKind === 'picket'
      ? confirmedPicketAttendances.find((p) => p.id === selectedActorId)
      : null;
  const isPicketDateMismatch =
    Boolean(selectedAttendance) &&
    Boolean(selectedPicketActor) &&
    selectedPicketActor!.attendance_date !== selectedAttendance!.attendance_date;

  const computeDurationMinutes = (start: string, end: string): number | null => {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  };
  const previewDuration = computeDurationMinutes(
    shortLeaveForm.leave_start_time,
    shortLeaveForm.leave_end_time
  );

  const query = shortLeaveSearch.trim().toLowerCase();
  const filteredLeaves = query
    ? shortLeaves.filter((lv) => {
        const haystack = [
          lv.leave_date,
          lv.teacher?.full_name,
          lv.reason,
          lv.recorded_by_role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : shortLeaves;

  const totalShortLeavePages = Math.max(
    1,
    Math.ceil(filteredLeaves.length / SHORT_LEAVE_PAGE_SIZE)
  );
  const safeShortLeavePage = Math.min(shortLeavePage, totalShortLeavePages);
  const paginatedLeaves = filteredLeaves.slice(
    (safeShortLeavePage - 1) * SHORT_LEAVE_PAGE_SIZE,
    safeShortLeavePage * SHORT_LEAVE_PAGE_SIZE
  );

  const canAccessForm =
    canAdminConfirm ||
    confirmedPicketAttendances.length > 0 ||
    confirmedCommitteeAttendances.length > 0;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Izin Keluar Sebentar ({shortLeaves.length})</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Diinput oleh <strong>Admin</strong>, <strong>Guru Piket/Pengganti</strong>, atau{' '}
            <strong>Panitia Ujian/Pengganti</strong>. Durasi izin keluar sebentar otomatis
            mengurangi persentase kehadiran untuk Tunjangan Transportasi.
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
          <p className="text-[11px] font-medium text-slate-500">Total Catatan</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {shortLeaves.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Izin Hari Ini</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {todayShortLeavesCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Durasi</p>
          <p className="text-xl font-bold text-rose-700 mt-0.5 tabular-nums">
            {totalDurationMinutes} <span className="text-xs font-semibold">menit</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Presensi Valid</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {validAttendances.length}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canAccessForm ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              if (!shortLeaveForm.attendance_id) {
                showToast('error', 'Pilih presensi guru / pengawas terlebih dahulu.');
                return;
              }
              if (!canAdminConfirm && !shortLeaveForm.actor_ref) {
                showToast(
                  'error',
                  'Pilih peran Anda (Guru Piket / Panitia Terkonfirmasi) terlebih dahulu.'
                );
                return;
              }
              if (isPicketDateMismatch) {
                showToast(
                  'error',
                  'Tanggal presensi Guru Piket harus sama dengan tanggal presensi target.'
                );
                return;
              }
              if (
                !/^\d{2}:\d{2}$/.test(shortLeaveForm.leave_start_time) ||
                !/^\d{2}:\d{2}$/.test(shortLeaveForm.leave_end_time)
              ) {
                showToast('error', 'Format jam keluar dan jam kembali harus HH:MM.');
                return;
              }
              if (shortLeaveForm.leave_end_time <= shortLeaveForm.leave_start_time) {
                showToast('error', 'Jam kembali harus lebih besar dari jam keluar.');
                return;
              }
              const [kind, refId] = shortLeaveForm.actor_ref.split(':');
              setSubmitting(true);
              try {
                const res = await postPresensi({
                  action: 'CREATE_SHORT_LEAVE',
                  attendance_id: shortLeaveForm.attendance_id,
                  leave_start_time: shortLeaveForm.leave_start_time,
                  leave_end_time: shortLeaveForm.leave_end_time,
                  reason: shortLeaveForm.reason.trim() || null,
                  picket_attendance_id: kind === 'picket' ? refId : null,
                  committee_attendance_id: kind === 'committee' ? refId : null,
                });
                if (res) {
                  showToast('success', 'Izin keluar sebentar berhasil dicatat.');
                  setShortLeaveForm((prev) => ({
                    ...prev,
                    attendance_id: '',
                    reason: '',
                  }));
                  setShortLeavePage(1);
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="lg:col-span-6 rounded-2xl bg-white/70 border border-slate-200/80 p-4 sm:p-5 space-y-3.5 self-start"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="izin-keluar-att-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Presensi Guru / Pengawas Hadir <span className="text-rose-500">*</span>
              </label>
              <select
                id="izin-keluar-att-select"
                required
                value={shortLeaveForm.attendance_id}
                onChange={(e) =>
                  setShortLeaveForm({ ...shortLeaveForm, attendance_id: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              >
                <option value="">-- Pilih Presensi Guru / Pengawas Hadir --</option>
                {validAttendances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.attendance_date} • {a.teacher?.full_name || 'Guru'} (
                    {a.attendance_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="izin-keluar-actor-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Peran Pencatat
              </label>
              <select
                id="izin-keluar-actor-select"
                value={shortLeaveForm.actor_ref}
                onChange={(e) =>
                  setShortLeaveForm({ ...shortLeaveForm, actor_ref: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              >
                <option value="">
                  {canAdminConfirm
                    ? '-- Catat sebagai Admin --'
                    : '-- Pilih Peran Anda (Guru Piket / Panitia Terkonfirmasi) --'}
                </option>
                {confirmedPicketAttendances.map((p) => (
                  <option key={`p:${p.id}`} value={`picket:${p.id}`}>
                    Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                  </option>
                ))}
                {confirmedCommitteeAttendances.map((c) => (
                  <option key={`c:${c.id}`} value={`committee:${c.id}`}>
                    Panitia Ujian: {c.teacher?.full_name || 'Panitia'} ({c.attendance_date})
                  </option>
                ))}
              </select>
            </div>

            {isPicketDateMismatch && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Tanggal Guru Piket (<strong>{selectedPicketActor?.attendance_date}</strong>)
                berbeda dengan tanggal presensi target (
                <strong>{selectedAttendance?.attendance_date}</strong>).
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="izin-keluar-start"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jam Keluar (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="izin-keluar-start"
                  type="time"
                  required
                  value={shortLeaveForm.leave_start_time}
                  onChange={(e) =>
                    setShortLeaveForm({ ...shortLeaveForm, leave_start_time: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="izin-keluar-end"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jam Kembali (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="izin-keluar-end"
                  type="time"
                  required
                  value={shortLeaveForm.leave_end_time}
                  onChange={(e) =>
                    setShortLeaveForm({ ...shortLeaveForm, leave_end_time: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            {previewDuration !== null ? (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Estimasi durasi izin keluar: <strong>-{previewDuration} menit</strong>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                Jam kembali harus lebih besar dari jam keluar.
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="izin-keluar-reason"
                className="block text-xs font-semibold text-slate-700"
              >
                Alasan Izin Keluar Sebentar (Opsional)
              </label>
              <input
                id="izin-keluar-reason"
                placeholder="Contoh: Urusan keluarga / ke bank / dinas singkat"
                value={shortLeaveForm.reason}
                onChange={(e) =>
                  setShortLeaveForm({ ...shortLeaveForm, reason: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !shortLeaveForm.attendance_id ||
                previewDuration === null ||
                isPicketDateMismatch
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Catat Izin Keluar Sebentar
            </button>
          </form>
        ) : (
          <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 self-start">
            Hanya Admin, Guru Piket Terkonfirmasi, atau Panitia Ujian Terkonfirmasi yang dapat
            mencatat izin keluar sebentar.
          </div>
        )}

        <div className="lg:col-span-6 space-y-3 min-w-0">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={shortLeaveSearch}
              onChange={(e) => {
                setShortLeaveSearch(e.target.value);
                setShortLeavePage(1);
              }}
              placeholder="Cari nama guru, tanggal, alasan..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
            {shortLeaveSearch && (
              <button
                type="button"
                onClick={() => {
                  setShortLeaveSearch('');
                  setShortLeavePage(1);
                }}
                aria-label="Hapus pencarian izin keluar"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredLeaves.length === 0 ? (
            <AkademikEmptyState
              icon={<Clock className="w-6 h-6 text-slate-400" />}
              message={
                shortLeaves.length === 0
                  ? 'Belum ada catatan izin keluar sebentar.'
                  : 'Tidak ada catatan izin keluar yang cocok dengan kata kunci pencarian Anda.'
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {paginatedLeaves.map((lv) => (
                  <div
                    key={lv.id}
                    className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-slate-900 truncate">
                          {lv.leave_date} • {lv.teacher?.full_name || 'Guru'}
                        </p>
                        {lv.recorded_by_role && (
                          <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800 text-[10px] font-semibold">
                            {lv.recorded_by_role}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 break-words">
                        {(lv.leave_start_time || '').slice(0, 5)}–
                        {(lv.leave_end_time || '').slice(0, 5)}
                        {lv.reason ? ` • ${lv.reason}` : ''}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold shrink-0 self-start sm:self-center">
                      -{lv.duration_minutes} menit
                    </span>
                  </div>
                ))}
              </div>

              {totalShortLeavePages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <span>
                    Halaman <strong>{safeShortLeavePage}</strong> dari{' '}
                    <strong>{totalShortLeavePages}</strong> ({filteredLeaves.length} catatan)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeShortLeavePage <= 1}
                      onClick={() => setShortLeavePage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={safeShortLeavePage >= totalShortLeavePages}
                      onClick={() =>
                        setShortLeavePage((p) => Math.min(totalShortLeavePages, p + 1))
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
