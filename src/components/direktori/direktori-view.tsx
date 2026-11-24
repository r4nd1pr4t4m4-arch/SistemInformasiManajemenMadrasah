'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  RotateCcw,
  Search,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { TeacherProfileModal } from './teacher-profile-modal';

export interface PublicEmploymentHistoryItem {
  id: string;
  position_title: string;
  unit_or_institution: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface PublicTeacherItem {
  id: string;
  full_name: string;
  staff_type: string | null;
  nip?: string | null;
  nuptk?: string | null;
  employment_status: string | null;
  join_date?: string | null;
  education_level: string | null;
  major: string | null;
  last_campus?: string | null;
  graduation_year?: number | null;
  thesis_title?: string | null;
  thesis_abstract?: string | null;
  thesis_keywords?: string[];
  thesis_article_url?: string | null;
  additional_duties?: string[];
  subjects?: string[];
  subject_groups?: string[];
  taught_classes?: string[];
  employment_histories?: PublicEmploymentHistoryItem[];
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

function formatEducationSummary(t: PublicTeacherItem): string {
  const degreeMajor = [t.education_level, t.major].filter(Boolean).join(' ').trim();
  const campus = (t.last_campus || '').trim();
  const combined = [degreeMajor, campus].filter(Boolean).join(' — ');
  return combined || '-';
}

function getTeacherBadgeLabel(t: PublicTeacherItem): string {
  if (t.staff_type === 'GURU' && t.subjects && t.subjects.length > 0) {
    return `Guru ${t.subjects[0]}`;
  }
  return formatEnumLabel(t.staff_type, 'GTK');
}

function getTeacherIdentifierLabel(t: PublicTeacherItem): string {
  const nip = (t.nip || '').trim();
  if (nip) return `NIP: ${nip}`;
  const nuptk = (t.nuptk || '').trim();
  if (nuptk) return `NUPTK: ${nuptk}`;
  return `Status: ${formatEnumLabel(t.employment_status, 'Aktif')}`;
}

function getTeacherCategories(t: PublicTeacherItem): string[] {
  if (t.subject_groups && t.subject_groups.length > 0) {
    return t.subject_groups;
  }
  return [formatEnumLabel(t.staff_type, 'GTK')];
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
  const [selectedRumpun, setSelectedRumpun] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});
  const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacherItem | null>(null);
  const [profileTeacher, setProfileTeacher] = useState<PublicTeacherItem | null>(null);
  const [copiedAbstract, setCopiedAbstract] = useState(false);

  useEffect(() => {
    if (!selectedTeacher) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedTeacher(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTeacher]);

  const rumpunOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const t of teachers) {
      for (const cat of getTeacherCategories(t)) {
        if (cat) unique.add(cat);
      }
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
      if (selectedRumpun !== 'ALL' && !getTeacherCategories(t).includes(selectedRumpun)) {
        return false;
      }
      if (!q) return true;
      return (
        (t.full_name || '').toLowerCase().includes(q) ||
        (t.major || '').toLowerCase().includes(q) ||
        (t.last_campus || '').toLowerCase().includes(q) ||
        (t.nip || '').toLowerCase().includes(q) ||
        (t.nuptk || '').toLowerCase().includes(q) ||
        (t.staff_type || '').toLowerCase().includes(q) ||
        (t.employment_status || '').toLowerCase().includes(q) ||
        (t.thesis_title || '').toLowerCase().includes(q) ||
        (t.thesis_keywords || []).some((kw) => kw.toLowerCase().includes(q)) ||
        (t.additional_duties || []).some((d) => d.toLowerCase().includes(q)) ||
        (t.subjects || []).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [teachers, selectedRumpun, searchQuery]);

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
    searchQuery.trim().length > 0 || selectedRumpun !== 'ALL' || selectedLevel !== 'ALL';

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedRumpun('ALL');
    setSelectedLevel('ALL');
  }

