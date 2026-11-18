import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessPortalPath } from '@/lib/auth/rbac';
import type { AppRole } from '@/types/database';

export async function middleware(request: NextRequest) {
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

    const accountStatus = (profile as { account_status?: string } | null)?.account_status;
    const isAllowed =
      Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

    if (isAllowed) {
      const rawNext = request.nextUrl.searchParams.get('next');
      const targetPath =
        rawNext && rawNext.startsWith('/') && !rawNext.startsWith('/login')
          ? rawNext
          : '/portal';
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = targetPath;
      portalUrl.search = '';
      return NextResponse.redirect(portalUrl);
    }
  }

  if (request.nextUrl.pathname.startsWith('/portal')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
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

    const accountStatus = (profile as { account_status?: string } | null)?.account_status;
    const isAllowed =
      Boolean(fallbackProfile?.is_active) && (!accountStatus || accountStatus === 'AKTIF');

    if (!isAllowed) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('account_status', accountStatus || 'PENDING');
      return NextResponse.redirect(loginUrl);
    }

    const { data: extraRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const primaryRole =
      ((fallbackProfile as { primary_role?: AppRole } | null)?.primary_role as AppRole) || 'UMUM';
    const roleSet = new Set<AppRole>([primaryRole]);
    for (const r of extraRoles || []) {
      if (r.role) roleSet.add(r.role as AppRole);
    }
    const userRoles = Array.from(roleSet);

    if (!canAccessPortalPath(request.nextUrl.pathname, userRoles)) {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = '/portal';
      portalUrl.search = '';
      return NextResponse.redirect(portalUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
