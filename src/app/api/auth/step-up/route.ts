import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import {
  getActiveStepUp,
  signStepUpCookie,
  STEP_UP_COOKIE,
  STEP_UP_TTL_SECONDS,
} from '@/lib/auth/step-up';
import { recordAuditLog } from '@/lib/security/audit-log';

const StepUpVerifySchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('password'),
    password: z.string().min(1, 'Kata sandi wajib diisi.'),
  }),
  z.object({
    method: z.literal('mfa'),
    factorId: z.string().min(1, 'Factor MFA wajib dipilih.'),
    code: z.string().regex(/^\d{6}$/, 'Kode MFA harus 6 digit angka.'),
  }),
]);

export async function GET() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const activeStepUp = await getActiveStepUp(session.userId);
  let mfaFactors: Array<{ id: string; friendly_name?: string | null }> = [];

  if (isSupabaseServerConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.mfa.listFactors();
      mfaFactors = (data?.totp || [])
        .filter((f) => f.status === 'verified')
        .map((f) => ({ id: f.id, friendly_name: f.friendly_name }));
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json({
    verified: Boolean(activeStepUp),
    method: activeStepUp?.method ?? null,
    expiresAt: activeStepUp?.exp ?? null,
    hasMfa: mfaFactors.length > 0,
    mfaFactors,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Layanan autentikasi belum dikonfigurasi.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = StepUpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data verifikasi tidak valid.' },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.method === 'password') {
    if (!session.email) {
      return NextResponse.json(
        { error: 'Akun ini tidak memiliki alamat email untuk verifikasi kata sandi.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: session.email,
      password: parsed.data.password,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Kata sandi yang Anda masukkan salah. Silakan coba lagi.' },
        { status: 401 }
      );
    }
  } else {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: parsed.data.factorId,
    });
    if (chErr || !challenge?.id) {
      return NextResponse.json(
        { error: 'Gagal memulai verifikasi MFA. Silakan coba lagi.' },
        { status: 400 }
      );
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: parsed.data.factorId,
      challengeId: challenge.id,
      code: parsed.data.code,
    });
    if (verErr) {
      return NextResponse.json(
        { error: 'Kode autentikator MFA tidak valid atau sudah kedaluwarsa.' },
        { status: 401 }
      );
    }
  }

  const { token, expiresAt } = signStepUpCookie(session.userId, parsed.data.method);

  await recordAuditLog({
    session,
    request,
    module: 'AUTH_SECURITY',
    action: 'STEP_UP_VERIFIED',
    entityType: 'profile',
    entityId: session.userId,
    summary: `Verifikasi Step-Up berhasil melalui metode ${parsed.data.method.toUpperCase()}.`,
    metadata: { method: parsed.data.method },
  });

  const res = NextResponse.json({
    verified: true,
    method: parsed.data.method,
    expiresAt,
  });

  res.cookies.set(STEP_UP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STEP_UP_TTL_SECONDS,
  });

  return res;
}
