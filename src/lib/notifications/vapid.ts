import crypto from 'node:crypto';
import * as webpush from 'web-push';

let vapidInitialized = false;

export function getVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
}

export function isWebPushConfigured(): boolean {
  const pub = getVapidPublicKey();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  return Boolean(pub && priv);
}

export function ensureWebPushConfigured(): boolean {
  if (!isWebPushConfigured()) return false;
  if (vapidInitialized) return true;

  const subject =
    (process.env.VAPID_SUBJECT || '').trim() ||
    (process.env.GMAIL_SMTP_USER ? `mailto:${process.env.GMAIL_SMTP_USER}` : 'mailto:admin@simms.sch.id');

  webpush.setVapidDetails(
    subject,
    getVapidPublicKey(),
    (process.env.VAPID_PRIVATE_KEY || '').trim()
  );
  vapidInitialized = true;
  return true;
}

export { webpush };

function getTrackingSecret(): string {
  return (
    (process.env.PUSH_TRACKING_SECRET || '').trim() ||
    (process.env.VAPID_PRIVATE_KEY || '').trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() ||
    'simms-push-tracking-fallback'
  );
}

export function signDeliveryToken(deliveryId: string): string {
  return crypto
    .createHmac('sha256', getTrackingSecret())
    .update(deliveryId)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyDeliveryToken(deliveryId: string, token: string): boolean {
  if (!deliveryId || !token) return false;
  const expected = signDeliveryToken(deliveryId);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
