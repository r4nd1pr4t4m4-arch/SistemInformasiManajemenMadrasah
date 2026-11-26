import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { parseCaptchaHeader, verifyCaptchaToken } from '@/lib/security/captcha-server';
import { sanitizeApiError } from '@/lib/security/api-error';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { PERMISSIONS } from '@/lib/auth/rbac';

const ALLOWED_DATA_URL_PREFIX =
  /^data:(application\/pdf|image\/jpeg|image\/jpg|image\/png|image\/webp);base64,[A-Za-z0-9+/=]+$/i;

const PublicIncomingLetterSchema = z.object({
  sender_organization: z
    .string()
    .trim()
    .min(3, 'Nama pengirim / instansi asal minimal 3 karakter.')
    .max(160, 'Nama pengirim / instansi terlalu panjang.'),
  sender_contact: z
    .string()
    .trim()
    .min(5, 'Kontak (WhatsApp / Email) pengirim wajib diisi.')
    .max(120, 'Kontak pengirim terlalu panjang.'),
  letter_number: z
    .string()
    .trim()
    .min(2, 'Nomor surat asal minimal 2 karakter.')
    .max(100, 'Nomor surat asal terlalu panjang.'),
  letter_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal surat tidak valid.'),
  category: z
    .enum([
      'SURAT_UNDANGAN',
      'SURAT_PENGANTAR',
      'SURAT_IZIN',
      'SURAT_REKOMENDASI',
      'SURAT_EDARAN',
      'LAINNYA',
    ])
    .default('SURAT_PENGANTAR'),
  subject: z
    .string()
    .trim()
    .min(4, 'Perihal surat minimal 4 karakter.')
    .max(240, 'Perihal surat terlalu panjang.'),
  summary: z
    .string()
    .trim()
    .min(5, 'Ringkasan maksud / keperluan surat wajib diisi.')
    .max(2000, 'Ringkasan surat maksimal 2000 karakter.'),
  file_data_url: z.string().trim().optional().nullable(),
  file_name: z.string().trim().max(200).optional().nullable(),
});

function extractReceiptTicketFromSummary(summary?: string | null): string | null {
  if (!summary) return null;
  const match = summary.match(/\[Resi:\s*(SM-\d{8}-[A-Z0-9]+)\b/i);
  return match?.[1] ? match[1].toUpperCase() : null;
}

export function stripReceiptMetaPrefix(summary?: string | null): string {
  if (!summary) return '';
  return summary.replace(/^\[Resi:[^\]]+\]\s*/i, '').trim();
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ circulars: [], trackedLetter: null, institution: null });
  }

  const supabase = createSupabaseAdminClient();
  const ticket = request.nextUrl.searchParams.get('ticket')?.trim() || '';

  // 1. Ambil daftar Surat Edaran Resmi (dengan fallback bila kolom migrasi 0046 belum tersedia)
  const [circularRes, instRes] = await Promise.all([
    supabase
      .from('letters')
      .select(
        'id, direction, category, letter_number, letter_date, subject, counterparty, summary, file_url, attachment_name, signatory_name, signatory_title, status, priority, classification_code'
      )
      .eq('direction', 'KELUAR')
      .eq('category', 'SURAT_EDARAN')
      .order('letter_date', { ascending: false })
      .limit(50),
    supabase
      .from('institution_settings')
      .select(
        'institution_type, name, short_name, address, phone, email, website_url, headmaster_name, head_title_label, nsm, npsn, accreditation, logo_url'
      )
      .limit(1)
      .maybeSingle(),
  ]);

  let rawCirculars: Array<Record<string, unknown>> = [];
  if (!circularRes.error && circularRes.data) {
    rawCirculars = circularRes.data as Array<Record<string, unknown>>;
  } else {
    const fallbackCirculars = await supabase
      .from('letters')
      .select('id, direction, category, letter_number, letter_date, subject, counterparty, summary, file_url')
      .eq('direction', 'KELUAR')
      .eq('category', 'SURAT_EDARAN')
      .order('letter_date', { ascending: false })
      .limit(50);
    rawCirculars = (fallbackCirculars.data || []) as Array<Record<string, unknown>>;
  }

  // Filter hanya surat edaran yang berstatus TERBIT / DIARSIPKAN (bukan DRAFT atau DIBATALKAN)
  const circulars = rawCirculars.filter((c) => {
    const st = String(c.status || 'TERBIT').toUpperCase();
    return st !== 'DRAFT' && st !== 'DIBATALKAN';
  });

  // 2. Pelacakan Surat Masuk berdasarkan Nomor Resi (SM-...) atau Nomor Surat Asal
  let trackedLetter: Record<string, unknown> | null = null;
  if (ticket.length >= 2) {
    const safeTicket = ticket.replace(/[\\%_]/g, '\\$&');
    const isReceiptFormat = /^SM-\d{8}-[A-Z0-9]+$/i.test(ticket);

    // Coba query dengan kolom receipt_ticket terlebih dahulu (hanya untuk direction = 'MASUK')
    const enrichedTrack = await supabase
      .from('letters')
      .select(
        'id, direction, category, letter_number, letter_date, subject, counterparty, summary, status, priority, receipt_ticket, created_at'
      )
      .eq('direction', 'MASUK')
      .or(
        isReceiptFormat
          ? `receipt_ticket.ilike.${safeTicket},summary.ilike.%[Resi: ${safeTicket}%`
          : `receipt_ticket.ilike.${safeTicket},letter_number.ilike.${safeTicket},summary.ilike.%[Resi: ${safeTicket}%`
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let foundLetter: Record<string, unknown> | null = null;
    if (!enrichedTrack.error && enrichedTrack.data) {
      foundLetter = enrichedTrack.data as Record<string, unknown>;
    } else if (enrichedTrack.error) {
      // Fallback aman apabila kolom receipt_ticket/status belum dimigrasikan pada DB
      const fallbackTrack = await supabase
        .from('letters')
        .select('id, direction, category, letter_number, letter_date, subject, counterparty, summary, created_at')
        .eq('direction', 'MASUK')
        .or(
          isReceiptFormat
            ? `summary.ilike.%[Resi: ${safeTicket}%`
            : `letter_number.ilike.${safeTicket},summary.ilike.%[Resi: ${safeTicket}%`
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackTrack.data) {
        foundLetter = fallbackTrack.data as Record<string, unknown>;
      }
    }

    if (foundLetter) {
      const { data: disps } = await supabase
        .from('letter_dispositions')
        .select(
          'id, instruction, notes, status, priority, due_date, completion_notes, completed_at, created_at, assignee:teachers_staff(full_name)'
        )
        .eq('letter_id', String(foundLetter.id))
        .order('created_at', { ascending: false });

      const resolvedTicket =
        (foundLetter.receipt_ticket as string | null) ||
        extractReceiptTicketFromSummary(foundLetter.summary as string | null) ||
        null;

      trackedLetter = {
        ...foundLetter,
        receipt_ticket: resolvedTicket,
        clean_summary: stripReceiptMetaPrefix(foundLetter.summary as string | null),
        dispositions: disps || [],
      };
    }
  }

  return NextResponse.json({
    circulars,
    trackedLetter,
    institution: instRes.data || null,
  });
}

