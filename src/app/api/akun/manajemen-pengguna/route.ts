import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { ALL_APP_ROLES } from '@/lib/auth/rbac';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { formatWibDateTime, isGmailSmtpConfigured, sendInstitutionalEmail } from '@/lib/email/mailer';
import { buildAccountStatusEmail } from '@/lib/email/templates';
import type { AppRole } from '@/types/database';
import { sanitizeApiError } from '@/lib/security/api-error';
import { recordAuditLog } from '@/lib/security/audit-log';

const UpdateUserSchema = z.object({
  userId: z.string().uuid().optional(),
  userIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  action: z.enum(['APPROVE', 'REJECT', 'REJECT_PERMANENT', 'DEACTIVATE', 'UPDATE_ROLE']),
  primaryRole: z.enum(ALL_APP_ROLES).optional(),
  rejectionReason: z.string().max(500).optional().nullable(),
  sendEmail: z.boolean().optional().default(true),
});

function pickFirstRelation<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export async function GET(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.USER_MANAGEMENT_VIEW);
  if (guard.errorResponse) return guard.errorResponse;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
  const pageSize = Math.min(
    Math.max(1, Number(url.searchParams.get('pageSize') || 25) || 25),
    100
  );
  const statusFilter = (url.searchParams.get('status') || 'ALL').trim().toUpperCase();
  const rawSearch = (url.searchParams.get('q') || '').trim();
  const cleanSearch = rawSearch.replace(/[%_,()]/g, ' ').trim();

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      users: [],
      summary: { total: 0, pending: 0, active: 0, inactive: 0, rejected: 0 },
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 1,
      },
      smtpConfigured: false,
    });
  }

  const supabase = createSupabaseAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Bangun query dengan relational select PostgREST (tanpa full-table scan pada students/teachers/library_members/user_roles)
  let profilesQuery = supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      email,
      phone,
      primary_role,
      is_active,
      account_status,
      rejection_reason,
      reviewed_at,
      created_at,
      user_roles(role),
      students(id, nis, nisn),
      teachers_staff(id, staff_type, nip),
      library_members(id, member_code, member_type)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (statusFilter === 'PENDING') {
    profilesQuery = profilesQuery.eq('account_status', 'PENDING');
  } else if (statusFilter === 'AKTIF') {
    profilesQuery = profilesQuery.eq('account_status', 'AKTIF').eq('is_active', true);
  } else if (statusFilter === 'NONAKTIF') {
    profilesQuery = profilesQuery.eq('account_status', 'NONAKTIF');
  } else if (statusFilter === 'DITOLAK') {
    profilesQuery = profilesQuery.in('account_status', ['DITOLAK', 'DITOLAK_PERMANEN']);
  } else if (statusFilter === 'DITOLAK_PERMANEN') {
    profilesQuery = profilesQuery.eq('account_status', 'DITOLAK_PERMANEN');
  }

  if (cleanSearch) {
    const matchingRoles = ALL_APP_ROLES.filter((role) =>
      role.toLowerCase().includes(cleanSearch.toLowerCase())
    );
    const orClauses = [
      `full_name.ilike.%${cleanSearch}%`,
      `email.ilike.%${cleanSearch}%`,
      `phone.ilike.%${cleanSearch}%`,
    ];
    if (matchingRoles.length > 0) {
      orClauses.push(`primary_role.in.(${matchingRoles.join(',')})`);
    }
    profilesQuery = profilesQuery.or(orClauses.join(','));
  }

  const [
    { data: profiles, count: filteredCount, error: profilesError },
    summaryRpcRes,
  ] = await Promise.all([
    profilesQuery.range(from, to),
    supabase.rpc('get_user_management_summary'),
  ]);

  if (profilesError) {
    return NextResponse.json({ error: sanitizeApiError(profilesError) }, { status: 500 });
  }

  // Fallback jika migrasi RPC 0043 belum dijalankan di database
  let summary = {
    total: 0,
    pending: 0,
    active: 0,
    inactive: 0,
    rejected: 0,
  };

  if (
    !summaryRpcRes.error &&
    summaryRpcRes.data &&
    typeof summaryRpcRes.data === 'object'
  ) {
    const rpcData = summaryRpcRes.data as Partial<typeof summary>;
    summary = {
      total: Number(rpcData.total ?? 0),
      pending: Number(rpcData.pending ?? 0),
      active: Number(rpcData.active ?? 0),
      inactive: Number(rpcData.inactive ?? 0),
      rejected: Number(rpcData.rejected ?? 0),
    };
  } else {
    const [
      { count: totalCount },
      { count: pendingCount },
      { count: activeCount },
      { count: inactiveCount },
      { count: rejectedCount },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_status', 'PENDING'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_status', 'AKTIF')
        .eq('is_active', true),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_status', 'NONAKTIF'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('account_status', ['DITOLAK', 'DITOLAK_PERMANEN']),
    ]);
    summary = {
      total: totalCount ?? 0,
      pending: pendingCount ?? 0,
      active: activeCount ?? 0,
      inactive: inactiveCount ?? 0,
      rejected: rejectedCount ?? 0,
    };
  }

  const users = (profiles || []).map((p) => {
    const cleanReason = p.rejection_reason?.trim() || null;
    const status = p.account_status || (p.is_active ? 'AKTIF' : 'NONAKTIF');

    const rawUserRoles = Array.isArray(p.user_roles) ? p.user_roles : [];
    const roleList = rawUserRoles
      .map((r: { role?: string | null }) => r?.role as AppRole | undefined)
      .filter((r): r is AppRole => Boolean(r));

    const linkedStudent = pickFirstRelation(
      p.students as
        | { id: string; nis: string | null; nisn: string | null }
        | Array<{ id: string; nis: string | null; nisn: string | null }>
        | null
    );
    const linkedTeacher = pickFirstRelation(
      p.teachers_staff as
        | { id: string; staff_type: string; nip: string | null }
        | Array<{ id: string; staff_type: string; nip: string | null }>
        | null
    );
    const linkedLibrary = pickFirstRelation(
      p.library_members as
        | { id: string; member_code: string; member_type: string }
        | Array<{ id: string; member_code: string; member_type: string }>
        | null
    );

    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      primary_role: p.primary_role,
      is_active: p.is_active,
      account_status: status,
      rejection_reason: cleanReason,
      reviewed_at: p.reviewed_at,
      created_at: p.created_at,
      roles: roleList.length > 0 ? roleList : [p.primary_role as AppRole],
      linked_student: linkedStudent,
      linked_teacher: linkedTeacher,
      linked_library: linkedLibrary,
    };
  });

  const totalCount = filteredCount ?? users.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return NextResponse.json({
    users,
    summary,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    smtpConfigured: isGmailSmtpConfigured(),
  });
}

