import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { NAME_CHANGE_COOLDOWN_DAYS } from '@/lib/validation/identity';

const DAY_MS = 24 * 60 * 60 * 1000;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function getNameChangeStatus(supabase: AdminClient, profileId: string) {
  const [{ data: pending }, { data: lastApproved }, { data: lastRejected }] = await Promise.all([
    supabase
      .from('profile_name_change_requests')
      .select('id, old_full_name, new_full_name, reason, created_at')
      .eq('profile_id', profileId)
      .eq('status', 'MENUNGGU')
      .maybeSingle(),
    supabase
      .from('profile_name_change_requests')
      .select('reviewed_at')
      .eq('profile_id', profileId)
      .eq('status', 'DISETUJUI')
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profile_name_change_requests')
      .select('new_full_name, review_notes, reviewed_at')
      .eq('profile_id', profileId)
      .eq('status', 'DITOLAK')
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let nextNameChangeAt: string | null = null;
  let nameRemainingDays = 0;
  if (lastApproved?.reviewed_at) {
    const nextMs =
      new Date(lastApproved.reviewed_at).getTime() + NAME_CHANGE_COOLDOWN_DAYS * DAY_MS;
    if (nextMs > Date.now()) {
      nextNameChangeAt = new Date(nextMs).toISOString();
      nameRemainingDays = Math.ceil((nextMs - Date.now()) / DAY_MS);
    }
  }

  return {
    pendingNameRequest: pending || null,
    lastRejectedNameRequest: lastRejected || null,
    canRequestNameChange: !pending && !nextNameChangeAt,
    nextNameChangeAt,
    nameRemainingDays,
  };
}
