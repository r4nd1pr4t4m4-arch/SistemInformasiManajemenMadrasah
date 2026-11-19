import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { getR2ObjectBuffer, isR2Configured } from '@/lib/storage/r2';

function normalizeEbookUrl(rawUrl: string, origin: string): string {
  const trimmed = rawUrl.trim();
  // Convert Google Drive share links to direct download URLs
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFileMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
  }
  const driveOpenMatch = trimmed.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (driveOpenMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveOpenMatch[1]}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, origin).toString();
}

function isPdfBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  // Check for "%PDF-" (0x25 0x50 0x44 0x46 0x2D) within first 1024 bytes
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46 &&
      bytes[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

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

  const fileUrl = (book.ebook_file_url as string | null)?.trim();
  if (!fileUrl) {
    return NextResponse.json({ error: 'File PDF E-Book belum tersedia.' }, { status: 404 });
  }

  try {
    let bytes: Uint8Array | null = null;

    // 1. Check if stored in Cloudflare R2 (either object key like "ebooks/..." or matching R2_PUBLIC_URL)
    const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
    if (isR2Configured()) {
      let r2Key: string | null = null;
      if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
        r2Key = fileUrl;
      } else if (r2PublicBase && fileUrl.startsWith(r2PublicBase)) {
        r2Key = fileUrl.slice(r2PublicBase.length).replace(/^\/+/, '');
      }

      if (r2Key) {
        bytes = await getR2ObjectBuffer(r2Key);
      }
    }

    // 2. Otherwise fetch via HTTP(S)
    if (!bytes) {
      const resolvedUrl = normalizeEbookUrl(fileUrl, request.nextUrl.origin);
      const upstream = await fetch(resolvedUrl, { cache: 'no-store', redirect: 'follow' });
      if (!upstream.ok) {
        return NextResponse.json(
          {
            error: `Gagal mengambil berkas E-Book dari URL sumber (HTTP ${upstream.status}). Pastikan URL dapat diakses langsung.`,
          },
          { status: 502 }
        );
      }
      bytes = new Uint8Array(await upstream.arrayBuffer());
    }

    if (!isPdfBuffer(bytes)) {
      return NextResponse.json(
        {
          error:
            'URL E-Book tidak mengarah ke file PDF yang valid (mungkin berupa halaman HTML, link Google Drive yang masih private, atau halaman login). Gunakan link file PDF langsung atau unggah ke penyimpanan R2.',
        },
        { status: 422 }
      );
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Gagal memuat aliran E-Book: ${err.message}`
            : 'Gagal memuat aliran E-Book.',
      },
      { status: 500 }
    );
  }
}
