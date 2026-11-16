import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles, ROLE_GROUPS } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { formatWibDateTime, isGmailSmtpConfigured, sendInstitutionalEmail } from '@/lib/email/mailer';
import { buildAccountStatusEmail } from '@/lib/email/templates';
import type { AppRole } from '@/types/database';

const APP_ROLES: [AppRole, ...AppRole[]] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_KESISWAAN',
  'WAKA_KURIKULUM',
  'WAKA_HUMAS',
  'WAKA_SARPRAS',
  'KEPALA_TU',
  'STAF_TU',
  'GURU',
  'WALI_KELAS',
  'GURU_WALI',
  'GURU_BK',
  'BENDAHARA',
  'BENDAHARA_KOMITE',
  'PENGELOLA_TABUNGAN',
  'PEMBINA_OSIM',
  'PEMBINA_EKSTRAKURIKULER',
  'PUSTAKAWAN',
  'SISWA',
  'ORANG_TUA',
  'ALUMNI',
  'UMUM',
];

const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'DEACTIVATE', 'UPDATE_ROLE']),
  primaryRole: z.enum(APP_ROLES).optional(),
  rejectionReason: z.string().max(500).optional().nullable(),
  sendEmail: z.boolean().optional().default(true),
});

export async function GET() {
  const guard = await requireApiRoles(ROLE_GROUPS.USER_MANAGEMENT);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      users: [],
      summary: { total: 0, pending: 0, active: 0, inactive: 0, rejected: 0 },
      smtpConfigured: false,
    });
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: profiles, error: profilesError },
    { data: roles },
    { data: students },
    { data: teachers },
    { data: libMembers },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, primary_role, is_active, account_status, rejection_reason, reviewed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('students').select('id, profile_id, nis, nisn').not('profile_id', 'is', null),
    supabase.from('teachers_staff').select('id, profile_id, staff_type, nip').not('profile_id', 'is', null),
    supabase.from('library_members').select('id, profile_id, member_code, member_type').not('profile_id', 'is', null),
  ]);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const rolesMap = new Map<string, AppRole[]>();
  for (const r of roles || []) {
    const list = rolesMap.get(r.user_id) || [];
    list.push(r.role as AppRole);
    rolesMap.set(r.user_id, list);
  }

  const studentMap = new Map((students || []).map((s) => [s.profile_id as string, s]));
  const teacherMap = new Map((teachers || []).map((t) => [t.profile_id as string, t]));
  const libMap = new Map((libMembers || []).map((l) => [l.profile_id as string, l]));

  const users = (profiles || []).map((p) => {
    const status = p.account_status || (p.is_active ? 'AKTIF' : 'NONAKTIF');
    return {
      ...p,
      account_status: status,
      roles: rolesMap.get(p.id) || [p.primary_role as AppRole],
      linked_student: studentMap.get(p.id) || null,
      linked_teacher: teacherMap.get(p.id) || null,
      linked_library: libMap.get(p.id) || null,
    };
  });

  const summary = {
    total: users.length,
    pending: users.filter((u) => u.account_status === 'PENDING').length,
    active: users.filter((u) => u.account_status === 'AKTIF' && u.is_active).length,
    inactive: users.filter((u) => u.account_status === 'NONAKTIF').length,
    rejected: users.filter((u) => u.account_status === 'DITOLAK').length,
  };

  return NextResponse.json({
    users,
    summary,
    smtpConfigured: isGmailSmtpConfigured(),
  });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(ROLE_GROUPS.USER_MANAGEMENT);
  if (guard.errorResponse) return guard.errorResponse;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Permintaan tidak valid.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, action, primaryRole, rejectionReason, sendEmail } = parsed.data;

    if (
      userId === guard.session.userId &&
      (action === 'REJECT' || action === 'DEACTIVATE')
    ) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menonaktifkan atau menolak akun Anda sendiri.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: targetUser, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, primary_role, is_active, account_status')
      .eq('id', userId)
      .single();

    if (fetchErr || !targetUser) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updated_at: nowIso,
    };

    if (action === 'APPROVE') {
      updatePayload.is_active = true;
      updatePayload.account_status = 'AKTIF';
      updatePayload.rejection_reason = null;
      updatePayload.reviewed_at = nowIso;
      updatePayload.reviewed_by = guard.session.userId;
    } else if (action === 'REJECT') {
      updatePayload.is_active = false;
      updatePayload.account_status = 'DITOLAK';
      updatePayload.rejection_reason = rejectionReason?.trim() || null;
      updatePayload.reviewed_at = nowIso;
      updatePayload.reviewed_by = guard.session.userId;
    } else if (action === 'DEACTIVATE') {
      updatePayload.is_active = false;
      updatePayload.account_status = 'NONAKTIF';
      updatePayload.reviewed_at = nowIso;
      updatePayload.reviewed_by = guard.session.userId;
    }

    if (primaryRole) {
      updatePayload.primary_role = primaryRole;
    }

    const { data: updatedUser, error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select('*')
      .single();

    if (updateErr || !updatedUser) {
      return NextResponse.json(
        { error: updateErr?.message || 'Gagal memperbarui status akun.' },
        { status: 500 }
      );
    }

    if (primaryRole) {
      await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: primaryRole }, { onConflict: 'user_id,role' });
    }

    let emailSent = false;
    let emailWarning: string | null = null;

    if (sendEmail && action !== 'UPDATE_ROLE' && targetUser.email) {
      if (!isGmailSmtpConfigured()) {
        emailWarning =
          'Status akun berhasil diperbarui, tetapi email notifikasi belum terkirim karena GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD belum dikonfigurasi.';
      } else {
        try {
          const { data: inst } = await supabase
            .from('institution_settings')
            .select('name, address, email, website_url')
            .limit(1)
            .maybeSingle();

          const origin = request.headers.get('origin') || inst?.website_url || '';
          const loginUrl = origin ? `${origin.replace(/\/$/, '')}/login` : null;
          const emailStatus =
            action === 'APPROVE' ? 'AKTIF' : action === 'REJECT' ? 'DITOLAK' : 'NONAKTIF';

          const tpl = buildAccountStatusEmail({
            institutionName: inst?.name || 'Portal SIMMS',
            institutionAddress: inst?.address,
            institutionEmail: inst?.email,
            recipientName: targetUser.full_name,
            recipientEmail: targetUser.email,
            status: emailStatus,
            rejectionReason: action === 'REJECT' ? rejectionReason?.trim() || null : null,
            loginUrl,
            reviewedAtWib: formatWibDateTime(),
          });

          await sendInstitutionalEmail({
            senderLabel: inst?.name || 'Admin SIMMS',
            to: targetUser.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          emailSent = true;
        } catch (mailErr) {
          emailWarning =
            mailErr instanceof Error
              ? `Status akun diperbarui, namun email gagal dikirim: ${mailErr.message}`
              : 'Status akun diperbarui, namun email gagal dikirim.';
        }
      }
    }

    return NextResponse.json({
      user: updatedUser,
      emailSent,
      emailWarning,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses permintaan.' },
      { status: 500 }
    );
  }
}
