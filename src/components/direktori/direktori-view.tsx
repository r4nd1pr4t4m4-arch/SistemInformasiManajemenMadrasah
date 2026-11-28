'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeSafeImageUrl } from '@/lib/storage/r2-url-helper';

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
  image_url?: string | null;
  description: string | null;
}

const GTK_PAGE_SIZE = 12;
const ACHIEVEMENT_PAGE_SIZE = 12;

function getSafeImageUrl(url: string | null | undefined): string | null {
  return normalizeSafeImageUrl(url, 1200);
}

async function copyTextSafely(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback ke execCommand
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
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
  const [visibleGtkCount, setVisibleGtkCount] = useState(GTK_PAGE_SIZE);
  const [visibleAchCount, setVisibleAchCount] = useState(ACHIEVEMENT_PAGE_SIZE);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});
  const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacherItem | null>(null);
  const [profileTeacher, setProfileTeacher] = useState<PublicTeacherItem | null>(null);
  const [copiedAbstract, setCopiedAbstract] = useState(false);

  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const abstractCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeAbstractModal() {
    setSelectedTeacher(null);
    requestAnimationFrame(() => {
      modalTriggerRef.current?.focus();
    });
  }

  function closeProfileModal() {
    setProfileTeacher(null);
    requestAnimationFrame(() => {
      modalTriggerRef.current?.focus();
    });
  }

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    requestAnimationFrame(() => {
      abstractCloseBtnRef.current?.focus();
    });
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedTeacher(null);
        requestAnimationFrame(() => {
          modalTriggerRef.current?.focus();
        });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTeacher]);

  const rumpunEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of teachers) {
      const uniqueForTeacher = new Set(getTeacherCategories(t).filter(Boolean));
      for (const cat of uniqueForTeacher) {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [teachers]);

  const levelEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of achievements) {
      const val = (a.level || '').trim();
      if (val) counts.set(val, (counts.get(val) || 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
  }, [achievements]);

  const effectiveRumpun = useMemo(() => {
    if (selectedRumpun === 'ALL') return 'ALL';
    return rumpunEntries.some(([cat]) => cat === selectedRumpun) ? selectedRumpun : 'ALL';
  }, [selectedRumpun, rumpunEntries]);

  const effectiveLevel = useMemo(() => {
    if (selectedLevel === 'ALL') return 'ALL';
    return levelEntries.some(([lvl]) => lvl === selectedLevel) ? selectedLevel : 'ALL';
  }, [selectedLevel, levelEntries]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teachers.filter((t) => {
      if (effectiveRumpun !== 'ALL' && !getTeacherCategories(t).includes(effectiveRumpun)) {
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
  }, [teachers, effectiveRumpun, searchQuery]);

  const filteredAchievements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return achievements.filter((a) => {
      if (effectiveLevel !== 'ALL' && (a.level || '').trim() !== effectiveLevel) {
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
  }, [achievements, effectiveLevel, searchQuery]);

  const displayedTeachers = filteredTeachers.slice(0, visibleGtkCount);
  const hasMoreTeachers = visibleGtkCount < filteredTeachers.length;

  const displayedAchievements = filteredAchievements.slice(0, visibleAchCount);
  const hasMoreAchievements = visibleAchCount < filteredAchievements.length;

  const hasFilter =
    searchQuery.trim().length > 0 || effectiveRumpun !== 'ALL' || effectiveLevel !== 'ALL';

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedRumpun('ALL');
    setSelectedLevel('ALL');
    setVisibleGtkCount(GTK_PAGE_SIZE);
    setVisibleAchCount(ACHIEVEMENT_PAGE_SIZE);
  }

  async function handleCopyAbstract(text: string) {
    const ok = await copyTextSafely(text);
    if (!ok) return;
    setCopiedAbstract(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedAbstract(false), 2000);
  }

  const selectedPhotoUrl = selectedTeacher ? getSafeImageUrl(selectedTeacher.photo_url) : null;

  return (
    <div className="space-y-8">
      {/* Toolbar Pencarian & Tab */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleGtkCount(GTK_PAGE_SIZE);
                setVisibleAchCount(ACHIEVEMENT_PAGE_SIZE);
              }}
              placeholder="Cari nama guru/staf, bidang studi, atau prestasi..."
              aria-label="Cari di direktori GTK dan prestasi"
              className="w-full min-h-[44px] rounded-xl border border-slate-300/90 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleGtkCount(GTK_PAGE_SIZE);
                  setVisibleAchCount(ACHIEVEMENT_PAGE_SIZE);
                }}
                aria-label="Hapus kata kunci"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Pilih tampilan direktori"
            className="flex flex-wrap items-center gap-2 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'ALL'}
              onClick={() => setActiveView('ALL')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                activeView === 'ALL'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'GTK'}
              onClick={() => setActiveView('GTK')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition tabular-nums ${
                activeView === 'GTK'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              GTK ({filteredTeachers.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'PRESTASI'}
              onClick={() => setActiveView('PRESTASI')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition tabular-nums ${
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span className="tabular-nums">
              Filter aktif: {filteredTeachers.length} GTK, {filteredAchievements.length} Prestasi
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="min-h-[34px] px-2.5 py-1 rounded-lg inline-flex items-center gap-1 font-semibold text-emerald-700 hover:bg-emerald-50 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Direktori GTK */}
      {(activeView === 'ALL' || activeView === 'GTK') && (
        <section aria-label="Direktori Guru dan Tenaga Kependidikan" className="space-y-5">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-emerald-700 shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 [overflow-wrap:anywhere]">
              Direktori Guru &amp; Tenaga Kependidikan (GTK)
            </h2>
          </div>

          {/* Filter Rumpun & Counter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div
              role="tablist"
              aria-label="Filter rumpun GTK"
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveRumpun === 'ALL'}
                onClick={() => {
                  setSelectedRumpun('ALL');
                  setVisibleGtkCount(GTK_PAGE_SIZE);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  effectiveRumpun === 'ALL'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                Semua Rumpun ({teachers.length})
              </button>
              {rumpunEntries.map(([cat, count]) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={effectiveRumpun === cat}
                  onClick={() => {
                    setSelectedRumpun(cat);
                    setVisibleGtkCount(GTK_PAGE_SIZE);
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    effectiveRumpun === cat
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {cat} ({count})
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-500 shrink-0 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                Menampilkan{' '}
                <strong className="text-slate-900 font-semibold">{displayedTeachers.length}</strong>{' '}
                dari {filteredTeachers.length} pendidik
              </span>
            </div>
          </div>

          {teachers.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-emerald-600/70 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">Data GTK Belum Tersedia</p>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Data GTK aktif akan tampil di sini setelah ditambahkan melalui Buku Induk GTK di
                Portal Akademik.
              </p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada data GTK yang cocok dengan pencarian atau filter.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedTeachers.map((t) => {
                  const safePhotoUrl = getSafeImageUrl(t.photo_url);
                  const showPhoto = Boolean(safePhotoUrl) && !brokenPhotos[t.id];
                  const hasAbstract = Boolean(
                    (t.thesis_title || '').trim() || (t.thesis_abstract || '').trim()
                  );
                  const dutyText =
                    t.additional_duties && t.additional_duties.length > 0
                      ? t.additional_duties.join(' & ')
                      : '-';

                  return (
                    <article
                      key={t.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-emerald-200 transition-all min-w-0"
                    >
                      <div>
                        {/* Header Identitas */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            {showPhoto && safePhotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={safePhotoUrl}
                                alt={t.full_name || 'Foto GTK'}
                                loading="lazy"
                                decoding="async"
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
                            <h3 className="font-bold text-slate-900 text-base leading-snug [overflow-wrap:anywhere] mt-1">
                              {t.full_name || 'Nama GTK'}
                            </h3>
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
                            <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-relaxed [overflow-wrap:anywhere]">
                              {dutyText}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Pendidikan Terakhir</span>
                            </p>
                            <p className="text-xs sm:text-[13px] font-medium text-slate-700 leading-relaxed [overflow-wrap:anywhere]">
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
                              <p className="text-xs sm:text-[13px] italic text-slate-600 line-clamp-2 leading-relaxed [overflow-wrap:anywhere]">
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
                          onClick={(e) => {
                            modalTriggerRef.current = e.currentTarget;
                            setProfileTeacher(t);
                          }}
                          className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs sm:text-[13px] font-semibold hover:bg-emerald-800 shadow-2xs transition"
                        >
                          <UserRound className="w-4 h-4 shrink-0" />
                          <span>Profil Singkat</span>
                        </button>
                        <button
                          type="button"
                          disabled={!hasAbstract}
                          onClick={(e) => {
                            modalTriggerRef.current = e.currentTarget;
                            setCopiedAbstract(false);
                            setSelectedTeacher(t);
                          }}
                          className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-[13px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 disabled:opacity-45 disabled:cursor-not-allowed transition"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span>Abstrak Skripsi</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {hasMoreTeachers && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleGtkCount((prev) => prev + GTK_PAGE_SIZE)}
                    className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-sm font-semibold text-slate-700 hover:text-emerald-800 shadow-xs transition"
                  >
                    Muat Lebih Banyak GTK (
                    {(filteredTeachers.length - displayedTeachers.length).toLocaleString('id-ID')}{' '}
                    tersisa)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Prestasi Siswa */}
      {(activeView === 'ALL' || activeView === 'PRESTASI') && (
        <section aria-label="Prestasi Siswa dan Lembaga" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-5 h-5 text-amber-600 shrink-0" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 [overflow-wrap:anywhere]">
                Prestasi Siswa &amp; Lembaga
              </h2>
            </div>

            {levelEntries.length > 1 && (
              <div
                role="tablist"
                aria-label="Filter tingkat prestasi"
                className="flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveLevel === 'ALL'}
                  onClick={() => {
                    setSelectedLevel('ALL');
                    setVisibleAchCount(ACHIEVEMENT_PAGE_SIZE);
                  }}
                  className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    effectiveLevel === 'ALL'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  Semua Tingkat ({achievements.length})
                </button>
                {levelEntries.map(([lvl, count]) => (
                  <button
                    key={lvl}
                    type="button"
                    role="tab"
                    aria-selected={effectiveLevel === lvl}
                    onClick={() => {
                      setSelectedLevel(lvl);
                      setVisibleAchCount(ACHIEVEMENT_PAGE_SIZE);
                    }}
                    className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                      effectiveLevel === lvl
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {formatEnumLabel(lvl, 'Umum')} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {achievements.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-2">
              <Trophy className="w-8 h-8 text-amber-500/70 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                Data Prestasi Belum Tersedia
              </p>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Catatan prestasi siswa akan tampil di sini setelah diinput melalui Portal Terpadu.
              </p>
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada catatan prestasi yang cocok dengan pencarian atau filter.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedAchievements.map((a) => {
                  const dateLabel = formatAchievementDate(a.achieved_at);
                  const safeAchImg = getSafeImageUrl(a.image_url);
                  const showAchImg = Boolean(safeAchImg) && !brokenPhotos[`ach:${a.id}`];
                  return (
                    <article
                      key={a.id}
                      className="modular-card rounded-2xl overflow-hidden flex flex-col justify-between min-w-0"
                    >
                      <div>
                        {showAchImg && safeAchImg && (
                          <div className="aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={safeAchImg}
                              alt={a.title}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenPhotos((prev) => ({ ...prev, [`ach:${a.id}`]: true }))
                              }
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-5 space-y-2 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 truncate">
                              {formatEnumLabel(a.level, 'Umum')}
                            </span>
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm leading-snug [overflow-wrap:anywhere]">
                            {a.title}
                          </h3>
                          <p className="text-xs text-emerald-700 font-semibold [overflow-wrap:anywhere]">
                            {a.rank ? `${a.rank} — ` : ''}
                            {a.participant_name || 'Tim Lembaga'}
                          </p>
                          {a.description?.trim() && (
                            <p className="text-xs text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
                              {a.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {(a.organizer || dateLabel) && (
                        <div className="px-5 pb-4 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 min-w-0">
                          {a.organizer && (
                            <span className="truncate">Penyelenggara: {a.organizer}</span>
                          )}
                          {dateLabel && (
                            <time
                              dateTime={a.achieved_at || undefined}
                              className="inline-flex items-center gap-1 shrink-0"
                            >
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{dateLabel}</span>
                            </time>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {hasMoreAchievements && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleAchCount((prev) => prev + ACHIEVEMENT_PAGE_SIZE)}
                    className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-sm font-semibold text-slate-700 hover:text-amber-900 shadow-xs transition"
                  >
                    Muat Lebih Banyak Prestasi (
                    {(filteredAchievements.length - displayedAchievements.length).toLocaleString('id-ID')}{' '}
                    tersisa)
                  </button>
                </div>
              )}
            </>
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
          onClose={closeProfileModal}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="abstract-modal-title"
          onClick={closeAbstractModal}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white px-5 sm:px-6 py-5 relative shrink-0">
              <button
                ref={abstractCloseBtnRef}
                type="button"
                onClick={closeAbstractModal}
                aria-label="Tutup modal abstrak"
                className="absolute top-3.5 right-3.5 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-emerald-100 hover:text-white hover:bg-white/15 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-emerald-100 mb-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Abstrak Karya Ilmiah</span>
              </p>
              <h2
                id="abstract-modal-title"
                className="text-lg sm:text-xl font-bold leading-snug pr-10 [overflow-wrap:anywhere]"
              >
                {selectedTeacher.thesis_title || 'Karya Ilmiah / Skripsi'}
              </h2>
            </div>

            {/* Isi Modal */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
              {/* Kartu Penulis */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {selectedPhotoUrl && !brokenPhotos[selectedTeacher.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPhotoUrl}
                      alt={selectedTeacher.full_name || 'Foto Penulis'}
                      decoding="async"
                      onError={() =>
                        setBrokenPhotos((prev) => ({ ...prev, [selectedTeacher.id]: true }))
                      }
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
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-left sm:text-justify">
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
                    {selectedTeacher.thesis_keywords.map((kw, idx) => (
                      <span
                        key={`${kw}-${idx}`}
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
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedTeacher.thesis_abstract}
                  onClick={() => void handleCopyAbstract(selectedTeacher.thesis_abstract || '')}
                  className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed transition"
                >
                  {copiedAbstract ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" />
                      <span>Salin Abstrak</span>
                    </>
                  )}
                </button>

                {selectedTeacher.thesis_article_url &&
                /^https?:\/\//i.test(selectedTeacher.thesis_article_url.trim()) ? (
                  <a
                    href={selectedTeacher.thesis_article_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Buka Artikel</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Tautan artikel ilmiah belum tersedia"
                    className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Buka Artikel</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={closeAbstractModal}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition"
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
