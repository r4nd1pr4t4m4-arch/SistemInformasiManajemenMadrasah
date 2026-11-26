import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Newspaper, User } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { BeritaShareBar } from '@/components/berita/berita-share-bar';
import { getInstitutionSettings, getPostBySlug, getPublishedPosts } from '@/lib/data/public-queries';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [post, school] = await Promise.all([getPostBySlug(slug), getInstitutionSettings()]);
  if (!post) {
    return { title: 'Artikel Tidak Ditemukan' };
  }
  const description =
    post.excerpt?.trim() || (post.content ? post.content.slice(0, 160) : school.name);
  return {
    title: `${post.title} — ${school.short_name || school.name}`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      ...(post.cover_image_url ? { images: [post.cover_image_url] } : {}),
    },
  };
}

export default async function BeritaDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [post, recentPosts] = await Promise.all([getPostBySlug(slug), getPublishedPosts(5)]);

  if (!post) {
    notFound();
  }

  const related = recentPosts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <PublicShell>
      <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-8">
        <div>
          <Link
            href="/berita"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Berita &amp; Pengumuman
          </Link>
        </div>

        <article className="glass-card rounded-3xl overflow-hidden">
          {post.cover_image_url && (
            <div className="w-full aspect-[16/9] bg-slate-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8 md:p-10 space-y-6">
            <div className="space-y-3">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                {(post.category || 'BERITA').replaceAll('_', ' ')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  {post.author_display_name || 'Tim Redaksi'}
                </span>
                {formattedDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>

            {post.excerpt?.trim() && (
              <p className="text-sm sm:text-base font-medium text-slate-700 bg-slate-50 border-l-4 border-emerald-500 px-4 py-3 rounded-r-xl leading-relaxed">
                {post.excerpt}
              </p>
            )}

            <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line break-words">
              {post.content}
            </div>

            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">Bagikan artikel ini:</span>
              <BeritaShareBar title={post.title} />
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-emerald-700" />
              Publikasi Lainnya
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/berita/${item.slug}`}
                  className="modular-card rounded-2xl p-4 space-y-2 hover:border-emerald-300 transition"
                >
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    {(item.category || 'BERITA').replaceAll('_', ' ')}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {item.excerpt || item.content?.slice(0, 100)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}
