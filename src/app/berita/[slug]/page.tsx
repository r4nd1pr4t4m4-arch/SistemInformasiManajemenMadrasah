import { cache, Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Newspaper,
  User,
} from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { BeritaShareBar } from '@/components/berita/berita-share-bar';
import { PostCoverImage } from '@/components/home/safe-media';
import {
  getInstitutionSettings,
  getPostBySlug,
  getPublishedPosts,
} from '@/lib/data/public-queries';
import {
  prepareRichTextHtmlForRender,
  stripHtmlToPlainText,
} from '@/lib/security/rich-text';

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getCachedPostBySlug = cache(getPostBySlug);
const getCachedInstitutionSettings = cache(getInstitutionSettings);

function normalizeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

function getSafeOpenGraphImage(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
  }
}

function formatCategoryLabel(category?: string | null): string {
  if (!category) return 'BERITA';
  return category.replaceAll('_', ' ');
}

function getCategoryBadgeClass(category?: string | null): string {
  const norm = (category || '').toUpperCase();
  if (norm.includes('PENGUMUMAN')) {
    return 'bg-amber-50 text-amber-800 border-amber-200/80';
  }
  if (norm.includes('ARTIKEL') || norm.includes('OPINI')) {
    return 'bg-sky-50 text-sky-800 border-sky-200/80';
  }
  if (norm.includes('PRESTASI') || norm.includes('KARYA')) {
    return 'bg-violet-50 text-violet-800 border-violet-200/80';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
}

function formatFullDate(raw?: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(raw?: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function cleanPlainSnippet(raw?: string | null, maxLength = 160): string {
  const text = stripHtmlToPlainText(raw)
    .replace(/[#*_`>~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${truncated || text.slice(0, maxLength).trim()}…`;
}

function estimateReadingMinutes(excerpt?: string | null, content?: string | null): number {
  const combined = `${stripHtmlToPlainText(excerpt)} ${stripHtmlToPlainText(content)}`.trim();
  if (!combined) return 1;
  const wordCount = combined.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const [post, school] = await Promise.all([
    getCachedPostBySlug(slug),
    getCachedInstitutionSettings(),
  ]);

  if (!post) {
    return { title: 'Artikel Tidak Ditemukan — SIMMS' };
  }

  const plainTitle = stripHtmlToPlainText(post.title) || 'Publikasi Lembaga';
  const description =
    cleanPlainSnippet(post.excerpt || post.content, 160) ||
    school.name ||
    'Publikasi Resmi Lembaga';
  const safeOgImage = getSafeOpenGraphImage(post.cover_image_url);

  return {
    title: `${plainTitle} — ${school.short_name || school.name}`,
    description,
    openGraph: {
      title: plainTitle,
      description,
      type: 'article',
      ...(safeOgImage ? { images: [safeOgImage] } : {}),
    },
  };
}

async function BeritaDetailContent({ params }: PageProps) {
  await connection();
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);

  const [post, recentPosts] = await Promise.all([
    getCachedPostBySlug(slug),
    getPublishedPosts(6),
  ]);

  if (!post) {
    notFound();
  }

  const related = recentPosts
    .filter((p) => p.slug?.trim() && p.slug !== post.slug)
    .slice(0, 3);
  const formattedDate = formatFullDate(post.published_at);
  const readingMinutes = estimateReadingMinutes(post.excerpt, post.content);
  const plainTitle = stripHtmlToPlainText(post.title) || 'Publikasi Lembaga';
  const hasExcerpt = Boolean(stripHtmlToPlainText(post.excerpt));
  const hasContent = Boolean(stripHtmlToPlainText(post.content));

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8">
      {/* Breadcrumb & Tombol Kembali */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
          <Link href="/" className="hover:text-emerald-700 transition shrink-0 py-1">
            Beranda
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
          <Link href="/berita" className="hover:text-emerald-700 transition shrink-0 py-1">
            Berita
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
          <span className="text-slate-700 font-medium truncate">
            {formatCategoryLabel(post.category)}
          </span>
        </nav>

        <Link
          href="/berita"
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-white/80 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Semua Berita</span>
        </Link>
      </div>

      {/* Konten Artikel Utama */}
      <article className="glass-card rounded-3xl overflow-hidden">
        {post.cover_image_url && (
          <div className="p-4 sm:p-6 pb-0">
            <PostCoverImage
              coverUrl={post.cover_image_url}
              alt={plainTitle || 'Sampul Publikasi'}
            />
          </div>
        )}

        <div className="p-5 sm:p-8 md:p-10 space-y-6">
          <header className="space-y-3.5 min-w-0">
            <span
              className={`inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                post.category
              )}`}
            >
              {formatCategoryLabel(post.category)}
            </span>

            <h1
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight [overflow-wrap:anywhere] rich-text-inline"
              dangerouslySetInnerHTML={{
                __html: prepareRichTextHtmlForRender(post.title, 'inline-single'),
              }}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-700 truncate">
                  {post.author_display_name || 'Tim Redaksi'}
                </span>
              </span>
              {formattedDate && (
                <time
                  dateTime={post.published_at || undefined}
                  className="inline-flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{formattedDate}</span>
                </time>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>~{readingMinutes} menit baca</span>
              </span>
            </div>
          </header>

          {hasExcerpt && (
            <div
              className="text-sm sm:text-base font-medium text-slate-700 bg-emerald-50/50 border-l-4 border-emerald-500 px-4 py-3.5 rounded-r-xl leading-relaxed [overflow-wrap:anywhere] rich-text-inline"
              dangerouslySetInnerHTML={{
                __html: prepareRichTextHtmlForRender(post.excerpt, 'inline'),
              }}
            />
          )}

          {hasContent ? (
            <div
              className="text-sm sm:text-base text-slate-700 leading-[1.8] rich-text-content"
              dangerouslySetInnerHTML={{
                __html: prepareRichTextHtmlForRender(post.content, 'block'),
              }}
            />
          ) : !hasExcerpt ? (
            <p className="text-sm text-slate-500 italic">
              Konten lengkap artikel belum tersedia.
            </p>
          ) : null}

          <footer className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Bagikan artikel ini:
            </span>
            <BeritaShareBar title={plainTitle} />
          </footer>
        </div>
      </article>

      {/* Publikasi Lainnya */}
      {related.length > 0 && (
        <section aria-label="Publikasi Lainnya" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Publikasi Lainnya</span>
            </h2>
            <Link
              href="/berita"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 py-1 shrink-0"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((item) => {
              const shortDate = formatShortDate(item.published_at);
              return (
                <Link
                  key={item.id}
                  href={`/berita/${encodeURIComponent(item.slug.trim())}`}
                  className="modular-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 hover:border-emerald-300 transition min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="space-y-2 min-w-0">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(
                        item.category
                      )}`}
                    >
                      {formatCategoryLabel(item.category)}
                    </span>
                    <h3
                      className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 [overflow-wrap:anywhere] group-hover:text-emerald-700 transition-colors rich-text-inline"
                      dangerouslySetInnerHTML={{
                        __html: prepareRichTextHtmlForRender(item.title, 'inline-single'),
                      }}
                    />
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed [overflow-wrap:anywhere]">
                      {cleanPlainSnippet(item.excerpt || item.content, 110) ||
                        'Baca informasi selengkapnya.'}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="truncate">{shortDate || 'Publikasi'}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
                      <span>Baca</span>
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function BeritaDetailSkeleton() {
  return (
    <div
      className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-48 rounded bg-slate-200/80" />
        <div className="h-10 w-28 rounded-xl bg-slate-200/70" />
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-10 space-y-6">
        <div className="space-y-3">
          <div className="h-6 w-24 rounded-full bg-emerald-100/80" />
          <div className="h-8 w-5/6 rounded-xl bg-slate-200/80" />
          <div className="h-8 w-2/3 rounded-xl bg-slate-200/70" />
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="h-4 w-28 rounded bg-slate-200/70" />
            <div className="h-4 w-36 rounded bg-slate-200/70" />
            <div className="h-4 w-24 rounded bg-slate-200/70" />
          </div>
        </div>
        <div className="h-20 w-full rounded-r-xl bg-emerald-50/70" />
        <div className="space-y-2.5">
          <div className="h-4 w-full rounded bg-slate-200/70" />
          <div className="h-4 w-full rounded bg-slate-200/70" />
          <div className="h-4 w-11/12 rounded bg-slate-200/70" />
          <div className="h-4 w-4/5 rounded bg-slate-200/70" />
        </div>
      </div>
    </div>
  );
}

export default function BeritaDetailPage({ params }: PageProps) {
  return (
    <PublicShell>
      <Suspense fallback={<BeritaDetailSkeleton />}>
        <BeritaDetailContent params={params} />
      </Suspense>
    </PublicShell>
  );
}
