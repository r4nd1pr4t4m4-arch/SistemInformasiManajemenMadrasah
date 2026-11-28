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

function getCurrentWibYear(): number {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const parsed = Number(iso.slice(0, 4));
  return Number.isFinite(parsed) && parsed >= 2020 ? parsed : new Date().getFullYear();
}

function parseFiscalYearFromDate(dateStr: string | null | undefined, fallback: number): number {
  if (!dateStr) return fallback;
  const parsed = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

function matchesFiscalYearFilter(
  itemYear: number,
  filter: string,
  currentFiscalYear: number
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ARCHIVE') return itemYear < currentFiscalYear;
  if (filter === 'ACTIVE') return itemYear === currentFiscalYear;
  const parsed = Number(filter);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) {
    return itemYear === parsed;
  }
  return itemYear === currentFiscalYear;
}

export async function GET(request: Request) {
  const guard = await requireApiRoles([...VIEW_ROLES]);
  if (guard.errorResponse) return guard.errorResponse;

  const currentFiscalYear = getCurrentWibYear();
  const { searchParams } = new URL(request.url);
  const rawFiscalYear = (searchParams.get('fiscalYear') || 'ACTIVE').trim().toUpperCase();
  const selectedFiscalYear = rawFiscalYear || 'ACTIVE';

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      currentFiscalYear,
      selectedFiscalYear,
      availableFiscalYears: [currentFiscalYear],
      archivedYears: [],
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
      .select('*, budget:budget_plans(id, code, name, fiscal_year)')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const rawBudgets = bRes.error ? [] : bRes.data || [];
  const rawEntries = eRes.error ? [] : eRes.data || [];

  // Hitung realisasi per pos anggaran dari seluruh transaksi terkait pos tersebut
  const spentByBudget = new Map<string, number>();
  for (const e of rawEntries) {
    if (e.entry_type === 'KELUAR' && e.budget_plan_id) {
      const amt = Number(e.amount || 0);
      spentByBudget.set(
        e.budget_plan_id as string,
        (spentByBudget.get(e.budget_plan_id as string) || 0) + amt
      );
    }
  }

  const yearsSet = new Set<number>([currentFiscalYear]);

  const allBudgets = rawBudgets.map((b) => {
    const fiscalYear = Number(b.fiscal_year) || currentFiscalYear;
    yearsSet.add(fiscalYear);
    const allocated = Number(b.allocated_amount || 0);
    const spent = spentByBudget.get(b.id as string) || 0;
    return {
      ...b,
      fiscal_year: fiscalYear,
      is_archived: fiscalYear < currentFiscalYear,
      spent_amount: spent,
      remaining_amount: allocated - spent,
      absorption_pct: allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0,
    };
  });

  const allEntries = rawEntries.map((e) => {
    const linkedBudget = Array.isArray(e.budget) ? e.budget[0] : e.budget;
    const entryFiscalYear =
      (linkedBudget && Number(linkedBudget.fiscal_year)) ||
      parseFiscalYearFromDate(e.entry_date as string | null, currentFiscalYear);
    yearsSet.add(entryFiscalYear);
    return {
      ...e,
      budget: linkedBudget || null,
      fiscal_year: entryFiscalYear,
      is_archived: entryFiscalYear < currentFiscalYear,
    };
  });

  const availableFiscalYears = Array.from(yearsSet).sort((a, b) => b - a);
  const archivedYears = availableFiscalYears.filter((yr) => yr < currentFiscalYear);

  // Filter berdasarkan tahun anggaran / arsip (default: hanya tahun anggaran aktif)
  const filteredBudgets = allBudgets.filter((b) =>
    matchesFiscalYearFilter(b.fiscal_year, selectedFiscalYear, currentFiscalYear)
  );
  const filteredEntries = allEntries.filter((e) =>
    matchesFiscalYearFilter(e.fiscal_year, selectedFiscalYear, currentFiscalYear)
  );

  let totalIn = 0;
  let totalOut = 0;
  for (const e of filteredEntries) {
    const amt = Number(e.amount || 0);
    if (e.entry_type === 'MASUK') totalIn += amt;
    else totalOut += amt;
  }
  const totalBudget = filteredBudgets.reduce((s, b) => s + Number(b.allocated_amount || 0), 0);

  return NextResponse.json({
    currentFiscalYear,
    selectedFiscalYear,
    availableFiscalYears,
    archivedYears,
    budgets: filteredBudgets,
    entries: filteredEntries,
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
          code: z.string().trim().min(2, 'Kode pos anggaran minimal 2 karakter.'),
          name: z.string().trim().min(3, 'Nama pos anggaran minimal 3 karakter.'),
          allocated_amount: z.number().min(0, 'Pagu anggaran tidak boleh negatif.'),
          notes: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data pos anggaran tidak valid.' },
          { status: 400 }
        );
      }

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
          entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal transaksi tidak valid.'),
          entry_type: z.enum(['MASUK', 'KELUAR']),
          funding_source: z.enum(['BOS', 'KOMITE', 'YAYASAN', 'LAINNYA']).default('BOS'),
          budget_plan_id: z.string().uuid().optional().nullable(),
          category: z.string().trim().min(2, 'Kategori minimal 2 karakter.'),
          description: z.string().trim().min(3, 'Uraian transaksi minimal 3 karakter.'),
          amount: z.number().positive('Nominal harus lebih dari 0.'),
          reference_no: z.string().optional().nullable(),
          receipt_url: z.string().optional().nullable(),
        })
        .safeParse(body);
      if (!p.success) {
        return NextResponse.json(
          { error: p.error.issues[0]?.message || 'Data transaksi BKU tidak valid.' },
          { status: 400 }
        );
      }

      // Pastikan jika mengaitkan Pos RKAS, tahun anggarannya sesuai dengan tahun tanggal transaksi BKU
      if (p.data.budget_plan_id) {
        const entryYear = Number(p.data.entry_date.slice(0, 4));
        const { data: linkedBudget } = await supabase
          .from('budget_plans')
          .select('id, fiscal_year')
          .eq('id', p.data.budget_plan_id)
          .maybeSingle();
        if (!linkedBudget) {
          return NextResponse.json({ error: 'Pos anggaran RKAS tidak ditemukan.' }, { status: 404 });
        }
        if (Number(linkedBudget.fiscal_year) !== entryYear) {
          return NextResponse.json(
            {
              error: `Pos RKAS yang dipilih milik Tahun Anggaran ${linkedBudget.fiscal_year}, tidak sesuai dengan tahun tanggal transaksi (${entryYear}).`,
            },
            { status: 400 }
          );
        }
      }

      const { data, error } = await supabase
        .from('cashbook_entries')
        .insert({
          ...p.data,
          budget_plan_id: p.data.budget_plan_id || null,
          reference_no: p.data.reference_no?.trim() || null,
          receipt_url: p.data.receipt_url?.trim() || null,
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
