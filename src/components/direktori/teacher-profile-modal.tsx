'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  History,
  IdCard,
  Layers,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { PublicTeacherItem } from './direktori-view';

interface TeacherProfileModalProps {
  teacher: PublicTeacherItem;
  photoBroken: boolean;
  onPhotoError: () => void;
  onClose: () => void;
  onOpenAbstract: (teacher: PublicTeacherItem) => void;
}

function getSafeImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
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

function formatJoinInfo(joinDate: string | null | undefined): {
  label: string;
  tenure: string | null;
} {
  if (!joinDate) return { label: 'Aktif Bertugas', tenure: null };
  const parsed = new Date(joinDate);
  if (Number.isNaN(parsed.getTime())) return { label: 'Aktif Bertugas', tenure: null };

  const formatted = parsed.toLocaleDateString('id-ID', {
    month: 'short',
    year: 'numeric',
  });
  const now = new Date();
  let years = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    years -= 1;
  }

  if (years >= 1) {
    return { label: formatted, tenure: `${years} tahun pengabdian` };
  }
  return { label: formatted, tenure: '< 1 tahun pengabdian' };
}

function formatHistoryPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const formatPart = (val: string | null | undefined) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val.slice(0, 4);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  };
  const start = formatPart(startDate);
  const end = endDate ? formatPart(endDate) : 'Sekarang';
  if (!start && !endDate) return '-';
  return `${start || '?'} — ${end}`;
}

