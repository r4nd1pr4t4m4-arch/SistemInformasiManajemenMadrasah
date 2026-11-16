'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Coins, Loader2, Settings2 } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { AdditionalDutyType } from '@/types/database';

interface TeacherOption {
  id: string;
  full_name: string;
}

interface HonorariumRow {
  id: string;
  period_month: number;
  period_year: number;
  total_jtm: number;
  jtm_honorarium_amount: number;
  additional_duty_allowance: number;
  total_amount: number;
  status: string;
  teacher?: { full_name: string } | null;
}

export default function HonorariumPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [ratePerJtm, setRatePerJtm] = useState(25000);
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

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-700" /> Atur Tarif per JTM
            </h1>
            <div className="flex gap-2">
              <input
                type="number"
                value={ratePerJtm}
                onChange={(e) => setRatePerJtm(Number(e.target.value) || 0)}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  callHonorApi(
                    'PATCH',
                    { action: 'UPDATE_RATE', rate_per_jtm: ratePerJtm },
                    'Tarif per JTM diperbarui.'
                  )
                }
                className="bg-emerald-600 text-white font-semibold px-4 rounded-xl text-xs"
              >
                Simpan Tarif
              </button>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
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

          <div className="glass-card rounded-3xl p-6 space-y-3">
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
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Master Tunjangan Tugas Tambahan (Dapat Diatur Admin)
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
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
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
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
                      ({formatRupiah(Number(h.additional_duty_allowance))})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatRupiah(Number(h.total_amount))}
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
