import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

const VIEW_ROLES = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'BENDAHARA',
  'BENDAHARA_KOMITE',
  'KEPALA_TU',
] as const;

const MANAGE_ROLES = ['SUPERADMIN', 'OPERATOR', 'BENDAHARA', 'KEPALA_TU'] as const;

export async function GET() {
  const guard = await requireApiRoles([...VIEW_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      budgets: [],
      entries: [],
      summary: { totalIn: 0, totalOut: 0, balance: 0, totalBudget: 0 },
    });
  }

  const supabase = createSupabaseAdminClient();
  const [bRes, eRes] = await Promise.all([
    supabase.from('budget_plans').select('*').order('fiscal_year', { ascending: false }).order('code'),
    supabase
      .from('cashbook_entries')
      .select('*, budget:budget_plans(id, code, name)')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const budgets = bRes.error ? [] : bRes.data || [];
  const entries = eRes.error ? [] : eRes.data || [];

  let totalIn = 0;
  let totalOut = 0;
  const spentByBudget = new Map<string, number>();

  for (const e of entries) {
    const amt = Number(e.amount || 0);
    if (e.entry_type === 'MASUK') totalIn += amt;
    else {
      totalOut += amt;
      if (e.budget_plan_id) {
        spentByBudget.set(
          e.budget_plan_id as string,
          (spentByBudget.get(e.budget_plan_id as string) || 0) + amt
        );
      }
    }
  }

  const enrichedBudgets = budgets.map((b) => {
    const allocated = Number(b.allocated_amount || 0);
    const spent = spentByBudget.get(b.id as string) || 0;
    return {
      ...b,
      spent_amount: spent,
      remaining_amount: allocated - spent,
      absorption_pct: allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0,
    };
  });

  const totalBudget = enrichedBudgets.reduce((s, b) => s + Number(b.allocated_amount || 0), 0);

  return NextResponse.json({
    budgets: enrichedBudgets,
    entries,
    summary: {
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
      totalBudget,
    },
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles([...MANAGE_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_BUDGET') {
      const p = z
        .object({
          fiscal_year: z.number().int().min(2020).max(2100),
          funding_source: z.enum(['BOS', 'KOMITE', 'YAYASAN', 'LAINNYA']).default('BOS'),
          code: z.string().trim().min(2),
          name: z.string().trim().min(3),
          allocated_amount: z.number().min(0),
          notes: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data pos anggaran tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('budget_plans')
        .insert({ ...p.data, code: p.data.code.toUpperCase(), created_by: guard.session.userId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ budget: data });
    }

    if (body.action === 'CREATE_CASHBOOK') {
      const p = z
        .object({
          entry_date: z.string().min(8),
          entry_type: z.enum(['MASUK', 'KELUAR']),
          funding_source: z.enum(['BOS', 'KOMITE', 'YAYASAN', 'LAINNYA']).default('BOS'),
          budget_plan_id: z.string().uuid().optional().nullable(),
          category: z.string().trim().min(2),
          description: z.string().trim().min(3),
          amount: z.number().positive(),
          reference_no: z.string().optional().nullable(),
          receipt_url: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data transaksi BKU tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('cashbook_entries')
        .insert({
          ...p.data,
          budget_plan_id: p.data.budget_plan_id || null,
          created_by: guard.session.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ entry: data });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan data kas/RKAS.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles([...MANAGE_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const target = searchParams.get('target') || 'entry';
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const table = target === 'budget' ? 'budget_plans' : 'cashbook_entries';
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