export function TeacherProfileModal({
  teacher,
  photoBroken,
  onPhotoError,
  onClose,
  onOpenAbstract,
}: TeacherProfileModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [onClose]);

  const safePhotoUrl = getSafeImageUrl(teacher.photo_url);
  const showPhoto = Boolean(safePhotoUrl) && !photoBroken;
  const hasAbstract = Boolean(
    (teacher.thesis_title || '').trim() || (teacher.thesis_abstract || '').trim()
  );
  const subjects = teacher.subjects || [];
  const subjectGroups = teacher.subject_groups || [];
  const duties = teacher.additional_duties || [];
  const taughtClasses = teacher.taught_classes || [];
  const histories = teacher.employment_histories || [];
  const joinInfo = formatJoinInfo(teacher.join_date);

  const primaryIdentifier = teacher.nip?.trim()
    ? { label: 'NIP', value: teacher.nip.trim() }
    : teacher.nuptk?.trim()
      ? { label: 'NUPTK', value: teacher.nuptk.trim() }
      : null;

  const badgeTitle =
    teacher.staff_type === 'GURU' && subjects.length > 0
      ? `Guru ${subjects[0]}`
      : formatEnumLabel(teacher.staff_type, 'GTK');

  const degreeLabel = [teacher.education_level, teacher.major].filter(Boolean).join(' ').trim();

  async function handleCopyIdentifier(value: string) {
    const ok = await copyTextSafely(value);
    if (!ok) return;
    setCopiedId(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(false), 1800);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-profile-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200/90 flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="relative bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white px-5 sm:px-7 pt-6 pb-6 shrink-0 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/3 -bottom-16 w-44 h-44 rounded-full bg-teal-300/15 blur-2xl"
          />

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup modal profil singkat"
            className="absolute top-3.5 right-3.5 z-10 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl text-emerald-100 hover:text-white hover:bg-white/15 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            <div className="relative shrink-0 w-fit">
              {showPhoto && safePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safePhotoUrl}
                  alt={teacher.full_name || 'Foto GTK'}
                  decoding="async"
                  onError={onPhotoError}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg bg-emerald-900/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-xs border-2 border-white/30 text-white font-bold text-2xl flex items-center justify-center shadow-lg">
                  {getInitials(teacher.full_name)}
                </div>
              )}
              <span
                title="GTK Aktif"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-emerald-800 shadow-xs"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-emerald-50 border border-white/20 backdrop-blur-xs max-w-full">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[220px]">{badgeTitle}</span>
                </span>
                {teacher.employment_status && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/35 text-emerald-100 border border-white/15">
                    {formatEnumLabel(teacher.employment_status, 'Aktif')}
                  </span>
                )}
              </div>

              <h2
                id="teacher-profile-modal-title"
                className="text-xl sm:text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]"
              >
                {teacher.full_name || 'Nama GTK'}
              </h2>

              <p className="text-xs sm:text-sm text-emerald-100/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
                  <span>{formatEnumLabel(teacher.staff_type, 'GTK')}</span>
                </span>
                {teacher.last_campus && (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
                    <span className="truncate">{teacher.last_campus}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5 bg-slate-50/40">
          {/* Quick Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Identitas NIP / NUPTK */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <IdCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{primaryIdentifier ? primaryIdentifier.label : 'Identitas'}</span>
                </span>
                {primaryIdentifier && (
                  <button
                    type="button"
                    onClick={() => void handleCopyIdentifier(primaryIdentifier.value)}
                    title={`Salin ${primaryIdentifier.label}`}
                    aria-label={`Salin ${primaryIdentifier.label}`}
                    className="min-w-[30px] min-h-[30px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm font-mono font-semibold text-slate-800 truncate">
                {primaryIdentifier ? primaryIdentifier.value : 'Terdaftar di GTK'}
              </p>
              {teacher.nip?.trim() && teacher.nuptk?.trim() && (
                <p className="text-[11px] font-mono text-slate-500 truncate">
                  NUPTK: {teacher.nuptk.trim()}
                </p>
              )}
            </div>

            {/* Masa Pengabdian */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs space-y-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Bergabung</span>
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800">{joinInfo.label}</p>
              {joinInfo.tenure && (
                <p className="text-[11px] text-emerald-700 font-medium">{joinInfo.tenure}</p>
              )}
            </div>

            {/* Kualifikasi Akademik */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs space-y-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Pendidikan</span>
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                {teacher.education_level || 'Sarjana / GTK'}
                {teacher.graduation_year ? ` (${teacher.graduation_year})` : ''}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {teacher.major || 'Bidang Kependidikan'}
              </p>
            </div>
          </div>

          {/* Bidang Studi & Amanah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bidang Studi / Rumpun */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3 min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Bidang Studi &amp; Pengajaran</span>
              </p>

              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((subject, idx) => (
                    <span
                      key={`${subject}-${idx}`}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {teacher.staff_type === 'GURU'
                    ? 'Belum ada jadwal mata pelajaran yang tertaut.'
                    : `Bertugas sebagai ${formatEnumLabel(teacher.staff_type, 'Tenaga Kependidikan')}.`}
                </p>
              )}

              {subjectGroups.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">Rumpun:</span>
                  {subjectGroups.map((group, idx) => (
                    <span
                      key={`${group}-${idx}`}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                    >
                      {group}
                    </span>
                  ))}
                </div>
              )}

              {taughtClasses.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">Kelas:</span>
                  {taughtClasses.map((cls, idx) => (
                    <span
                      key={`${cls}-${idx}`}
                      className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/70 text-[11px] font-semibold"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tugas Tambahan */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3 min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Briefcase className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Tugas Tambahan &amp; Amanah</span>
              </p>

              {duties.length > 0 ? (
                <ul className="space-y-2">
                  {duties.map((duty, idx) => (
                    <li
                      key={`${duty}-${idx}`}
                      className="flex items-start gap-2 text-xs sm:text-[13px] font-medium text-slate-700 min-w-0"
                    >
                      <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="leading-snug [overflow-wrap:anywhere]">{duty}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fokus pada tugas pokok sebagai {formatEnumLabel(teacher.staff_type, 'GTK')}.
                </p>
              )}
            </div>
          </div>

          {/* Detail Pendidikan Terakhir */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Latar Belakang Pendidikan</span>
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">
                  {degreeLabel || 'Data pendidikan belum dilengkapi'}
                </p>
                {teacher.last_campus && (
                  <p className="text-xs sm:text-sm text-slate-600 [overflow-wrap:anywhere]">
                    {teacher.last_campus}
                  </p>
                )}
              </div>
              {teacher.graduation_year && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shrink-0 w-fit">
                  Lulus {teacher.graduation_year}
                </span>
              )}
            </div>
          </div>

          {/* Karya Ilmiah / Skripsi */}
          {hasAbstract && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Karya Ilmiah / Skripsi</span>
                </p>
                {teacher.graduation_year && (
                  <span className="text-xs font-semibold text-emerald-700/80 tabular-nums">
                    {teacher.graduation_year}
                  </span>
                )}
              </div>

              {teacher.thesis_title && (
                <p className="text-xs sm:text-sm font-semibold italic text-slate-800 leading-relaxed [overflow-wrap:anywhere]">
                  &ldquo;{teacher.thesis_title}&rdquo;
                </p>
              )}

              {teacher.thesis_keywords && teacher.thesis_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {teacher.thesis_keywords.slice(0, 6).map((kw, idx) => (
                    <span
                      key={`${kw}-${idx}`}
                      className="px-2.5 py-0.5 rounded-md bg-white/85 border border-emerald-200/70 text-[11px] font-medium text-emerald-900"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAbstract(teacher)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Baca Abstrak Lengkap</span>
                </button>
                {teacher.thesis_article_url &&
                  /^https?:\/\//i.test(teacher.thesis_article_url.trim()) && (
                    <a
                      href={teacher.thesis_article_url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-50 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>Artikel Ilmiah</span>
                    </a>
                  )}
              </div>
            </div>
          )}

          {/* Riwayat Jabatan / Pengalaman */}
          {histories.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <History className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Riwayat Jabatan &amp; Pengalaman</span>
              </p>

              <ol className="relative border-l-2 border-emerald-100 ml-2 pl-4 space-y-3">
                {histories.map((item) => (
                  <li key={item.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 [overflow-wrap:anywhere]">
                        {item.position_title}
                      </p>
                      <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                        {formatHistoryPeriod(item.start_date, item.end_date)}
                      </span>
                    </div>
                    {item.unit_or_institution && (
                      <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">
                        {item.unit_or_institution}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Direktori Resmi GTK &bull; Informasi Publik
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
            {hasAbstract && (
              <button
                type="button"
                onClick={() => onOpenAbstract(teacher)}
                className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Abstrak Skripsi</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[40px] px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
