import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { PERMISSIONS } from '@/lib/auth/rbac';
import type { NotificationCategoryKey } from '@/lib/notifications/types';

/**
 * Helper mengambil user_id (profile_id) dari siswa & seluruh orang tua/walinya.
 */
async function getStudentAndGuardianUserIds(studentId: string): Promise<{
  studentName: string;
  studentUserId: string | null;
  guardianUserIds: string[];
  allUserIds: string[];
}> {
  if (!isSupabaseAdminConfigured() || !studentId) {
    return { studentName: 'Siswa', studentUserId: null, guardianUserIds: [], allUserIds: [] };
  }
  const db = createSupabaseAdminClient();
  const [{ data: student }, { data: guardians }] = await Promise.all([
    db.from('students').select('full_name, profile_id').eq('id', studentId).maybeSingle(),
    db.from('student_guardians').select('profile_id').eq('student_id', studentId),
  ]);

  const studentName = (student?.full_name as string) || 'Siswa';
  const studentUserId = (student?.profile_id as string | null) ?? null;
  const guardianUserIds = (guardians || [])
    .map((g) => g.profile_id as string | null)
    .filter((id): id is string => Boolean(id));

  const allSet = new Set<string>(guardianUserIds);
  if (studentUserId) allSet.add(studentUserId);

  return {
    studentName,
    studentUserId,
    guardianUserIds,
    allUserIds: Array.from(allSet),
  };
}

async function safeDispatch(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // Fail-safe: kegagalan notifikasi tidak boleh mengganggu transaksi utama
  }
}

export async function notifyStudentFamilyEvent(params: {
  studentId: string;
  categoryKey: NotificationCategoryKey;
  title: string;
  body: string;
  url: string;
  dedupeKey?: string;
  createdBy?: string | null;
  includeStudent?: boolean;
}) {
  await safeDispatch(async () => {
    const family = await getStudentAndGuardianUserIds(params.studentId);
    const targetIds =
      params.includeStudent === false ? family.guardianUserIds : family.allUserIds;
    if (targetIds.length === 0) return;

    await dispatchNotification({
      categoryKey: params.categoryKey,
      title: params.title,
      body: params.body.replace('{studentName}', family.studentName),
      url: params.url,
      sourceType: 'SYSTEM_EVENT',
      createdBy: params.createdBy ?? null,
      dedupeKey: params.dedupeKey ?? null,
      target: { userIds: targetIds },
    });
  });
}

export async function notifyCmsPostPublished(params: {
  postId: string;
  title: string;
  slug: string;
  category?: string | null;
  createdBy?: string | null;
}) {
  await safeDispatch(async () => {
    const label = params.category === 'PENGUMUMAN' ? 'Pengumuman Baru' : 'Berita Terbaru';
    await dispatchNotification({
      categoryKey: params.category === 'PENGUMUMAN' ? 'PENGUMUMAN_BROADCAST' : 'BERITA_CMS',
      title: `${label}: ${params.title}`,
      body: 'Informasi terbaru telah dipublikasikan di website resmi lembaga. Ketuk untuk membaca selengkapnya.',
      url: `/berita/${params.slug}`,
      sourceType: 'SYSTEM_EVENT',
      createdBy: params.createdBy ?? null,
      dedupeKey: `cms-post-${params.postId}`,
      dedupeWindowMinutes: 60,
      target: {
        includeAllUsers: true,
        includePublicSubscribers: true,
      },
    });
  });
}

export async function notifyPpdbNewRegistration(params: {
  registrationId: string;
  applicantName: string;
  registrationNumber?: string | null;
}) {
  await safeDispatch(async () => {
    await dispatchNotification({
      categoryKey: 'PPDB',
      title: 'Pendaftar PPDB Baru Masuk',
      body: `${params.applicantName}${params.registrationNumber ? ` (${params.registrationNumber})` : ''} telah mendaftar melalui PPDB Online.`,
      url: '/portal/cms/ppdb',
      sourceType: 'SYSTEM_EVENT',
      dedupeKey: `ppdb-new-${params.registrationId}`,
      target: { roles: PERMISSIONS.CMS_PPDB_MANAGE },
    });
  });
}

export async function notifyNewInquiry(params: {
  inquiryId: string;
  senderName: string;
  subject?: string | null;
}) {
  await safeDispatch(async () => {
    await dispatchNotification({
      categoryKey: 'PERPUSTAKAAN_SURAT',
      title: 'Pesan Kontak Baru dari Website',
      body: `${params.senderName}: ${params.subject || 'Mengirimkan pertanyaan melalui formulir kontak.'}`,
      url: '/portal/cms/profil',
      sourceType: 'SYSTEM_EVENT',
      dedupeKey: `inquiry-${params.inquiryId}`,
      target: { roles: ['SUPERADMIN', 'OPERATOR', 'WAKA_HUMAS', 'KEPALA_TU'] },
    });
  });
}

export async function notifyUserDirect(params: {
  userId: string;
  categoryKey: NotificationCategoryKey;
  title: string;
  body: string;
  url: string;
  dedupeKey?: string;
  dedupeWindowMinutes?: number;
  createdBy?: string | null;
}) {
  await safeDispatch(async () => {
    if (!params.userId) return;
    await dispatchNotification({
      categoryKey: params.categoryKey,
      title: params.title,
      body: params.body,
      url: params.url,
      sourceType: 'SYSTEM_EVENT',
      createdBy: params.createdBy ?? null,
      dedupeKey: params.dedupeKey ?? null,
      dedupeWindowMinutes: params.dedupeWindowMinutes,
      target: { userIds: [params.userId] },
    });
  });
}
