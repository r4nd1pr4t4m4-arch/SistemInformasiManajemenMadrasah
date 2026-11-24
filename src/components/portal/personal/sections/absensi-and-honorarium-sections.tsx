'use client';

import { useState } from 'react';
import {
  Banknote,
  ClipboardCheck,
  Clock,
  Download,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { HonorariumDutyItem, HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';
import {
  PersonalEmptyState,
  PersonalStatCard,
  formatDateId,
  formatTimeShort,
  formatTimeValue,
  type PersonalPayload,
  type PersonalScope,
} from './types';

export function AbsensiSection({
  data,
  scope,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
}) {
  const [absensiStatusFilter, setAbsensiStatusFilter] = useState<
    'ALL' | 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'
  >('ALL');
  const [absensiSearch, setAbsensiSearch] = useState('');
  const [absensiVisibleCount, setAbsensiVisibleCount] = useState(20);

  if (scope === 'gtk') {
    if (!data.teacher) {
      return (
        <div className="space-y-5">
          <PersonalEmptyState
            icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
            title="Akun belum tertaut ke data GTK"
            description="Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha."
          />
        </div>
      );
    }

    const q = absensiSearch.trim().toLowerCase();
    const filteredGtkAtt = data.attendances.filter((a) => {
      if (!q) return true;
      const sched = a.schedule as {
        subject?: { name?: string | null } | null;
        classroom?: { name?: string | null } | null;
      } | null;
      const dateVal = a.attendance_date ? String(a.attendance_date) : null;
      const attType = String(a.attendance_type || '');
      const geoLabel = a.is_within_geofence ? 'di lokasi' : 'luar radius';
      const haystack = `${attType} ${attType.replace(/_/g, ' ')} ${
        sched?.subject?.name || ''
      } ${sched?.classroom?.name || ''} ${a.attendance_date || ''} ${formatDateId(
        dateVal
      )} ${geoLabel}`.toLowerCase();
      return haystack.includes(q);
    });
    const displayedGtkAtt = filteredGtkAtt.slice(0, absensiVisibleCount);
    const hasMoreGtkAtt = absensiVisibleCount < filteredGtkAtt.length;

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <PersonalStatCard
            label="Total Catatan Presensi"
            value={String(data.attendances.length)}
            tone="emerald"
          />
          <PersonalStatCard
            label="Total JTM Diperoleh"
            value={String(
              data.attendances.reduce(
                (acc, row) => acc + (Number(row.jtm_earned) || 0),
                0
              )
            )}
            tone="slate"
          />
          <div className="col-span-2 sm:col-span-1">
            <PersonalStatCard
              label="Dalam Radius Geofence"
              value={String(
                data.attendances.filter((row) => Boolean(row.is_within_geofence)).length
              )}
              tone="amber"
            />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Riwayat Presensi &amp; Perolehan JTM</span>
            </h2>
            {data.attendances.length > 0 && (
              <span className="text-[11px] font-medium text-slate-500">
                Menampilkan {displayedGtkAtt.length} dari {filteredGtkAtt.length} catatan
              </span>
            )}
          </div>

          {data.attendances.length > 0 && (
            <div className="relative min-w-0">
              <label htmlFor="gtk-absensi-search" className="sr-only">
                Cari riwayat presensi GTK
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="gtk-absensi-search"
                type="text"
                value={absensiSearch}
                onChange={(e) => {
                  setAbsensiSearch(e.target.value);
                  setAbsensiVisibleCount(20);
                }}
                placeholder="Cari tanggal, jenis presensi, mapel, atau kelas..."
                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {absensiSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAbsensiSearch('');
                    setAbsensiVisibleCount(20);
                  }}
                  aria-label="Hapus pencarian presensi"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {data.attendances.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Belum ada riwayat presensi GTK.
            </p>
          ) : filteredGtkAtt.length === 0 ? (
            <div className="py-8 text-center space-y-2.5">
              <p className="text-xs font-semibold text-slate-600">
                Tidak ada catatan presensi yang sesuai pencarian.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAbsensiSearch('');
                  setAbsensiVisibleCount(20);
                }}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Pencarian
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="space-y-2.5 md:hidden">
                {displayedGtkAtt.map((a) => {
                  const sched = a.schedule as {
                    subject?: { name?: string | null } | null;
                    classroom?: { name?: string | null } | null;
                  } | null;
                  const attType = String(a.attendance_type || '-').replace(/_/g, ' ');
                  const dateVal = a.attendance_date
                    ? String(a.attendance_date)
                    : null;
                  const dist =
                    typeof a.distance_meters === 'number'
                      ? `${Math.round(a.distance_meters)} m`
                      : null;
                  return (
                    <div
                      key={String(a.id)}
                      className="modular-card rounded-2xl p-3.5 space-y-2 text-xs min-w-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {formatDateId(dateVal)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            a.is_within_geofence
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {a.is_within_geofence ? 'Di Lokasi' : 'Luar Radius'}
                          {dist ? ` (${dist})` : ''}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 break-words">
                        {attType}
                        {sched?.subject?.name ? ` • ${sched.subject.name}` : ''}
                        {sched?.classroom?.name ? ` (${sched.classroom.name})` : ''}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
                        <span>
                          Masuk: <strong>{formatTimeValue(a.check_in_time)}</strong> •
                          Pulang: <strong>{formatTimeValue(a.check_out_time)}</strong>
                        </span>
                        <span className="font-bold text-emerald-700">
                          {Number(a.jtm_earned) || 0} JTM
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                      <th className="py-2.5 px-3">Jenis Presensi &amp; Sesi</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Masuk</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Pulang</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">JTM</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Geofence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedGtkAtt.map((a) => {
                      const sched = a.schedule as {
                        subject?: { name?: string | null } | null;
                        classroom?: { name?: string | null } | null;
                      } | null;
                      const attType = String(a.attendance_type || '-').replace(
                        /_/g,
                        ' '
                      );
                      const dateVal = a.attendance_date
                        ? String(a.attendance_date)
                        : null;
                      const dist =
                        typeof a.distance_meters === 'number'
                          ? ` (${Math.round(a.distance_meters)} m)`
                          : '';
                      return (
                        <tr key={String(a.id)} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap text-slate-700">
                            {formatDateId(dateVal)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 break-words">
                            <span className="font-semibold">{attType}</span>
                            {sched?.subject?.name && (
                              <span className="text-slate-500">
                                {' '}
                                • {sched.subject.name}
                                {sched.classroom?.name
                                  ? ` (${sched.classroom.name})`
                                  : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {formatTimeValue(a.check_in_time)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {formatTimeValue(a.check_out_time)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                            {Number(a.jtm_earned) || 0}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                a.is_within_geofence
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {a.is_within_geofence ? 'Di Lokasi' : 'Luar Radius'}
                              {dist}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasMoreGtkAtt && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setAbsensiVisibleCount((c) => c + 20)}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                  >
                    Muat Lebih Banyak (
                    {filteredGtkAtt.length - displayedGtkAtt.length} tersisa)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (scope === 'orang-tua' && !data.student) {
    return (
      <div className="space-y-5">
        <PersonalEmptyState
          icon={<ClipboardCheck className="w-8 h-8 text-slate-300" />}
          title="Belum ada data putra/putri terhubung"
          description="Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah."
        />
      </div>
    );
  }

  const q = absensiSearch.trim().toLowerCase();
  const filteredAttendances = data.attendances.filter((a) => {
    const status = String(a.status || '');
    if (absensiStatusFilter !== 'ALL' && status !== absensiStatusFilter) return false;
    if (q) {
      const sched = a.schedule as {
        start_time?: string | null;
        end_time?: string | null;
        subject?: { name?: string | null } | null;
      } | null;
      const cls = a.classroom as { name?: string | null } | null;
      const dateVal = a.attendance_date ? String(a.attendance_date) : null;
      const haystack = `${sched?.subject?.name || 'Absensi Harian Kelas'} ${
        cls?.name || ''
      } ${a.notes || ''} ${a.attendance_date || ''} ${formatDateId(dateVal)} ${status}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const displayedAttendances = filteredAttendances.slice(0, absensiVisibleCount);
  const hasMoreAttendances = absensiVisibleCount < filteredAttendances.length;
  const hasAbsensiFilter =
    absensiSearch.trim().length > 0 || absensiStatusFilter !== 'ALL';

  const hadirCount = data.attendances.filter((a) => a.status === 'HADIR').length;
  const attendanceRate =
    data.attendances.length > 0
      ? Math.round((hadirCount / data.attendances.length) * 100)
      : 0;

  const getStatusBadgeClass = (status: string) =>
    status === 'HADIR'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'ALPA'
        ? 'bg-rose-100 text-rose-800'
        : status === 'IZIN'
          ? 'bg-sky-100 text-sky-800'
          : 'bg-amber-100 text-amber-800';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        {(['HADIR', 'SAKIT', 'IZIN', 'ALPA'] as const).map((status) => (
          <PersonalStatCard
            key={status}
            label={status}
            value={String(
              data.attendances.filter((a) => a.status === status).length
            )}
            tone={
              status === 'HADIR'
                ? 'emerald'
                : status === 'ALPA'
                  ? 'rose'
                  : 'amber'
            }
          />
        ))}
      </div>

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Catatan Kehadiran</span>
            {data.attendances.length > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                {attendanceRate}% Hadir
              </span>
            )}
          </h2>
          {data.attendances.length > 0 && (
            <span className="text-[11px] font-medium text-slate-500">
              Menampilkan {displayedAttendances.length} dari {filteredAttendances.length} catatan
            </span>
          )}
        </div>

        {data.attendances.length > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="absensi-search-input" className="sr-only">
                Cari riwayat absensi
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="absensi-search-input"
                type="text"
                value={absensiSearch}
                onChange={(e) => {
                  setAbsensiSearch(e.target.value);
                  setAbsensiVisibleCount(20);
                }}
                placeholder="Cari mata pelajaran, tanggal, atau catatan..."
                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {absensiSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAbsensiSearch('');
                    setAbsensiVisibleCount(20);
                  }}
                  aria-label="Hapus pencarian absensi"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
              {(['ALL', 'HADIR', 'SAKIT', 'IZIN', 'ALPA'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={absensiStatusFilter === st}
                  onClick={() => {
                    setAbsensiStatusFilter(st);
                    setAbsensiVisibleCount(20);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${
                    absensiStatusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>
        )}

        {data.attendances.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Belum ada riwayat absensi tercatat.
          </p>
        ) : filteredAttendances.length === 0 ? (
          <div className="py-8 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-600">
              Tidak ada catatan absensi yang sesuai filter.
            </p>
            {hasAbsensiFilter && (
              <button
                type="button"
                onClick={() => {
                  setAbsensiSearch('');
                  setAbsensiStatusFilter('ALL');
                  setAbsensiVisibleCount(20);
                }}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="space-y-2.5 md:hidden">
              {displayedAttendances.map((a) => {
                const sched = a.schedule as {
                  start_time?: string | null;
                  end_time?: string | null;
                  subject?: { name?: string | null } | null;
                } | null;
                const cls = a.classroom as { name?: string | null } | null;
                const status = String(a.status || '-');
                const dateVal = a.attendance_date
                  ? String(a.attendance_date)
                  : null;
                return (
                  <div
                    key={String(a.id)}
                    className="modular-card rounded-2xl p-3.5 space-y-1.5 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {formatDateId(dateVal)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusBadgeClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 break-words">
                      {sched?.subject?.name
                        ? `Mapel: ${sched.subject.name}`
                        : 'Absensi Harian Kelas'}
                    </p>
                    {(sched?.start_time || cls?.name) && (
                      <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {sched?.start_time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {formatTimeShort(sched.start_time)}
                            {sched.end_time ? `–${formatTimeShort(sched.end_time)}` : ''}
                          </span>
                        )}
                        {cls?.name && <span>Kelas {cls.name}</span>}
                      </p>
                    )}
                    {Boolean(a.notes) && (
                      <p className="text-[11px] text-slate-500 break-words bg-slate-50 rounded-xl px-2.5 py-1.5">
                        Catatan: {String(a.notes)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3">Jenis / Mata Pelajaran</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Waktu / Kelas</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedAttendances.map((a) => {
                    const sched = a.schedule as {
                      start_time?: string | null;
                      end_time?: string | null;
                      subject?: { name?: string | null } | null;
                    } | null;
                    const cls = a.classroom as { name?: string | null } | null;
                    const status = String(a.status || '-');
                    const dateVal = a.attendance_date
                      ? String(a.attendance_date)
                      : null;
                    return (
                      <tr key={String(a.id)} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-medium whitespace-nowrap text-slate-700">
                          {formatDateId(dateVal)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium break-words">
                          {sched?.subject?.name
                            ? `Mapel: ${sched.subject.name}`
                            : 'Absensi Harian Kelas'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {sched?.start_time
                            ? `${formatTimeShort(sched.start_time)}${
                                sched.end_time ? `–${formatTimeShort(sched.end_time)}` : ''
                              }`
                            : cls?.name
                              ? `Kelas ${cls.name}`
                              : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[260px] break-words">
                          {a.notes ? String(a.notes) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMoreAttendances && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setAbsensiVisibleCount((c) => c + 20)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                >
                  Muat Lebih Banyak (
                  {filteredAttendances.length - displayedAttendances.length} tersisa)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const HONOR_MONTHS = [
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

export function HonorariumSection({
  data,
  onSelectHonorSlip,
}: {
  data: PersonalPayload;
  onSelectHonorSlip: (slip: HonorariumSlipData) => void;
}) {
  if (!data.teacher) {
    return (
      <PersonalEmptyState
        icon={<Banknote className="w-8 h-8 text-slate-300" />}
        title="Akun belum tertaut ke data GTK"
        description="Akun Anda belum ditautkan dengan data Guru/Tenaga Kependidikan. Silakan hubungi Operator atau Tata Usaha."
      />
    );
  }

  if (data.honorariums.length === 0) {
    return (
      <PersonalEmptyState
        icon={<Banknote className="w-8 h-8 text-slate-300" />}
        title="Belum ada slip honorarium"
        description="Slip honorarium bulanan akan muncul setelah Bendahara menerbitkan rekap honorarium."
      />
    );
  }

  const totalHonorReceived = data.honorariums.reduce(
    (sum, h) => sum + (Number(h.total_amount) || 0),
    0
  );
  const totalHonorJtm = data.honorariums.reduce(
    (sum, h) => sum + (Number(h.total_jtm) || 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <PersonalStatCard
          label="Total Slip Tersedia"
          value={`${data.honorariums.length} Periode`}
          tone="slate"
        />
        <PersonalStatCard
          label="Akumulasi JTM"
          value={`${totalHonorJtm} JTM`}
          tone="amber"
        />
        <div className="col-span-2 sm:col-span-1">
          <PersonalStatCard
            label="Total Honorarium"
            value={formatRupiah(totalHonorReceived)}
            tone="emerald"
          />
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          data.honorariums.length === 1
            ? 'grid-cols-1 max-w-xl'
            : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {data.honorariums.map((h) => {
          const mNum = Number(h.period_month) || 0;
          const monthLabel = HONOR_MONTHS[mNum] || String(h.period_month || '-');
          const statusStr = String(h.status || 'DRAFT').toUpperCase();
          const statusBadge =
            statusStr === 'PAID' || statusStr === 'DIBAYAR' || statusStr === 'LUNAS'
              ? 'bg-emerald-100 text-emerald-800'
              : statusStr === 'APPROVED' || statusStr === 'DISETUJUI'
                ? 'bg-sky-100 text-sky-800'
                : 'bg-amber-100 text-amber-800';

          return (
            <div
              key={String(h.id)}
              className="glass-card rounded-3xl p-4 sm:p-5 space-y-3 border border-slate-200 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {monthLabel} {String(h.period_year || '')}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusBadge}`}
                >
                  {statusStr}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span>Total JTM:</span>
                  <strong className="text-slate-900 shrink-0">
                    {Number(h.total_jtm) || 0} JTM
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Honor JTM:</span>
                  <strong className="text-slate-900 shrink-0">
                    {formatRupiah(Number(h.jtm_honorarium_amount) || 0)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tunjangan Tugas &amp; Transport:</span>
                  <strong className="text-slate-900 shrink-0">
                    {formatRupiah(
                      (Number(h.additional_duty_allowance) || 0) +
                        (Number(h.transport_allowance) || 0)
                    )}
                  </strong>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-slate-100 text-sm font-black text-emerald-800">
                  <span>Total Diterima Bersih:</span>
                  <span className="shrink-0">
                    {formatRupiah(Number(h.total_amount) || 0)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onSelectHonorSlip({
                    id: String(h.id),
                    teacherName: data.teacher?.full_name || data.profile.fullName,
                    teacherNip: data.teacher?.nip || null,
                    homeDistanceKm:
                      h.home_distance_km != null
                        ? Number(h.home_distance_km)
                        : data.teacher?.home_distance_km ?? null,
                    periodMonth: Number(h.period_month) || 1,
                    periodYear: Number(h.period_year) || new Date().getFullYear(),
                    teachingJtm: Number(h.teaching_jtm) || 0,
                    substituteJtm: Number(h.substitute_jtm) || 0,
                    examSupervisorJtm: Number(h.exam_supervisor_jtm) || 0,
                    examCommitteeJtm: Number(h.exam_committee_jtm) || 0,
                    eventJtm: Number(h.event_jtm) || 0,
                    picketJtm: Number(h.picket_jtm) || 0,
                    ceremonyJtm: Number(h.ceremony_jtm) || 0,
                    paidHolidayJtm: Number(h.paid_holiday_jtm) || 0,
                    totalJtm: Number(h.total_jtm) || 0,
                    ratePerJtm: Number(h.rate_per_jtm) || 0,
                    jtmHonorariumAmount: Number(h.jtm_honorarium_amount) || 0,
                    additionalDutyAllowance: Number(h.additional_duty_allowance) || 0,
                    transportAllowance: Number(h.transport_allowance) || 0,
                    totalAmount: Number(h.total_amount) || 0,
                    status: statusStr,
                    dutyItems: (h.items as HonorariumDutyItem[]) || [],
                  })
                }
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2 px-3 text-xs transition"
              >
                <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip (PNG / PDF)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
