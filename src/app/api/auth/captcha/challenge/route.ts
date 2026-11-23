import { NextResponse } from 'next/server';
import { createLocalCaptchaChallenge, isCaptchaBypassed } from '@/lib/security/captcha-server';
import { sanitizeApiError } from '@/lib/security/api-error';

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
      { error: sanitizeApiError(err, 'Gagal membuat tantangan CAPTCHA.') },
      { status: 500 }
    );
  }
}
