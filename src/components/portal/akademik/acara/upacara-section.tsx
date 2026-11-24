'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { AkademikEmptyState } from '../akademik-ui';
import type {
  CeremonyRow,
  PicketAttOpt,
  PostAcaraFn,
  ShowToastFn,
  TeacherOpt,
} from './types';

interface UpacaraSectionProps {
  teachers: TeacherOpt[];
  ceremonies: CeremonyRow[];
  confirmedPickets: PicketAttOpt[];
  canManageEvents: boolean;
  submitting: boolean;
  postAcara: PostAcaraFn;
  showToast: ShowToastFn;
}

const UPACARA_PAGE_SIZE = 8;

export function UpacaraSection({
  teachers,
  ceremonies,
  confirmedPickets,
  canManageEvents,
  submitting,
  postAcara,
  showToast,
}: UpacaraSectionProps) {
  const [ceremonyForm, setCeremonyForm] = useState(() => ({
    ceremony_date: getWibTodayDateString(),
    teacher_id: '',
    jtm_allocated: 2,
    notes: '',
  }));
  const [subCeremonyForm, setSubCeremonyForm] = useState({
    ceremony_id: '',
    substitute_teacher_id: '',
    picket_attendance_id: '',
    reason: '',
  });
  const [upacaraSearch, setUpacaraSearch] = useState('');
  const [upacaraFilter, setUpacaraFilter] = useState<
    'ALL' | 'TERJADWAL' | 'TERLAKSANA' | 'DIBATALKAN'
  >('ALL');
  const [upacaraPage, setUpacaraPage] = useState(1);

  const scheduledCeremonies = ceremonies.filter((c) => c.status === 'TERJADWAL');
  const completedCeremonies = ceremonies.filter((c) => c.status === 'TERLAKSANA');
  const totalJtmUpacara = completedCeremonies.reduce(
    (sum, c) => sum + (Number(c.jtm_allocated) || 0),
    0
  );

  const isCeremonyDateMonday = (() => {
    if (!ceremonyForm.ceremony_date) return true;
    const d = new Date(`${ceremonyForm.ceremony_date}T00:00:00Z`);
    return d.getUTCDay() === 1;
  })();

  const selectedCeremony = scheduledCeremonies.find(
    (c) => c.id === subCeremonyForm.ceremony_id
  );
  const selectedSubPicket = confirmedPickets.find(
    (p) => p.id === subCeremonyForm.picket_attendance_id
  );
  const isSameCeremonyTeacher =
    Boolean(selectedCeremony) &&
    selectedCeremony!.teacher_id === subCeremonyForm.substitute_teacher_id;
  const isSubPicketDateMismatch =
    Boolean(selectedCeremony) &&
    Boolean(selectedSubPicket) &&
    selectedSubPicket!.attendance_date !== selectedCeremony!.ceremony_date;

  const filteredByStatus =
    upacaraFilter === 'ALL' ? ceremonies : ceremonies.filter((c) => c.status === upacaraFilter);

  const query = upacaraSearch.trim().toLowerCase();
  const filteredCeremonies = query
    ? filteredByStatus.filter((c) => {
        const haystack = [
          c.ceremony_date,
          c.teacher?.full_name,
          c.original_teacher?.full_name,
          c.substitution_reason,
          c.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : filteredByStatus;

  const totalUpacaraPages = Math.max(1, Math.ceil(filteredCeremonies.length / UPACARA_PAGE_SIZE));
  const safeUpacaraPage = Math.min(upacaraPage, totalUpacaraPages);
  const paginatedCeremonies = filteredCeremonies.slice(
    (safeUpacaraPage - 1) * UPACARA_PAGE_SIZE,
    safeUpacaraPage * UPACARA_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total Jadwal</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            {ceremonies.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Terjadwal</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5 tabular-nums">
            {scheduledCeremonies.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Terlaksana</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {completedCeremonies.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/75 border border-slate-200/80 p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Total JTM Terlaksana</p>
          <p className="text-xl font-bold text-sky-700 mt-0.5 tabular-nums">
            {totalJtmUpacara} <span className="text-xs font-semibold">JTM</span>
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Upacara Bendera Hari Senin — Pembina Upacara &amp; Pengganti ({ceremonies.length})
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Guru yang bertugas sebagai <strong>Pembina Upacara Bendera Hari Senin</strong> (atau{' '}
            <strong>Pembina Pengganti</strong> yang ditunjuk Admin / Guru Piket terkonfirmasi Admin)
            mendapatkan JTM setelah pelaksanaan upacara dikonfirmasi.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {(canManageEvents || confirmedPickets.length > 0) && (
            <div className="lg:col-span-5 space-y-4">
              {canManageEvents && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ceremonyForm.ceremony_date || !ceremonyForm.teacher_id) {
                      showToast('error', 'Pilih tanggal Senin dan guru pembina upacara.');
                      return;
                    }
                    if (!isCeremonyDateMonday) {
                      showToast('error', 'Jadwal Upacara Bendera harus pada hari Senin.');
                      return;
                    }
                    const safeJtm = Math.min(
                      12,
                      Math.max(
                        1,
                        Number.isFinite(ceremonyForm.jtm_allocated)
                          ? ceremonyForm.jtm_allocated
                          : 2
                      )
                    );
                    const ok = await postAcara(
                      {
                        action: 'CREATE_CEREMONY',
                        ceremony_date: ceremonyForm.ceremony_date,
                        teacher_id: ceremonyForm.teacher_id,
                        jtm_allocated: safeJtm,
                        notes: ceremonyForm.notes.trim() || null,
                      },
                      'Jadwal Pembina Upacara Hari Senin berhasil disimpan.'
                    );
                    if (ok) {
                      setCeremonyForm((prev) => ({
                        ...prev,
                        teacher_id: '',
                        jtm_allocated: 2,
                        notes: '',
                      }));
                      setUpacaraPage(1);
                    }
                  }}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                >
                  <p className="text-xs font-bold text-slate-800">
                    Jadwalkan Pembina Upacara (Hari Senin)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="upacara-date-input"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Tanggal (Hari Senin) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="upacara-date-input"
                        type="date"
                        required
                        value={ceremonyForm.ceremony_date}
                        onChange={(e) =>
                          setCeremonyForm({ ...ceremonyForm, ceremony_date: e.target.value })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="upacara-jtm-input"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Alokasi JTM (1–12)
                      </label>
                      <input
                        id="upacara-jtm-input"
                        type="number"
                        min={1}
                        max={12}
                        value={ceremonyForm.jtm_allocated}
                        onChange={(e) => {
                          const val = Number.parseInt(e.target.value, 10);
                          setCeremonyForm({
                            ...ceremonyForm,
                            jtm_allocated: Number.isFinite(val)
                              ? Math.min(12, Math.max(1, val))
                              : 1,
                          });
                        }}
                        placeholder="JTM"
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {!isCeremonyDateMonday && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                      Tanggal yang dipilih bukan hari Senin. Jadwal upacara wajib jatuh pada hari
                      Senin.
                    </div>
                  )}

                  <div className="space-y-1">
                    <label
                      htmlFor="upacara-teacher-select"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Guru Pembina Upacara <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="upacara-teacher-select"
                      required
                      value={ceremonyForm.teacher_id}
                      onChange={(e) =>
                        setCeremonyForm({ ...ceremonyForm, teacher_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="">-- Pilih Guru Pembina Upacara --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="upacara-notes-input"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Catatan (Opsional)
                    </label>
                    <input
                      id="upacara-notes-input"
                      placeholder="Catatan (opsional)"
                      value={ceremonyForm.notes}
                      onChange={(e) => setCeremonyForm({ ...ceremonyForm, notes: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isCeremonyDateMonday}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Jadwal Pembina Upacara
                  </button>
                </form>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!subCeremonyForm.ceremony_id || !subCeremonyForm.substitute_teacher_id) {
                    showToast('error', 'Pilih jadwal upacara dan guru pembina pengganti.');
                    return;
                  }
                  if (!canManageEvents && !subCeremonyForm.picket_attendance_id) {
                    showToast(
                      'error',
                      'Pilih presensi Guru Piket terkonfirmasi Admin terlebih dahulu.'
                    );
                    return;
                  }
                  if (isSameCeremonyTeacher) {
                    showToast(
                      'error',
                      'Pembina pengganti tidak boleh sama dengan pembina saat ini.'
                    );
                    return;
                  }
                  if (isSubPicketDateMismatch) {
                    showToast(
                      'error',
                      `Guru Piket hanya dapat menunjuk pembina pengganti pada tanggal piketnya (${selectedCeremony?.ceremony_date}).`
                    );
                    return;
                  }
                  const ok = await postAcara(
                    {
                      action: 'SUBSTITUTE_CEREMONY_LEADER',
                      ceremony_id: subCeremonyForm.ceremony_id,
                      substitute_teacher_id: subCeremonyForm.substitute_teacher_id,
                      picket_attendance_id: subCeremonyForm.picket_attendance_id || null,
                      reason: subCeremonyForm.reason.trim() || null,
                    },
                    'Pembina Upacara Pengganti berhasil ditunjuk.'
                  );
                  if (ok) {
                    setSubCeremonyForm({
                      ceremony_id: '',
                      substitute_teacher_id: '',
                      picket_attendance_id: '',
                      reason: '',
                    });
                  }
                }}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
                <p className="text-xs font-bold text-slate-800">
                  Tunjuk Pembina Upacara Pengganti (Admin / Guru Piket Terkonfirmasi)
                </p>

                <div className="space-y-1">
                  <label
                    htmlFor="upacara-sub-ceremony-select"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jadwal Upacara Senin (Terjadwal) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="upacara-sub-ceremony-select"
                    required
                    value={subCeremonyForm.ceremony_id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const nextCer = scheduledCeremonies.find((c) => c.id === nextId);
                      setSubCeremonyForm({
                        ...subCeremonyForm,
                        ceremony_id: nextId,
                        substitute_teacher_id:
                          nextCer && nextCer.teacher_id === subCeremonyForm.substitute_teacher_id
                            ? ''
                            : subCeremonyForm.substitute_teacher_id,
                      });
                    }}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">-- Pilih Jadwal Upacara Senin (Terjadwal) --</option>
                    {scheduledCeremonies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ceremony_date} • Pembina: {c.teacher?.full_name || 'Guru'} (
                        {c.jtm_allocated} JTM)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="upacara-sub-teacher-select"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Guru Pembina Pengganti <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="upacara-sub-teacher-select"
                    required
                    value={subCeremonyForm.substitute_teacher_id}
                    onChange={(e) =>
                      setSubCeremonyForm({
                        ...subCeremonyForm,
                        substitute_teacher_id: e.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">-- Pilih Guru Pembina Pengganti --</option>
                    {teachers
                      .filter((t) => !selectedCeremony || t.id !== selectedCeremony.teacher_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="upacara-sub-picket-select"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Aktor Penunjukkan
                  </label>
                  <select
                    id="upacara-sub-picket-select"
                    value={subCeremonyForm.picket_attendance_id}
                    onChange={(e) =>
                      setSubCeremonyForm({
                        ...subCeremonyForm,
                        picket_attendance_id: e.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">
                      {canManageEvents
                        ? '-- Sebagai Admin (atau pilih Guru Piket Terkonfirmasi) --'
                        : '-- Pilih Presensi Guru Piket / Pengganti Terkonfirmasi Admin --'}
                    </option>
                    {confirmedPickets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.attendance_date} • {p.teacher?.full_name || 'Guru Piket'}
                      </option>
                    ))}
                  </select>
                </div>

                {isSubPicketDateMismatch && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                    Tanggal Guru Piket (<strong>{selectedSubPicket?.attendance_date}</strong>)
                    berbeda dengan tanggal upacara (
                    <strong>{selectedCeremony?.ceremony_date}</strong>).
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="upacara-sub-reason-input"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Alasan Penggantian (Opsional)
                  </label>
                  <input
                    id="upacara-sub-reason-input"
                    placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                    value={subCeremonyForm.reason}
                    onChange={(e) =>
                      setSubCeremonyForm({ ...subCeremonyForm, reason: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    scheduledCeremonies.length === 0 ||
                    isSameCeremonyTeacher ||
                    isSubPicketDateMismatch ||
                    (!canManageEvents && !subCeremonyForm.picket_attendance_id)
                  }
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Tunjuk Pembina Pengganti
                </button>
              </form>
            </div>
          )}

          <div
            className={`${
              canManageEvents || confirmedPickets.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
            } space-y-3 min-w-0`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${ceremonies.length})` },
                    { id: 'TERJADWAL', label: `Terjadwal (${scheduledCeremonies.length})` },
                    { id: 'TERLAKSANA', label: `Terlaksana (${completedCeremonies.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setUpacaraFilter(tab.id);
                      setUpacaraPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                      upacaraFilter === tab.id
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
                  value={upacaraSearch}
                  onChange={(e) => {
                    setUpacaraSearch(e.target.value);
                    setUpacaraPage(1);
                  }}
                  placeholder="Cari pembina, tanggal..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {upacaraSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpacaraSearch('');
                      setUpacaraPage(1);
                    }}
                    aria-label="Hapus pencarian upacara"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredCeremonies.length === 0 ? (
              <AkademikEmptyState
                icon={<CalendarDays className="w-6 h-6" />}
                message={
                  ceremonies.length === 0
                    ? 'Belum ada jadwal Pembina Upacara Bendera Hari Senin.'
                    : 'Tidak ada jadwal upacara yang cocok dengan filter atau pencarian Anda.'
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedCeremonies.map((c) => {
                    const matchingPicket = confirmedPickets.find(
                      (p) => p.attendance_date === c.ceremony_date
                    );
                    return (
                      <div
                        key={c.id}
                        className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-slate-900 break-words">
                            Senin, {c.ceremony_date} • {c.teacher?.full_name || 'Guru'}
                            {c.original_teacher?.full_name && (
                              <span className="font-normal text-slate-500">
                                {' '}
                                (menggantikan {c.original_teacher.full_name})
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 break-words">
                            Status:{' '}
                            <strong
                              className={
                                c.status === 'TERLAKSANA' ? 'text-emerald-700' : 'text-amber-700'
                              }
                            >
                              {c.status}
                            </strong>
                            {c.substitution_reason ? ` • Alasan: ${c.substitution_reason}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold ${
                              c.status === 'TERLAKSANA'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {c.status === 'TERLAKSANA'
                              ? `+${c.jtm_allocated} JTM`
                              : `0/${c.jtm_allocated} JTM`}
                          </span>
                          {c.status === 'TERJADWAL' && (canManageEvents || matchingPicket) && (
                            <button
                              type="button"
                              aria-busy={submitting || undefined}
                              disabled={submitting}
                              onClick={() =>
                                postAcara(
                                  {
                                    action: 'CONFIRM_CEREMONY',
                                    ceremony_id: c.id,
                                    picket_attendance_id: !canManageEvents
                                      ? matchingPicket?.id || null
                                      : null,
                                  },
                                  `Upacara ${c.ceremony_date} dikonfirmasi terlaksana (+${c.jtm_allocated} JTM).`
                                )
                              }
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold transition cursor-pointer"
                            >
                              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              <span>Konfirmasi Terlaksana</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalUpacaraPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span>
                      Halaman <strong>{safeUpacaraPage}</strong> dari{' '}
                      <strong>{totalUpacaraPages}</strong> ({filteredCeremonies.length} jadwal)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeUpacaraPage <= 1}
                        onClick={() => setUpacaraPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={safeUpacaraPage >= totalUpacaraPages}
                        onClick={() => setUpacaraPage((p) => Math.min(totalUpacaraPages, p + 1))}
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
    </div>
  );
}