export async function PATCH(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.USER_MANAGEMENT_MANAGE);
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

    const { userId, userIds, action, primaryRole, rejectionReason, sendEmail } = parsed.data;
    const isActorSuperadmin = guard.session.roles.includes('SUPERADMIN');

    if (!isActorSuperadmin && primaryRole === 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Hanya SUPERADMIN yang dapat menetapkan peran SUPERADMIN.' },
        { status: 403 }
      );
    }

    // Mode Aksi Massal (Bulk Actions) ketika userIds dikirimkan
    if (userIds && userIds.length > 0) {
      if (action !== 'APPROVE' && action !== 'DEACTIVATE' && action !== 'UPDATE_ROLE') {
        return NextResponse.json(
          { error: 'Aksi massal hanya mendukung APPROVE, DEACTIVATE, atau UPDATE_ROLE.' },
          { status: 400 }
        );
      }

      if (action === 'UPDATE_ROLE' && !primaryRole) {
        return NextResponse.json(
          { error: 'Peran baru (primaryRole) wajib dipilih untuk aksi ubah peran massal.' },
          { status: 400 }
        );
      }

      const uniqueIds = Array.from(new Set(userIds)).filter((id) => {
        if ((action === 'DEACTIVATE' || action === 'UPDATE_ROLE') && id === guard.session.userId) {
          return false;
        }
        return true;
      });

      if (uniqueIds.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada akun valid yang dapat diproses (Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri).' },
          { status: 400 }
        );
      }

      const supabase = createSupabaseAdminClient();
      const { data: targetUsers, error: fetchBulkErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, primary_role, is_active, account_status')
        .in('id', uniqueIds);

      if (fetchBulkErr || !targetUsers || targetUsers.length === 0) {
        return NextResponse.json({ error: 'Pengguna terpilih tidak ditemukan.' }, { status: 404 });
      }

      const allowedTargets = targetUsers.filter(
        (u) => isActorSuperadmin || u.primary_role !== 'SUPERADMIN'
      );

      if (allowedTargets.length === 0) {
        return NextResponse.json(
          { error: 'Hanya SUPERADMIN yang dapat mengubah status atau peran akun SUPERADMIN.' },
          { status: 403 }
        );
      }

      const targetIds = allowedTargets.map((u) => u.id);
      const nowIso = new Date().toISOString();
      const bulkPayload: Record<string, unknown> = {
        updated_at: nowIso,
      };

      if (action === 'APPROVE') {
        bulkPayload.is_active = true;
        bulkPayload.account_status = 'AKTIF';
        bulkPayload.rejection_reason = null;
        bulkPayload.reviewed_at = nowIso;
        bulkPayload.reviewed_by = guard.session.userId;
      } else if (action === 'DEACTIVATE') {
        bulkPayload.is_active = false;
        bulkPayload.account_status = 'NONAKTIF';
        bulkPayload.reviewed_at = nowIso;
        bulkPayload.reviewed_by = guard.session.userId;
      }

      if (primaryRole) {
        bulkPayload.primary_role = primaryRole;
      }

      const { data: updatedUsers, error: bulkUpdateErr } = await supabase
        .from('profiles')
        .update(bulkPayload)
        .in('id', targetIds)
        .select('*');

      if (bulkUpdateErr) {
        return NextResponse.json(
          { error: sanitizeApiError(bulkUpdateErr, 'Gagal memperbarui akun secara massal.') },
          { status: 500 }
        );
      }

      if (primaryRole) {
        for (const u of allowedTargets) {
          if (u.primary_role && u.primary_role !== primaryRole) {
            await supabase
              .from('user_roles')
              .delete()
              .eq('user_id', u.id)
              .eq('role', u.primary_role);
          }
        }
        const roleUpserts = targetIds.map((id) => ({ user_id: id, role: primaryRole }));
        const { error: bulkRoleErr } = await supabase
          .from('user_roles')
          .upsert(roleUpserts, { onConflict: 'user_id,role' });
        if (bulkRoleErr) {
          return NextResponse.json(
            { error: sanitizeApiError(bulkRoleErr, 'Gagal memperbarui peran pengguna secara massal.') },
            { status: 500 }
          );
        }
      }

      await recordAuditLog({
        session: guard.session,
        request,
        module: 'USER_MANAGEMENT',
        action: `BULK_${action}`,
        entityType: 'profile',
        entityId: targetIds[0],
        summary: `Aksi massal ${action}${primaryRole ? ` (${primaryRole})` : ''} pada ${targetIds.length} akun pengguna`,
        metadata: {
          targetUserIds: targetIds,
          primaryRole: primaryRole || null,
          updatedCount: targetIds.length,
        },
      });

      return NextResponse.json({
        updatedCount: targetIds.length,
        users: updatedUsers || [],
      });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'ID pengguna (userId atau userIds) wajib disertakan.' },
        { status: 400 }
      );
    }

    if (
      userId === guard.session.userId &&
      (action === 'REJECT' || action === 'REJECT_PERMANENT' || action === 'DEACTIVATE')
    ) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menonaktifkan atau menolak akun Anda sendiri.' },
        { status: 400 }
      );
    }

    if (userId === guard.session.userId && action === 'UPDATE_ROLE') {
      return NextResponse.json(
        { error: 'Anda tidak dapat mengubah peran akun Anda sendiri.' },
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

    if (!isActorSuperadmin && targetUser.primary_role === 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Hanya SUPERADMIN yang dapat mengubah status atau peran akun SUPERADMIN.' },
        { status: 403 }
      );
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
    } else if (action === 'REJECT_PERMANENT') {
      updatePayload.is_active = false;
      updatePayload.account_status = 'DITOLAK_PERMANEN';
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
      if (targetUser.primary_role && targetUser.primary_role !== primaryRole) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', targetUser.primary_role);
      }
      const { error: roleUpsertErr } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: primaryRole }, { onConflict: 'user_id,role' });
      if (roleUpsertErr) {
        return NextResponse.json(
          { error: sanitizeApiError(roleUpsertErr, 'Gagal memperbarui peran pengguna.') },
          { status: 500 }
        );
      }
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

          const rawWebsiteUrl = inst?.website_url?.trim();
          const normalizedWebsiteUrl = rawWebsiteUrl
            ? /^https?:\/\//i.test(rawWebsiteUrl)
              ? rawWebsiteUrl
              : `https://${rawWebsiteUrl}`
            : '';
          const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || '';
          const reqOrigin = request.headers.get('origin')?.trim() || '';
          const isLocalReqOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin);
          const baseOrigin =
            normalizedWebsiteUrl ||
            (envAppUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envAppUrl)
              ? envAppUrl
              : '') ||
            (!isLocalReqOrigin ? reqOrigin : '') ||
            envAppUrl ||
            reqOrigin;
          const loginUrl = baseOrigin ? `${baseOrigin.replace(/\/$/, '')}/login` : null;
          const emailStatus =
            action === 'APPROVE'
              ? 'AKTIF'
              : action === 'REJECT'
              ? 'DITOLAK'
              : action === 'REJECT_PERMANENT'
              ? 'DITOLAK_PERMANEN'
              : 'NONAKTIF';

          const tpl = buildAccountStatusEmail({
            institutionName: inst?.name || 'Portal SIMMS',
            institutionAddress: inst?.address,
            institutionEmail: inst?.email,
            recipientName: targetUser.full_name,
            recipientEmail: targetUser.email,
            status: emailStatus,
            rejectionReason:
              action === 'REJECT' || action === 'REJECT_PERMANENT'
                ? rejectionReason?.trim() || null
                : null,
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

    await recordAuditLog({
      session: guard.session,
      request,
      module: 'USER_MANAGEMENT',
      action,
      entityType: 'profile',
      entityId: userId,
      summary: `${action} pada akun ${targetUser.full_name} (${targetUser.email || userId})`,
      metadata: {
        before: {
          primary_role: targetUser.primary_role,
          account_status: targetUser.account_status,
          is_active: targetUser.is_active,
        },
        after: {
          primary_role: updatedUser.primary_role,
          account_status: updatedUser.account_status,
          is_active: updatedUser.is_active,
        },
        rejectionReason: rejectionReason?.trim() || null,
      },
    });

    return NextResponse.json({
      user: updatedUser,
      emailSent,
      emailWarning,
    });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeApiError(err, 'Gagal memproses permintaan.') },
      { status: 500 }
    );
  }
}
