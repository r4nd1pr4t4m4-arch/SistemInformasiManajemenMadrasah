'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  DAY_NAMES,
  formatEnum,
  formatRupiah,
  type AdditionalDutyItem,
  type DashboardPayload,
} from './types';

export function DashboardHeroSection({
  data,
  todayFormatted,
  refreshing,
  onRefresh,
}: {
  data: DashboardPayload;
  todayFormatted: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const user = data.user;
  const teacher = data.teacherProfile;
  const additionalDuties = teacher?.additionalDuties || [];
  const homeroomClasses = teacher?.homeroomClassrooms || [];
  const teaching = data.teachingSummary;

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-8 space-y-5 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2.5 max-w-3xl min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                Peran:{' '}
                {(user?.roles || []).length > 0
                  ? (user?.roles || []).map((r) => formatEnum(r)).join(' • ')
                  : 'Pengguna'}
              </span>
            </span>
            {data.academicYear && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                TA {data.academicYear.name} ({data.academicYear.semester})
              </span>
            )}
            {todayFormatted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {todayFormatted}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Assalamu&apos;alaikum, {user?.fullName || 'Pengguna'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pusat kendali dan informasi real-time yang disesuaikan secara otomatis dengan peran utama
            serta penugasan/tugas tambahan aktif Anda di lembaga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Segarkan Data
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-emerald-700 transition shadow-xs"
          >
            Website Resmi <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {data.todayCalendarEvent && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Kalender Pendidikan Hari Ini: {data.todayCalendarEvent.title}
              </p>
              <p className="text-[11px] text-emerald-800">
                Kategori: <strong>{formatEnum(data.todayCalendarEvent.category, 'Umum')}</strong>
                {data.todayCalendarEvent.description
                  ? ` — ${data.todayCalendarEvent.description}`
                  : ''}
              </p>
            </div>
          </div>
          <Link
            href="/portal/akademik/kalender/agenda"
            className="text-xs font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
          >
            Lihat Kalender <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {teacher && (
        <div className="pt-4 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-700" />
              Status GTK &amp; Tugas Tambahan:
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              {teacher.staff_type} {teacher.employment_status ? `(${teacher.employment_status})` : ''}
            </span>
            {homeroomClasses.map((cls) => (
              <span
                key={cls.id}
                className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold"
              >
                Wali Kelas {cls.name}
              </span>
            ))}
            {teaching?.isPicketToday && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                Guru Piket Hari Ini ({DAY_NAMES[data.todayDayOfWeek]})
              </span>
            )}
            {additionalDuties.map((duty) => (
              <span
                key={duty.id}
                className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
                title={duty.decree_number ? `SK: ${duty.decree_number}` : undefined}
              >
                {duty.name}
                {duty.receives_allowance && duty.monthly_allowance > 0
                  ? ` (${formatRupiah(duty.monthly_allowance)}/bln)`
                  : ''}
              </span>
            ))}
            {additionalDuties.length === 0 && homeroomClasses.length === 0 && (
              <span className="text-xs text-slate-500 italic">
                Tidak ada SK tugas tambahan struktural aktif
              </span>
            )}
          </div>
          {teacher.nip && (
            <span className="text-[11px] font-mono text-slate-500">NIP: {teacher.nip}</span>
          )}
        </div>
      )}
    </section>
  );
}

export function DashboardTeachingSection({
  todayDayOfWeek,
  teaching,
  additionalDuties,
}: {
  todayDayOfWeek: number;
  teaching: NonNullable<DashboardPayload['teachingSummary']>;
  additionalDuties: AdditionalDutyItem[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Kinerja Mengajar, Presensi &amp; Tugas Tambahan Anda</span>
        </h2>
        <Link
          href="/portal/akademik/presensi/gps"
          className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Buka Presensi GPS <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Presensi Hari Ini</span>
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          {teaching.todayAttendances.length > 0 ? (
            <div>
              <p className="text-lg font-extrabold text-emerald-700">
                Sudah Check-In ({teaching.todayAttendances[0].check_in_time?.slice(0, 5) || 'Hadir'})
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {teaching.todayAttendances[0].check_out_time
                  ? `Check-Out: ${teaching.todayAttendances[0].check_out_time.slice(0, 5)}`
                  : 'Belum Check-Out Pulang'}{' '}
                •{' '}
                {teaching.todayAttendances[0].admin_confirmed
                  ? 'Terkonfirmasi Admin'
                  : 'Menunggu Konfirmasi'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-extrabold text-amber-700">Belum Presensi</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Lakukan check-in GPS saat tiba di lembaga
              </p>
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-sky-600">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Akumulasi JTM Bulan Ini</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {teaching.monthJtmBreakdown.total}{' '}
            <span className="text-xs font-semibold text-slate-500">JTM</span>
          </p>
          <p className="text-[11px] text-slate-600">
            KBM: {teaching.monthJtmBreakdown.teaching} • Piket: {teaching.monthJtmBreakdown.picket} •
            Ujian/Acara: {teaching.monthJtmBreakdown.exam + teaching.monthJtmBreakdown.event}
          </p>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-indigo-600">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Beban Jadwal Mingguan</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {teaching.totalWeeklyScheduledJtm}{' '}
            <span className="text-xs font-semibold text-slate-500">JTM / Minggu</span>
          </p>
          <p className="text-[11px] text-slate-600">
            {teaching.totalWeeklySchedules} sesi tatap muka • Hari ini:{' '}
            {teaching.todaySchedules.length} sesi
          </p>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-2 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Tunjangan &amp; Slip Bulan Ini</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-extrabold text-slate-900">
            {teaching.currentHonorarium
              ? formatRupiah(teaching.currentHonorarium.total_amount)
              : formatRupiah(
                  additionalDuties.reduce(
                    (s, d) => s + (d.receives_allowance ? d.monthly_allowance : 0),
                    0
                  )
                )}
          </p>
          <p className="text-[11px] text-slate-600">
            {teaching.currentHonorarium
              ? `Status Slip: ${teaching.currentHonorarium.status}`
              : `${additionalDuties.length} Tugas Tambahan Aktif`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                Jadwal Mengajar Anda Hari Ini ({DAY_NAMES[todayDayOfWeek] || '-'})
              </h3>
              <p className="text-xs text-slate-500">
                Status pengisian Jurnal Pembelajaran untuk setiap jam tatap muka hari ini
              </p>
            </div>
            <Link
              href="/portal/akademik/presensi/jurnal"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shrink-0"
            >
              Isi Jurnal KBM
            </Link>
          </div>

          {teaching.todaySchedules.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-6 text-center text-xs text-slate-500">
              Anda tidak memiliki jadwal mengajar tatap muka pada hari{' '}
              {DAY_NAMES[todayDayOfWeek]}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {teaching.todaySchedules.map((sch) => (
                <div
                  key={sch.id}
                  className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        {String(sch.start_time).slice(0, 5)} - {String(sch.end_time).slice(0, 5)}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {sch.subject?.name} ({sch.classroom?.name})
                      </span>
                    </div>
                    <p className="text-slate-500">
                      Kode Mapel: {sch.subject?.code} • Alokasi: {sch.jtm_count} JTM
                    </p>
                  </div>
                  {sch.journalSubmittedToday ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Jurnal Terisi
                    </span>
                  ) : (
                    <Link
                      href="/portal/akademik/presensi/jurnal"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold hover:bg-amber-100"
                    >
                      <Clock className="w-3.5 h-3.5" /> Belum Isi Jurnal
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Penugasan &amp; Tugas Tambahan Aktif
          </h3>

          {teaching.homeroomDetails.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                Kelas Perwalian Anda (Wali Kelas)
              </p>
              {teaching.homeroomDetails.map((hr) => (
                <div
                  key={hr.classroomId}
                  className="rounded-2xl bg-indigo-50/70 border border-indigo-200/80 p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 text-sm">
                      Kelas {hr.classroomName} (Tingkat {hr.gradeLevel})
                    </span>
                    <span className="font-semibold text-indigo-700">
                      {hr.studentsCount} Siswa
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center pt-1">
                    <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                      <p className="text-[10px] text-slate-500">Hadir</p>
                      <p className="font-bold text-emerald-700">{hr.todayPresent}</p>
                    </div>
                    <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                      <p className="text-[10px] text-slate-500">Sakit</p>
                      <p className="font-bold text-amber-700">{hr.todaySick}</p>
                    </div>
                    <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                      <p className="text-[10px] text-slate-500">Izin</p>
                      <p className="font-bold text-sky-700">{hr.todayPermit}</p>
                    </div>
                    <div className="rounded-xl bg-white p-1.5 border border-indigo-100">
                      <p className="text-[10px] text-slate-500">Alpa</p>
                      <p className="font-bold text-rose-700">{hr.todayAlpha}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {teaching.picketSchedules.length > 0 && (
            <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950">Jadwal Guru Piket</span>
                <Link
                  href="/portal/akademik/presensi/laporan-piket"
                  className="text-amber-800 font-semibold hover:underline"
                >
                  Laporan Piket →
                </Link>
              </div>
              <p className="text-amber-900">
                Hari Piket:{' '}
                <strong>
                  {teaching.picketSchedules.map((p) => DAY_NAMES[p.day_of_week]).join(', ')}
                </strong>
              </p>
            </div>
          )}

          {(teaching.upcomingExamSupervisions.length > 0 ||
            teaching.examCommittees.length > 0) && (
            <div className="rounded-2xl bg-sky-50/70 border border-sky-200/80 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-950">Penugasan Ujian Aktif</span>
                <Link
                  href="/portal/akademik/ujian/bap"
                  className="text-sky-800 font-semibold hover:underline"
                >
                  Buka Modul Ujian →
                </Link>
              </div>
              {teaching.examCommittees.map((c) => (
                <p key={c.id} className="text-sky-900">
                  • Panitia Ujian: <strong>{c.committee_role}</strong> ({c.jtm_allocated} JTM)
                </p>
              ))}
              {teaching.upcomingExamSupervisions.map((s) => (
                <p key={s.id} className="text-sky-900">
                  • Pengawas ({s.exam_date}): <strong>{s.session_name}</strong> —{' '}
                  {s.room?.room_name || 'Ruang Ujian'} ({s.jtm_allocated} JTM)
                </p>
              ))}
            </div>
          )}

          {additionalDuties.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                SK Tugas Tambahan Struktural
              </p>
              {additionalDuties.map((d) => (
                <div
                  key={d.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{d.name}</p>
                    <p className="text-[11px] text-slate-500">
                      No. SK: {d.decree_number || 'Terdaftar'}
                    </p>
                  </div>
                  {d.receives_allowance && (
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(d.monthly_allowance)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
