'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Coins, Download, Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';
import {
  MONTH_OPTIONS,
  type CallHonorApiFn,
  type HonorariumRow,
  type ShowToastFn,
  type TeacherOption,
} from './types';

interface RekapSectionProps {
  canManage: boolean;
  teachers: TeacherOption[];
  honorariums: HonorariumRow[];
  ratePerJtm: number;
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  onOpenSlip: (slip: HonorariumSlipData) => void;
  callHonorApi: CallHonorApiFn;
  showToast: ShowToastFn;
}

export function RekapSection({
  canManage,
  teachers,
  honorariums,
  ratePerJtm,
  refreshing,
  submittingAction,
  onRefresh,
  onOpenSlip,
  callHonorApi,
  showToast,
}: RekapSectionProps) {
  const [genForm, setGenForm] = useState(() => {
    const now = new Date();
    return {
      teacher_id: '',
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
    };
  });
  const [rekapSearch, setRekapSearch] = useState('');
  const [rekapStatusFilter, setRekapStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'PAID'>(
    'ALL'
  );

  const filteredHonorariums = useMemo(() => {
    const q = rekapSearch.trim().toLowerCase();
    return honorariums.filter((h) => {
      if (rekapStatusFilter !== 'ALL' && h.status !== rekapStatusFilter) return false;
      if (q) {
        const name = (h.teacher?.full_name || '').toLowerCase();
        const periodStr = `${h.period_month}/${h.period_year}`;
        if (!name.includes(q) && !periodStr.includes(q)) return false;
      }
      return true;
    });
  }, [honorariums, rekapSearch, rekapStatusFilter]);

  const rekapSummary = useMemo(() => {
    let totalNominal = 0;
    let paidCount = 0;
    for (const h of honorariums) {
      totalNominal += Number(h.total_amount ?? 0);
      if (h.status === 'PAID') paidCount += 1;
    }
    return { totalNominal, paidCount };
  }, [honorariums]);

  async function handleGenerateHonorarium(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!genForm.teacher_id) {
      showToast('Pilih guru terlebih dahulu.', 'error');
      return;
    }
    if (
      !Number.isInteger(genForm.period_month) ||
      genForm.period_month < 1 ||
      genForm.period_month > 12
    ) {
      showToast('Bulan periode harus antara 1 sampai 12.', 'error');
      return;
    }
    if (
      !Number.isInteger(genForm.period_year) ||
      genForm.period_year < 2020 ||
      genForm.period_year > 2100
    ) {
      showToast('Tahun periode harus antara 2020 sampai 2100.', 'error');
      return;
    }
    await callHonorApi(
      'POST',
      { action: 'GENERATE_HONORARIUM', ...genForm },
      'Honorarium guru berhasil dihitung dari JTM & tunjangan.'
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Rekap &amp; Slip Honorarium Guru</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Hitung honorarium bulanan dari akumulasi JTM, tunjangan tugas tambahan, dan tunjangan
            transport, lalu cetak atau ubah status pembayaran slip.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Total: </span>
            <span className="font-bold font-mono text-emerald-800">
              {formatRupiah(rekapSummary.totalNominal)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px]">
            <span className="text-slate-500">Lunas (PAID): </span>
            <span className="font-bold text-slate-800">
              {rekapSummary.paidCount}/{honorariums.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang rekap honorarium dari server"
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
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Generate Honorarium Bulanan</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Jika slip periode yang sama sudah ada, sistem akan menghitung ulang dan memperbarui
                nominalnya.
              </p>
            </div>

            <form onSubmit={handleGenerateHonorarium} className="space-y-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="honor-gen-teacher"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Nama Guru
                </label>
                <select
                  id="honor-gen-teacher"
                  required
                  disabled={submittingAction === 'GENERATE_HONORARIUM'}
                  value={genForm.teacher_id}
                  onChange={(e) => setGenForm({ ...genForm, teacher_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="honor-gen-month"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Bulan Periode
                  </label>
                  <select
                    id="honor-gen-month"
                    disabled={submittingAction === 'GENERATE_HONORARIUM'}
                    value={genForm.period_month}
                    onChange={(e) =>
                      setGenForm({ ...genForm, period_month: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="honor-gen-year"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Tahun Periode
                  </label>
                  <input
                    id="honor-gen-year"
                    type="number"
                    min={2020}
                    max={2100}
                    required
                    disabled={submittingAction === 'GENERATE_HONORARIUM'}
                    value={genForm.period_year}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGenForm({
                        ...genForm,
                        period_year: Number.isFinite(val) ? val : 2026,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={Boolean(submittingAction) || !genForm.teacher_id}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'GENERATE_HONORARIUM' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Coins className="w-3.5 h-3.5" />
                )}
                <span>Hitung &amp; Simpan Slip Honorarium</span>
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Rekap Honorarium Guru ({filteredHonorariums.length})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'DRAFT', label: 'DRAFT' },
                  { key: 'APPROVED', label: 'APPROVED' },
                  { key: 'PAID', label: 'PAID' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRekapStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    rekapStatusFilter === tab.key
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
            <label htmlFor="honor-rekap-search" className="sr-only">
              Cari nama guru atau periode
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="honor-rekap-search"
              type="search"
              value={rekapSearch}
              onChange={(e) => setRekapSearch(e.target.value)}
              placeholder="Cari nama guru atau periode (mis. 11/2026)..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredHonorariums.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {honorariums.length === 0
                  ? 'Belum ada slip honorarium yang di-generate.'
                  : 'Tidak ada data honorarium yang cocok dengan filter.'}
              </p>
              {(rekapSearch || rekapStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setRekapSearch('');
                    setRekapStatusFilter('ALL');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[34rem] overflow-y-auto pr-0.5">
              {filteredHonorariums.map((h) => {
                const monthName =
                  MONTH_OPTIONS.find((m) => m.value === h.period_month)?.label ||
                  String(h.period_month);
                const statusBadgeClass =
                  h.status === 'PAID'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : h.status === 'APPROVED'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div
                    key={h.id}
                    className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {h.teacher?.full_name || 'GTK'}{' '}
                        <span className="font-medium text-slate-500">
                          ({monthName} {h.period_year})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {h.total_jtm} JTM ({formatRupiah(Number(h.jtm_honorarium_amount))}) +
                        Tunjangan ({formatRupiah(Number(h.additional_duty_allowance))}) + Transport
                        ({formatRupiah(Number(h.transport_allowance ?? 0))})
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap shrink-0">
                      <span className="font-bold font-mono text-emerald-700 text-sm">
                        {formatRupiah(Number(h.total_amount))}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSlip({
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                          title="Lihat & Unduh Slip PNG / PDF"
                        >
                          <Download className="w-3 h-3" /> Slip
                        </button>
                        {canManage ? (
                          <select
                            aria-label={`Status honorarium ${h.teacher?.full_name || 'GTK'}`}
                            disabled={Boolean(submittingAction)}
                            value={h.status}
                            onChange={(e) =>
                              void callHonorApi(
                                'PATCH',
                                {
                                  action: 'UPDATE_STATUS',
                                  honorarium_id: h.id,
                                  status: e.target.value,
                                },
                                'Status honorarium diperbarui.'
                              )
                            }
                            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-60 ${statusBadgeClass}`}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="APPROVED">APPROVED</option>
                            <option value="PAID">PAID</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusBadgeClass}`}
                          >
                            {h.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
