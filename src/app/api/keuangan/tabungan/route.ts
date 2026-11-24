import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  calculateWithdrawalFee,
  DEFAULT_WITHDRAWAL_FEE_TIERS,
  type SavingsFeeTier,
} from '@/lib/domain/tabungan-fee';
import { sanitizeApiError } from '@/lib/security/api-error';
import { recordAuditLog } from '@/lib/security/audit-log';
import { notifyStudentFamilyEvent, notifyUserDirect } from '@/lib/notifications/event-hooks';

const OpenAccountSchema = z.object({
  action: z.literal('OPEN_ACCOUNT'),
  owner_type: z.enum(['SISWA', 'GURU', 'TU', 'UMUM']),
  student_id: z.string().uuid().optional().nullable(),
  teacher_id: z.string().uuid().optional().nullable(),
  owner_name: z.string().min(2),
  owner_phone: z.string().optional().nullable(),
  owner_address: z.string().optional().nullable(),
  initial_deposit: z
    .number()
    .int('Setoran awal harus berupa bilangan bulat.')
    .min(0, 'Setoran awal tidak boleh negatif.')
    .refine((val) => val === 0 || (val >= 1000 && val % 1000 === 0), {
      message: 'Setoran awal minimal Rp 1.000 dan harus kelipatan Rp 1.000 (atau Rp 0).',
    })
    .default(0),
});

const TransactionSchema = z.object({
  action: z.literal('TRANSACTION'),
  account_id: z.string().uuid(),
  transaction_type: z.enum(['SETOR', 'TARIK']),
  amount: z
    .number()
    .int('Nominal transaksi harus berupa bilangan bulat.')
    .min(1000, 'Nominal transaksi minimal Rp 1.000.')
    .refine((val) => val % 1000 === 0, {
      message: 'Nominal transaksi harus kelipatan Rp 1.000.',
    }),
  notes: z.string().optional().nullable(),
});

const UpdateFeeTiersSchema = z.object({
  action: z.literal('UPDATE_FEE_TIERS'),
  tiers: z.array(
    z.object({
      id: z.string().uuid().optional().nullable(),
      tier_order: z.number().int().min(1),
      label: z.string().optional().nullable(),
      min_amount: z.number().min(0),
      max_amount: z.number().min(0).nullable().optional(),
      fee_percentage: z.number().min(0).max(100),
      is_active: z.boolean().default(true),
    })
  ),
});

const UpdateAccountSchema = z.object({
  action: z.literal('UPDATE_ACCOUNT'),
  id: z.string().uuid('ID rekening tidak valid.'),
  owner_name: z.string().trim().min(2, 'Nama pemilik rekening minimal 2 karakter.'),
  owner_phone: z.string().optional().nullable(),
  owner_type: z.enum(['SISWA', 'GURU', 'TU', 'UMUM']),
});

const DeleteAccountsSchema = z.object({
  action: z.literal('DELETE_ACCOUNTS'),
  ids: z
    .array(z.string().uuid('ID rekening tidak valid.'))
    .min(1, 'Minimal pilih 1 rekening untuk dihapus.')
    .max(100, 'Maksimal 100 rekening dapat dihapus sekaligus.'),
});

const UpdateTransactionSchema = z.object({
  action: z.literal('UPDATE_TRANSACTION'),
  id: z.string().uuid('ID transaksi tidak valid.'),
  transaction_type: z.enum(['SETOR', 'TARIK']),
  amount: z
    .number()
    .int('Nominal transaksi harus berupa bilangan bulat.')
    .min(1000, 'Nominal transaksi minimal Rp 1.000.')
    .refine((val) => val % 1000 === 0, {
      message: 'Nominal transaksi harus kelipatan Rp 1.000.',
    }),
  notes: z.string().optional().nullable(),
});

const DeleteTransactionsSchema = z.object({
  action: z.literal('DELETE_TRANSACTIONS'),
  ids: z
    .array(z.string().uuid('ID transaksi tidak valid.'))
    .min(1, 'Minimal pilih 1 transaksi untuk dihapus.')
    .max(100, 'Maksimal 100 transaksi dapat dihapus sekaligus.'),
});

