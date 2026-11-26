'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BarChart3, Clock, ShieldAlert, TrendingUp } from 'lucide-react';
import { formatRupiah, type DashboardPayload } from './types';

export function DashboardExecutiveChartsAndEws({
  exec,
  finance,
  ews,
}: {
  exec: DashboardPayload['executiveSummary'];
  finance: DashboardPayload['financeSummary'];
  ews: DashboardPayload['ewsSummary'];
}) {
  if (!exec && !finance && !ews) return null;

  const sppBilled = Number(finance?.spp?.totalBilledAmount || 0);
  const sppPaid = Number(finance?.spp?.totalPaidAmount || 0);
  const sppUnpaid = Math.max(0, sppBilled - sppPaid);
  const sppPct = sppBilled > 0 ? Math.min(100, Math.round((sppPaid / sppBilled) * 100)) : 0;

  const facTotal = Number(exec?.facilities.totalItems || 0);
  const facGood = Number(exec?.facilities.goodConditionCount || 0);
  const facGoodPct = facTotal > 0 ? Math.min(100, Math.round((facGood / facTotal) * 100)) : 0;

  const attTotal = Number(exec?.todayAttendanceTotal || 0);
  const attUnconfirmed = Number(exec?.todayAttendanceUnconfirmed || 0);
  const attConfirmed = Math.max(0, attTotal - attUnconfirmed);
  const attConfirmedPct = attTotal > 0 ? Math.round((attConfirmed / attTotal) * 100) : 0;

  const hasAlerts =
    (ews?.highAlphaStudents?.length || 0) > 0 ||
    (ews?.overdueDispositionsCount || 0) > 0 ||
    (ews?.pendingSppProofsCount || 0) > 0;

  return (
    <section className="space-y-4">
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Grafik Eksekutif Ringkas */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>Visualisasi Kinerja &amp; Serapan Lembaga</span>
              </h2>
              <p className="text-xs text-slate-500">
                Indikator real-time realisasi SPP, konfirmasi presensi, dan kesiapan sarpras.
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>

          <div className="space-y-4 text-xs">
            {/* Bar 1: Realisasi SPP */}
            {finance?.spp && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">
                    Realisasi Pembayaran SPP &amp; Komite
                  </span>
                  <span className="font-bold text-emerald-700">{sppPct}% Terbayar</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${sppPct}%` }}
                  />
                  <div
                    className="h-full bg-rose-300/80 transition-all"
                    style={{ width: `${100 - sppPct}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Masuk: {formatRupiah(sppPaid)}</span>
                  <span>Tunggakan: {formatRupiah(sppUnpaid)}</span>
                </div>
              </div>
            )}

            {/* Bar 2: Konfirmasi Presensi Hari Ini */}
            {exec && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">
                    Konfirmasi Presensi Guru Hari Ini
                  </span>
                  <span className="font-bold text-sky-700">
                    {attConfirmed}/{attTotal} ({attConfirmedPct}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{ width: `${attConfirmedPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bar 3: Kondisi Sarana Prasarana */}
            {exec && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">
                    Kesiapan Sarana &amp; Prasarana (Kondisi Baik)
                  </span>
                  <span className="font-bold text-indigo-700">
                    {facGood}/{facTotal} Item ({facGoodPct}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${facGoodPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Early Warning System (EWS) */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Early Warning System (EWS)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Peringatan dini yang memerlukan tindak lanjut segera.
              </p>
            </div>
          </div>

          {!hasAlerts ? (
            <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-4 text-xs text-emerald-900 font-medium">
              Semua indikator operasional dalam kondisi normal. Tidak ada peringatan dini aktif saat ini.
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {(ews?.pendingSppProofsCount || 0) > 0 && (
                <Link
                  href="/portal/keuangan/spp/verifikasi-bukti"
                  className="modular-card rounded-2xl p-3 flex items-center justify-between gap-2 border border-amber-200 bg-amber-50/60 hover:bg-amber-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-amber-950">
                        {ews?.pendingSppProofsCount} Bukti Transfer SPP Menunggu Verifikasi
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Segera tinjau konfirmasi pembayaran dari Orang Tua/Siswa.
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-amber-700 shrink-0" />
                </Link>
              )}

              {(ews?.overdueDispositionsCount || 0) > 0 && (
                <Link
                  href="/portal/layanan/persuratan"
                  className="modular-card rounded-2xl p-3 flex items-center justify-between gap-2 border border-rose-200 bg-rose-50/60 hover:bg-rose-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-rose-950">
                        {ews?.overdueDispositionsCount} Disposisi Surat Lewat Tenggat
                      </p>
                      <p className="text-[11px] text-rose-800">
                        Tindak lanjuti disposisi yang melewati batas waktu.
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0" />
                </Link>
              )}

              {(ews?.highAlphaStudents?.length || 0) > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Siswa Rawan Alpa Bulan Ini (≥3 Hari)
                    </p>
                    <Link
                      href="/portal/akademik/rekap-absensi/siswa-harian"
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Detail →
                    </Link>
                  </div>
                  <div className="space-y-1">
                    {ews?.highAlphaStudents.slice(0, 4).map((st) => (
                      <div
                        key={st.studentId}
                        className="flex items-center justify-between gap-2 text-[11px] py-1 border-t border-slate-100 first:border-t-0"
                      >
                        <span className="font-semibold text-slate-800 truncate">{st.fullName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold shrink-0">
                          {st.alpaCount} Alpa
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
