import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

const InquirySchema = z.object({
  senderName: z.string().min(2),
  senderEmail: z.string().email().optional().or(z.literal('')),
  senderPhone: z.string().optional().default(''),
  category: z.enum(['ASPIRASI', 'PENGADUAN', 'INFORMASI']).default('ASPIRASI'),
  subject: z.string().min(3),
  message: z.string().min(5),
});

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

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('inquiries').insert({
      sender_name: parsed.data.senderName,
      sender_email: parsed.data.senderEmail || null,
      sender_phone: parsed.data.senderPhone || null,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'BARU',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Pesan Anda berhasil dikirim.' });
  } catch {
    return NextResponse.json(
      { error: 'Gagal mengirim pesan.' },
      { status: 500 }
    );
  }
}
