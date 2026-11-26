import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { verifyCaptchaToken } from '@/lib/security/captcha-server';
import type { CaptchaPayload } from '@/lib/security/captcha-types';
import { sanitizeApiError } from '@/lib/security/api-error';
import { notifyNewInquiry } from '@/lib/notifications/event-hooks';

const InquirySchema = z.object({
  senderName: z.string().min(2),
  senderEmail: z.string().email().optional().or(z.literal('')),
  senderPhone: z.string().optional().default(''),
  category: z.enum(['ASPIRASI', 'PENGADUAN', 'INFORMASI']).default('ASPIRASI'),
  subject: z.string().min(3),
  message: z.string().min(5),
  captcha: z.custom<CaptchaPayload>().optional(),
});

const InquiryAdminUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['BARU', 'DIPROSES', 'SELESAI']),
  response: z.string().trim().optional().nullable(),
});

function generateTicketCode(): string {
  const dateCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ADU-${dateCompact}-${rand}`;
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ inquiries: [] });
  }

  const { searchParams } = new URL(request.url);
  const ticket = searchParams.get('ticket')?.trim().toUpperCase();
  const supabase = createSupabaseAdminClient();

  // Mode Pelacakan Tiket Publik (tanpa login)
  if (ticket) {
    const { data, error } = await supabase
      .from('inquiries')
      .select('ticket_code, category, subject, status, response, responded_at, created_at, updated_at')
      .eq('ticket_code', ticket)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: `Nomor tiket ${ticket} tidak ditemukan.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ ticket: data });
  }

  // Mode Kotak Masuk Admin CMS
  const guard = await requireApiRoles(PERMISSIONS.CMS_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ inquiries: data || [] });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = InquirySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Mohon lengkapi form pengaduan/aspirasi dengan benar.' },
        { status: 400 }
      );
    }

    const captchaResult = await verifyCaptchaToken(parsed.data.captcha, request);
    if (!captchaResult.success) {
      return NextResponse.json(
        {
          error: captchaResult.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
          turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const ticketCode = generateTicketCode();
    const { data: insertedInquiry, error } = await supabase
      .from('inquiries')
      .insert({
        sender_name: parsed.data.senderName,
        sender_email: parsed.data.senderEmail || null,
        sender_phone: parsed.data.senderPhone || null,
        category: parsed.data.category,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: 'BARU',
        ticket_code: ticketCode,
      })
      .select('id, ticket_code')
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }

    if (insertedInquiry?.id) {
      await notifyNewInquiry({
        inquiryId: insertedInquiry.id,
        senderName: parsed.data.senderName,
        subject: parsed.data.subject,
      });
    }

    return NextResponse.json({
      ticketCode: insertedInquiry?.ticket_code || ticketCode,
      message: 'Pesan Anda berhasil dikirim.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal mengirim pesan.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = InquiryAdminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tindak lanjut pengaduan tidak valid.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const supabase = createSupabaseAdminClient();
    const updatePayload: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: nowIso,
    };
    if (parsed.data.response !== undefined) {
      updatePayload.response = parsed.data.response || null;
      if (parsed.data.response) {
        updatePayload.responded_by = guard.session.userId;
        updatePayload.responded_at = nowIso;
      }
    }

    const { data, error } = await supabase
      .from('inquiries')
      .update(updatePayload)
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ inquiry: data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status pengaduan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.CMS_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID pengaduan wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('inquiries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
