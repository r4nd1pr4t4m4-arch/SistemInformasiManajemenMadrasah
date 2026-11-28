'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  CreditCard,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  PiggyBank,
  Receipt,
  ShieldAlert,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type { AppRole } from '@/types/database';
import { formatEnum, formatRupiah, type DashboardPayload } from './types';

export function DashboardExecutiveSection({
  exec,
  hasRole,
}: {
  exec: NonNullable<DashboardPayload['executiveSummary']>;
  hasRole: (roles: AppRole[]) => boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-emerald-700" />
        Ringkasan Operasional Lembaga, Akademik &amp; Administrasi
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <Link
          href="/portal/sdm/siswa"
          className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
        >
          <p className="text-[11px] font-semibold text-slate-500">Siswa Aktif</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {exec.activeStudentsCount}
          </p>
        </Link>
        <Link
          href="/portal/sdm/gtk"
          className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
        >
          <p className="text-[11px] font-semibold text-slate-500">GTK Aktif</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {exec.activeTeachersCount}
          </p>
        </Link>
        <Link
          href="/portal/akademik/kelas-jadwal/rombel"
          className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
        >
          <p className="text-[11px] font-semibold text-slate-500">Rombongan Belajar</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{exec.classroomsCount}</p>
        </Link>
        <Link
          href="/portal/akademik/kelas-jadwal/mapel"
          className="glass-card rounded-2xl p-4 hover:border-emerald-300 transition"
        >
          <p className="text-[11px] font-semibold text-slate-500">Mata Pelajaran</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{exec.subjectsCount}</p>
        </Link>
        <Link
          href="/portal/akademik/presensi/konfirmasi"
          className="glass-card rounded-2xl p-4 border border-amber-200/70 bg-amber-50/40 hover:border-amber-300 transition"
        >
          <p className="text-[11px] font-semibold text-amber-800">Presensi Hari Ini</p>
          <p className="text-2xl font-extrabold text-amber-800 mt-1">
            {exec.todayAttendanceTotal}
          </p>
          <p className="text-[10px] text-amber-700">
            {exec.todayAttendanceUnconfirmed} menunggu konfirmasi
          </p>
        </Link>
        {hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU']) && (
          <Link
            href="/portal/akun/manajemen-pengguna"
            className="glass-card rounded-2xl p-4 border border-emerald-200/70 bg-emerald-50/40 hover:border-emerald-300 transition"
          >
            <p className="text-[11px] font-semibold text-emerald-800">Persetujuan Akun</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">
              {exec.pendingAccountsCount}
            </p>
            <p className="text-[10px] text-emerald-700">Pendaftar akun baru</p>
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pantauan Kehadiran Guru Hari Ini
              </h3>
              <p className="text-xs text-slate-500">
                Rekap presensi GPS &amp; status konfirmasi kehadiran GTK hari ini
              </p>
            </div>
            <Link
              href="/portal/akademik/presensi/konfirmasi"
              className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
            >
              Konfirmasi Presensi <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {exec.recentTodayAttendances.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs text-slate-500">
              Belum ada catatan presensi guru yang masuk pada hari ini.
            </div>
          ) : (
            <div className="space-y-2">
              {exec.recentTodayAttendances.map((att) => (
                <div
                  key={att.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 break-words">
                      {att.teacher?.full_name || 'Guru'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatEnum(att.attendance_type, 'Presensi')} • Masuk:{' '}
                      {att.check_in_time?.slice(0, 5) || '-'} • Pulang:{' '}
                      {att.check_out_time?.slice(0, 5) || '-'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                      att.admin_confirmed
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {att.admin_confirmed ? 'Terkonfirmasi' : 'Menunggu'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Statistik Penerimaan Siswa Baru (PPDB)
              </h3>
              <p className="text-xs text-slate-500">
                Progres pendaftaran dan verifikasi berkas calon peserta didik
              </p>
            </div>
            <Link
              href="/portal/cms/ppdb"
              className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
            >
              Verifikasi PPDB <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="modular-card rounded-2xl p-3">
              <p className="text-[11px] text-slate-500">Total</p>
              <p className="text-lg font-extrabold text-slate-900">{exec.ppdb.total}</p>
            </div>
            <div className="modular-card rounded-2xl p-3">
              <p className="text-[11px] text-amber-700">Menunggu</p>
              <p className="text-lg font-extrabold text-amber-700">
                {exec.ppdb.waitingVerification}
              </p>
            </div>
            <div className="modular-card rounded-2xl p-3">
              <p className="text-[11px] text-sky-700">Terverifikasi</p>
              <p className="text-lg font-extrabold text-sky-700">{exec.ppdb.verified}</p>
            </div>
            <div className="modular-card rounded-2xl p-3">
              <p className="text-[11px] text-emerald-700">Lulus</p>
              <p className="text-lg font-extrabold text-emerald-700">{exec.ppdb.accepted}</p>
            </div>
          </div>

          {exec.ppdb.recentRegistrations.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500">
              Belum ada pendaftar PPDB terbaru.
            </div>
          ) : (
            <div className="space-y-2">
              {exec.ppdb.recentRegistrations.slice(0, 3).map((reg) => (
                <div
                  key={reg.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between gap-2.5 text-xs min-w-0"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{reg.full_name}</p>
                    <p className="text-[11px] text-slate-500">Jalur: {reg.pathway || 'UMUM'}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px] shrink-0">
                    {formatEnum(reg.status, 'BARU')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {hasRole([
          'SUPERADMIN',
          'OPERATOR',
          'KEPALA_LEMBAGA',
          'WAKA_SARPRAS',
          'KEPALA_TU',
          'STAF_TU',
        ]) && (
          <div className="lg:col-span-6 glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
            <div className="flex flex-wrap items-start sm:items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 break-words">
                  Kondisi Sarana &amp; Prasarana
                </h3>
                <p className="text-xs text-slate-500 break-words">
                  Total {exec.facilities.totalItems} item inventaris ({exec.facilities.totalUnits}{' '}
                  unit)
                </p>
              </div>
              <Link
                href="/portal/cms/sarana-prasarana"
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Kelola Sarpras <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs min-w-0">
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3 sm:p-3.5 min-w-0">
                <p className="text-emerald-800 font-medium break-words">Kondisi Baik</p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-900 mt-0.5 tabular-nums">
                  {exec.facilities.goodConditionCount} Item
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-3 sm:p-3.5 min-w-0">
                <p className="text-rose-800 font-medium break-words">Perlu Perbaikan / Rusak</p>
                <p className="text-lg sm:text-xl font-extrabold text-rose-900 mt-0.5 tabular-nums">
                  {exec.facilities.needsAttentionCount} Item
                </p>
              </div>
            </div>

            {exec.facilities.damagedList.length > 0 && (
              <div className="space-y-1.5 min-w-0">
                {exec.facilities.damagedList.map((f) => (
                  <div
                    key={f.id}
                    className="modular-card rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="font-semibold text-slate-800 min-w-0 flex-1 break-words">
                      {f.name} ({f.quantity} unit)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold text-[11px] shrink-0">
                      {formatEnum(f.condition, 'Baik')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasRole(['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'KEPALA_TU', 'STAF_TU']) && (
          <div className="lg:col-span-6 glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
            <div className="flex flex-wrap items-start sm:items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 break-words">
                  Arsip Persuratan Tata Usaha Terbaru
                </h3>
                <p className="text-xs text-slate-500 break-words">
                  Rekam surat masuk &amp; surat keluar terakhir
                </p>
              </div>
              <Link
                href="/portal/layanan/persuratan"
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Buka Persuratan <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </Link>
            </div>

            {exec.recentLetters.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                Belum ada arsip surat yang tercatat.
              </div>
            ) : (
              <div className="space-y-2 min-w-0">
                {exec.recentLetters.map((l) => (
                  <div
                    key={l.id}
                    className="modular-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 text-xs min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-bold text-emerald-700 truncate">
                        {l.letter_number} • {l.direction}
                      </p>
                      <p className="font-bold text-slate-900 truncate">{l.subject}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                      {l.letter_date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function DashboardFinanceSection({
  finance,
  showSppCard,
  showTabunganCard,
  showHonorariumCard,
  visibleFinanceCardsCount,
  isGuruOnlyDashboard,
  hasBendaharaKomiteDuty,
  hasPengelolaTabunganDuty,
}: {
  finance: NonNullable<DashboardPayload['financeSummary']>;
  showSppCard: boolean;
  showTabunganCard: boolean;
  showHonorariumCard: boolean;
  visibleFinanceCardsCount: number;
  isGuruOnlyDashboard: boolean;
  hasBendaharaKomiteDuty: boolean;
  hasPengelolaTabunganDuty: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 min-w-0">
          <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Informasi Keuangan Sesuai Wewenang &amp; Tugas Tambahan Anda</span>
        </h2>
        {isGuruOnlyDashboard && (
          <div className="flex flex-wrap items-center gap-1.5">
            {hasBendaharaKomiteDuty && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                Bendahara Komite
              </span>
            )}
            {hasPengelolaTabunganDuty && (
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold">
                Pengelola Tabungan
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className={`grid gap-5 ${
          visibleFinanceCardsCount === 1
            ? 'grid-cols-1'
            : visibleFinanceCardsCount === 2
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-3'
        }`}
      >
        {showSppCard && finance.spp && (
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    SPP &amp; Iuran Komite
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {finance.spp.paidBillsCount} Lunas • {finance.spp.unpaidBillsCount} Belum Lunas
                  </p>
                </div>
              </div>
              <Link
                href="/portal/keuangan/spp/pembayaran"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Detail →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="modular-card rounded-2xl p-3">
                <p className="text-[11px] text-slate-500">Total Tagihan</p>
                <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {formatRupiah(finance.spp.totalBilledAmount)}
                </p>
              </div>
              <div className="modular-card rounded-2xl p-3">
                <p className="text-[11px] text-emerald-700">Total Terbayar</p>
                <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                  {formatRupiah(finance.spp.totalPaidAmount)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase">
                Pembayaran Masuk Terbaru
              </p>
              {finance.spp.recentPayments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Belum ada transaksi pembayaran terbaru.
                </p>
              ) : (
                finance.spp.recentPayments.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="modular-card rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0 truncate pr-2">
                      <p className="font-bold text-slate-900 truncate">
                        {p.bill?.student?.full_name || p.receipt_number}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {p.bill?.fee_type?.name || 'SPP'} • {p.payment_method}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-700 shrink-0">
                      {formatRupiah(p.amount_paid)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showTabunganCard && finance.tabungan && (
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">Tabungan Digital</h3>
                  <p className="text-[11px] text-slate-500">
                    {finance.tabungan.activeAccountsCount} Rekening Aktif
                  </p>
                </div>
              </div>
              <Link
                href="/portal/keuangan/tabungan/transaksi"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Detail →
              </Link>
            </div>

            <div className="modular-card rounded-2xl p-3.5">
              <p className="text-[11px] text-slate-500">Total Saldo Tabungan Mengendap</p>
              <p className="text-xl font-extrabold text-teal-800 mt-0.5">
                {formatRupiah(finance.tabungan.totalBalance)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase">
                Mutasi Setor / Tarik Terbaru
              </p>
              {finance.tabungan.recentTransactions.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Belum ada mutasi tabungan terbaru.
                </p>
              ) : (
                finance.tabungan.recentTransactions.slice(0, 3).map((trx) => (
                  <div
                    key={trx.id}
                    className="modular-card rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0 truncate pr-2">
                      <p className="font-bold text-slate-900 truncate">
                        {trx.account?.owner_name || trx.account?.account_number}
                      </p>
                      <p className="text-[11px] text-slate-500">{trx.transaction_type}</p>
                    </div>
                    <span
                      className={`font-bold shrink-0 ${
                        trx.transaction_type === 'SETOR' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {trx.transaction_type === 'SETOR' ? '+' : '-'}
                      {formatRupiah(trx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showHonorariumCard && finance.honorarium && (
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Honorarium GTK</h3>
                  <p className="text-[11px] text-slate-500">
                    {finance.honorarium.currentMonthSlipsCount} Slip Periode Ini
                  </p>
                </div>
              </div>
              <Link
                href="/portal/keuangan/honorarium/rekap"
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Detail →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="modular-card rounded-2xl p-3">
                <p className="text-[11px] text-slate-500">Tarif / JTM</p>
                <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {formatRupiah(finance.honorarium.ratePerJtm)}
                </p>
              </div>
              <div className="modular-card rounded-2xl p-3">
                <p className="text-[11px] text-slate-500">Transport / KM</p>
                <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {formatRupiah(finance.honorarium.transportRatePerKm)}
                </p>
              </div>
            </div>

            <div className="modular-card rounded-2xl p-3.5 space-y-1 text-xs">
              <p className="text-[11px] text-slate-500">Total Honorarium Bulan Ini</p>
              <p className="text-lg font-extrabold text-slate-900">
                {formatRupiah(finance.honorarium.currentMonthTotalAmount)}
              </p>
              <p className="text-[11px] text-slate-600">
                Dibayar: {finance.honorarium.paidSlipsCount} slip • Draft/Approved:{' '}
                {finance.honorarium.draftOrApprovedCount} slip
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function DashboardServicesAndPersonalSection({
  bk,
  guruWali,
  studentPersonal,
  linkedChildren = [],
  selectedChildId = '',
  onSelectChild,
  library,
  libraryMember,
  alumni,
}: {
  bk: DashboardPayload['bkSummary'];
  guruWali: DashboardPayload['guruWaliSummary'];
  studentPersonal: DashboardPayload['studentProfile'];
  linkedChildren?: NonNullable<DashboardPayload['linkedChildren']>;
  selectedChildId?: string;
  onSelectChild?: (studentId: string) => void;
  library: DashboardPayload['librarySummary'];
  libraryMember: DashboardPayload['libraryMember'];
  alumni: DashboardPayload['alumniSummary'];
}) {
  return (
    <>
      {(bk || (guruWali && guruWali.mentoredStudentsCount > 0)) && (
        <section className="grid lg:grid-cols-12 gap-5">
          {bk && (
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Rekam Bimbingan Konseling (BK)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Konsultasi: {bk.konsultasiCount} • Prestasi: {bk.prestasiCount} • Pelanggaran:{' '}
                      {bk.pelanggaranCount}
                    </p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/bk"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Buka BK →
                </Link>
              </div>

              <div className="space-y-2">
                {bk.recentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {r.student?.full_name} — {r.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {r.record_type} • {r.incident_date}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold">
                      {r.points} Poin
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {guruWali && guruWali.mentoredStudentsCount > 0 && (
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Pendampingan Siswa Binaan (Guru Wali)
                    </h3>
                    <p className="text-xs text-slate-500">
                      {guruWali.mentoredStudentsCount} siswa binaan aktif
                    </p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/guru-wali"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Buka Guru Wali →
                </Link>
              </div>

              <div className="space-y-2">
                {guruWali.recentLogs.map((l) => (
                  <div key={l.id} className="modular-card rounded-xl p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-900">
                      {l.assignment?.student?.full_name} — {l.topic}
                    </p>
                    <p className="text-slate-600 line-clamp-2">{l.notes}</p>
                    <p className="text-[11px] text-slate-400">
                      Wali: {l.assignment?.teacher?.full_name} • {l.mentoring_date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {studentPersonal && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              Informasi Akademik, Dokumen &amp; Keuangan Siswa
            </h2>
            {linkedChildren.length > 1 && onSelectChild && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="dashboard-child-switcher"
                  className="text-xs font-semibold text-slate-600"
                >
                  Pilih Anak:
                </label>
                <select
                  id="dashboard-child-switcher"
                  value={selectedChildId || studentPersonal.student.id}
                  onChange={(e) => onSelectChild(e.target.value)}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {linkedChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.full_name} {child.nis ? `(${child.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Identitas &amp; Kelas</p>
              <p className="font-extrabold text-slate-900 text-base">
                {studentPersonal.student.full_name}
              </p>
              <p className="text-xs text-emerald-700 font-semibold">
                {studentPersonal.classroom
                  ? `Kelas ${studentPersonal.classroom.name}`
                  : 'Belum ditempatkan di Rombel'}
              </p>
              <p className="text-[11px] text-slate-500">
                NIS: {studentPersonal.student.nis || '-'} • NISN:{' '}
                {studentPersonal.student.nisn || '-'}
              </p>
            </div>

            <Link
              href="/portal/siswa/biodata-dokumen/dokumen"
              className="glass-card rounded-3xl p-5 space-y-1 hover:border-emerald-300 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Dokumen Resmi Siswa</span>
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {studentPersonal.documents.uploadedCount} Dokumen
              </p>
              <p className="text-[11px] text-emerald-700">
                {studentPersonal.documents.verifiedCount} Terverifikasi •{' '}
                {studentPersonal.documents.pendingCount} Menunggu
              </p>
            </Link>

            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Kehadiran Bulan Ini</p>
              <p className="text-2xl font-extrabold text-emerald-700">
                {studentPersonal.monthAttendance.hadir} Hari Hadir
              </p>
              <p className="text-[11px] text-slate-600">
                Sakit: {studentPersonal.monthAttendance.sakit} • Izin:{' '}
                {studentPersonal.monthAttendance.izin} • Alpa:{' '}
                {studentPersonal.monthAttendance.alpa}
              </p>
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Tagihan &amp; Tabungan Siswa</p>
              <p className="text-lg font-extrabold text-slate-900">
                Saldo: {formatRupiah(studentPersonal.savings?.balance || 0)}
              </p>
              <p className="text-[11px] text-rose-700 font-semibold">
                Tunggakan SPP/Komite: {formatRupiah(studentPersonal.bills.unpaidAmount)} (
                {studentPersonal.bills.unpaidCount} tagihan)
              </p>
            </div>
          </div>
        </section>
      )}

      {(library || alumni) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {library && (
            <div
              className={`${
                alumni ? 'lg:col-span-7' : 'lg:col-span-12'
              } glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden`}
            >
              <div className="flex flex-wrap items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                      Perpustakaan Digital (E-Library)
                    </h3>
                    <p className="text-xs text-slate-500 break-words">
                      {library.totalBookTitles} Judul Koleksi • {library.totalCopiesAvailable}{' '}
                      Eksemplar Tersedia • {library.activeLoansCount} Dipinjam
                    </p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/perpustakaan/katalog"
                  className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Buka E-Library <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                </Link>
              </div>

              {libraryMember && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CreditCard className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span className="break-words min-w-0">
                      Kartu Anggota E-Library Anda: <strong>{libraryMember.member_code}</strong> (
                      {libraryMember.member_type})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/15 text-emerald-100 text-[10px] font-semibold shrink-0">
                    Status: {libraryMember.status}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                {library.recentBooks.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{b.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {b.author} • {formatEnum(b.book_format)}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold shrink-0">
                      {b.available_copies}/{b.total_copies}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alumni && (
            <div
              className={`${
                library ? 'lg:col-span-5' : 'lg:col-span-12'
              } glass-card rounded-3xl p-4 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden`}
            >
              <div className="flex flex-wrap items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                      Sebaran Tracer Study Alumni
                    </h3>
                    <p className="text-xs text-slate-500">{alumni.totalTracers} Alumni Terdata</p>
                  </div>
                </div>
                <Link
                  href="/portal/layanan/alumni"
                  className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
                >
                  Detail →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs min-w-0">
                <div className="modular-card rounded-xl p-2.5 min-w-0">
                  <p className="text-[10px] text-slate-500 truncate">Kuliah</p>
                  <p className="font-extrabold text-slate-900 text-base">{alumni.kuliahCount}</p>
                </div>
                <div className="modular-card rounded-xl p-2.5 min-w-0">
                  <p className="text-[10px] text-slate-500 truncate">Bekerja</p>
                  <p className="font-extrabold text-slate-900 text-base">{alumni.bekerjaCount}</p>
                </div>
                <div className="modular-card rounded-xl p-2.5 min-w-0">
                  <p className="text-[10px] text-slate-500 truncate">Wirausaha</p>
                  <p className="font-extrabold text-slate-900 text-base">{alumni.wirausahaCount}</p>
                </div>
                <div className="modular-card rounded-xl p-2.5 min-w-0">
                  <p className="text-[10px] text-slate-500 truncate">Pesantren</p>
                  <p className="font-extrabold text-slate-900 text-base">{alumni.pesantrenCount}</p>
                </div>
              </div>

              <div className="space-y-2 min-w-0">
                {alumni.recentTracers.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="modular-card rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">
                        {a.full_name} ({a.graduation_year})
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {a.institution_or_company || '-'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px] shrink-0 max-w-[45%] truncate">
                      {formatEnum(a.current_activity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
