import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import {
  calculateSiblingGroupBilling,
  isSiblingDiscountCategory,
} from '@/lib/domain/sibling-discount';
import { sanitizeApiError } from '@/lib/security/api-error';
import { recordAuditLog } from '@/lib/security/audit-log';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';

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
  amount: z.number().min(0),
  due_date: z.string().optional().nullable(),
});

const RecordPaymentSchema = z.object({
  action: z.literal('RECORD_PAYMENT'),
  bill_id: z.string().uuid(),
  amount_paid: z.number().min(1),
  payment_method: z.enum(['TUNAI', 'TRANSFER', 'QRIS']).default('TUNAI'),
  notes: z.string().optional().nullable(),
});

const SiblingGroupSchema = z.object({
  action: z.enum(['CREATE_SIBLING_GROUP', 'UPDATE_SIBLING_GROUP']),
  group_id: z.string().uuid().optional(),
  name: z.string().min(2),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  student_ids: z.array(z.string().uuid()).min(1),
  exempt_student_id: z.string().uuid().optional().nullable(),
});

const GenerateGroupBillsSchema = z.object({
  action: z.literal('GENERATE_SIBLING_GROUP_BILLS'),
  group_id: z.string().uuid(),
  fee_type_id: z.string().uuid(),
  billing_month: z.number().min(1).max(12),
  billing_year: z.number().min(2020).max(2100),
  amount: z.number().min(0),
});

type GroupMemberRow = {
  id: string;
  group_id: string;
  student_id: string;
  is_exempt: boolean;
  student?: {
    id: string;
    full_name: string;
    nis: string | null;
    nisn: string | null;
    status: string;
  } | null;
};

