'use client';

import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  PersonalEmptyState,
  PersonalStatCard,
  formatDateId,
  type PersonalPayload,
  type PersonalScope,
} from './types';

export function UjianSection({ data }: { data: PersonalPayload }) {
  const [examSearch, setExamSearch] = useState('');

  const q = examSearch.trim().toLowerCase();
  const sortedRooms = [...data.examRooms].sort((a, b) => {
    const dateA = a.exam_room?.period?.start_date || '';
    const dateB = b.exam_room?.period?.start_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.exam_room?.room_name || '').localeCompare(b.exam_room?.room_name || '');
  });
  const filteredRooms = q
    ? sortedRooms.filter((er) => {
        const haystack = `${er.exam_room?.period?.name || ''} ${
          er.exam_room?.room_name || ''
        } ${er.seat_number || ''} ${er.exam_room?.period?.start_date || ''}`.toLowerCase();
        return haystack.includes(q);
      })
    : sortedRooms;

  return (
    <div className="space-y-4">
      {data.examRooms.length === 0 ? (
        <PersonalEmptyState
          icon={<BookOpen className="w-8 h-8 text-slate-300" />}
          title="Belum ada penempatan ruang ujian"
          description="Penempatan ruang dan nomor kursi ujian akan muncul saat periode ujian aktif."
        />
      ) : (
        <>
          {data.examRooms.length > 2 && (
            <div className="glass-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-slate-700">
                Menampilkan {filteredRooms.length} dari {data.examRooms.length} ruang ujian
              </span>
              <div className="relative min-w-0 sm:w-64">
                <label htmlFor="exam-search-input" className="sr-only">
                  Cari ruang atau periode ujian
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="exam-search-input"
                  type="search"
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  placeholder="Cari ruang, kursi, atau periode..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          {filteredRooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada ruang ujian yang cocok dengan pencarian &ldquo;{examSearch}
                &rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setExamSearch('')}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Reset pencarian
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredRooms.map((er) => {
                const period = er.exam_room?.period;
                return (
                  <div
                    key={er.id}
                    className="glass-card rounded-3xl p-5 space-y-3 min-w-0 border border-slate-200/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-bold text-emerald-700 break-words">
                          {period?.name || 'Periode Ujian'}
                        </p>
                        <h3 className="text-base font-black text-slate-900 break-words">
                          Ruang: {er.exam_room?.room_name || '-'}
                        </h3>
                      </div>
                      <span className="shrink-0 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono">
                        Kursi: {er.seat_number || '-'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                      {(period?.start_date || period?.end_date) && (
                        <p className="flex items-center gap-1.5 flex-wrap">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            Periode: {formatDateId(period?.start_date)} –{' '}
                            {formatDateId(period?.end_date)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BkSection({
  data,
  scope,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
}) {
  const [bkTypeFilter, setBkTypeFilter] = useState<
    'ALL' | 'KONSULTASI' | 'PRESTASI' | 'PELANGGARAN'
  >('ALL');
  const [bkSearch, setBkSearch] = useState('');

  if (scope === 'orang-tua' && !data.student) {
    return (
      <PersonalEmptyState
        icon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
        title="Belum ada data putra/putri terhubung"
        description="Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah."
      />
    );
  }

  const q = bkSearch.trim().toLowerCase();
  const sortedBk = [...data.bkRecords].sort((a, b) =>
    (b.incident_date || '').localeCompare(a.incident_date || '')
  );
  const filteredBk = sortedBk.filter((rec) => {
    const recType = String(rec.record_type || '').toUpperCase();
    if (bkTypeFilter !== 'ALL' && recType !== bkTypeFilter) return false;
    if (q) {
      const haystack = `${recType} ${rec.title || ''} ${rec.description || ''} ${
        rec.follow_up || ''
      } ${rec.counselor?.full_name || ''} ${rec.incident_date || ''} ${formatDateId(
        rec.incident_date
      )}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const hasBkFilter = bkSearch.trim().length > 0 || bkTypeFilter !== 'ALL';

  const countKonsultasi = data.bkRecords.filter(
    (r) => String(r.record_type || '').toUpperCase() === 'KONSULTASI'
  ).length;
  const countPrestasi = data.bkRecords.filter(
    (r) => String(r.record_type || '').toUpperCase() === 'PRESTASI'
  ).length;
  const countPelanggaran = data.bkRecords.filter(
    (r) => String(r.record_type || '').toUpperCase() === 'PELANGGARAN'
  ).length;

  return (
    <div className="space-y-4">
      {data.bkRecords.length === 0 ? (
        <PersonalEmptyState
          icon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
          title="Tidak ada catatan BK"
          description={
            scope === 'orang-tua'
              ? 'Belum ada catatan bimbingan konseling atau pembinaan yang tercatat untuk putra/putri Anda.'
              : 'Belum ada catatan bimbingan konseling atau pembinaan yang tercatat.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <PersonalStatCard
              label="Konsultasi"
              value={String(countKonsultasi)}
              tone="slate"
            />
            <PersonalStatCard
              label="Prestasi"
              value={String(countPrestasi)}
              tone="emerald"
            />
            <PersonalStatCard
              label="Pelanggaran"
              value={String(countPelanggaran)}
              tone={countPelanggaran > 0 ? 'rose' : 'slate'}
            />
          </div>

          <div className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <label htmlFor="personal-bk-search" className="sr-only">
                  Cari catatan BK
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="personal-bk-search"
                  type="text"
                  value={bkSearch}
                  onChange={(e) => setBkSearch(e.target.value)}
                  placeholder="Cari catatan, tindak lanjut, tanggal, atau konselor..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {bkSearch && (
                  <button
                    type="button"
                    onClick={() => setBkSearch('')}
                    aria-label="Hapus pencarian catatan BK"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                {(
                  [
                    { key: 'ALL', label: 'Semua' },
                    { key: 'KONSULTASI', label: 'Konsultasi' },
                    { key: 'PRESTASI', label: 'Prestasi' },
                    { key: 'PELANGGARAN', label: 'Pelanggaran' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={bkTypeFilter === tab.key}
                    onClick={() => setBkTypeFilter(tab.key)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 whitespace-nowrap ${
                      bkTypeFilter === tab.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>
                Menampilkan {filteredBk.length} dari {data.bkRecords.length} catatan
              </span>
            </div>
          </div>

          {filteredBk.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2.5">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada catatan BK yang sesuai dengan filter pencarian.
              </p>
              {hasBkFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setBkSearch('');
                    setBkTypeFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBk.map((rec) => {
                const recType = String(rec.record_type || '').toUpperCase();
                const badgeClass =
                  recType === 'PELANGGARAN'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : recType === 'PRESTASI'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200';
                return (
                  <div
                    key={rec.id}
                    className="glass-card rounded-3xl p-4 sm:p-5 space-y-2.5 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold max-w-full break-words ${badgeClass}`}
                      >
                        {recType || 'CATATAN'} {rec.title ? `• ${rec.title}` : ''}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {formatDateId(rec.incident_date)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-slate-800 font-medium break-words leading-relaxed">
                      {rec.description}
                    </p>
                    {rec.follow_up && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 break-words">
                        <span className="font-semibold">Tindak Lanjut:</span> {rec.follow_up}
                      </p>
                    )}
                    {rec.counselor?.full_name && (
                      <p className="text-[11px] text-slate-500 break-words">
                        Guru BK: {rec.counselor.full_name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const GW_ASPECT_LABELS: Record<string, string> = {
  AKADEMIK: 'Akademik',
  IBADAH_KARAKTER: 'Ibadah & Karakter',
  SETORAN_HAFALAN: 'Setoran Hafalan',
  SOSIAL: 'Sosial',
  KESEHATAN: 'Kesehatan',
  LAINNYA: 'Lainnya',
};

const GW_ASPECT_BADGE_CLASS: Record<string, string> = {
  SETORAN_HAFALAN: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  AKADEMIK: 'bg-amber-50 text-amber-800 border-amber-200',
  IBADAH_KARAKTER: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  SOSIAL: 'bg-sky-50 text-sky-800 border-sky-200',
  KESEHATAN: 'bg-teal-50 text-teal-800 border-teal-200',
  LAINNYA: 'bg-slate-100 text-slate-700 border-slate-200',
};

function extractGuruWaliTeacherName(assignment: unknown): string {
  if (!assignment || typeof assignment !== 'object') return '';
  const assignObj = Array.isArray(assignment) ? assignment[0] : assignment;
  if (!assignObj || typeof assignObj !== 'object') return '';
  const teacherRaw = (assignObj as { teacher?: unknown }).teacher;
  const teacherObj = Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw;
  if (!teacherObj || typeof teacherObj !== 'object') return '';
  const fullName = (teacherObj as { full_name?: unknown }).full_name;
  return typeof fullName === 'string' ? fullName.trim() : '';
}

const GW_PAGE_SIZE = 10;

export function GuruWaliSection({
  data,
  scope,
}: {
  data: PersonalPayload;
  scope: PersonalScope;
}) {
  const [gwAspectFilter, setGwAspectFilter] = useState<
    'ALL' | 'AKADEMIK' | 'IBADAH_KARAKTER' | 'SETORAN_HAFALAN' | 'SOSIAL' | 'KESEHATAN' | 'LAINNYA'
  >('ALL');
  const [gwSearch, setGwSearch] = useState('');
  const [gwPage, setGwPage] = useState(1);

  if ((scope === 'orang-tua' || scope === 'siswa') && !data.student) {
    return (
      <PersonalEmptyState
        icon={<HeartHandshake className="w-8 h-8 text-slate-300" />}
        title={
          scope === 'orang-tua'
            ? 'Belum ada data putra/putri terhubung'
            : 'Akun siswa belum tertaut ke Buku Induk'
        }
        description={
          scope === 'orang-tua'
            ? 'Akun Anda belum terhubung dengan data siswa. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
            : 'Akun Anda belum terhubung dengan data peserta didik di Buku Induk. Silakan hubungi bagian Tata Usaha atau Operator Madrasah.'
        }
      />
    );
  }

  const allLogs = [...(data.guruWaliLogs || [])].sort((a, b) =>
    (b.mentoring_date || '').localeCompare(a.mentoring_date || '')
  );
  const q = gwSearch.trim().toLowerCase();
  const filteredLogs = allLogs.filter((log) => {
    const asp = String(log.aspect || 'AKADEMIK').toUpperCase();
    if (gwAspectFilter !== 'ALL' && asp !== gwAspectFilter) return false;
    if (q) {
      const teacherName = extractGuruWaliTeacherName(log.assignment);
      const haystack = `${asp} ${GW_ASPECT_LABELS[asp] || ''} ${log.topic || ''} ${
        log.notes || ''
      } ${log.recommendation || ''} ${teacherName} ${log.mentoring_date || ''} ${formatDateId(
        log.mentoring_date
      )}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hafalanCount = allLogs.filter(
    (l) => String(l.aspect || '').toUpperCase() === 'SETORAN_HAFALAN'
  ).length;
  const akademikCount = allLogs.filter(
    (l) => String(l.aspect || '').toUpperCase() === 'AKADEMIK'
  ).length;
  const hasFilter = gwSearch.trim().length > 0 || gwAspectFilter !== 'ALL';
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / GW_PAGE_SIZE));
  const safePage = Math.min(gwPage, totalPages);
  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * GW_PAGE_SIZE,
    safePage * GW_PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      {data.guruWaliTeacher?.full_name && (
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 border border-emerald-200/70 bg-emerald-50/40 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Guru Wali Pendamping Aktif
              </p>
              <p className="text-sm font-bold text-slate-900 break-words">
                {data.guruWaliTeacher.full_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {allLogs.length === 0 ? (
        <PersonalEmptyState
          icon={<HeartHandshake className="w-8 h-8 text-slate-300" />}
          title="Belum ada rekam jejak bimbingan Guru Wali"
          description={
            scope === 'orang-tua'
              ? 'Belum ada catatan bimbingan atau setoran hafalan Guru Wali yang tercatat untuk putra/putri Anda.'
              : 'Belum ada catatan bimbingan atau setoran hafalan Guru Wali yang tercatat untuk akun Anda.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <button
              type="button"
              aria-pressed={gwAspectFilter === 'ALL'}
              onClick={() => {
                setGwAspectFilter('ALL');
                setGwPage(1);
              }}
              className={`col-span-2 sm:col-span-1 text-left rounded-2xl transition hover:opacity-95 ${
                gwAspectFilter === 'ALL' ? 'ring-2 ring-slate-900/20' : ''
              }`}
            >
              <PersonalStatCard
                label="Total Bimbingan"
                value={String(allLogs.length)}
                tone="slate"
              />
            </button>
            <button
              type="button"
              aria-pressed={gwAspectFilter === 'SETORAN_HAFALAN'}
              onClick={() => {
                setGwAspectFilter('SETORAN_HAFALAN');
                setGwPage(1);
              }}
              className={`text-left rounded-2xl transition hover:opacity-95 ${
                gwAspectFilter === 'SETORAN_HAFALAN' ? 'ring-2 ring-emerald-500/40' : ''
              }`}
            >
              <PersonalStatCard
                label="Setoran Hafalan"
                value={String(hafalanCount)}
                tone="emerald"
              />
            </button>
            <button
              type="button"
              aria-pressed={gwAspectFilter === 'AKADEMIK'}
              onClick={() => {
                setGwAspectFilter('AKADEMIK');
                setGwPage(1);
              }}
              className={`text-left rounded-2xl transition hover:opacity-95 ${
                gwAspectFilter === 'AKADEMIK' ? 'ring-2 ring-amber-500/40' : ''
              }`}
            >
              <PersonalStatCard label="Akademik" value={String(akademikCount)} tone="amber" />
            </button>
          </div>

          <div className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <label htmlFor="personal-gw-search" className="sr-only">
                  Cari rekam jejak bimbingan Guru Wali
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="personal-gw-search"
                  type="text"
                  value={gwSearch}
                  onChange={(e) => {
                    setGwSearch(e.target.value);
                    setGwPage(1);
                  }}
                  placeholder="Cari topik, hafalan, catatan, rekomendasi, atau tanggal..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-8 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                {gwSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setGwSearch('');
                      setGwPage(1);
                    }}
                    aria-label="Hapus pencarian bimbingan Guru Wali"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1 shrink-0">
                {(
                  [
                    { key: 'ALL', label: 'Semua' },
                    { key: 'SETORAN_HAFALAN', label: 'Setoran Hafalan' },
                    { key: 'AKADEMIK', label: 'Akademik' },
                    { key: 'IBADAH_KARAKTER', label: 'Ibadah & Karakter' },
                    { key: 'SOSIAL', label: 'Sosial' },
                    { key: 'KESEHATAN', label: 'Kesehatan' },
                    { key: 'LAINNYA', label: 'Lainnya' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={gwAspectFilter === tab.key}
                    onClick={() => {
                      setGwAspectFilter(tab.key);
                      setGwPage(1);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition shrink-0 whitespace-nowrap ${
                      gwAspectFilter === tab.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>
                Menampilkan {filteredLogs.length} dari {allLogs.length} catatan bimbingan
              </span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setGwSearch('');
                    setGwAspectFilter('ALL');
                    setGwPage(1);
                  }}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center space-y-2.5">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada rekam jejak bimbingan yang cocok dengan filter.
              </p>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setGwSearch('');
                    setGwAspectFilter('ALL');
                    setGwPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedLogs.map((log) => {
                  const aspKey = String(log.aspect || 'AKADEMIK').toUpperCase();
                  const aspLabel = GW_ASPECT_LABELS[aspKey] || aspKey;
                  const isHafalan = aspKey === 'SETORAN_HAFALAN';
                  const badgeClass =
                    GW_ASPECT_BADGE_CLASS[aspKey] || 'bg-sky-50 text-sky-800 border-sky-200';
                  const teacherName = extractGuruWaliTeacherName(log.assignment);
                  return (
                    <div
                      key={log.id}
                      className="glass-card rounded-2xl p-4 sm:p-5 space-y-2.5 border border-slate-200/80 min-w-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          {aspLabel}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {formatDateId(log.mentoring_date)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 break-words">
                        {isHafalan ? `Hafalan: ${log.topic || '-'}` : log.topic || 'Bimbingan Umum'}
                      </p>
                      {log.notes && (
                        <p className="text-xs sm:text-[13px] text-slate-700 break-words leading-relaxed whitespace-pre-line">
                          {log.notes}
                        </p>
                      )}
                      {log.recommendation && (
                        <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 break-words">
                          <span className="font-semibold">Rekomendasi:</span> {log.recommendation}
                        </p>
                      )}
                      {teacherName && (
                        <p className="text-[11px] text-slate-500 break-words">
                          Guru Wali: {teacherName}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                  <span>
                    Halaman <strong className="text-slate-900">{safePage}</strong> dari{' '}
                    {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setGwPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Sebelumnya</span>
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setGwPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
                    >
                      <span>Berikutnya</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