export async function POST(request: NextRequest) {
  const captchaPayload = parseCaptchaHeader(request);
  const captchaResult = await verifyCaptchaToken(captchaPayload, request);
  if (!captchaResult.success) {
    return NextResponse.json(
      {
        error: captchaResult.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
        turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
      },
      { status: 403 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = PublicIncomingLetterSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Data pengiriman surat tidak valid.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const rawDataUrl = parsed.data.file_data_url?.trim() || '';
    if (rawDataUrl) {
      if (rawDataUrl.length > 2.2 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Ukuran berkas lampiran maksimal 1.5 MB untuk pengiriman publik.' },
          { status: 400 }
        );
      }
      if (!ALLOWED_DATA_URL_PREFIX.test(rawDataUrl)) {
        return NextResponse.json(
          { error: 'Format berkas lampiran tidak valid. Gunakan file PDF, JPG, PNG, atau WEBP.' },
          { status: 400 }
        );
      }
    }

    const supabase = createSupabaseAdminClient();
    const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
    const receiptTicket = `SM-${todayCompact}-${randomCode}`;

    const summaryWithMeta = `[Resi: ${receiptTicket} | Kontak: ${parsed.data.sender_contact}] ${parsed.data.summary}`;

    let { data: inserted, error } = await supabase
      .from('letters')
      .insert({
        direction: 'MASUK',
        category: parsed.data.category,
        letter_number: parsed.data.letter_number,
        letter_date: parsed.data.letter_date,
        subject: parsed.data.subject,
        counterparty: parsed.data.sender_organization,
        summary: summaryWithMeta,
        file_url: rawDataUrl || null,
        attachment_name: parsed.data.file_name?.trim() || null,
        receipt_ticket: receiptTicket,
        sender_contact: parsed.data.sender_contact,
        status: 'TERBIT',
        priority: 'BIASA',
      })
      .select('id, letter_number, subject, counterparty, letter_date, receipt_ticket')
      .single();

    if (error) {
      // Fallback jika kolom migrasi 0046/0048 belum diaplikasikan pada DB remote
      const fallbackCategory = ['SURAT_UNDANGAN', 'SURAT_EDARAN', 'LAINNYA'].includes(
        parsed.data.category
      )
        ? parsed.data.category
        : 'LAINNYA';
      const fallbackRes = await supabase
        .from('letters')
        .insert({
          direction: 'MASUK',
          category: fallbackCategory,
          letter_number: parsed.data.letter_number,
          letter_date: parsed.data.letter_date,
          subject: parsed.data.subject,
          counterparty: parsed.data.sender_organization,
          summary: summaryWithMeta,
          file_url: rawDataUrl || null,
        })
        .select('id, letter_number, subject, counterparty, letter_date')
        .single();
      inserted = fallbackRes.data
        ? { ...fallbackRes.data, receipt_ticket: receiptTicket }
        : null;
      error = fallbackRes.error;
    }

    if (error || !inserted) {
      return NextResponse.json(
        { error: sanitizeApiError(error) || 'Gagal mengirim surat masuk.' },
        { status: 500 }
      );
    }

    try {
      await dispatchNotification({
        categoryKey: 'PERPUSTAKAAN_SURAT',
        title: `Surat Masuk Eksternal Baru (${receiptTicket})`,
        body: `Dari ${parsed.data.sender_organization}: "${parsed.data.subject}" (No: ${parsed.data.letter_number}).`,
        url: '/portal/layanan/persuratan',
        sourceType: 'SYSTEM_EVENT',
        dedupeKey: `pub-letter-${inserted.id}`,
        target: { roles: PERMISSIONS.PERSURATAN_VIEW },
      });
    } catch {
      // Abaikan jika push gagal
    }

    return NextResponse.json({
      submitted: true,
      receiptTicket,
      letter: inserted,
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses pengiriman surat masuk.' }, { status: 500 });
  }
}
