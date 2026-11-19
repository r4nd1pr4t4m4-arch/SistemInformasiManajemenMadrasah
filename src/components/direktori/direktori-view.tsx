'use client';

import { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  GraduationCap,
  RotateCcw,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';

export interface PublicTeacherItem {
  id: string;
  full_name: string;
  staff_type: string | null;
  employment_status: string | null;
  education_level: string | null;
  major: string | null;
  photo_url: string | null;
}

export interface PublicAchievementItem {
  id: string;
  title: string;
  level: string | null;
  rank: string | null;
  participant_name: string | null;
  achieved_at: string | null;
  organizer: string | null;
  description: string | null;
}

function getInitials(name: string | null | undefined): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'GT';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function formatEnumLabel(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.replace(/_/g, ' ');
}

function formatAchievementDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DirektoriView({
  teachers,
  achievements,
}: {
  teachers: PublicTeacherItem[];
  achievements: PublicAchievementItem[];
}) {
  const [activeView, setActiveView] = useState<'ALL' | 'GTK' | 'PRESTASI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffType, setSelectedStaffType] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});

  const staffTypes = useMemo(() => {
    const unique = new Set<string>();
    for (const t of teachers) {
      const val = (t.staff_type || '').trim();
      if (val) unique.add(val);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  }, [teachers]);

  const achievementLevels = useMemo(() => {
    const unique = new Set<string>();
    for (const a of achievements) {
      const val = (a.level || '').trim();
      if (val) unique.add(val);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  }, [achievements]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teachers.filter((t) => {
      if (selectedStaffType !== 'ALL' && (t.staff_type || '').trim() !== selectedStaffType) {
        return false;
      }
      if (!q) return true;
      return (
        (t.full_name || '').toLowerCase().includes(q) ||
        (t.major || '').toLowerCase().includes(q) ||
        (t.staff_type || '').toLowerCase().includes(q) ||
        (t.employment_status || '').toLowerCase().includes(q)
      );
    });
  }, [teachers, selectedStaffType, searchQuery]);

  const filteredAchievements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return achievements.filter((a) => {
      if (selectedLevel !== 'ALL' && (a.level || '').trim() !== selectedLevel) {
        return false;
      }
      if (!q) return true;
      return (
        (a.title || '').toLowerCase().includes(q) ||
        (a.participant_name || '').toLowerCase().includes(q) ||
        (a.organizer || '').toLowerCase().includes(q) ||
        (a.rank || '').toLowerCase().includes(q) ||
        (a.level || '').toLowerCase().includes(q)
      );
    });
  }, [achievements, selectedLevel, searchQuery]);

  const hasFilter =
    searchQuery.trim().length > 0 || selectedStaffType !== 'ALL' || selectedLevel !== 'ALL';

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedStaffType('ALL');
    setSelectedLevel('ALL');
  }

  return (
    <div className="space-y-8">
      {/* Toolbar Pencarian & Tab */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama guru/staf, bidang studi, atau prestasi..."
              aria-label="Cari di direktori GTK dan prestasi"
              className="w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus kata kunci"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('ALL')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                activeView === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveView('GTK')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                activeView === 'GTK'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              GTK ({filteredTeachers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('PRESTASI')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                activeView === 'PRESTASI'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Prestasi ({filteredAchievements.length})
            </button>
          </div>
        </div>

        {hasFilter && (
          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span>
              Filter aktif: {filteredTeachers.length} GTK, {filteredAchievements.length} Prestasi
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Direktori GTK */}
      {(activeView === 'ALL' || activeView === 'GTK') && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-5 h-5 text-emerald-700 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                Direktori Guru &amp; Tenaga Kependidikan (GTK)
              </h1>
            </div>

            {staffTypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedStaffType('ALL')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                    selectedStaffType === 'ALL'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  Semua Jenis
                </button>
                {staffTypes.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStaffType(st)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                      selectedStaffType === st
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {formatEnumLabel(st, 'GTK')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {teachers.length === 0 ? (
            <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">
              Data GTK aktif akan tampil di sini setelah ditambahkan melalui Buku Induk GTK di
              Portal Akademik.
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="glass-card rounded-3xl p-6 text-center space-y-2.5">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada data GTK yang cocok dengan pencarian atau filter.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((t) => {
                const showPhoto = Boolean(t.photo_url) && !brokenPhotos[t.id];
                return (
                  <div
                    key={t.id}
                    className="modular-card rounded-2xl p-4 sm:p-5 flex items-center gap-4 min-w-0"
                  >
                    {showPhoto ? (
                      <img
                        src={t.photo_url!}
                        alt={t.full_name}
                        loading="lazy"
                        onError={() =>
                          setBrokenPhotos((prev) => ({ ...prev, [t.id]: true }))
                        }
                        className="w-12 h-12 rounded-2xl object-cover border border-emerald-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0">
                        {getInitials(t.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-slate-900 text-sm leading-snug break-words">
                        {t.full_name || 'Nama GTK'}
                      </p>
                      <p className="text-xs text-slate-500 break-words">
                        {formatEnumLabel(t.staff_type, 'GTK')} •{' '}
                        {formatEnumLabel(t.employment_status, 'Aktif')}
                      </p>
                      {(t.major || t.education_level) && (
                        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1 pt-0.5 min-w-0">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {[t.education_level, t.major].filter(Boolean).join(' • ')}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Prestasi Siswa */}
      {(activeView === 'ALL' || activeView === 'PRESTASI') && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-5 h-5 text-amber-600 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                Prestasi Siswa &amp; Lembaga
              </h2>
            </div>

            {achievementLevels.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedLevel('ALL')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                    selectedLevel === 'ALL'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  Semua Tingkat
                </button>
                {achievementLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                      selectedLevel === lvl
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {formatEnumLabel(lvl, 'Umum')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {achievements.length === 0 ? (
            <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">
              Catatan prestasi siswa akan tampil di sini setelah diinput melalui Portal Terpadu.
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="glass-card rounded-3xl p-6 text-center space-y-2.5">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada catatan prestasi yang cocok dengan pencarian atau filter.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAchievements.map((a) => {
                const dateLabel = formatAchievementDate(a.achieved_at);
                return (
                  <div
                    key={a.id}
                    className="modular-card rounded-2xl p-5 space-y-2.5 flex flex-col justify-between min-w-0"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 truncate">
                          {formatEnumLabel(a.level, 'Umum')}
                        </span>
                        <Award className="w-4 h-4 text-amber-500 shrink-0" />
                      </div>
                      <p className="font-bold text-slate-900 text-sm leading-snug break-words">
                        {a.title}
                      </p>
                      <p className="text-xs text-emerald-700 font-semibold break-words">
                        {a.rank ? `${a.rank} — ` : ''}
                        {a.participant_name || 'Tim Lembaga'}
                      </p>
                      {a.description && (
                        <p className="text-xs text-slate-600 leading-relaxed break-words">
                          {a.description}
                        </p>
                      )}
                    </div>

                    {(a.organizer || dateLabel) && (
                      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 min-w-0">
                        {a.organizer && (
                          <span className="truncate">Penyelenggara: {a.organizer}</span>
                        )}
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{dateLabel}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
