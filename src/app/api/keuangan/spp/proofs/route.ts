import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';
import { sanitizeApiError } from '@/lib/security/api-error';

const SubmitProofSchema = z.object({
  bill_id: z.string().uuid(),
  amount_claimed: z.number().positive('Nominal transfer harus lebih dari 0.'),
  payment_method: z.enum(['TRANSFER', 'QRIS']).default('TRANSFER'),
  transfer_date: z.string().min(8),
  proof_file_url: z.string().min(4, 'Tautan atau berkas bukti transfer wajib diisi.'),
  notes: z.string().optional().nullable(),
});

const ReviewProofSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['DISETUJUI', 'DITOLAK']),
  reviewer_notes: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ proofs: [] });
  }

  const supabase = createSupabaseAdminClient();
  const isSppStaff = hasAnyRole(session, PERMISSIONS.SPP_VIEW);

  if (isSppStaff) {
    const { data, error } = await supabase
      .from('spp_payment_proofs')
      .select(
        '*, student:students(id, full_name, nis), bill:student_bills(id, amount, paid_amount, status, billing_month, billing_year, fee_type:fee_types(name))'
      )
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ proofs: [] });
      return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    }
    return NextResponse.json({ proofs: data || [] });
  }

  // Siswa / Orang Tua: ambil bukti milik sendiri
  const { data, error } = await supabase
    .from('spp_payment_proofs')
    .select(
      '*, student:students(id, full_name, nis), bill:student_bills(id, amount, paid_amount, status, billing_month, billing_year, fee_type:fee_types(name))'
    )
    .eq('submitted_by', session.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ proofs: [] });
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }
  return NextResponse.json({ proofs: data || [] });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = SubmitProofSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data bukti transfer tidak valid.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: bill, error: billErr } = await supabase
      .from('student_bills')
      .select('id, student_id, amount, paid_amount, status')
      .eq('id', parsed.data.bill_id)
      .maybeSingle();

    if (billErr || !bill) {
      return NextResponse.json({ error: 'Tagihan SPP tidak ditemukan.' }, { status: 404 });
    }
    if (bill.status === 'LUNAS') {
      return NextResponse.json({ error: 'Tagihan ini sudah berstatus LUNAS.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('spp_payment_proofs')
      .insert({
        bill_id: bill.id,
        student_id: bill.student_id,
        submitted_by: session.userId,
        amount_claimed: parsed.data.amount_claimed,
        payment_method: parsed.data.payment_method,
        transfer_date: parsed.data.transfer_date,
        proof_file_url: parsed.data.proof_file_url,
        notes: parsed.data.notes || null,
        status: 'MENUNGGU_VERIFIKASI',
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
    return NextResponse.json({ proof: data });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim bukti transfer.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session || !hasAnyRole(session, PERMISSIONS.SPP_MANAGE)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ReviewProofSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data verifikasi tidak valid.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: proof, error: fetchErr } = await supabase
      .from('spp_payment_proofs')
      .select('*')
      .eq('id', parsed.data.id)
      .maybeSingle();

    if (fetchErr || !proof) {
      return NextResponse.json({ error: 'Bukti transfer tidak ditemukan.' }, { status: 404 });
    }
    if (proof.status !== 'MENUNGGU_VERIFIKASI') {
      return NextResponse.json({ error: 'Bukti transfer ini sudah diverifikasi sebelumnya.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (parsed.data.decision === 'DISETUJUI') {
      const { data: bill } = await supabase
        .from('student_bills')
        .select('id, amount, paid_amount, status, student_id')
        .eq('id', proof.bill_id)
        .single();

      if (bill) {
        const nextPaid = Number(bill.paid_amount || 0) + Number(proof.amount_claimed || 0);
        const billAmount = Number(bill.amount || 0);
        const nextStatus = nextPaid >= billAmount ? 'LUNAS' : 'SEBAGIAN';
        const receiptNumber = `TRF-${Date.now().toString().slice(-8)}`;

        await supabase.from('bill_payments').insert({
          bill_id: bill.id,
          amount_paid: Number(proof.amount_claimed),
          payment_method: proof.payment_method,
          payment_date: proof.transfer_date || nowIso.slice(0, 10),
          receipt_number: receiptNumber,
          received_by: session.userId,
          notes: `Verifikasi bukti transfer mandiri (${proof.id.slice(0, 8)})`,
        });

        await supabase
          .from('student_bills')
          .update({
            paid_amount: nextPaid,
            status: nextStatus,
            updated_at: nowIso,
          })
          .eq('id', bill.id);
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('spp_payment_proofs')
      .update({
        status: parsed.data.decision,
        reviewer_notes: parsed.data.reviewer_notes || null,
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', proof.id)
      .select('*')
      .single();

    if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });

    await notifyStudentFamilyEvent({
      studentId: proof.student_id,
      categoryKey: 'KEUANGAN_SPP',
      title:
        parsed.data.decision === 'DISETUJUI'
          ? 'Bukti Transfer SPP Disetujui'
          : 'Bukti Transfer SPP Ditolak',
      body:
        parsed.data.decision === 'DISETUJUI'
          ? `Pembayaran sebesar Rp${Number(proof.amount_claimed).toLocaleString('id-ID')} telah diverifikasi Bendahara.`
          : `Bukti transfer ditolak.${parsed.data.reviewer_notes ? ` Catatan: ${parsed.data.reviewer_notes}` : ''}`,
      url: '/portal/orang-tua/spp',
    });

    return NextResponse.json({ proof: updated });
  } catch {
    return NextResponse.json({ error: 'Gagal memverifikasi bukti transfer.' }, { status: 500 });
  }
}
