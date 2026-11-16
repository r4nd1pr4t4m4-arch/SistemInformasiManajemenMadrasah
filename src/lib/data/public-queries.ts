import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DEFAULT_INSTITUTION_SETTINGS, DEFAULT_POSTS } from '@/lib/data/demo-seed';
import type { InstitutionSettings, PostItem } from '@/types/database';

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_INSTITUTION_SETTINGS;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('institution_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_INSTITUTION_SETTINGS;

    return {
      ...DEFAULT_INSTITUTION_SETTINGS,
      ...data,
      mission: Array.isArray(data.mission) ? data.mission : [],
      social_links: data.social_links || {},
    };
  } catch {
    return DEFAULT_INSTITUTION_SETTINGS;
  }
}

export async function getPublishedPosts(limit = 12): Promise<PostItem[]> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_POSTS;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, slug, category, excerpt, content, cover_image_url, author_display_name, status, published_at')
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as PostItem[];
  } catch {
    return [];
  }
}

export async function getPublicDirectoryData() {
  if (!isSupabaseAdminConfigured()) {
    return { teachers: [], achievements: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: teachers }, { data: achievements }] = await Promise.all([
      supabase
        .from('teachers_staff')
        .select('id, full_name, staff_type, employment_status, education_level, major, photo_url')
        .eq('is_active', true)
        .eq('show_in_public_directory', true)
        .order('full_name'),
      supabase
        .from('achievements')
        .select('id, title, level, rank, participant_name, achieved_at, organizer, description')
        .order('achieved_at', { ascending: false })
        .limit(20),
    ]);

    return {
      teachers: teachers || [],
      achievements: achievements || [],
    };
  } catch {
    return { teachers: [], achievements: [] };
  }
}

export async function getPublicGalleryAndFacilities() {
  if (!isSupabaseAdminConfigured()) {
    return { gallery: [], facilities: [], faqs: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: gallery }, { data: facilities }, { data: faqs }] = await Promise.all([
      supabase
        .from('media_gallery')
        .select('id, title, media_type, media_url, thumbnail_url, description, event_date')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('facilities')
        .select('id, name, category, quantity, condition, description, image_url')
        .order('name'),
      supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('is_published', true)
        .order('sort_order'),
    ]);

    return {
      gallery: gallery || [],
      facilities: facilities || [],
      faqs: faqs || [],
    };
  } catch {
    return { gallery: [], facilities: [], faqs: [] };
  }
}
