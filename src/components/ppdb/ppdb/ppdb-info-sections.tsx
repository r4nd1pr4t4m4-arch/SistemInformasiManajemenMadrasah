'use client';

import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  type PathwayDefinition,
  type PathwayQuotas,
  type PpdbPathwayCode,
} from '@/lib/ppdb/pathways';
import {
  PpdbRegistrationCard,
  type RegistrationCardData,
} from '@/components/ppdb/registration-card';
import {
  formatPeriodDate,
  type ActivePeriod,
  type AnnouncementPeriodInfo,
  type PpdbTab,
} from './types';

interface PpdbPeriodBannerProps {
  loadingPeriod: boolean;
  periodError: string | null;
  activePeriod: ActivePeriod | null;
  announcementPeriod: AnnouncementPeriodInfo | null;
  activeTab: PpdbTab;
  onRetry: () => void;
  onOpenCheckStatus?: () => void;
}

export function PpdbPeriodBanner({
  loadingPeriod,
  periodError,
  activePeriod,
  announcementPeriod,
  activeTab,
  onRetry,
  onOpenCheckStatus,
}: PpdbPeriodBannerProps) {
  return (
    <>
      {loadingPeriod && (
        <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600 print:hidden">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
          <span>Memeriksa jadwal periode pendaftaran PPDB aktif...</span>
        </div>
      )}

      {!loadingPeriod && periodError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{periodError}</span>
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {!loadingPeriod && !periodError && announcementPeriod?.is_announcement_open && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <Megaphone className="w-4 h-4 text-sky-700 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-sky-950">
                Pengumuman Hasil Seleksi {announcementPeriod.name} Sudah Dibuka!
              </p>
              <p className="text-sky-800 mt-0.5">
                {announcementPeriod.announcement_date
                  ? `Tanggal Pengumuman: ${formatPeriodDate(announcementPeriod.announcement_date)}. `
                  : ''}
                Silakan cek status kelulusan Anda menggunakan Nomor Pendaftaran.
              </p>
            </div>
          </div>
          {activeTab !== 'cek' && onOpenCheckStatus && (
            <button
              type="button"
              onClick={onOpenCheckStatus}
              className="min-h-[38px] px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold transition shrink-0"
            >
              Cek Hasil Pengumuman
            </button>
          )}
        </div>
      )}

      {!loadingPeriod && !periodError && activePeriod && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-emerald-900 print:hidden">
          <span className="font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Periode Aktif: {activePeriod.name}</span>
          </span>
          <span className="font-medium text-emerald-800 sm:text-right">
            {formatPeriodDate(activePeriod.open_date)} s/d{' '}
            {formatPeriodDate(activePeriod.close_date)}
            {activePeriod.announcement_date
              ? ` • Pengumuman: ${formatPeriodDate(activePeriod.announcement_date)}`
              : ''}
          </span>
        </div>
      )}

      {!loadingPeriod && !periodError && !activePeriod && activeTab === 'daftar' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-900 text-xs flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="font-bold text-sm">
              Periode Pendaftaran PPDB Saat Ini Belum Dibuka / Sudah Ditutup
            </p>
            <p className="leading-relaxed">
              Saat ini belum ada periode PPDB yang aktif sehingga pengunggahan dokumen persyaratan
              dan pengiriman formulir dinonaktifkan sementara. Silakan hubungi panitia PPDB atau
              pantau halaman pengumuman untuk jadwal pembukaan berikutnya.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

interface PpdbPathwaySelectorProps {
  pathways: PathwayDefinition[];
  selectedPathway: PpdbPathwayCode | null;
  activePathwayDef: PathwayDefinition | null;
  quotas: PathwayQuotas;
  onSelectPathway: (code: PpdbPathwayCode) => void;
}

export function PpdbPathwaySelector({
  pathways,
  selectedPathway,
  activePathwayDef,
  quotas,
  onSelectPathway,
}: PpdbPathwaySelectorProps) {
  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
            selectedPathway ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-700 text-white'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold">
            1
          </span>
          <span>Pilih Jalur</span>
        </div>
        <div className="h-px flex-1 bg-slate-200" />
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
            selectedPathway ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span>Biodata &amp; Berkas</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles className="w-3.5 h-3.5" /> Langkah 1
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Pilih Jalur Pendaftaran Terlebih Dahulu
            </h2>
          </div>
          {selectedPathway && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Terpilih: {activePathwayDef?.title}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pathways.map((pw) => {
            const isSelected = selectedPathway === pw.code;
            const quota = quotas[pw.code];
            return (
              <button
                key={pw.code}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectPathway(pw.code)}
                className={`text-left rounded-3xl p-5 border-2 transition-all flex flex-col justify-between space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500/20'
                    : 'border-slate-200/80 bg-white/90 hover:border-emerald-300 hover:shadow-sm'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {pw.badge}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      Kuota: {quota}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{pw.title}</h3>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{pw.subtitle}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{pw.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                  <p className="font-bold text-slate-700 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Syarat Khusus:
                  </p>
                  {pw.specialDocs.length === 0 ? (
                    <p className="text-slate-500 italic">Tidak ada persyaratan khusus.</p>
                  ) : (
                    pw.specialDocs.map((d) => (
                      <p key={d.key} className="text-emerald-800 font-medium">
                        • {d.label}
                      </p>
                    ))
                  )}
                  <p className="text-slate-500 pt-1">
                    + Persyaratan Umum:{' '}
                    {pw.generalDocs.length > 0
                      ? pw.generalDocs.map((d) => d.label).join(', ')
                      : 'Tidak ada syarat umum'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

interface PpdbSubmittedViewProps {
  submittedCard: RegistrationCardData;
  uploadWarnings: string[];
  onReset: () => void;
}

export function PpdbSubmittedView({
  submittedCard,
  uploadWarnings,
  onReset,
}: PpdbSubmittedViewProps) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            <strong>Pendaftaran Berhasil!</strong> Simpan atau cetak Kartu Bukti Pendaftaran resmi
            Anda di bawah ini.
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100/60 transition shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Daftar Siswa Lain
        </button>
      </div>

      {uploadWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 print:hidden">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Data pendaftaran tersimpan, namun beberapa berkas gagal diunggah ke server:
            </p>
            <p>{uploadWarnings.join(', ')}</p>
            <p className="text-amber-800">
              Harap bawa fotokopi/berkas asli dokumen tersebut saat verifikasi di panitia PPDB.
            </p>
          </div>
        </div>
      )}

      <PpdbRegistrationCard data={submittedCard} />
    </div>
  );
}