async function recalculateAccountBalances(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  accountIds: string[]
): Promise<Record<string, number>> {
  const uniqueAccountIds = Array.from(new Set(accountIds.filter(Boolean)));
  const finalBalances: Record<string, number> = {};

  for (const accountId of uniqueAccountIds) {
    const { data: rows, error: fetchErr } = await supabase
      .from('savings_transactions')
      .select('id, transaction_type, amount, balance_after')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (fetchErr) {
      throw fetchErr;
    }

    let runningBalance = 0;
    for (const row of rows || []) {
      const amount = Number(row.amount || 0);
      runningBalance += row.transaction_type === 'SETOR' ? amount : -amount;
      if (Number(row.balance_after) !== runningBalance) {
        const { error: updTrxErr } = await supabase
          .from('savings_transactions')
          .update({ balance_after: runningBalance })
          .eq('id', row.id);
        if (updTrxErr) {
          throw updTrxErr;
        }
      }
    }

    const { error: updAccErr } = await supabase
      .from('savings_accounts')
      .update({ balance: runningBalance, updated_at: new Date().toISOString() })
      .eq('id', accountId);

    if (updAccErr) {
      throw updAccErr;
    }

    finalBalances[accountId] = runningBalance;
  }

  return finalBalances;
}

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.TABUNGAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      accounts: [],
      transactions: [],
      students: [],
      teachers: [],
      tuStaff: [],
      publicUsers: [],
      feeTiers: DEFAULT_WITHDRAWAL_FEE_TIERS,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: accounts },
    { data: transactions },
    { data: students },
    { data: gtkRows },
    { data: publicProfiles },
    { data: publicLibMembers },
    { data: feeTiers },
  ] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: false }),
    supabase
      .from('savings_transactions')
      .select('*, account:savings_accounts(account_number, owner_name, owner_type)')
      .order('transaction_date', { ascending: false })
      .limit(100),
    supabase
      .from('students')
      .select('id, full_name, nis, nisn, phone, status')
      .eq('status', 'AKTIF')
      .order('full_name'),
    supabase
      .from('teachers_staff')
      .select('id, full_name, nip, phone, staff_type, is_active')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, phone, email, primary_role, is_active, account_status')
      .eq('primary_role', 'UMUM')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('library_members')
      .select('id, full_name, phone, email, member_code, member_type')
      .eq('member_type', 'UMUM')
      .order('full_name'),
    supabase
      .from('savings_withdrawal_fee_tiers')
      .select('*')
      .order('tier_order', { ascending: true }),
  ]);

  const teachers = (gtkRows || []).filter((g) => g.staff_type === 'GURU');
  const tuStaff = (gtkRows || []).filter((g) => g.staff_type !== 'GURU');

  // Gabungkan pengguna UMUM dari profiles aktif dan anggota umum E-Library tanpa duplikasi nama
  const publicUsersMap = new Map<
    string,
    { id: string; full_name: string; phone: string | null; label: string }
  >();
  for (const p of publicProfiles || []) {
    if (p.account_status && p.account_status !== 'AKTIF') continue;
    const key = p.full_name.trim().toLowerCase();
    publicUsersMap.set(key, {
      id: `profile:${p.id}`,
      full_name: p.full_name,
      phone: p.phone || null,
      label: `${p.full_name}${p.email ? ` (${p.email})` : ' (Akun Umum)'}`,
    });
  }
  for (const m of publicLibMembers || []) {
    const key = m.full_name.trim().toLowerCase();
    if (!publicUsersMap.has(key)) {
      publicUsersMap.set(key, {
        id: `lib:${m.id}`,
        full_name: m.full_name,
        phone: m.phone || null,
        label: `${m.full_name} (${m.member_code})`,
      });
    }
  }

  return NextResponse.json({
    accounts: accounts || [],
    transactions: transactions || [],
    students: students || [],
    teachers,
    tuStaff,
    publicUsers: Array.from(publicUsersMap.values()),
    feeTiers: feeTiers && feeTiers.length > 0 ? feeTiers : DEFAULT_WITHDRAWAL_FEE_TIERS,
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
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembukaan rekening tidak valid.' },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data transaksi tabungan tidak valid.' },
          { status: 400 }
        );
      }

      const { data: account, error: accErr } = await supabase
        .from('savings_accounts')
        .select('id, account_number, student_id, teacher_id, balance, is_active')
        .eq('id', parsed.data.account_id)
        .single();

      if (accErr || !account) {
        return NextResponse.json({ error: 'Rekening tabungan tidak ditemukan.' }, { status: 404 });
      }

      if (account.is_active === false) {
        return NextResponse.json(
          { error: 'Rekening tabungan ini sedang nonaktif/ditutup dan tidak dapat bertransaksi.' },
          { status: 400 }
        );
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

      let feePercentage = 0;
      let feeAmount = 0;
      let netAmount = parsed.data.amount;

      if (parsed.data.transaction_type === 'TARIK') {
        const { data: tiersData } = await supabase
          .from('savings_withdrawal_fee_tiers')
          .select('*')
          .order('tier_order', { ascending: true });

        const feeCalc = calculateWithdrawalFee(
          parsed.data.amount,
          tiersData && tiersData.length > 0 ? (tiersData as SavingsFeeTier[]) : DEFAULT_WITHDRAWAL_FEE_TIERS
        );

        feePercentage = feeCalc.feePercentage;
        feeAmount = feeCalc.feeAmount;
        netAmount = feeCalc.netAmount;
      }

      // Optimistic lock pada balance untuk mencegah race condition / double withdrawal
      const { data: updatedAcc, error: balErr } = await supabase
        .from('savings_accounts')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id)
        .eq('balance', account.balance)
        .select('id')
        .maybeSingle();

      if (balErr || !updatedAcc) {
        return NextResponse.json(
          {
            error:
              balErr?.message ||
              'Saldo rekening berubah karena transaksi bersamaan. Silakan muat ulang dan coba lagi.',
          },
          { status: 409 }
        );
      }

      const refRand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const { data: trx, error: trxErr } = await supabase
        .from('savings_transactions')
        .insert({
          account_id: account.id,
          transaction_type: parsed.data.transaction_type,
          amount: parsed.data.amount,
          fee_percentage: feePercentage,
          fee_amount: feeAmount,
          net_amount: netAmount,
          balance_after: newBalance,
          reference_number: `TRX-${Date.now().toString().slice(-8)}-${refRand}`,
          notes: parsed.data.notes || null,
          recorded_by: guard.session.userId,
        })
        .select('*')
        .single();

      if (trxErr) {
        // Kompensasi rollback saldo jika pencatatan log transaksi gagal
        await supabase
          .from('savings_accounts')
          .update({ balance: account.balance, updated_at: new Date().toISOString() })
          .eq('id', account.id)
          .eq('balance', newBalance);
        return NextResponse.json({ error: sanitizeApiError(trxErr) }, { status: 500 });
      }

      const trxLabel = parsed.data.transaction_type === 'SETOR' ? 'Setoran' : 'Penarikan';
      if (account.student_id) {
        await notifyStudentFamilyEvent({
          studentId: account.student_id,
          categoryKey: 'TABUNGAN',
          title: `${trxLabel} Tabungan Berhasil`,
          body: `${trxLabel} tabungan {studentName} sebesar Rp${parsed.data.amount.toLocaleString('id-ID')} tercatat. Saldo kini Rp${newBalance.toLocaleString('id-ID')}.`,
          url: '/portal/tabungan-saya',
          dedupeKey: `tabungan-${trx.id}`,
          createdBy: guard.session.userId,
        });
      } else if (account.teacher_id) {
        const { data: teacherRow } = await supabase
          .from('teachers_staff')
          .select('profile_id')
          .eq('id', account.teacher_id)
          .maybeSingle();
        if (teacherRow?.profile_id) {
          await notifyUserDirect({
            userId: teacherRow.profile_id,
            categoryKey: 'TABUNGAN',
            title: `${trxLabel} Tabungan Berhasil`,
            body: `${trxLabel} tabungan sebesar Rp${parsed.data.amount.toLocaleString('id-ID')} tercatat. Saldo kini Rp${newBalance.toLocaleString('id-ID')}.`,
            url: '/portal/tabungan-saya',
            dedupeKey: `tabungan-${trx.id}`,
            createdBy: guard.session.userId,
          });
        }
      }

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_TABUNGAN',
        action: `SAVINGS_${parsed.data.transaction_type}`,
        entityType: 'savings_account',
        entityId: account.id,
        summary: `${parsed.data.transaction_type} Rp${parsed.data.amount.toLocaleString('id-ID')} pada rekening ${account.account_number}`,
        metadata: {
          accountNumber: account.account_number,
          transactionType: parsed.data.transaction_type,
          amount: parsed.data.amount,
          feeAmount,
          netAmount,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
          referenceNumber: trx?.reference_number ?? null,
        },
      });

      return NextResponse.json({
        transaction: trx,
        balance: newBalance,
        fee_percentage: feePercentage,
        fee_amount: feeAmount,
        net_amount: netAmount,
      });
    }

    if (body.action === 'UPDATE_FEE_TIERS') {
      const parsed = UpdateFeeTiersSchema.safeParse(body);
      if (!parsed.success || parsed.data.tiers.length === 0) {
        return NextResponse.json(
          {
            error: !parsed.success
              ? parsed.error.issues[0]?.message || 'Data aturan fee tidak valid.'
              : 'Minimal harus terdapat 1 rentang aturan fee penarikan.',
          },
          { status: 400 }
        );
      }

      // Hapus tier lama dan perbarui dengan tier yang baru diatur oleh admin / pengelola
      await supabase
        .from('savings_withdrawal_fee_tiers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const insertRows = parsed.data.tiers.map((t, idx) => ({
        tier_order: idx + 1,
        label: t.label?.trim() || null,
        min_amount: t.min_amount,
        max_amount: t.max_amount != null && t.max_amount > 0 ? t.max_amount : null,
        fee_percentage: t.fee_percentage,
        is_active: t.is_active ?? true,
        updated_at: new Date().toISOString(),
      }));

      const { data: updatedTiers, error: upErr } = await supabase
        .from('savings_withdrawal_fee_tiers')
        .insert(insertRows)
        .select('*')
        .order('tier_order', { ascending: true });

      if (upErr) {
        return NextResponse.json({ error: sanitizeApiError(upErr) }, { status: 500 });
      }

      return NextResponse.json({ feeTiers: updatedTiers });
    }

    if (body.action === 'RESET_FEE_TIERS') {
      await supabase
        .from('savings_withdrawal_fee_tiers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { data: resetTiers, error: resetErr } = await supabase
        .from('savings_withdrawal_fee_tiers')
        .insert(
          DEFAULT_WITHDRAWAL_FEE_TIERS.map((t) => ({
            tier_order: t.tier_order,
            label: t.label,
            min_amount: t.min_amount,
            max_amount: t.max_amount,
            fee_percentage: t.fee_percentage,
            is_active: t.is_active,
          }))
        )
        .select('*')
        .order('tier_order', { ascending: true });

      if (resetErr) {
        return NextResponse.json({ error: sanitizeApiError(resetErr) }, { status: 500 });
      }

      return NextResponse.json({ feeTiers: resetTiers });
    }

    if (body.action === 'UPDATE_ACCOUNT') {
      const parsed = UpdateAccountSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan rekening tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existing, error: existErr } = await supabase
        .from('savings_accounts')
        .select('id, account_number, owner_name, owner_phone, owner_type')
        .eq('id', parsed.data.id)
        .maybeSingle();

      if (existErr || !existing) {
        return NextResponse.json({ error: 'Rekening tabungan tidak ditemukan.' }, { status: 404 });
      }

      const nextPhone = parsed.data.owner_phone?.trim() || null;
      const { data: updated, error: updErr } = await supabase
        .from('savings_accounts')
        .update({
          owner_name: parsed.data.owner_name,
          owner_phone: nextPhone,
          owner_type: parsed.data.owner_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updErr || !updated) {
        return NextResponse.json(
          { error: sanitizeApiError(updErr) || 'Gagal memperbarui rekening tabungan.' },
          { status: 500 }
        );
      }

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_TABUNGAN',
        action: 'SAVINGS_ACCOUNT_UPDATE',
        entityType: 'savings_account',
        entityId: existing.id,
        summary: `Memperbarui rekening ${existing.account_number} (${parsed.data.owner_name})`,
        metadata: {
          accountNumber: existing.account_number,
          before: {
            owner_name: existing.owner_name,
            owner_phone: existing.owner_phone,
            owner_type: existing.owner_type,
          },
          after: {
            owner_name: updated.owner_name,
            owner_phone: updated.owner_phone,
            owner_type: updated.owner_type,
          },
        },
      });

      return NextResponse.json({ account: updated });
    }

    if (body.action === 'DELETE_ACCOUNTS') {
      const parsed = DeleteAccountsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data penghapusan rekening tidak valid.' },
          { status: 400 }
        );
      }

      const uniqueIds = Array.from(new Set(parsed.data.ids));
      const { data: targetAccounts } = await supabase
        .from('savings_accounts')
        .select('id, account_number, owner_name')
        .in('id', uniqueIds);

      const { error: delTrxErr } = await supabase
        .from('savings_transactions')
        .delete()
        .in('account_id', uniqueIds);

      if (delTrxErr) {
        return NextResponse.json({ error: sanitizeApiError(delTrxErr) }, { status: 500 });
      }

      const { error: delAccErr } = await supabase
        .from('savings_accounts')
        .delete()
        .in('id', uniqueIds);

      if (delAccErr) {
        return NextResponse.json({ error: sanitizeApiError(delAccErr) }, { status: 500 });
      }

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_TABUNGAN',
        action: 'SAVINGS_ACCOUNTS_DELETE',
        entityType: 'savings_account',
        entityId: uniqueIds[0],
        summary: `Menghapus ${uniqueIds.length} rekening tabungan beserta riwayat transaksinya`,
        metadata: {
          deletedIds: uniqueIds,
          deletedAccounts: targetAccounts || [],
        },
      });

      return NextResponse.json({ deletedCount: uniqueIds.length });
    }

    if (body.action === 'UPDATE_TRANSACTION') {
      const parsed = UpdateTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data pembaruan transaksi tidak valid.' },
          { status: 400 }
        );
      }

      const { data: existing, error: existErr } = await supabase
        .from('savings_transactions')
        .select('id, account_id, transaction_type, amount, reference_number, notes')
        .eq('id', parsed.data.id)
        .maybeSingle();

      if (existErr || !existing) {
        return NextResponse.json({ error: 'Transaksi tabungan tidak ditemukan.' }, { status: 404 });
      }

      const { data: accountTrxRows, error: listErr } = await supabase
        .from('savings_transactions')
        .select('id, transaction_type, amount')
        .eq('account_id', existing.account_id)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (listErr) {
        return NextResponse.json({ error: sanitizeApiError(listErr) }, { status: 500 });
      }

      let simulatedBalance = 0;
      for (const row of accountTrxRows || []) {
        const type = row.id === existing.id ? parsed.data.transaction_type : row.transaction_type;
        const amt = row.id === existing.id ? parsed.data.amount : Number(row.amount || 0);
        simulatedBalance += type === 'SETOR' ? amt : -amt;
      }

      if (simulatedBalance < 0) {
        return NextResponse.json(
          { error: 'Perubahan transaksi menyebabkan saldo rekening menjadi negatif.' },
          { status: 400 }
        );
      }

      let feePercentage = 0;
      let feeAmount = 0;
      let netAmount = parsed.data.amount;

      if (parsed.data.transaction_type === 'TARIK') {
        const { data: tiersData } = await supabase
          .from('savings_withdrawal_fee_tiers')
          .select('*')
          .order('tier_order', { ascending: true });

        const feeCalc = calculateWithdrawalFee(
          parsed.data.amount,
          tiersData && tiersData.length > 0 ? (tiersData as SavingsFeeTier[]) : DEFAULT_WITHDRAWAL_FEE_TIERS
        );
        feePercentage = feeCalc.feePercentage;
        feeAmount = feeCalc.feeAmount;
        netAmount = feeCalc.netAmount;
      }

      const nextNotes = parsed.data.notes?.trim() || null;
      const { error: updErr } = await supabase
        .from('savings_transactions')
        .update({
          transaction_type: parsed.data.transaction_type,
          amount: parsed.data.amount,
          fee_percentage: feePercentage,
          fee_amount: feeAmount,
          net_amount: netAmount,
          notes: nextNotes,
        })
        .eq('id', existing.id);

      if (updErr) {
        return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });
      }

      const finalBalances = await recalculateAccountBalances(supabase, [existing.account_id]);
      const finalBalance = finalBalances[existing.account_id] ?? simulatedBalance;

      const { data: updatedTrx } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('id', existing.id)
        .maybeSingle();

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_TABUNGAN',
        action: 'SAVINGS_TRANSACTION_UPDATE',
        entityType: 'savings_transaction',
        entityId: existing.id,
        summary: `Memperbarui transaksi ${existing.reference_number} menjadi ${parsed.data.transaction_type} Rp${parsed.data.amount.toLocaleString('id-ID')}`,
        metadata: {
          referenceNumber: existing.reference_number,
          accountId: existing.account_id,
          before: {
            transaction_type: existing.transaction_type,
            amount: existing.amount,
            notes: existing.notes,
          },
          after: {
            transaction_type: parsed.data.transaction_type,
            amount: parsed.data.amount,
            fee_percentage: feePercentage,
            fee_amount: feeAmount,
            net_amount: netAmount,
            notes: nextNotes,
            accountBalanceAfter: finalBalance,
          },
        },
      });

      return NextResponse.json({
        transaction: updatedTrx,
        balance: finalBalance,
        fee_percentage: feePercentage,
        fee_amount: feeAmount,
        net_amount: netAmount,
      });
    }

    if (body.action === 'DELETE_TRANSACTIONS') {
      const parsed = DeleteTransactionsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data penghapusan transaksi tidak valid.' },
          { status: 400 }
        );
      }

      const uniqueIds = Array.from(new Set(parsed.data.ids));
      const { data: affectedRows, error: fetchErr } = await supabase
        .from('savings_transactions')
        .select('id, account_id, reference_number, transaction_type, amount')
        .in('id', uniqueIds);

      if (fetchErr) {
        return NextResponse.json({ error: sanitizeApiError(fetchErr) }, { status: 500 });
      }

      const affectedAccountIds = Array.from(
        new Set((affectedRows || []).map((row) => row.account_id).filter(Boolean))
      );

      const { error: delErr } = await supabase
        .from('savings_transactions')
        .delete()
        .in('id', uniqueIds);

      if (delErr) {
        return NextResponse.json({ error: sanitizeApiError(delErr) }, { status: 500 });
      }

      await recalculateAccountBalances(supabase, affectedAccountIds);

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_TABUNGAN',
        action: 'SAVINGS_TRANSACTIONS_DELETE',
        entityType: 'savings_transaction',
        entityId: uniqueIds[0],
        summary: `Menghapus ${uniqueIds.length} transaksi tabungan dan menghitung ulang saldo ${affectedAccountIds.length} rekening`,
        metadata: {
          deletedIds: uniqueIds,
          affectedAccountIds,
          deletedTransactions: affectedRows || [],
        },
      });

      return NextResponse.json({ deletedCount: uniqueIds.length });
    }

    return NextResponse.json({ error: 'Aksi tabungan tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses tabungan.' }, { status: 500 });
  }
}
