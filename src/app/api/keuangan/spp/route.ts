import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const CreateFeeTypeSchema = z.object({
  action: z.literal('CREATE_FEE_TYPE'),
  name: z.string().min(2),
  category: z.enum(['SPP', 'KOMITE', 'UANG_GEDUNG', 'LAINNYA']),
  default_amount: z.number().min(0),
  is_recurring_monthly: z.boolean().default(true),
});

const CreateBillSchema = z.object({
  action: z.literal('CREATE_BILL'),
  student_id: z.string().uuid(),
  fee_type_id: z.string().uuid(),
  billing_month: z.number().min(1).max(12).optional().nullable(),
  billing_year: z.number().min(2020).max(2100).optional().nullable(),
  amount: z.number().min(1),
  due_date: z.string().optional().nullable(),
});

const RecordPaymentSchema = z.object({
  action: z.literal('RECORD_PAYMENT'),
  bill_id: z.string().uuid(),
  amount_paid: z.number().min(1),
  payment_method: z.enum(['TUNAI', 'TRANSFER', 'QRIS']).default('TUNAI'),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.SPP_KOMITE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ feeTypes: [], bills: [], payments: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: feeTypes }, { data: bills }, { data: payments }] = await Promise.all([
    supabase.from('fee_types').select('*').order('name'),
    supabase
      .from('student_bills')
      .select('*, student:students(full_name, nis), fee_type:fee_types(name, category)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('bill_payments')
      .select('*, bill:student_bills(student:students(full_name), fee_type:fee_types(name))')
      .order('payment_date', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    feeTypes: feeTypes || [],
    bills: bills || [],
    payments: payments || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.SPP_KOMITE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_FEE_TYPE') {
      const parsed = CreateFeeTypeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data jenis biaya tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('fee_types')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ feeType: data });
    }

    if (body.action === 'CREATE_BILL') {
      const parsed = CreateBillSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data tagihan tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('student_bills')
        .insert({
          ...payload,
          paid_amount: 0,
          status: 'BELUM_LUNAS',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ bill: data });
    }

    if (body.action === 'RECORD_PAYMENT') {
      const parsed = RecordPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembayaran tidak valid.' }, { status: 400 });
      }

      const { data: bill, error: billErr } = await supabase
        .from('student_bills')
        .select('id, amount, paid_amount')
        .eq('id', parsed.data.bill_id)
        .single();

      if (billErr || !bill) {
        return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 });
      }

      const newPaid = Number(bill.paid_amount) + parsed.data.amount_paid;
      const totalAmount = Number(bill.amount);
      const newStatus =
        newPaid >= totalAmount ? 'LUNAS' : newPaid > 0 ? 'CICILAN' : 'BELUM_LUNAS';

      const receiptNumber = `KW-${Date.now().toString().slice(-8)}`;
      const { data: payment, error: payErr } = await supabase
        .from('bill_payments')
        .insert({
          bill_id: bill.id,
          receipt_number: receiptNumber,
          amount_paid: parsed.data.amount_paid,
          payment_method: parsed.data.payment_method,
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

      await supabase
        .from('student_bills')
        .update({ paid_amount: newPaid, status: newStatus })
        .eq('id', bill.id);

      return NextResponse.json({ payment, status: newStatus });
    }

    return NextResponse.json({ error: 'Aksi SPP/Komite tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses data SPP/Komite.' }, { status: 500 });
  }
}