async function resolveStudentSiblingExemption(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string
): Promise<{
  groupId: string;
  groupName: string;
  isExempt: boolean;
  totalSiblings: number;
  payableCount: number;
} | null> {
  const { data: memberRow } = await supabase
    .from('sibling_group_members')
    .select('group_id, sibling_group:sibling_groups(id, name, is_active)')
    .eq('student_id', studentId)
    .maybeSingle();

  if (!memberRow) return null;

  const groupObj = Array.isArray(memberRow.sibling_group)
    ? memberRow.sibling_group[0]
    : memberRow.sibling_group;

  if (!groupObj || !groupObj.is_active) return null;

  const { data: members } = await supabase
    .from('sibling_group_members')
    .select('student_id, is_exempt, student:students(id, status)')
    .eq('group_id', groupObj.id)
    .order('created_at', { ascending: true });

  const activeMembers = (members || []).filter((m) => {
    const st = Array.isArray(m.student) ? m.student[0] : m.student;
    return st?.status === 'AKTIF';
  });

  const activeIds = activeMembers.map((m) => m.student_id);
  const preferredExempt = activeMembers.find((m) => m.is_exempt)?.student_id || null;
  const summary = calculateSiblingGroupBilling(activeIds, preferredExempt);

  return {
    groupId: groupObj.id,
    groupName: groupObj.name,
    isExempt: summary.exemptStudentId === studentId,
    totalSiblings: summary.totalSiblings,
    payableCount: summary.payableCount,
  };
}

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.SPP_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ feeTypes: [], bills: [], siblingGroups: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: feeTypes }, { data: bills }, { data: groups }, { data: members }] =
    await Promise.all([
      supabase.from('fee_types').select('*').order('name'),
      supabase
        .from('student_bills')
        .select('*, student:students(full_name, nis), fee_type:fee_types(name, category)')
        .order('created_at', { ascending: false })
        .limit(150),
      supabase.from('sibling_groups').select('*').order('name', { ascending: true }),
      supabase
        .from('sibling_group_members')
        .select('*, student:students(id, full_name, nis, nisn, status)')
        .order('created_at', { ascending: true }),
    ]);

  const membersByGroup = new Map<string, GroupMemberRow[]>();
  for (const m of (members || []) as GroupMemberRow[]) {
    const list = membersByGroup.get(m.group_id) || [];
    list.push(m);
    membersByGroup.set(m.group_id, list);
  }

  const siblingGroups = (groups || []).map((g) => {
    const grpMembers = membersByGroup.get(g.id) || [];
    const activeIds = grpMembers
      .filter((m) => m.student?.status === 'AKTIF')
      .map((m) => m.student_id);
    const preferredExempt =
      grpMembers.find((m) => m.is_exempt && m.student?.status === 'AKTIF')?.student_id || null;
    const billingSummary = calculateSiblingGroupBilling(activeIds, preferredExempt);
    return {
      ...g,
      members: grpMembers,
      billingSummary,
    };
  });

  return NextResponse.json({
    feeTypes: feeTypes || [],
    bills: bills || [],
    siblingGroups,
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.SPP_MANAGE);
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
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('fee_types')
        .insert(payload)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ feeType: data });
    }

    if (body.action === 'CREATE_BILL') {
      const parsed = CreateBillSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data tagihan tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;

      const { data: feeType } = await supabase
        .from('fee_types')
        .select('id, category')
        .eq('id', parsed.data.fee_type_id)
        .single();

      let siblingInfo: Awaited<ReturnType<typeof resolveStudentSiblingExemption>> = null;
      if (feeType && isSiblingDiscountCategory(feeType.category)) {
        siblingInfo = await resolveStudentSiblingExemption(supabase, parsed.data.student_id);
      }

      const isExempt = Boolean(siblingInfo?.isExempt);
      const originalAmount = parsed.data.amount;
      const discountAmount = isExempt ? originalAmount : 0;
      const finalAmount = isExempt ? 0 : originalAmount;

      const { data, error } = await supabase
        .from('student_bills')
        .insert({
          ...payload,
          amount: finalAmount,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          is_sibling_exempt: isExempt,
          sibling_group_id: siblingInfo?.groupId || null,
          notes: isExempt
            ? `Gratis Kelompok Saudara "${siblingInfo?.groupName}" (${siblingInfo?.totalSiblings} saudara, bayar ${siblingInfo?.payableCount})`
            : null,
          paid_amount: 0,
          status: isExempt ? 'LUNAS' : 'BELUM_LUNAS',
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      if (!isExempt && finalAmount > 0) {
        await notifyStudentFamilyEvent({
          studentId: parsed.data.student_id,
          categoryKey: 'KEUANGAN_SPP',
          title: 'Tagihan SPP Baru Diterbitkan',
          body: `Tagihan baru untuk {studentName} sebesar Rp${finalAmount.toLocaleString('id-ID')} telah diterbitkan.`,
          url: '/portal/orang-tua',
          dedupeKey: `spp-bill-${data.id}`,
          createdBy: guard.session.userId,
        });
      }
      return NextResponse.json({ bill: data, siblingApplied: isExempt });
    }

    if (body.action === 'RECORD_PAYMENT') {
      const parsed = RecordPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pembayaran tidak valid.' }, { status: 400 });
      }

      const { data: bill, error: billErr } = await supabase
        .from('student_bills')
        .select('id, student_id, amount, paid_amount, status')
        .eq('id', parsed.data.bill_id)
        .single();

      if (billErr || !bill) {
        return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 });
      }

      const totalAmount = Number(bill.amount);
      const currentPaid = Number(bill.paid_amount);
      const remaining = Math.max(0, totalAmount - currentPaid);
      if (bill.status === 'LUNAS' || remaining <= 0) {
        return NextResponse.json({ error: 'Tagihan ini sudah lunas.' }, { status: 400 });
      }
      if (parsed.data.amount_paid > remaining) {
        return NextResponse.json(
          { error: `Nominal pembayaran melebihi sisa tagihan (${remaining}).` },
          { status: 400 }
        );
      }

      const newPaid = currentPaid + parsed.data.amount_paid;
      const newStatus =
        newPaid >= totalAmount ? 'LUNAS' : newPaid > 0 ? 'CICILAN' : 'BELUM_LUNAS';

      // Optimistic lock pada paid_amount untuk mencegah double payment / overpayment bersamaan
      const { data: updatedBill, error: updBillErr } = await supabase
        .from('student_bills')
        .update({ paid_amount: newPaid, status: newStatus })
        .eq('id', bill.id)
        .eq('paid_amount', bill.paid_amount)
        .select('id')
        .maybeSingle();

      if (updBillErr || !updatedBill) {
        return NextResponse.json(
          {
            error:
              updBillErr?.message ||
              'Status tagihan berubah karena pembayaran bersamaan. Silakan muat ulang dan coba lagi.',
          },
          { status: 409 }
        );
      }

      const receiptRand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const receiptNumber = `KW-${Date.now().toString().slice(-8)}-${receiptRand}`;
      const { data: payment, error: payErr } = await supabase
        .from('bill_payments')
        .insert({
          bill_id: bill.id,
          receipt_number: receiptNumber,
          amount_paid: parsed.data.amount_paid,
          payment_method: parsed.data.payment_method,
          recorded_by: guard.session.userId,
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (payErr) {
        await supabase
          .from('student_bills')
          .update({ paid_amount: bill.paid_amount, status: bill.status })
          .eq('id', bill.id)
          .eq('paid_amount', newPaid);
        return NextResponse.json({ error: sanitizeApiError(payErr) }, { status: 500 });
      }

      if (bill.student_id) {
        await notifyStudentFamilyEvent({
          studentId: bill.student_id,
          categoryKey: 'KEUANGAN_SPP',
          title: newStatus === 'LUNAS' ? 'Pembayaran SPP Lunas' : 'Pembayaran SPP Diterima',
          body: `Pembayaran SPP untuk {studentName} sebesar Rp${parsed.data.amount_paid.toLocaleString('id-ID')} (${receiptNumber}) telah tercatat (${newStatus}).`,
          url: '/portal/orang-tua',
          dedupeKey: `spp-pay-${receiptNumber}`,
          createdBy: guard.session.userId,
        });
      }

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'KEUANGAN_SPP',
        action: 'RECORD_SPP_PAYMENT',
        entityType: 'student_bill',
        entityId: bill.id,
        summary: `Pencatatan pembayaran SPP Rp${parsed.data.amount_paid.toLocaleString('id-ID')} (${receiptNumber})`,
        metadata: {
          billId: bill.id,
          receiptNumber,
          amountPaid: parsed.data.amount_paid,
          paymentMethod: parsed.data.payment_method,
          newStatus,
        },
      });

      return NextResponse.json({ payment, status: newStatus });
    }

    if (body.action === 'CREATE_SIBLING_GROUP' || body.action === 'UPDATE_SIBLING_GROUP') {
      const parsed = SiblingGroupSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data kelompok saudara tidak valid.' },
          { status: 400 }
        );
      }

      const uniqueStudents = Array.from(new Set(parsed.data.student_ids));
      let groupId = parsed.data.group_id;

      if (parsed.data.action === 'CREATE_SIBLING_GROUP') {
        const { data: grp, error: grpErr } = await supabase
          .from('sibling_groups')
          .insert({
            name: parsed.data.name,
            notes: parsed.data.notes || null,
            is_active: parsed.data.is_active,
          })
          .select('id')
          .single();
        if (grpErr || !grp) {
          return NextResponse.json(
            { error: grpErr?.message || 'Gagal membuat kelompok saudara.' },
            { status: 500 }
          );
        }
        groupId = grp.id;
      } else {
        if (!groupId) {
          return NextResponse.json({ error: 'ID kelompok saudara wajib diisi.' }, { status: 400 });
        }
        const { error: updErr } = await supabase
          .from('sibling_groups')
          .update({
            name: parsed.data.name,
            notes: parsed.data.notes || null,
            is_active: parsed.data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', groupId);
        if (updErr) return NextResponse.json({ error: sanitizeApiError(updErr) }, { status: 500 });

        await supabase.from('sibling_group_members').delete().eq('group_id', groupId);
      }

      // Remove any existing membership for these students so UNIQUE(student_id) doesn't conflict
      await supabase.from('sibling_group_members').delete().in('student_id', uniqueStudents);

      const summary = calculateSiblingGroupBilling(uniqueStudents, parsed.data.exempt_student_id);
      const memberRows = uniqueStudents.map((sid) => ({
        group_id: groupId!,
        student_id: sid,
        is_exempt: summary.exemptStudentId === sid,
      }));

      const { error: memErr } = await supabase.from('sibling_group_members').insert(memberRows);
      if (memErr) return NextResponse.json({ error: sanitizeApiError(memErr) }, { status: 500 });

      return NextResponse.json({ ok: true, group_id: groupId, billingSummary: summary });
    }

    if (body.action === 'DELETE_SIBLING_GROUP') {
      const groupId = body.group_id as string | undefined;
      if (!groupId || !z.string().uuid().safeParse(groupId).success) {
        return NextResponse.json({ error: 'ID kelompok saudara tidak valid.' }, { status: 400 });
      }
      const { error } = await supabase.from('sibling_groups').delete().eq('id', groupId);
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'GENERATE_SIBLING_GROUP_BILLS') {
      const parsed = GenerateGroupBillsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Data penerbitan tagihan kelompok saudara tidak valid.' },
          { status: 400 }
        );
      }

      const [{ data: grp }, { data: feeType }, { data: members }] = await Promise.all([
        supabase
          .from('sibling_groups')
          .select('id, name, is_active')
          .eq('id', parsed.data.group_id)
          .single(),
        supabase
          .from('fee_types')
          .select('id, name, category')
          .eq('id', parsed.data.fee_type_id)
          .single(),
        supabase
          .from('sibling_group_members')
          .select('student_id, is_exempt, student:students(id, status)')
          .eq('group_id', parsed.data.group_id)
          .order('created_at', { ascending: true }),
      ]);

      if (!grp || !grp.is_active) {
        return NextResponse.json(
          { error: 'Kelompok saudara tidak ditemukan atau tidak aktif.' },
          { status: 404 }
        );
      }
      if (!feeType) {
        return NextResponse.json({ error: 'Jenis biaya tidak ditemukan.' }, { status: 404 });
      }

      const activeMembers = (members || []).filter((m) => {
        const st = Array.isArray(m.student) ? m.student[0] : m.student;
        return st?.status === 'AKTIF';
      });
      if (activeMembers.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada siswa aktif dalam kelompok saudara ini.' },
          { status: 400 }
        );
      }

      const activeIds = activeMembers.map((m) => m.student_id);
      const preferredExempt = activeMembers.find((m) => m.is_exempt)?.student_id || null;
      const summary = calculateSiblingGroupBilling(activeIds, preferredExempt);
      const applyDiscount = isSiblingDiscountCategory(feeType.category);

      const { data: existingBills } = await supabase
        .from('student_bills')
        .select('student_id')
        .in('student_id', activeIds)
        .eq('fee_type_id', feeType.id)
        .eq('billing_month', parsed.data.billing_month)
        .eq('billing_year', parsed.data.billing_year);

      const existingSet = new Set((existingBills || []).map((b) => b.student_id));
      const toInsert = activeIds
        .filter((sid) => !existingSet.has(sid))
        .map((sid) => {
          const isExempt = applyDiscount && summary.exemptStudentId === sid;
          const originalAmount = parsed.data.amount;
          return {
            student_id: sid,
            fee_type_id: feeType.id,
            billing_month: parsed.data.billing_month,
            billing_year: parsed.data.billing_year,
            amount: isExempt ? 0 : originalAmount,
            original_amount: originalAmount,
            discount_amount: isExempt ? originalAmount : 0,
            is_sibling_exempt: isExempt,
            sibling_group_id: grp.id,
            notes: isExempt
              ? `Gratis Kelompok Saudara "${grp.name}" (${summary.totalSiblings} saudara, bayar ${summary.payableCount})`
              : `Kelompok Saudara "${grp.name}" (${summary.totalSiblings} saudara, bayar ${summary.payableCount})`,
            paid_amount: 0,
            status: isExempt ? 'LUNAS' : 'BELUM_LUNAS',
          };
        });

      if (toInsert.length === 0) {
        return NextResponse.json(
          { error: 'Tagihan bulan & tahun tersebut sudah diterbitkan untuk seluruh anggota.' },
          { status: 400 }
        );
      }

      const { error: insErr } = await supabase.from('student_bills').insert(toInsert);
      if (insErr) return NextResponse.json({ error: sanitizeApiError(insErr) }, { status: 500 });

      return NextResponse.json({
        ok: true,
        insertedCount: toInsert.length,
        billingSummary: summary,
      });
    }

    return NextResponse.json({ error: 'Aksi SPP tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses transaksi SPP.' }, { status: 500 });
  }
}
