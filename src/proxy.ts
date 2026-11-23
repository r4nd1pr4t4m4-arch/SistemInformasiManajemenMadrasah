import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessPortalPath, mapDutyCodeToRole } from '@/lib/auth/rbac';
import {
  ROLE_CACHE_COOKIE,
  ROLE_CACHE_TTL_SECONDS,
  signRoleCacheCookie,
  verifyRoleCacheCookie,
} from '@/lib/auth/role-cache';
import type { AppRole } from '@/types/database';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname === '/login' && user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active, account_status')
      .eq('id', user.id)
      .maybeSingle();

    const fallbackProfile = profileError
      ? (
          await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', user.id)
            .maybeSingle()
        ).data
      : profile;

    const accountStatus = (fallbackProfile as { account_status?: string } | null)?.account_status;
    const isAllowed =
      Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

    if (isAllowed) {
      const rawNext = request.nextUrl.searchParams.get('next');
      const targetPath =
        rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/login')
          ? rawNext
          : '/portal';
      return NextResponse.redirect(new URL(targetPath, request.url));
    }
  }

  if (request.nextUrl.pathname.startsWith('/portal')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.cookies.delete(ROLE_CACHE_COOKIE);
      return redirectRes;
    }

    // Cek signed role-cache cookie (TTL 2 menit) untuk menghindari 8-11 query DB pada setiap klik menu
    const cached = await verifyRoleCacheCookie(
      request.cookies.get(ROLE_CACHE_COOKIE)?.value,
      user.id
    );

    if (cached) {
      if (
        !canAccessPortalPath(request.nextUrl.pathname, cached.roles, {
          isPicketTeacher: cached.isPicketTeacher,
          isExamSupervisor: cached.isExamSupervisor,
          isExamCommittee: cached.isExamCommittee,
          taughtSubjectIds: cached.taughtSubjectIds,
        })
      ) {
        const portalUrl = request.nextUrl.clone();
        portalUrl.pathname = '/portal';
        portalUrl.search = '';
        return NextResponse.redirect(portalUrl);
      }
      return response;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active, account_status, primary_role')
      .eq('id', user.id)
      .maybeSingle();

    const fallbackProfile = profileError
      ? (
          await supabase
            .from('profiles')
            .select('is_active, primary_role')
            .eq('id', user.id)
            .maybeSingle()
        ).data
      : profile;

    const accountStatus = (fallbackProfile as { account_status?: string } | null)?.account_status;
    const isAllowed =
      Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

    if (!isAllowed) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('account_status', accountStatus || 'PENDING');
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.cookies.delete(ROLE_CACHE_COOKIE);
      return redirectRes;
    }

    const [{ data: extraRoles }, { data: teacherRow }, { data: guardianRows }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('teachers_staff').select('id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('student_guardians').select('id').eq('profile_id', user.id).limit(1),
    ]);

    const primaryRole =
      ((fallbackProfile as { primary_role?: AppRole } | null)?.primary_role as AppRole) || 'UMUM';
    const roleSet = new Set<AppRole>([primaryRole]);
    for (const r of extraRoles || []) {
      if (r.role) roleSet.add(r.role as AppRole);
    }
    if ((guardianRows || []).length > 0) {
      roleSet.add('ORANG_TUA');
    }

    let isPicketTeacher = false;
    let isExamSupervisor = false;
    let isExamCommittee = false;
    let taughtSubjectIds: string[] = [];

    if (teacherRow?.id) {
      const [
        { data: dutyRows },
        { data: homeroomRows },
        { data: guruWaliRows },
        { data: picketRows },
        { data: picketDelegationRows },
        { data: examSupRows },
        { data: examComRows },
        { data: scheduleRows },
      ] = await Promise.all([
        supabase
          .from('teacher_additional_duties')
          .select('duty_type:additional_duty_types(code, name)')
          .eq('teacher_id', teacherRow.id)
          .eq('is_active', true),
        supabase.from('classrooms').select('id').eq('homeroom_teacher_id', teacherRow.id).limit(1),
        supabase
          .from('guru_wali_assignments')
          .select('id')
          .eq('teacher_id', teacherRow.id)
          .limit(1),
        supabase.from('picket_schedules').select('id').eq('teacher_id', teacherRow.id).limit(1),
        supabase
          .from('teacher_delegations')
          .select('id')
          .eq('substitute_teacher_id', teacherRow.id)
          .eq('delegation_type', 'PIKET')
          .limit(1),
        supabase.from('exam_supervisors').select('id').eq('teacher_id', teacherRow.id).limit(1),
        supabase.from('exam_committees').select('id').eq('teacher_id', teacherRow.id).limit(1),
        supabase.from('schedules').select('subject_id').eq('teacher_id', teacherRow.id),
      ]);

      for (const d of dutyRows || []) {
        const dt = Array.isArray(d.duty_type) ? d.duty_type[0] : d.duty_type;
        const mapped =
          mapDutyCodeToRole(dt?.code as string | null) ||
          mapDutyCodeToRole(dt?.name as string | null);
        if (mapped) roleSet.add(mapped);
      }
      if ((homeroomRows || []).length > 0) roleSet.add('WALI_KELAS');
      if ((guruWaliRows || []).length > 0) roleSet.add('GURU_WALI');

      isPicketTeacher =
        (picketRows || []).length > 0 || (picketDelegationRows || []).length > 0;
      isExamSupervisor = (examSupRows || []).length > 0;
      isExamCommittee = (examComRows || []).length > 0;
      taughtSubjectIds = Array.from(
        new Set(
          (scheduleRows || [])
            .map((r) => r.subject_id as string | null)
            .filter((id): id is string => Boolean(id))
        )
      );
    }

    const userRoles = Array.from(roleSet);
    const signedCookie = await signRoleCacheCookie({
      uid: user.id,
      roles: userRoles,
      isPicketTeacher,
      isExamSupervisor,
      isExamCommittee,
      taughtSubjectIds,
    });

    if (
      !canAccessPortalPath(request.nextUrl.pathname, userRoles, {
        isPicketTeacher,
        isExamSupervisor,
        isExamCommittee,
        taughtSubjectIds,
      })
    ) {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = '/portal';
      portalUrl.search = '';
      const redirectRes = NextResponse.redirect(portalUrl);
      if (signedCookie) {
        redirectRes.cookies.set(ROLE_CACHE_COOKIE, signedCookie, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: ROLE_CACHE_TTL_SECONDS,
        });
      }
      return redirectRes;
    }

    if (signedCookie) {
      response.cookies.set(ROLE_CACHE_COOKIE, signedCookie, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ROLE_CACHE_TTL_SECONDS,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
