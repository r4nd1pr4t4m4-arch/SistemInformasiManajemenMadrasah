import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { getR2ObjectStream, isR2Configured } from '@/lib/storage/r2';

function normalizeEbookUrl(rawUrl: string, origin: string): string {
  const trimmed = rawUrl.trim();
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

function isPdfHeaderInChunk(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
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

function createPrefixedStream(
  firstChunk: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstChunk);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
      } else if (value) {
        controller.enqueue(value);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
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

  const rangeHeader = request.headers.get('range');
  const isInitialRequest = !rangeHeader || rangeHeader.startsWith('bytes=0-');

  try {
    // 1. Stream directly from Cloudflare R2 if stored there
    const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
    if (isR2Configured()) {
      let r2Key: string | null = null;
      if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
        r2Key = fileUrl;
      } else if (r2PublicBase && fileUrl.startsWith(r2PublicBase)) {
        r2Key = fileUrl.slice(r2PublicBase.length).replace(/^\/+/, '');
      }

      if (r2Key) {
        const r2Res = await getR2ObjectStream(r2Key, rangeHeader);
        const headers: Record<string, string> = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex, nofollow',
        };
        if (r2Res.contentLength != null) {
          headers['Content-Length'] = String(r2Res.contentLength);
        }
        if (r2Res.contentRange) {
          headers['Content-Range'] = r2Res.contentRange;
        }
        return new NextResponse(r2Res.stream as ReadableStream<Uint8Array>, {
          status: r2Res.isPartial ? 206 : 200,
          headers,
        });
      }
    }

    // 2. Otherwise stream from upstream HTTP(S) with Range pass-through
    const resolvedUrl = normalizeEbookUrl(fileUrl, request.nextUrl.origin);
    const upstream = await fetch(resolvedUrl, {
      cache: 'no-store',
      redirect: 'follow',
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        {
          error: `Gagal mengambil berkas E-Book dari URL sumber (HTTP ${upstream.status}). Pastikan URL dapat diakses langsung.`,
        },
        { status: 502 }
      );
    }

    const upstreamContentType = upstream.headers.get('content-type') || '';
    if (upstreamContentType.includes('text/html')) {
      return NextResponse.json(
        {
          error:
            'URL E-Book mengembalikan halaman HTML, bukan file PDF. Gunakan link PDF langsung atau unggah ke penyimpanan R2.',
        },
        { status: 422 }
      );
    }

    if (!upstream.body) {
      return NextResponse.json({ error: 'Respons berkas E-Book kosong.' }, { status: 502 });
    }

    let responseStream: ReadableStream<Uint8Array> = upstream.body;

    // Peek at the very first chunk only on initial/bytes=0- request to verify %PDF- header without buffering the whole file
    if (isInitialRequest) {
      const reader = upstream.body.getReader();
      const { done, value } = await reader.read();
      if (done || !value || !isPdfHeaderInChunk(value)) {
        reader.cancel();
        return NextResponse.json(
          {
            error:
              'URL E-Book tidak mengarah ke file PDF yang valid (mungkin berupa halaman HTML, link Google Drive yang masih private, atau halaman login).',
          },
          { status: 422 }
        );
      }
      responseStream = createPrefixedStream(value, reader);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    };

    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    if (contentLength) headers['Content-Length'] = contentLength;
    if (contentRange) headers['Content-Range'] = contentRange;

    return new NextResponse(responseStream, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
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
