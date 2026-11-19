'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Coins, Download, Loader2, Settings2 } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { AdditionalDutyType } from '@/types/database';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { HonorariumSlipModal } from './honorarium-slip-modal';
import type { HonorariumDutyItem, HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';

interface TeacherOption {
  id: string;
  full_name: string;
  home_distance_km?: number;
}

interface HonorariumRow {
  id: string;
  period_month: number;
  period_year: number;
  teaching_jtm?: number;
  substitute_jtm?: number;
  exam_supervisor_jtm?: number;
  exam_committee_jtm?: number;
  event_jtm?: number;
  picket_jtm?: number;
  ceremony_jtm?: number;
  paid_holiday_jtm?: number;
  total_jtm: number;
  rate_per_jtm?: number;
  jtm_honorarium_amount: number;
  additional_duty_allowance: number;
  transport_allowance?: number;
  total_amount: number;
  status: string;
  teacher?: { full_name: string; nip?: string | null; home_distance_km?: number | null } | null;
  items?: HonorariumDutyItem[];
}

interface DailyHourRow {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
}

const DAY_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type HonorariumSection = 'tarif-jam' | 'jarak-guru' | 'tugas-tambahan' | 'rekap';

export function HonorariumWorkspace({ section }: { section: HonorariumSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.HONORARIUM_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [activeHonorSlip, setActiveHonorSlip] = useState<HonorariumSlipData | null>(null);
  const [ratePerJtm, setRatePerJtm] = useState(25000);
  const [transportRatePerKm, setTransportRatePerKm] = useState(2000);
  const [schoolStartTime, setSchoolStartTime] = useState('07:30');
  const [schoolEndTime, setSchoolEndTime] = useState('12:30');
  const [dailyHours, setDailyHours] = useState<DailyHourRow[]>([]);
  const [distanceForm, setDistanceForm] = useState({ teacher_id: '', home_distance_km: 0 });
  const [dutyTypes, setDutyTypes] = useState<AdditionalDutyType[]>([]);
  const [honorariums, setHonorariums] = useState<HonorariumRow[]>([]);

  const [assignDutyForm, setAssignDutyForm] = useState({ teacher_id: '', duty_type_id: '' });
  const [genForm, setGenForm] = useState({ teacher_id: '', period_month: 11, period_year: 2026 });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, honRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/keuangan/honorarium'),
      ]);
      const bi = await biRes.json();
      const hon = await honRes.json();
      setTeachers(bi.teachers || []);
      setRatePerJtm(hon.ratePerJtm ?? 25000);
      setTransportRatePerKm(hon.transportRatePerKm ?? 2000);
      setSchoolStartTime(hon.schoolStartTime || '07:30');
      setSchoolEndTime(hon.schoolEndTime || '12:30');
      setDailyHours(hon.dailyHours || []);
      setDutyTypes(hon.dutyTypes || []);
      setHonorariums(hon.honorariums || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function callHonorApi(method: 'POST' | 'PATCH', body: unknown, msg: string) {
    const res = await fetch('/api/keuangan/honorarium', {
      method,
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data honorarium guru...
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

      {section === 'tarif-jam' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-3xl p-6 space-y-3 h-fit">
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-700" /> Tarif JTM, Jam Sekolah &amp;
              Transport per KM
            </h1>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Tarif per JTM</label>
                <input
                  type="number"
                  value={ratePerJtm}
                  onChange={(e) => setRatePerJtm(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">
                  Tarif Transport / KM
                </label>
                <input
                  type="number"
                  value={transportRatePerKm}
                  onChange={(e) => setTransportRatePerKm(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">
                  Jam Masuk Sekolah
                </label>
                <input
                  type="time"
                  value={schoolStartTime}
                  onChange={(e) => setSchoolStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">
                  Jam Pulang Sekolah
                </label>
                <input
                  type="time"
                  value={schoolEndTime}
                  onChange={(e) => setSchoolEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  callHonorApi(
                    'PATCH',
                    {
                      action: 'UPDATE_RATE',
                      rate_per_jtm: ratePerJtm,
                      transport_rate_per_km: transportRatePerKm,
                      school_start_time: schoolStartTime,
                      school_end_time: schoolEndTime,
                    },
                    'Tarif JTM, jam sekolah & tarif transport diperbarui.'
                  )
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Pengaturan Tarif &amp; Jam Sekolah Default
              </button>
            )}
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Jam Sekolah Per Hari (Senin – Minggu)
            </h2>
            <p className="text-[11px] text-slate-500">
              Atur jam masuk &amp; jam pulang masing-masing hari untuk menghitung persentase durasi
              kehadiran tunjangan transportasi.
            </p>
            <div className="space-y-2">
              {dailyHours.map((dh) => (
                <div
                  key={dh.day_of_week}
                  className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <label className="inline-flex items-center gap-1.5 w-20 shrink-0 font-semibold text-slate-800">
                    <input
                      type="checkbox"
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
                      className="accent-emerald-600"
                    />
                    {DAY_LABELS[dh.day_of_week]}
                  </label>
                  <input
                    type="time"
                    disabled={!dh.is_active}
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
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono disabled:bg-slate-100"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    disabled={!dh.is_active}
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
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono disabled:bg-slate-100"
                  />
                </div>
              ))}
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  callHonorApi(
                    'PATCH',
                    { action: 'UPDATE_DAILY_HOURS', daily_hours: dailyHours },
                    'Jam sekolah per hari berhasil diperbarui.'
                  )
                }
                className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Jam Sekolah Per Hari
              </button>
            )}
          </div>
        </div>
      )}

      {section === 'jarak-guru' && (
          <div className="glass-card rounded-3xl p-6 space-y-4 max-w-3xl">
            <h2 className="text-sm font-bold text-slate-900">
              Jarak Rumah Guru ke Madrasah / Sekolah (KM)
            </h2>
            {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await callHonorApi(
                  'PATCH',
                  {
                    action: 'UPDATE_TEACHER_DISTANCE',
                    teacher_id: distanceForm.teacher_id,
                    home_distance_km: distanceForm.home_distance_km,
                  },
                  'Jarak rumah guru (KM) berhasil diperbarui.'
                );
              }}
              className="flex gap-2"
            >
              <select
                required
                value={distanceForm.teacher_id}
                onChange={(e) => {
                  const found = teachers.find((t) => t.id === e.target.value);
                  setDistanceForm({
                    teacher_id: e.target.value,
                    home_distance_km: Number(found?.home_distance_km ?? 0),
                  });
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.home_distance_km ?? 0} KM)
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min={0}
                max={500}
                value={distanceForm.home_distance_km}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDistanceForm({
                    ...distanceForm,
                    home_distance_km: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
                  });
                }}
                placeholder="KM (mis. 4.25)"
                className="w-28 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-emerald-700 text-white font-semibold px-3 rounded-xl text-xs shrink-0"
              >
                Simpan
              </button>
            </form>
            )}
            <div className="grid sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pt-2">
              {teachers.map((t) => (
                <div
                  key={t.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-900">{t.full_name}</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {t.home_distance_km ?? 0} KM
                  </span>
                </div>
              ))}
            </div>
          </div>
      )}

      {section === 'tugas-tambahan' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
            <h2 className="text-sm font-bold text-slate-900">Tugaskan Tugas Tambahan ke Guru</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await callHonorApi(
                  'POST',
                  { action: 'ASSIGN_DUTY', ...assignDutyForm },
                  'Tugas tambahan guru berhasil disimpan.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={assignDutyForm.teacher_id}
                onChange={(e) =>
                  setAssignDutyForm({ ...assignDutyForm, teacher_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <select
                required
                value={assignDutyForm.duty_type_id}
                onChange={(e) =>
                  setAssignDutyForm({ ...assignDutyForm, duty_type_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Tugas Tambahan --</option>
                {dutyTypes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{' '}
                    {d.receives_allowance
                      ? `(${formatRupiah(Number(d.monthly_allowance))}/bln)`
                      : '(Tanpa Tunjangan)'}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Tugaskan
              </button>
            </form>
          </div>
          )}

          <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
            <h2 className="text-base font-bold text-slate-900">
              Master Tunjangan Tugas Tambahan
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto">
              {dutyTypes.map((d) => (
                <div
                  key={d.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{d.name}</p>
                    {!d.receives_allowance && (
                      <span className="text-[10px] font-semibold text-rose-600">
                        Tanpa tunjangan honorarium
                      </span>
                    )}
                  </div>
                  {canManage ? (
                    <input
                      type="number"
                      disabled={!d.receives_allowance}
                      defaultValue={Number(d.monthly_allowance)}
                      onBlur={(e) => {
                        if (!d.receives_allowance) return;
                        const val = Number(e.target.value) || 0;
                        if (val !== Number(d.monthly_allowance)) {
                          callHonorApi(
                            'PATCH',
                            {
                              action: 'UPDATE_DUTY_ALLOWANCE',
                              duty_type_id: d.id,
                              monthly_allowance: val,
                            },
                            `Tunjangan ${d.name} diperbarui.`
                          );
                        }
                      }}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono disabled:bg-slate-100"
                    />
                  ) : (
                    <span className="font-mono font-bold text-emerald-700">
                      {formatRupiah(Number(d.monthly_allowance))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'rekap' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" /> Generate Honorarium Bulanan
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await callHonorApi(
                  'POST',
                  { action: 'GENERATE_HONORARIUM', ...genForm },
                  'Honorarium guru berhasil dihitung dari JTM & tunjangan.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={genForm.teacher_id}
                onChange={(e) => setGenForm({ ...genForm, teacher_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={genForm.period_month}
                  onChange={(e) => setGenForm({ ...genForm, period_month: Number(e.target.value) })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={genForm.period_year}
                  onChange={(e) => setGenForm({ ...genForm, period_year: Number(e.target.value) })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Hitung &amp; Simpan Slip Honorarium
              </button>
            </form>
          </div>
          )}

          <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
            <h2 className="text-base font-bold text-slate-900">
              Rekap Honorarium Guru ({honorariums.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {honorariums.map((h) => (
                <div
                  key={h.id}
                  className="modular-card rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {h.teacher?.full_name} ({h.period_month}/{h.period_year})
                    </p>
                    <p className="text-slate-500">
                      {h.total_jtm} JTM ({formatRupiah(Number(h.jtm_honorarium_amount))}) + Tunjangan
                      ({formatRupiah(Number(h.additional_duty_allowance))}) + Transport (
                      {formatRupiah(Number(h.transport_allowance ?? 0))})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatRupiah(Number(h.total_amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveHonorSlip({
                          id: h.id,
                          teacherName: h.teacher?.full_name || 'GTK',
                          teacherNip: h.teacher?.nip || null,
                          homeDistanceKm: h.teacher?.home_distance_km ?? null,
                          periodMonth: h.period_month,
                          periodYear: h.period_year,
                          teachingJtm: Number(h.teaching_jtm) || 0,
                          substituteJtm: Number(h.substitute_jtm) || 0,
                          examSupervisorJtm: Number(h.exam_supervisor_jtm) || 0,
                          examCommitteeJtm: Number(h.exam_committee_jtm) || 0,
                          eventJtm: Number(h.event_jtm) || 0,
                          picketJtm: Number(h.picket_jtm) || 0,
                          ceremonyJtm: Number(h.ceremony_jtm) || 0,
                          paidHolidayJtm: Number(h.paid_holiday_jtm) || 0,
                          totalJtm: Number(h.total_jtm) || 0,
                          ratePerJtm: Number(h.rate_per_jtm) || ratePerJtm,
                          jtmHonorariumAmount: Number(h.jtm_honorarium_amount) || 0,
                          additionalDutyAllowance: Number(h.additional_duty_allowance) || 0,
                          transportAllowance: Number(h.transport_allowance) || 0,
                          totalAmount: Number(h.total_amount) || 0,
                          status: h.status,
                          dutyItems: h.items || [],
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                      title="Lihat & Unduh Slip PNG / PDF"
                    >
                      <Download className="w-3 h-3" /> Slip
                    </button>
                    {canManage ? (
                      <select
                        value={h.status}
                        onChange={(e) =>
                          callHonorApi(
                            'PATCH',
                            {
                              action: 'UPDATE_STATUS',
                              honorarium_id: h.id,
                              status: e.target.value,
                            },
                            'Status honorarium diperbarui.'
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="PAID">PAID</option>
                      </select>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {h.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeHonorSlip && (
        <HonorariumSlipModal slip={activeHonorSlip} onClose={() => setActiveHonorSlip(null)} />
      )}
    </div>
  );
}
