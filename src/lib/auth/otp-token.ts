import crypto from 'node:crypto';

export const OTP_COOKIE_NAME = 'simms_pwd_otp';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 menit

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
  }
  return secret;
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function generateNumericOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function createSignedOtpToken(userId: string, otp: string): string {
  const payload = {
    userId,
    otpHash: hashOtp(otp),
    exp: Date.now() + OTP_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedOtpToken(
  token: string,
  expectedUserId: string,
  otpInput: string
): { valid: boolean; reason?: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Token OTP tidak valid.' };
  }

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedSigBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
  ) {
    return { valid: false, reason: 'Tanda tangan token OTP tidak valid.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      userId: string;
      otpHash: string;
      exp: number;
    };

    if (payload.userId !== expectedUserId) {
      return { valid: false, reason: 'Token OTP bukan milik akun ini.' };
    }
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang.' };
    }

    const inputHash = hashOtp(otpInput.trim());
    if (
      inputHash.length !== payload.otpHash.length ||
      !crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(payload.otpHash))
    ) {
      return { valid: false, reason: 'Kode OTP yang Anda masukkan salah.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Format token OTP tidak valid.' };
  }
}
