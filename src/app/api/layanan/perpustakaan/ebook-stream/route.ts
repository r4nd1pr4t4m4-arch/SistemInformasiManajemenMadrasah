import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  const bookId = request.nextUrl.searchParams.get('book_id');
  if (!bookId) {
    return NextResponse.json({ error: 'book_id wajib diisi.' }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: book, error: bookErr } = await supabase
    .from('library_books')
    .select('id, title, book_format, ebook_file_url, is_premium')
    .eq('id', bookId)
    .maybeSingle();

  if (bookErr || !book) {
    return NextResponse.json({ error: 'E-Book tidak ditemukan.' }, { status: 404 });
  }

  if (book.book_format !== 'EBOOK' && book.book_format !== 'KEDUANYA') {
    return NextResponse.json({ error: 'Koleksi ini bukan format E-Book.' }, { status: 400 });
  }

  const session = await getCurrentUserWithRoles();

  if (book.is_premium) {
    if (!session) {
      return NextResponse.json(
        { error: 'Buku Premium: silakan masuk dan dapatkan izin akses dari Admin.' },
        { status: 403 }
      );
    }

    const isAdminOrLibrarian = hasAnyRole(session, PERMISSIONS.PERPUSTAKAAN_MANAGE);
    if (!isAdminOrLibrarian) {
      const { data: grant } = await supabase
        .from('ebook_access_grants')
        .select('id, expires_at')
        .eq('book_id', book.id)
        .eq('user_id', session.userId)
        .eq('is_revoked', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (!grant) {
        return NextResponse.json(
          { error: 'Anda belum memiliki izin aktif dari Admin untuk membaca buku premium ini.' },
          { status: 403 }
        );
      }
    }
  }

  const fileUrl = book.ebook_file_url as string | null;
  if (!fileUrl) {
    return NextResponse.json({ error: 'File PDF E-Book belum tersedia.' }, { status: 404 });
  }

  try {
    const resolvedUrl = fileUrl.startsWith('http')
      ? fileUrl
      : new URL(fileUrl, request.nextUrl.origin).toString();

    const upstream = await fetch(resolvedUrl, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Gagal mengambil berkas E-Book dari penyimpanan.' },
        { status: 502 }
      );
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memuat aliran E-Book.' }, { status: 500 });
  }
}
