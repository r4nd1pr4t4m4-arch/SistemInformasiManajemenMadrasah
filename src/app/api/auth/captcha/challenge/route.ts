import { NextResponse } from 'next/server';
import { createLocalCaptchaChallenge, isCaptchaBypassed } from '@/lib/security/captcha-server';

export async function GET(request: Request) {
  if (isCaptchaBypassed(request)) {
    return NextResponse.json(
      { bypassed: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const challenge = createLocalCaptchaChallenge();
    return NextResponse.json(
      {
        bypassed: false,
        ...challenge,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuat tantangan CAPTCHA.' },
      { status: 500 }
    );
  }
}
