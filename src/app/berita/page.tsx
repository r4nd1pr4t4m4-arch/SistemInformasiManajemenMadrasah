import { Suspense } from 'react';
import { Newspaper } from 'lucide-react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/layout/public-shell';
import { getPublishedPosts } from '@/lib/data/public-queries';

async function BeritaContent() {
  await connection();
  const posts = await getPublishedPosts(30);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {posts.map((post) => (
        <article
          key={post.id}
          className="modular-card rounded-3xl p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {post.category.replace('_', ' ')}
            </span>
            <h2 className="font-bold text-slate-900 leading-snug">{post.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {post.excerpt || post.content.slice(0, 140)}
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{post.author_display_name || 'Tim Redaksi'}</span>
            <span>
              {post.published_at
                ? new Date(post.published_at).toLocaleDateString('id-ID')
                : ''}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function BeritaPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Publikasi &amp; Informasi Lembaga
            </h1>
            <p className="text-sm text-slate-600">
              Liputan kegiatan, pengumuman ujian/libur, artikel pendidikan, serta karya tulis guru dan siswa.
            </p>
          </div>
          <span className="hidden sm:inline-flex text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5" /> Berita &amp; Artikel
          </span>
        </div>

        <Suspense
          fallback={
            <div className="glass-card rounded-3xl p-8 text-center text-sm text-slate-500">
              Memuat publikasi...
            </div>
          }
        >
          <BeritaContent />
        </Suspense>
      </div>
    </PublicShell>
  );
}
