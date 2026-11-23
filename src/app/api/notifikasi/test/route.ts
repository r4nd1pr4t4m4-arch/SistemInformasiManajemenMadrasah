import { NextResponse } from 'next/server';
import { getCurrentUserWithRoles } from '@/lib/auth/session';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { isWebPushConfigured } from '@/lib/notifications/vapid';

export async function POST() {
  const session = await getCurrentUserWithRoles();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      {
        error:
          'VAPID Web Push belum dikonfigurasi. Jalankan `npm run push:vapid` dan isi environment variable terlebih dahulu.',
      },
      { status: 503 }
    );
  }

  const result = await dispatchNotification({
    categoryKey: 'PENGUMUMAN_BROADCAST',
    title: 'Uji Coba Notifikasi SIMMS',
    body: `Halo ${session.fullName}, notifikasi Web Push pada perangkat Anda telah aktif dan berfungsi dengan baik.`,
    url: '/portal/akun/notifikasi',
    sourceType: 'TEST',
    createdBy: session.userId,
    target: { userIds: [session.userId] },
    processImmediately: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.skippedReason || 'Gagal mengirim notifikasi uji coba.' },
      { status: 500 }
    );
  }

  if (result.pushQueuedCount === 0) {
    return NextResponse.json(
      {
        ...result,
        ok: true,
        warning:
          'Notifikasi in-app berhasil dibuat, tetapi belum ada perangkat Web Push aktif pada akun Anda.',
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ...result,
    ok: true,
    message: `Notifikasi uji coba telah dikirim ke ${result.pushQueuedCount} perangkat aktif Anda.`,
  });
}
