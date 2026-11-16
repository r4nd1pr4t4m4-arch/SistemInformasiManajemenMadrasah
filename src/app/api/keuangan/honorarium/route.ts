import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { calculateTeacherHonorarium } from '@/lib/domain/honorarium';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';

const UpdateRateSchema = z.object({
  action: z.literal('UPDATE_RATE'),
  rate_per_jtm: z.number().min(0),
});

const UpdateDutyAllowanceSchema = z.object({
  action: z.literal('UPDATE_DUTY_ALLOWANCE'),
  duty_type_id: z.string().uuid(),
  monthly_allowance: z.number().min(0),
});

const UpdateStatusSchema = z.object({
  action: z.literal('UPDATE_STATUS'),
  honorarium_id: z.string().uuid(),
  status: z.enum(['DRAFT', 'APPROVED', 'PAID']),
});

const AssignDutySchema = z.object({
  action: z.literal('ASSIGN_DUTY'),
  teacher_id: z.string().uuid(),
  duty_type_id: z.string().uuid(),
  decree_number: z.string().optional().nullable(),
});

const GenerateHonorariumSchema = z.object({
  action: z.literal('GENERATE_HONORARIUM'),
  teacher_id: z.string().uuid(),
  period_month: z.number().min(1).max(12),
  period_year: z.number().min(2020).max(2100),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.HONORARIUM);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      ratePerJtm: 25000,
      dutyTypes: [],
      teacherDuties: [],
      honorariums: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: rateRow },
    { data: dutyTypes },
    { data: teacherDuties },
    { data: honorariums },
  ] = await Promise.all([
    supabase
      .from('honorarium_settings')
      .select('rate_per_jtm')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('additional_duty_types').select('*').order('name'),
    supabase
      .from('teacher_additional_duties')
      .select(
        '*, teacher:teachers_staff(full_name), duty_type:additional_duty_types(code, name, receives_allowance, monthly_allowance)'
      )
      .eq('is_active', true),
    supabase
      .from('teacher_honorariums')
      .select('*, teacher:teachers_staff(full_name), items:teacher_honorarium_duty_items(*)')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    ratePerJtm: Number(rateRow?.rate_per_jtm ?? 25000),
    dutyTypes: dutyTypes || [],
    teacherDuties: teacherDuties || [],
    honorariums: honorariums || [],
  });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.HONORARIUM);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'UPDATE_RATE') {
      const parsed = UpdateRateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Tarif per JTM tidak valid.' }, { status: 400 });
      }
      await supabase
        .from('honorarium_settings')
        .update({ is_active: false })
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('honorarium_settings')
        .insert({ rate_per_jtm: parsed.data.rate_per_jtm, is_active: true })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ setting: data });
    }

    if (body.action === 'UPDATE_DUTY_ALLOWANCE') {
      const parsed = UpdateDutyAllowanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Nominal tunjangan tidak valid.' }, { status: 400 });
      }

      const { data: duty } = await supabase
        .from('additional_duty_types')
        .select('code, receives_allowance')
        .eq('id', parsed.data.duty_type_id)
        .single();

      if (
        !duty ||
        !duty.receives_allowance ||
        duty.code === 'BENDAHARA_KOMITE' ||
        duty.code === 'PENGELOLA_TABUNGAN'
      ) {
        return NextResponse.json(
          {
            error:
              'Bendahara Komite dan Pengelola Tabungan tidak memiliki tambahan tunjangan honorarium.',
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('additional_duty_types')
        .update({
          monthly_allowance: parsed.data.monthly_allowance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.duty_type_id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ dutyType: data });
    }

    if (body.action === 'UPDATE_STATUS') {
      const parsed = UpdateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Status honorarium tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('teacher_honorariums')
        .update({
          status: parsed.data.status,
          paid_at: parsed.data.status === 'PAID' ? new Date().toISOString() : null,
        })
        .eq('id', parsed.data.honorarium_id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ honorarium: data });
    }

    return NextResponse.json({ error: 'Aksi PATCH honorarium tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui pengaturan honorarium.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.HONORARIUM);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ASSIGN_DUTY') {
      const parsed = AssignDutySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data penugasan guru tidak valid.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('teacher_additional_duties')
        .insert({
          teacher_id: parsed.data.teacher_id,
          duty_type_id: parsed.data.duty_type_id,
          decree_number: parsed.data.decree_number || null,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ assignment: data });
    }

    if (body.action === 'GENERATE_HONORARIUM') {
      const parsed = GenerateHonorariumSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parameter generate honorarium tidak valid.' }, { status: 400 });
      }

      const { teacher_id, period_month, period_year } = parsed.data;
      const startDate = `${period_year}-${String(period_month).padStart(2, '0')}-01`;
      const endDateObj = new Date(period_year, period_month, 0);
      const endDate = `${period_year}-${String(period_month).padStart(2, '0')}-${String(
        endDateObj.getDate()
      ).padStart(2, '0')}`;

      const [
        { data: rateRow },
        { data: attendances },
        { data: delegations },
        { data: supervisors },
        { data: committees },
        { data: duties },
      ] = await Promise.all([
        supabase
          .from('honorarium_settings')
          .select('rate_per_jtm')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('teacher_attendances')
          .select('jtm_earned')
          .eq('teacher_id', teacher_id)
          .eq('is_within_geofence', true)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate),
        supabase
          .from('teacher_delegations')
          .select('jtm_transferred')
          .eq('substitute_teacher_id', teacher_id)
          .eq('status', 'APPROVED')
          .gte('delegation_date', startDate)
          .lte('delegation_date', endDate),
        supabase
          .from('exam_supervisors')
          .select('jtm_allocated')
          .eq('teacher_id', teacher_id)
          .gte('exam_date', startDate)
          .lte('exam_date', endDate),
        supabase
          .from('exam_committees')
          .select('jtm_allocated')
          .eq('teacher_id', teacher_id),
        supabase
          .from('teacher_additional_duties')
          .select(
            'duty_type:additional_duty_types(id, code, name, receives_allowance, monthly_allowance)'
          )
          .eq('teacher_id', teacher_id)
          .eq('is_active', true),
      ]);

      const teachingJtm = (attendances || []).reduce((s, r) => s + (r.jtm_earned || 0), 0);
      const substituteJtm = (delegations || []).reduce((s, r) => s + (r.jtm_transferred || 0), 0);
      const examSupervisorJtm = (supervisors || []).reduce(
        (s, r) => s + (r.jtm_allocated || 0),
        0
      );
      const examCommitteeJtm = (committees || []).reduce(
        (s, r) => s + (r.jtm_allocated || 0),
        0
      );
      const ratePerJtm = Number(rateRow?.rate_per_jtm ?? 25000);

      const dutyInputs = (duties || [])
        .map((d) => {
          const dt = Array.isArray(d.duty_type) ? d.duty_type[0] : d.duty_type;
          if (!dt) return null;
          return {
            id: dt.id as string,
            code: dt.code as string,
            name: dt.name as string,
            receivesAllowance: Boolean(dt.receives_allowance),
            monthlyAllowance: Number(dt.monthly_allowance ?? 0),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const calc = calculateTeacherHonorarium(
        { teachingJtm, substituteJtm, examSupervisorJtm, examCommitteeJtm },
        ratePerJtm,
        dutyInputs
      );

      const { data: saved, error: saveErr } = await supabase
        .from('teacher_honorariums')
        .upsert(
          {
            teacher_id,
            period_month,
            period_year,
            teaching_jtm: teachingJtm,
            substitute_jtm: substituteJtm,
            exam_supervisor_jtm: examSupervisorJtm,
            exam_committee_jtm: examCommitteeJtm,
            total_jtm: calc.totalJtm,
            rate_per_jtm: calc.ratePerJtm,
            jtm_honorarium_amount: calc.jtmHonorariumAmount,
            additional_duty_allowance: calc.additionalDutyAllowance,
            total_amount: calc.totalAmount,
            status: 'DRAFT',
          },
          { onConflict: 'teacher_id,period_month,period_year' }
        )
        .select('*')
        .single();

      if (saveErr || !saved) {
        return NextResponse.json(
          { error: saveErr?.message || 'Gagal menyimpan honorarium.' },
          { status: 500 }
        );
      }

      await supabase
        .from('teacher_honorarium_duty_items')
        .delete()
        .eq('honorarium_id', saved.id);

      if (calc.eligibleDuties.length > 0) {
        const dutyMap = new Map(dutyInputs.map((d) => [d.code, d.id]));
        await supabase.from('teacher_honorarium_duty_items').insert(
          calc.eligibleDuties.map((d) => ({
            honorarium_id: saved.id,
            duty_type_id: dutyMap.get(d.code)!,
            duty_name: d.name,
            allowance_amount: d.monthlyAllowance,
          }))
        );
      }

      return NextResponse.json({ honorarium: saved, calculation: calc });
    }

    return NextResponse.json({ error: 'Aksi POST honorarium tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses honorarium.' }, { status: 500 });
  }
}
