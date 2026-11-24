'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState } from '../akademik-ui';
import {
  DAY_NAMES,
  type ConfirmationRow,
  type PicketAttOpt,
  type PostAcaraFn,
  type SchoolEvent,
  type ShowToastFn,
  type TeacherOpt,
} from './types';

interface KonfirmasiSectionProps {
  events: SchoolEvent[];
  teachers: TeacherOpt[];
  confirmations: ConfirmationRow[];
  confirmedPickets: PicketAttOpt[];
  canManageEvents: boolean;
  submitting: boolean;
  postAcara: PostAcaraFn;
  showToast: ShowToastFn;
}

const CONFIRM_PAGE_SIZE = 8;

export function KonfirmasiSection({
  events,
  teachers,
  confirmations,
  confirmedPickets,
  canManageEvents,
  submitting,
  postAcara,
  showToast,
}: KonfirmasiSectionProps) {
  const [confirmForm, setConfirmForm] = useState(() => ({
    event_id: '',
    teacher_id: '',
    event_date: getWibTodayDateString(),
    picket_attendance_id: '',
    notes: '',
  }));
  const [confirmSearch, setConfirmSearch] = useState('');
  const [confirmRoleFilter, setConfirmRoleFilter] = useState<'ALL' | 'ADMIN' | 'GURU_PIKET'>(
    'ALL'
  );
  const [confirmPage, setConfirmPage] = useState(1);

  const canConfirm = canManageEvents || confirmedPickets.length > 0;
  const activeEvents = events.filter((ev) => ev.is_active);
  const selectedEvent = activeEvents.find((ev) => ev.id === confirmForm.event_id);
  const selectedPicket = confirmedPickets.find(
    (p) => p.id === confirmForm.picket_attendance_id
  );

  let dateMismatchError: string | null = null;
  if (selectedEvent && confirmForm.event_date) {
    if (selectedEvent.event_type === 'RUTIN_MINGGUAN') {
      const d = new Date(`${confirmForm.event_date}T00:00:00Z`);
      const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      if (selectedEvent.day_of_week !== isoDay) {
        dateMismatchError = `Tanggal ${confirmForm.event_date} (${DAY_NAMES[isoDay]}) tidak sesuai jadwal rutin setiap hari ${DAY_NAMES[selectedEvent.day_of_week || 1]}.`;
      }
    } else if (
      (selectedEvent.start_date && confirmForm.event_date < selectedEvent.start_date) ||
      (selectedEvent.end_date && confirmForm.event_date > selectedEvent.end_date)
    ) {
      dateMismatchError = `Tanggal ${confirmForm.event_date} di luar rentang acara (${selectedEvent.start_date} s.d. ${selectedEvent.end_date}).`;
    }
  }

  const picketDateMismatch =
    Boolean(selectedPicket) &&
    Boolean(confirmForm.event_date) &&
    selectedPicket!.attendance_date !== confirmForm.event_date;

  const filteredByRole =
    confirmRoleFilter === 'ALL'
      ? confirmations
      : confirmations.filter((c) => c.confirmed_by_role === confirmRoleFilter);

  const query = confirmSearch.trim().toLowerCase();
  const filteredConfirmations = query
    ? filteredByRole.filter((c) => {
        const haystack = [
          c.teacher?.full_name,
          c.event?.title,
          c.event_date,
          c.confirmed_by_role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByRole;

  const totalConfirmPages = Math.max(
    1,
    Math.ceil(filteredConfirmations.length / CONFIRM_PAGE_SIZE)
  );
  const safeConfirmPage = Math.min(confirmPage, totalConfirmPages);
  const paginatedConfirmations = filteredConfirmations.slice(
    (safeConfirmPage - 1) * CONFIRM_PAGE_SIZE,
    safeConfirmPage * CONFIRM_PAGE_SIZE
  );

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Konfirmasi</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {confirmations.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Acara Aktif</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {activeEvents.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Oleh Guru Piket</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {confirmations.filter((c) => c.confirmed_by_role === 'GURU_PIKET').length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Piket Terkonfirmasi</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {confirmedPickets.length}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {canConfirm && (
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Konfirmasi Kehadiran Guru di Acara</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dapat dikonfirmasi oleh <strong>Admin</strong> atau{' '}
                <strong>Guru Piket hari itu</strong> (yang sudah dikonfirmasi kehadirannya). Setelah
                dikonfirmasi, guru dapat mengisi Jurnal Acara.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!confirmForm.event_id || !confirmForm.teacher_id) {
                    showToast('error', 'Pilih acara/kegiatan dan guru yang hadir.');
                    return;
                  }
                  if (!canManageEvents && !confirmForm.picket_attendance_id) {
                    showToast('error', 'Pilih presensi Guru Piket hari ini terlebih dahulu.');
                    return;
                  }
                  if (dateMismatchError) {
                    showToast('error', dateMismatchError);
                    return;
                  }
                  if (picketDateMismatch) {
                    showToast(
                      'error',
                      `Guru Piket hanya dapat mengonfirmasi acara pada tanggal piketnya (${selectedPicket?.attendance_date}).`
                    );
                    return;
                  }
                  const ok = await postAcara(
                    {
                      action: 'CONFIRM_EVENT_ATTENDANCE',
                      event_id: confirmForm.event_id,
                      teacher_id: confirmForm.teacher_id,
                      event_date: confirmForm.event_date,
                      picket_attendance_id: confirmForm.picket_attendance_id || null,
                      notes: confirmForm.notes.trim() || null,
                    },
                    'Kehadiran guru pada acara berhasil dikonfirmasi.'
                  );
                  if (ok) {
                    setConfirmForm((prev) => ({ ...prev, teacher_id: '', notes: '' }));
                    setConfirmPage(1);
                  }
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="acara-konf-event-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Acara / Kegiatan Aktif <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="acara-konf-event-select"
                    required
                    value={confirmForm.event_id}
                    onChange={(e) => setConfirmForm({ ...confirmForm, event_id: e.target.value })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Acara / Kegiatan --</option>
                    {activeEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} (
                        {ev.event_type === 'RUTIN_MINGGUAN'
                          ? `Rutin ${DAY_NAMES[ev.day_of_week || 1]}`
                          : `${ev.start_date} s.d. ${ev.end_date}`}{' '}
                        • {ev.jtm_allocated} JTM)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="acara-konf-teacher-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Guru yang Hadir <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="acara-konf-teacher-select"
                    required
                    value={confirmForm.teacher_id}
                    onChange={(e) => setConfirmForm({ ...confirmForm, teacher_id: e.target.value })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Guru yang Hadir --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="acara-konf-date-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="acara-konf-date-input"
                    type="date"
                    required
                    value={confirmForm.event_date}
                    onChange={(e) => setConfirmForm({ ...confirmForm, event_date: e.target.value })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="acara-konf-picket-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Aktor Konfirmasi
                  </label>
                  <select
                    id="acara-konf-picket-select"
                    value={confirmForm.picket_attendance_id}
                    onChange={(e) =>
                      setConfirmForm({ ...confirmForm, picket_attendance_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">
                      {canManageEvents
                        ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket) --'
                        : '-- Pilih Presensi Guru Piket Hari Ini --'}
                    </option>
                    {confirmedPickets.map((p) => (
                      <option key={p.id} value={p.id}>
                        Guru Piket: {p.teacher?.full_name || 'Guru'} ({p.attendance_date})
                      </option>
                    ))}
                  </select>
                </div>

                {dateMismatchError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {dateMismatchError}
                  </div>
                )}

                {picketDateMismatch && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    Tanggal Guru Piket (<strong>{selectedPicket?.attendance_date}</strong>) berbeda
                    dengan tanggal acara (<strong>{confirmForm.event_date}</strong>).
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="acara-konf-notes-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Catatan Konfirmasi (Opsional)
                  </label>
                  <input
                    id="acara-konf-notes-input"
                    placeholder="Catatan konfirmasi (opsional)"
                    value={confirmForm.notes}
                    onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    Boolean(dateMismatchError) ||
                    picketDateMismatch ||
                    (!canManageEvents && !confirmForm.picket_attendance_id)
                  }
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Konfirmasi Kehadiran Acara
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={`${canConfirm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5`}>
          <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Riwayat Konfirmasi Kehadiran Acara ({filteredConfirmations.length})
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: `Semua (${confirmations.length})` },
                      {
                        id: 'ADMIN',
                        label: `Admin (${confirmations.filter((c) => c.confirmed_by_role === 'ADMIN').length})`,
                      },
                      {
                        id: 'GURU_PIKET',
                        label: `Guru Piket (${confirmations.filter((c) => c.confirmed_by_role === 'GURU_PIKET').length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setConfirmRoleFilter(tab.id);
                        setConfirmPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                        confirmRoleFilter === tab.id
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
                    value={confirmSearch}
                    onChange={(e) => {
                      setConfirmSearch(e.target.value);
                      setConfirmPage(1);
                    }}
                    placeholder="Cari guru, acara, tanggal..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  {confirmSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmSearch('');
                        setConfirmPage(1);
                      }}
                      aria-label="Hapus pencarian konfirmasi"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredConfirmations.length === 0 ? (
              <AkademikEmptyState
                icon={<UserCheck className="w-6 h-6" />}
                message={
                  confirmations.length === 0
                    ? 'Belum ada konfirmasi kehadiran guru pada acara.'
                    : 'Tidak ada riwayat konfirmasi yang cocok dengan filter atau pencarian Anda.'
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedConfirmations.map((c) => (
                    <div
                      key={c.id}
                      className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-bold text-slate-900 break-words">
                          {c.teacher?.full_name || 'Guru'} • {c.event?.title || 'Acara'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Tanggal: {c.event_date} • Dikonfirmasi oleh{' '}
                          <span className="font-semibold text-slate-700">
                            {c.confirmed_by_role === 'GURU_PIKET' ? 'Guru Piket' : 'Admin'}
                          </span>
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0 self-start sm:self-center">
                        +{c.event?.jtm_allocated ?? 0} JTM
                      </span>
                    </div>
                  ))}
                </div>

                {totalConfirmPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span>
                      Halaman <strong>{safeConfirmPage}</strong> dari{' '}
                      <strong>{totalConfirmPages}</strong> ({filteredConfirmations.length}{' '}
                      konfirmasi)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeConfirmPage <= 1}
                        onClick={() => setConfirmPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={safeConfirmPage >= totalConfirmPages}
                        onClick={() => setConfirmPage((p) => Math.min(totalConfirmPages, p + 1))}
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
    </>
  );
}
