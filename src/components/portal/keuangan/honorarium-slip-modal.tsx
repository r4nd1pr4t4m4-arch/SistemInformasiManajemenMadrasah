'use client';

import { useState } from 'react';
import { Banknote, CheckCircle2, Download, FileText, Loader2, X } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import {
  downloadHonorariumSlipPdf,
  downloadHonorariumSlipPng,
  type HonorariumSlipData,
} from '@/lib/cards/honorarium-slip-png';
import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';

const MONTH_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function HonorariumSlipModal({
  slip,
  onClose,
}: {
  slip: HonorariumSlipData;
  onClose: () => void;
}) {
  const school = useInstitutionSettings();
  const [downloading, setDownloading] = useState<'png' | 'pdf' | null>(null);

  const periodLabel = `${MONTH_NAMES[slip.periodMonth] || slip.periodMonth} ${slip.periodYear}`;
  const refCode = `HON-${slip.periodYear}${String(slip.periodMonth).padStart(2, '0')}-${slip.id
    .slice(0, 6)
    .toUpperCase()}`;

  const jtmRows: Array<[string, number]> = [
    ['Mengajar Reguler', slip.teachingJtm],
    ['Guru Pengganti', slip.substituteJtm],
    ['Pengawas Ruang Ujian', slip.examSupervisorJtm],
    ['Panitia Ujian', slip.examCommitteeJtm],
    ['Piket Harian', slip.picketJtm],
    ['Acara & Kegiatan', slip.eventJtm],
    ['Upacara Bendera', slip.ceremonyJtm],
    ['Libur Nasional Berbayar', slip.paidHolidayJtm],
  ];

  async function handleDownload(fmt: 'png' | 'pdf') {
    setDownloading(fmt);
    try {
      const name = school.name || 'SIMMS — Administrasi Keuangan';
      if (fmt === 'png') {
        await downloadHonorariumSlipPng(slip, name);
      } else {
        await downloadHonorariumSlipPdf(slip, name);
      }
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 text-white relative bg-gradient-to-br from-slate-900 to-emerald-800">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">
            {school.name || 'Administrasi Keuangan'}
          </p>
          <h3 className="text-lg font-black mt-1 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-300" />
            Slip Honorarium GTK
          </h3>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              {periodLabel} • {slip.status}
            </span>
            <span className="font-mono text-[11px] text-white/85">{refCode}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Nama Penerima</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{slip.teacherName}</p>
              {slip.homeDistanceKm != null && (
                <p className="text-[11px] text-slate-500">Jarak Rumah: {slip.homeDistanceKm} KM</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Tarif / JTM</p>
              <p className="font-bold text-emerald-700 mt-0.5">
                {formatRupiah(Number(slip.ratePerJtm) || 0)}
              </p>
            </div>
          </div>

          {/* 8 JTM Breakdown */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Rincian Perolehan JTM
            </p>
            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {jtmRows.map(([label, val]) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                >
                  <span className={val > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    {label}
                  </span>
                  <div className="flex items-center gap-3 font-mono">
                    <span className={val > 0 ? 'text-slate-600' : 'text-slate-400'}>
                      {val} JTM
                    </span>
                    <span className={val > 0 ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {formatRupiah(val * (Number(slip.ratePerJtm) || 0))}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 font-bold text-slate-900">
                <span>Subtotal Honor JTM ({slip.totalJtm} JTM)</span>
                <span>{formatRupiah(Number(slip.jtmHonorariumAmount) || 0)}</span>
              </div>
            </div>
          </div>

          {/* Duties & Transport */}
          <div className="space-y-1.5">
            {slip.dutyItems && slip.dutyItems.length > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Tugas Tambahan Terdaftar
                </p>
                {slip.dutyItems.map((d, idx) => (
                  <div key={d.id || idx} className="flex justify-between text-[11px] text-slate-600">
                    <span>
                      • {d.duty_name}
                      {d.is_excluded ? ' (Tidak mendapat tunjangan)' : ''}
                    </span>
                    <span className="font-mono">
                      {d.is_excluded ? 'Rp 0' : formatRupiah(Number(d.allowance_amount) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Tunjangan Tugas Tambahan</span>
              <strong className="text-slate-900">
                {formatRupiah(Number(slip.additionalDutyAllowance) || 0)}
              </strong>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tunjangan Transportasi (Pembulatan)</span>
              <strong className="text-slate-900">
                {formatRupiah(Number(slip.transportAllowance) || 0)}
              </strong>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between">
            <span className="font-bold text-emerald-900">Total Honorarium Diterima</span>
            <span className="text-lg font-black text-emerald-700">
              {formatRupiah(Number(slip.totalAmount) || 0)}
            </span>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload('png')}
              disabled={downloading !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
            >
              {downloading === 'png' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Unduh PNG
            </button>
            <button
              type="button"
              onClick={() => handleDownload('pdf')}
              disabled={downloading !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
            >
              {downloading === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Unduh PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
