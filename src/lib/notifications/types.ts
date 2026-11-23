export type NotificationCategoryKey =
  | 'PENGUMUMAN_BROADCAST'
  | 'KEAMANAN_AKUN'
  | 'PRESENSI_SISWA'
  | 'LAYANAN_BK'
  | 'KEUANGAN_SPP'
  | 'BERITA_CMS'
  | 'PPDB'
  | 'GURU_WALI_HAFALAN'
  | 'PENILAIAN_RAPORT'
  | 'TABUNGAN'
  | 'SDM_HONORARIUM'
  | 'PERPUSTAKAAN_SURAT'
  | 'PENGINGAT_TERJADWAL';

export const ALL_NOTIFICATION_CATEGORY_KEYS: readonly NotificationCategoryKey[] = [
  'PENGUMUMAN_BROADCAST',
  'KEAMANAN_AKUN',
  'PRESENSI_SISWA',
  'LAYANAN_BK',
  'KEUANGAN_SPP',
  'BERITA_CMS',
  'PPDB',
  'GURU_WALI_HAFALAN',
  'PENILAIAN_RAPORT',
  'TABUNGAN',
  'SDM_HONORARIUM',
  'PERPUSTAKAAN_SURAT',
  'PENGINGAT_TERJADWAL',
] as const;

export type PushCampaignSourceType = 'BROADCAST' | 'SYSTEM_EVENT' | 'CRON' | 'TEST';
export type PushCampaignStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type PushDeliveryStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXPIRED';

export interface NotificationCategoryRow {
  key: NotificationCategoryKey;
  label: string;
  description: string;
  default_enabled: boolean;
  allow_user_opt_out: boolean;
  is_public_eligible: boolean;
  sort_order: number;
  updated_at?: string;
}

export interface InAppNotificationItem {
  id: string;
  user_id: string;
  category_key: NotificationCategoryKey;
  campaign_id: string | null;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string | null;
  audience_type: 'USER' | 'PUBLIC';
  endpoint: string;
  platform: string;
  device_label: string;
  is_active: boolean;
  deactivated_reason: string | null;
  deactivated_at: string | null;
  failure_count: number;
  last_seen_at: string;
  created_at: string;
}

export interface PushPayloadData {
  deliveryId: string;
  token: string;
  campaignId: string;
  categoryKey: NotificationCategoryKey;
  title: string;
  body: string;
  url: string;
  icon: string;
  badge: string;
  tag: string;
  inAppNotificationId?: string | null;
}
