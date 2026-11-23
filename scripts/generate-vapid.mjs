import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();
const trackingSecret = crypto.randomBytes(32).toString('hex');
const cronSecret = crypto.randomBytes(32).toString('hex');

console.log('\n=== SIMMS Web Push VAPID Keys ===\n');
console.log('Tambahkan variabel berikut ke .env.local dan Environment Variables Vercel:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@simms.sch.id');
console.log(`PUSH_TRACKING_SECRET=${trackingSecret}`);
console.log(`CRON_SECRET=${cronSecret}`);
console.log('\n=================================\n');
