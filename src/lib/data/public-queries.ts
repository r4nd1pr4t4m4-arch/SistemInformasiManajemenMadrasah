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
        .select(
          'id, full_name, staff_type, nip, nuptk, employment_status, education_level, major, last_campus, graduation_year, thesis_title, thesis_abstract, thesis_keywords, thesis_article_url, photo_url'
        )
        .eq('is_active', true)
        .eq('show_in_public_directory', true)
        .order('full_name'),
      supabase
        .from('achievements')
        .select('id, title, level, rank, participant_name, achieved_at, organizer, description')
        .order('achieved_at', { ascending: false })
        .limit(20),
    ]);

    const teacherRows = teachers || [];
    const teacherIds = teacherRows.map((t) => t.id);

    const dutiesMap = new Map<string, string[]>();
    const subjectsMap = new Map<string, string[]>();
    const groupsMap = new Map<string, string[]>();

    if (teacherIds.length > 0) {
      const [{ data: duties }, { data: schedules }, { data: homerooms }] = await Promise.all([
        supabase
          .from('teacher_additional_duties')
          .select('teacher_id, duty_type:additional_duty_types(name)')
          .in('teacher_id', teacherIds)
          .eq('is_active', true),
        supabase
          .from('schedules')
          .select('teacher_id, subject:subjects(name, subject_group)')
          .in('teacher_id', teacherIds),
        supabase
          .from('classrooms')
          .select('homeroom_teacher_id, name')
          .in('homeroom_teacher_id', teacherIds),
      ]);

      const pushUnique = (map: Map<string, string[]>, key: string, val: string | null | undefined) => {
        const cleaned = (val || '').trim();
        if (!cleaned) return;
        const arr = map.get(key) || [];
        if (!arr.includes(cleaned)) {
          arr.push(cleaned);
          map.set(key, arr);
        }
      };

      for (const row of duties || []) {
        const dutyType = Array.isArray(row.duty_type) ? row.duty_type[0] : row.duty_type;
        pushUnique(dutiesMap, row.teacher_id, dutyType?.name);
      }
      for (const row of homerooms || []) {
        if (row.homeroom_teacher_id && row.name) {
          pushUnique(dutiesMap, row.homeroom_teacher_id, `Wali Kelas ${row.name}`);
        }
      }
      for (const row of schedules || []) {
        const subj = Array.isArray(row.subject) ? row.subject[0] : row.subject;
        pushUnique(subjectsMap, row.teacher_id, subj?.name);
        pushUnique(groupsMap, row.teacher_id, subj?.subject_group);
      }
    }

    const enrichedTeachers = teacherRows.map((t) => ({
      ...t,
      thesis_keywords: Array.isArray(t.thesis_keywords) ? t.thesis_keywords : [],
      additional_duties: dutiesMap.get(t.id) || [],
      subjects: subjectsMap.get(t.id) || [],
      subject_groups: groupsMap.get(t.id) || [],
    }));

    return {
      teachers: enrichedTeachers,
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
