'use client';

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  AlertCircle,
  Clock,
  Coins,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { normalizeDecimalInput, parseDecimalInput } from '@/lib/validation/decimal';
import {
  DAY_LABELS,
  formatDurationLabel,
  parseTimeMinutes,
  type CallHonorApiFn,
  type DailyHourRow,
  type RateSnapshot,
  type ShowToastFn,
  type TeacherOption,
} from './types';

interface TarifJamSectionProps {
  canManage: boolean;
  ratePerJtm: number;
  setRatePerJtm: Dispatch<SetStateAction<number>>;
  transportRatePerKm: number;
  setTransportRatePerKm: Dispatch<SetStateAction<number>>;
  schoolStartTime: string;
  setSchoolStartTime: Dispatch<SetStateAction<string>>;
  schoolEndTime: string;
  setSchoolEndTime: Dispatch<SetStateAction<string>>;
  savedRateSnapshot: RateSnapshot;
  dailyHours: DailyHourRow[];
  setDailyHours: Dispatch<SetStateAction<DailyHourRow[]>>;
  savedDailyHours: DailyHourRow[];
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  callHonorApi: CallHonorApiFn;
  showToast: ShowToastFn;
}

export function TarifJamSection({
  canManage,
  ratePerJtm,
  setRatePerJtm,
  transportRatePerKm,
  setTransportRatePerKm,
  schoolStartTime,
  setSchoolStartTime,
  schoolEndTime,
  setSchoolEndTime,
  savedRateSnapshot,
  dailyHours,
  setDailyHours,
  savedDailyHours,
  refreshing,
  submittingAction,
  onRefresh,
  callHonorApi,
  showToast,
}: TarifJamSectionProps) {
  const rateValidationError = useMemo(() => {
    if (!Number.isFinite(ratePerJtm) || ratePerJtm < 0) {
      return 'Tarif per JTM tidak boleh bernilai negatif.';
    }
    if (!Number.isFinite(transportRatePerKm) || transportRatePerKm < 0) {
      return 'Tarif transport per KM tidak boleh bernilai negatif.';
    }
    const startMin = parseTimeMinutes(schoolStartTime);
    const endMin = parseTimeMinutes(schoolEndTime);
    if (startMin === null || endMin === null) {
      return 'Jam masuk dan jam pulang sekolah wajib diisi dengan format HH:MM.';
    }
    if (endMin <= startMin) {
      return 'Jam pulang sekolah harus lebih besar daripada jam masuk sekolah.';
    }
    return null;
  }, [ratePerJtm, schoolEndTime, schoolStartTime, transportRatePerKm]);

  const invalidDailyDays = useMemo(() => {
    const invalid = new Set<number>();
    for (const dh of dailyHours) {
      if (!dh.is_active) continue;
      const startMin = parseTimeMinutes(dh.start_time);
      const endMin = parseTimeMinutes(dh.end_time);
      if (startMin === null || endMin === null || endMin <= startMin) {
        invalid.add(dh.day_of_week);
      }
    }
    return invalid;
  }, [dailyHours]);

  const isRateDirty =
    ratePerJtm !== savedRateSnapshot.ratePerJtm ||
    transportRatePerKm !== savedRateSnapshot.transportRatePerKm ||
    schoolStartTime !== savedRateSnapshot.schoolStartTime ||
    schoolEndTime !== savedRateSnapshot.schoolEndTime;

  const isDailyHoursDirty = useMemo(() => {
    if (dailyHours.length !== savedDailyHours.length) return true;
    return dailyHours.some((dh, idx) => {
      const saved = savedDailyHours[idx];
      if (!saved) return true;
      return (
        dh.day_of_week !== saved.day_of_week ||
        dh.is_active !== saved.is_active ||
        dh.start_time !== saved.start_time ||
        dh.end_time !== saved.end_time
      );
    });
  }, [dailyHours, savedDailyHours]);

  const activeDaysCount = useMemo(
    () => dailyHours.filter((dh) => dh.is_active).length,
    [dailyHours]
  );

  function handleSaveRates(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (rateValidationError) {
      showToast(rateValidationError, 'error');
      return;
    }
    void callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_RATE',
        rate_per_jtm: Math.round(ratePerJtm),
        transport_rate_per_km: Math.round(transportRatePerKm),
        school_start_time: schoolStartTime,
        school_end_time: schoolEndTime,
      },
      'Tarif JTM, jam sekolah & tarif transport diperbarui.'
    );
  }

  function handleSaveDailyHours() {
    if (!canManage || submittingAction) return;
    if (invalidDailyDays.size > 0) {
      const firstDay = Array.from(invalidDailyDays)[0];
      showToast(
        `Jam sekolah hari ${DAY_LABELS[firstDay] || firstDay} tidak valid (jam pulang harus lebih besar dari jam masuk).`,
        'error'
      );
      return;
    }
    void callHonorApi(
      'PATCH',
      { action: 'UPDATE_DAILY_HOURS', daily_hours: dailyHours },
      'Jam sekolah per hari berhasil diperbarui.'
    );
  }

  function handleApplyDefaultToActiveDays() {
    if (!canManage) return;
    const startMin = parseTimeMinutes(schoolStartTime);
    const endMin = parseTimeMinutes(schoolEndTime);
    if (startMin === null || endMin === null || endMin <= startMin) {
      showToast('Isi jam masuk & jam pulang default yang valid terlebih dahulu.', 'error');
      return;
    }
    setDailyHours((prev) =>
      prev.map((dh) =>
        dh.is_active
          ? { ...dh, start_time: schoolStartTime, end_time: schoolEndTime }
          : dh
      )
    );
    showToast('Jam default diterapkan ke seluruh hari aktif. Klik Simpan untuk menyimpan.', 'success');
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Tarif JTM &amp; Jam Sekolah</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Atur tarif dasar JTM, tarif transport per kilometer, dan jam operasional sekolah
            sebagai acuan perhitungan honorarium bulanan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Tarif JTM: </span>
            <span className="font-bold text-emerald-800 font-mono">
              {formatRupiah(savedRateSnapshot.ratePerJtm)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px]">
            <span className="text-slate-500">Hari Aktif: </span>
            <span className="font-bold text-slate-800">{activeDaysCount}/7 hari</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang pengaturan dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <form onSubmit={handleSaveRates} className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Tarif JTM, Jam Sekolah &amp; Transport per KM</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Nilai ini menjadi tarif standar dan jam masuk/pulang default.
              </p>
            </div>
            {isRateDirty && canManage && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                Belum disimpan
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label
                htmlFor="honor-rate-jtm"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Tarif per JTM (Rp)
              </label>
              <input
                id="honor-rate-jtm"
                type="number"
                min={0}
                step={500}
                disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                value={ratePerJtm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRatePerJtm(Number.isFinite(val) ? Math.max(0, val) : 0);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="text-[11px] text-emerald-700 font-medium font-mono">
                {formatRupiah(ratePerJtm)} / JTM
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="honor-rate-transport"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Tarif Transport / KM (Rp)
              </label>
              <input
                id="honor-rate-transport"
                type="number"
                min={0}
                step={100}
                disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                value={transportRatePerKm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTransportRatePerKm(Number.isFinite(val) ? Math.max(0, val) : 0);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="text-[11px] text-emerald-700 font-medium font-mono">
                {formatRupiah(transportRatePerKm)} / KM
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="honor-school-start"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Jam Masuk Sekolah Default
              </label>
              <input
                id="honor-school-start"
                type="time"
                disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                value={schoolStartTime}
                onChange={(e) => setSchoolStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="honor-school-end"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Jam Pulang Sekolah Default
              </label>
              <input
                id="honor-school-end"
                type="time"
                disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                value={schoolEndTime}
                onChange={(e) => setSchoolEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Durasi jam sekolah default
            </span>
            <span
              className={`font-semibold font-mono ${
                rateValidationError ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {formatDurationLabel(schoolStartTime, schoolEndTime)}
            </span>
          </div>

          {rateValidationError && (
            <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{rateValidationError}</span>
            </p>
          )}

          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={Boolean(submittingAction) || Boolean(rateValidationError)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'UPDATE_RATE' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan Pengaturan Tarif &amp; Jam Sekolah</span>
              </button>
              {isRateDirty && (
                <button
                  type="button"
                  disabled={Boolean(submittingAction)}
                  onClick={() => {
                    setRatePerJtm(savedRateSnapshot.ratePerJtm);
                    setTransportRatePerKm(savedRateSnapshot.transportRatePerKm);
                    setSchoolStartTime(savedRateSnapshot.schoolStartTime);
                    setSchoolEndTime(savedRateSnapshot.schoolEndTime);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              )}
            </div>
          )}
        </form>

        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">
                  Jam Sekolah Per Hari (Senin – Minggu)
                </h2>
                {isDailyHoursDirty && canManage && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                    Belum disimpan
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Atur jam masuk &amp; jam pulang masing-masing hari untuk menghitung persentase
                durasi kehadiran tunjangan transportasi.
              </p>
            </div>
            {canManage && dailyHours.length > 0 && (
              <button
                type="button"
                disabled={Boolean(submittingAction)}
                onClick={handleApplyDefaultToActiveDays}
                className="shrink-0 self-start px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold transition disabled:opacity-60"
              >
                Terapkan Jam Default
              </button>
            )}
          </div>

          {dailyHours.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              Data jam sekolah harian belum tersedia.
            </div>
          ) : (
            <div className="space-y-2">
              {dailyHours.map((dh) => {
                const isInvalid = invalidDailyDays.has(dh.day_of_week);
                const dayName = DAY_LABELS[dh.day_of_week] || `Hari ${dh.day_of_week}`;
                return (
                  <div
                    key={dh.day_of_week}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition ${
                      isInvalid
                        ? 'bg-rose-50/70 border-rose-300'
                        : dh.is_active
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50/80 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                      <label className="inline-flex items-center gap-2 min-w-[96px] font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!canManage || submittingAction === 'UPDATE_DAILY_HOURS'}
                          checked={dh.is_active}
                          onChange={(e) =>
                            setDailyHours((prev) =>
                              prev.map((x) =>
                                x.day_of_week === dh.day_of_week
                                  ? { ...x, is_active: e.target.checked }
                                  : x
                              )
                            )
                          }
                          className="w-4 h-4 rounded accent-emerald-600 disabled:opacity-60"
                        />
                        <span>{dayName}</span>
                      </label>

                      <span
                        className={`sm:hidden text-[11px] font-mono font-medium ${
                          !dh.is_active
                            ? 'text-slate-400'
                            : isInvalid
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                        }`}
                      >
                        {dh.is_active
                          ? formatDurationLabel(dh.start_time, dh.end_time)
                          : 'Libur / Nonaktif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                      <input
                        type="time"
                        aria-label={`Jam masuk ${dayName}`}
                        disabled={
                          !canManage ||
                          !dh.is_active ||
                          submittingAction === 'UPDATE_DAILY_HOURS'
                        }
                        value={dh.start_time}
                        onChange={(e) =>
                          setDailyHours((prev) =>
                            prev.map((x) =>
                              x.day_of_week === dh.day_of_week
                                ? { ...x, start_time: e.target.value }
                                : x
                            )
                          )
                        }
                        className="flex-1 sm:flex-none min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <span className="text-slate-400 shrink-0">–</span>
                      <input
                        type="time"
                        aria-label={`Jam pulang ${dayName}`}
                        disabled={
                          !canManage ||
                          !dh.is_active ||
                          submittingAction === 'UPDATE_DAILY_HOURS'
                        }
                        value={dh.end_time}
                        onChange={(e) =>
                          setDailyHours((prev) =>
                            prev.map((x) =>
                              x.day_of_week === dh.day_of_week
                                ? { ...x, end_time: e.target.value }
                                : x
                            )
                          )
                        }
                        className="flex-1 sm:flex-none min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <span
                        className={`hidden sm:inline-block w-24 text-right text-[11px] font-mono shrink-0 ${
                          !dh.is_active
                            ? 'text-slate-400'
                            : isInvalid
                              ? 'text-rose-600 font-semibold'
                              : 'text-slate-600'
                        }`}
                      >
                        {dh.is_active
                          ? formatDurationLabel(dh.start_time, dh.end_time)
                          : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {invalidDailyDays.size > 0 && (
            <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Periksa jam masuk &amp; pulang pada hari yang ditandai merah (jam pulang harus
                lebih besar dari jam masuk).
              </span>
            </p>
          )}

          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={Boolean(submittingAction) || invalidDailyDays.size > 0}
                onClick={handleSaveDailyHours}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'UPDATE_DAILY_HOURS' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan Jam Sekolah Per Hari</span>
              </button>
              {isDailyHoursDirty && (
                <button
                  type="button"
                  disabled={Boolean(submittingAction)}
                  onClick={() => setDailyHours(savedDailyHours.map((d) => ({ ...d })))}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface JarakGuruSectionProps {
  canManage: boolean;
  teachers: TeacherOption[];
  transportRatePerKm: number;
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  callHonorApi: CallHonorApiFn;
  showToast: ShowToastFn;
}

export function JarakGuruSection({
  canManage,
  teachers,
  transportRatePerKm,
  refreshing,
  submittingAction,
  onRefresh,
  callHonorApi,
  showToast,
}: JarakGuruSectionProps) {
  const [distanceForm, setDistanceForm] = useState({ teacher_id: '', home_distance_km: '0' });
  const [distanceSearch, setDistanceSearch] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'configured' | 'zero'>('all');

  const parsedDistanceKm = parseDecimalInput(distanceForm.home_distance_km) ?? NaN;

  const distanceValidationError = !distanceForm.teacher_id
    ? null
    : !Number.isFinite(parsedDistanceKm) || parsedDistanceKm < 0 || parsedDistanceKm > 500
      ? 'Jarak harus berupa angka antara 0 sampai 500 KM.'
      : null;

  const roundedPreviewKm =
    Number.isFinite(parsedDistanceKm) && parsedDistanceKm >= 0
      ? Math.round(parsedDistanceKm * 100) / 100
      : 0;

  const configuredDistanceCount = useMemo(
    () => teachers.filter((t) => Number(t.home_distance_km ?? 0) > 0).length,
    [teachers]
  );

  const filteredDistanceTeachers = useMemo(() => {
    const normalizedQuery = distanceSearch.trim().toLowerCase();
    return teachers.filter((t) => {
      const km = Number(t.home_distance_km ?? 0);
      if (distanceFilter === 'configured' && km <= 0) return false;
      if (distanceFilter === 'zero' && km > 0) return false;
      if (normalizedQuery && !t.full_name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [distanceFilter, distanceSearch, teachers]);

  async function handleSaveDistance(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!distanceForm.teacher_id) {
      showToast('Pilih guru terlebih dahulu.', 'error');
      return;
    }
    if (!Number.isFinite(parsedDistanceKm) || parsedDistanceKm < 0 || parsedDistanceKm > 500) {
      showToast('Jarak harus berupa angka antara 0 sampai 500 KM.', 'error');
      return;
    }
    const roundedKm = Math.round(parsedDistanceKm * 100) / 100;
    const ok = await callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_TEACHER_DISTANCE',
        teacher_id: distanceForm.teacher_id,
        home_distance_km: roundedKm,
      },
      'Jarak rumah guru (KM) berhasil diperbarui.'
    );
    if (ok) {
      setDistanceForm((prev) => ({
        ...prev,
        home_distance_km: String(roundedKm),
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Jarak Rumah Guru ke Madrasah / Sekolah</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Jarak tempuh (KM) dikalikan tarif transport ({formatRupiah(transportRatePerKm)}
            /KM) dan persentase durasi kehadiran harian untuk menghitung tunjangan transportasi.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Sudah Diatur: </span>
            <span className="font-bold text-emerald-800">
              {configuredDistanceCount}/{teachers.length} guru
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang daftar guru dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {canManage && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900">Perbarui Jarak Rumah Guru</h2>
              <p className="text-[11px] text-slate-500">
                Pilih guru dari daftar atau klik kartu guru di samping untuk mengisi jarak
                otomatis.
              </p>
            </div>

            <form onSubmit={handleSaveDistance} className="space-y-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="honor-distance-teacher"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Nama Guru
                </label>
                <select
                  id="honor-distance-teacher"
                  required
                  disabled={submittingAction === 'UPDATE_TEACHER_DISTANCE'}
                  value={distanceForm.teacher_id}
                  onChange={(e) => {
                    const found = teachers.find((t) => t.id === e.target.value);
                    setDistanceForm({
                      teacher_id: e.target.value,
                      home_distance_km: String(Number(found?.home_distance_km ?? 0)),
                    });
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.home_distance_km ?? 0} KM)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="honor-distance-km"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Jarak Rumah ke Sekolah (KM)
                </label>
                <div className="relative">
                  <input
                    id="honor-distance-km"
                    type="text"
                    inputMode="decimal"
                    required
                    disabled={submittingAction === 'UPDATE_TEACHER_DISTANCE'}
                    value={distanceForm.home_distance_km}
                    onChange={(e) =>
                      setDistanceForm((prev) => ({
                        ...prev,
                        home_distance_km: normalizeDecimalInput(e.target.value),
                      }))
                    }
                    placeholder="mis. 4.25"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-12 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                    KM
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Maksimal 500 KM (mendukung 2 angka desimal, mis. 4.25).
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600">Estimasi maks. transport/hari</span>
                <span className="font-bold font-mono text-emerald-700">
                  {formatRupiah(Math.round(roundedPreviewKm * transportRatePerKm))}
                </span>
              </div>

              {distanceValidationError && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{distanceValidationError}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={
                  Boolean(submittingAction) ||
                  !distanceForm.teacher_id ||
                  Boolean(distanceValidationError)
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'UPDATE_TEACHER_DISTANCE' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan Jarak Guru</span>
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Jarak Rumah Guru ({filteredDistanceTeachers.length})
              </h2>
              {canManage && (
                <p className="text-[11px] text-slate-500">
                  Klik kartu guru untuk memilih dan mengubah jaraknya dengan cepat.
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'all', label: 'Semua' },
                  { key: 'configured', label: 'Sudah Diatur' },
                  { key: 'zero', label: '0 KM' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDistanceFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    distanceFilter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <label htmlFor="honor-distance-search" className="sr-only">
              Cari nama guru
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="honor-distance-search"
              type="search"
              value={distanceSearch}
              onChange={(e) => setDistanceSearch(e.target.value)}
              placeholder="Cari nama guru..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredDistanceTeachers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {teachers.length === 0
                  ? 'Belum ada data guru terdaftar.'
                  : 'Tidak ada guru yang sesuai dengan filter pencarian.'}
              </p>
              {(distanceSearch || distanceFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setDistanceSearch('');
                    setDistanceFilter('all');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto pr-0.5">
              {filteredDistanceTeachers.map((t) => {
                const km = Number(t.home_distance_km ?? 0);
                const isSelected = distanceForm.teacher_id === t.id;
                const cardContent = (
                  <>
                    <div className="min-w-0 text-left">
                      <p className="font-bold text-slate-900 break-words">{t.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Est. {formatRupiah(Math.round(km * transportRatePerKm))}/hari
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-lg font-mono font-semibold text-[11px] ${
                        km > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {km} KM
                    </span>
                  </>
                );

                if (!canManage) {
                  return (
                    <div
                      key={t.id}
                      className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      {cardContent}
                    </div>
                  );
                }

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setDistanceForm({
                        teacher_id: t.id,
                        home_distance_km: String(Number(t.home_distance_km ?? 0)),
                      })
                    }
                    className={`modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs transition w-full cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40'
                        : 'hover:border-emerald-300 hover:bg-slate-50/80'
                    }`}
                  >
                    {cardContent}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