  async function handleCopyAbstract(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAbstract(true);
      setTimeout(() => setCopiedAbstract(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
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
        <section className="space-y-5">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-emerald-700 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
              Direktori Guru &amp; Tenaga Kependidikan (GTK)
            </h1>
          </div>

          {/* Filter Rumpun & Counter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRumpun('ALL')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  selectedRumpun === 'ALL'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                Semua Rumpun
              </button>
              {rumpunOptions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedRumpun(cat)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    selectedRumpun === cat
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-500 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                Menampilkan <strong className="text-slate-900 font-semibold">{filteredTeachers.length}</strong> dari{' '}
                {teachers.length} pendidik
              </span>
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTeachers.map((t) => {
                const showPhoto = Boolean(t.photo_url) && !brokenPhotos[t.id];
                const hasAbstract = Boolean((t.thesis_title || '').trim() || (t.thesis_abstract || '').trim());
                const dutyText =
                  t.additional_duties && t.additional_duties.length > 0
                    ? t.additional_duties.join(' & ')
                    : '-';

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-emerald-200 transition-all min-w-0"
                  >
                    <div>
                      {/* Header Identitas */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          {showPhoto ? (
                            <img
                              src={t.photo_url!}
                              alt={t.full_name}
                              loading="lazy"
                              onError={() =>
                                setBrokenPhotos((prev) => ({ ...prev, [t.id]: true }))
                              }
                              className="w-14 h-14 rounded-2xl object-cover border border-emerald-200"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                              {getInitials(t.full_name)}
                            </div>
                          )}
                          <span
                            title="Aktif"
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 max-w-full truncate">
                            {getTeacherBadgeLabel(t)}
                          </span>
                          <h2 className="font-bold text-slate-900 text-base leading-snug break-words mt-1">
                            {t.full_name || 'Nama GTK'}
                          </h2>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                            {getTeacherIdentifierLabel(t)}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 my-4" />

                      {/* Informasi Akademik & Tugas */}
                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Tugas Tambahan</span>
                          </p>
                          <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-relaxed break-words">
                            {dutyText}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Pendidikan Terakhir</span>
                          </p>
                          <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-relaxed break-words">
                            {formatEducationSummary(t)}
                          </p>
                        </div>

                        {/* Box Karya Ilmiah / Skripsi */}
                        <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>Karya Ilmiah / Skripsi</span>
                            </p>
                            {t.graduation_year && (
                              <span className="text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                                {t.graduation_year}
                              </span>
                            )}
                          </div>
                          {t.thesis_title ? (
                            <p className="text-xs sm:text-[13px] italic text-slate-600 line-clamp-2 leading-relaxed">
                              &ldquo;{t.thesis_title}&rdquo;
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Belum ada data karya ilmiah / skripsi.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol Aksi Kartu GTK */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileTeacher(t)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs sm:text-[13px] font-semibold hover:bg-emerald-800 shadow-2xs transition"
                      >
                        <UserRound className="w-4 h-4 shrink-0" />
                        <span>Profil Singkat</span>
                      </button>
                      <button
                        type="button"
                        disabled={!hasAbstract}
                        onClick={() => {
                          setCopiedAbstract(false);
                          setSelectedTeacher(t);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-[13px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 disabled:opacity-45 disabled:cursor-not-allowed transition"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Abstrak Skripsi</span>
                      </button>
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

      {/* Modal Profil Singkat GTK */}
      {profileTeacher && (
        <TeacherProfileModal
          teacher={profileTeacher}
          photoBroken={Boolean(brokenPhotos[profileTeacher.id])}
          onPhotoError={() =>
            setBrokenPhotos((prev) => ({ ...prev, [profileTeacher.id]: true }))
          }
          onClose={() => setProfileTeacher(null)}
          onOpenAbstract={(teacher) => {
            setProfileTeacher(null);
            setCopiedAbstract(false);
            setSelectedTeacher(teacher);
          }}
        />
      )}

      {/* Modal Abstrak Karya Ilmiah */}
      {selectedTeacher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="abstract-modal-title"
          onClick={() => setSelectedTeacher(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white px-6 py-5 relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                aria-label="Tutup modal abstrak"
                className="absolute top-4 right-4 p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-emerald-100 mb-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Abstrak Karya Ilmiah</span>
              </p>
              <h2
                id="abstract-modal-title"
                className="text-lg sm:text-xl font-bold leading-snug pr-8 break-words"
              >
                {selectedTeacher.thesis_title || 'Karya Ilmiah / Skripsi'}
              </h2>
            </div>

            {/* Isi Modal */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Kartu Penulis */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {selectedTeacher.photo_url && !brokenPhotos[selectedTeacher.id] ? (
                    <img
                      src={selectedTeacher.photo_url}
                      alt={selectedTeacher.full_name}
                      className="w-11 h-11 rounded-full object-cover border border-emerald-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {getInitials(selectedTeacher.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                      {selectedTeacher.full_name}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 truncate">
                      {formatEducationSummary(selectedTeacher)}
                    </p>
                  </div>
                </div>

                {selectedTeacher.graduation_year && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shrink-0 w-fit">
                    Tahun Lulus: {selectedTeacher.graduation_year}
                  </span>
                )}
              </div>

              {/* Ringkasan Abstrak */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Ringkasan Abstrak
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words text-justify">
                  {selectedTeacher.thesis_abstract || 'Ringkasan abstrak belum ditambahkan.'}
                </p>
              </div>

              {/* Kata Kunci */}
              {selectedTeacher.thesis_keywords && selectedTeacher.thesis_keywords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Kata Kunci (Keywords)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTeacher.thesis_keywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-700"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={!selectedTeacher.thesis_abstract}
                  onClick={() => handleCopyAbstract(selectedTeacher.thesis_abstract || '')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed transition"
                >
                  {copiedAbstract ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Teks Abstrak</span>
                    </>
                  )}
                </button>

                {selectedTeacher.thesis_article_url &&
                /^https?:\/\//i.test(selectedTeacher.thesis_article_url.trim()) ? (
                  <a
                    href={selectedTeacher.thesis_article_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka Artikel Ilmiah</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Tautan artikel ilmiah belum tersedia"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka Artikel Ilmiah</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
