import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';

const OpenAccountSchema = z.object({
  action: z.literal('OPEN_ACCOUNT'),
  owner_type: z.enum(['SISWA', 'GURU', 'TU', 'UMUM']),
  student_id: z.string().uuid().optional().nullable(),
  teacher_id: z.string().uuid().optional().nullable(),
  owner_name: z.string().min(2),
  owner_phone: z.string().optional().nullable(),
  owner_address: z.string().optional().nullable(),
  initial_deposit: z.number().min(0).default(0),
});

const TransactionSchema = z.object({
  action: z.literal('TRANSACTION'),
  account_id: z.string().uuid(),
  transaction_type: z.enum(['SETOR', 'TARIK']),
  amount: z.number().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.TABUNGAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ accounts: [], transactions: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: false }),
    supabase
      .from('savings_transactions')
      .select('*, account:savings_accounts(account_number, owner_name, owner_type)')
      .order('transaction_date', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    accounts: accounts || [],
    transactions: transactions || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.TABUNGAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'OPEN_ACCOUNT') {
      const parsed = OpenAccountSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembukaan rekening tidak valid.' }, { status: 400 });
      }

      const prefix =
        parsed.data.owner_type === 'SISWA'
          ? 'TAB-S'
          : parsed.data.owner_type === 'GURU'
          ? 'TAB-G'
          : parsed.data.owner_type === 'TU'
          ? 'TAB-T'
          : 'TAB-U';
      const accountNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

      const { data: account, error } = await supabase
        .from('savings_accounts')
        .insert({
          account_number: accountNumber,
          owner_type: parsed.data.owner_type,
          student_id: parsed.data.student_id || null,
          teacher_id: parsed.data.teacher_id || null,
          owner_name: parsed.data.owner_name,
          owner_phone: parsed.data.owner_phone || null,
          owner_address: parsed.data.owner_address || null,
          balance: parsed.data.initial_deposit,
          is_active: true,
        })
        .select('*')
        .single();

      if (error || !account) {
        return NextResponse.json({ error: error?.message || 'Gagal membuka rekening.' }, { status: 500 });
      }

      if (parsed.data.initial_deposit > 0) {
        await supabase.from('savings_transactions').insert({
          account_id: account.id,
          transaction_type: 'SETOR',
          amount: parsed.data.initial_deposit,
          balance_after: parsed.data.initial_deposit,
          reference_number: `TRX-${Date.now().toString().slice(-8)}`,
          notes: 'Setoran awal pembukaan buku tabungan',
        });
      }

      return NextResponse.json({ account });
    }

    if (body.action === 'TRANSACTION') {
      const parsed = TransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data transaksi tabungan tidak valid.' }, { status: 400 });
      }

      const { data: account, error: accErr } = await supabase
        .from('savings_accounts')
        .select('id, balance')
        .eq('id', parsed.data.account_id)
        .single();

      if (accErr || !account) {
        return NextResponse.json({ error: 'Rekening tabungan tidak ditemukan.' }, { status: 404 });
      }

      const currentBalance = Number(account.balance);
      if (parsed.data.transaction_type === 'TARIK' && currentBalance < parsed.data.amount) {
        return NextResponse.json(
          { error: 'Saldo tabungan tidak mencukupi untuk penarikan.' },
          { status: 400 }
        );
      }

      const newBalance =
        parsed.data.transaction_type === 'SETOR'
          ? currentBalance + parsed.data.amount
          : currentBalance - parsed.data.amount;

      const { data: trx, error: trxErr } = await supabase
        .from('savings_transactions')
        .insert({
          account_id: account.id,
          transaction_type: parsed.data.transaction_type,
          amount: parsed.data.amount,
          balance_after: newBalance,
          reference_number: `TRX-${Date.now().toString().slice(-8)}`,
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (trxErr) return NextResponse.json({ error: trxErr.message }, { status: 500 });

      await supabase
        .from('savings_accounts')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      return NextResponse.json({ transaction: trx, balance: newBalance });
    }

    return NextResponse.json({ error: 'Aksi tabungan tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses tabungan.' }, { status: 500 });
  }
}
