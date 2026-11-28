import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DEFAULT_INSTITUTION_SETTINGS, DEFAULT_POSTS } from '@/lib/data/demo-seed';
import type { InstitutionSettings, PostItem } from '@/types/database';
import { toPublicMediaProxyUrl } from '@/lib/storage/r2-url-helper';

function normalizeInstitutionLogoUrl(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (trimmed.startsWith('institution-logos/')) {
    return `/api/cms/logo?key=${encodeURIComponent(trimmed)}`;
  }
  const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  if (r2PublicBase && trimmed.startsWith(`${r2PublicBase}/`)) {
    const objectKey = trimmed.slice(r2PublicBase.length + 1);
    return `/api/cms/logo?key=${encodeURIComponent(objectKey)}`;
  }
  return toPublicMediaProxyUrl(trimmed);
}

function normalizeNullableMediaUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const normalized = toPublicMediaProxyUrl(rawUrl);
  return normalized || null;
}

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
      logo_url: normalizeInstitutionLogoUrl(data.logo_url),
      mission: Array.isArray(data.mission) ? data.mission : [],
      social_links: data.social_links || {},
    };
  } catch {
    return DEFAULT_INSTITUTION_SETTINGS;
  }
}

export async function getPublishedPosts(limit = 12): Promise<PostItem[]> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_POSTS.slice(0, limit);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, slug, category, excerpt, content, cover_image_url, author_display_name, status, published_at')
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map((post) => ({
      ...post,
      cover_image_url: normalizeNullableMediaUrl(post.cover_image_url),
    })) as PostItem[];
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
          'id, full_name, staff_type, nip, nuptk, employment_status, join_date, education_level, major, last_campus, graduation_year, thesis_title, thesis_abstract, thesis_keywords, thesis_article_url, photo_url'
        )
        .eq('is_active', true)
        .eq('show_in_public_directory', true)
        .order('full_name'),
      supabase
        .from('achievements')
        .select('id, title, level, rank, participant_name, achieved_at, organizer, image_url, description')
        .order('achieved_at', { ascending: false })
        .limit(20),
    ]);

    const teacherRows = teachers || [];
    const teacherIds = teacherRows.map((t) => t.id);

    const dutiesMap = new Map<string, string[]>();
    const subjectsMap = new Map<string, string[]>();
    const groupsMap = new Map<string, string[]>();
    const classesMap = new Map<string, string[]>();
    const historiesMap = new Map<
      string,
      Array<{
        id: string;
        position_title: string;
        unit_or_institution: string | null;
        start_date: string | null;
        end_date: string | null;
      }>
    >();

    if (teacherIds.length > 0) {
      const [{ data: duties }, { data: schedules }, { data: homerooms }, { data: histories }] =
        await Promise.all([
          supabase
            .from('teacher_additional_duties')
            .select('teacher_id, duty_type:additional_duty_types(name)')
            .in('teacher_id', teacherIds)
            .eq('is_active', true),
          supabase
            .from('schedules')
            .select('teacher_id, subject:subjects(name, subject_group), classroom:classrooms(name)')
            .in('teacher_id', teacherIds),
          supabase
            .from('classrooms')
            .select('homeroom_teacher_id, name')
            .in('homeroom_teacher_id', teacherIds),
          supabase
            .from('employment_histories')
            .select('id, teacher_id, position_title, unit_or_institution, start_date, end_date')
            .in('teacher_id', teacherIds)
            .order('start_date', { ascending: false }),
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
        const cls = Array.isArray(row.classroom) ? row.classroom[0] : row.classroom;
        pushUnique(subjectsMap, row.teacher_id, subj?.name);
        pushUnique(groupsMap, row.teacher_id, subj?.subject_group);
        pushUnique(classesMap, row.teacher_id, cls?.name);
      }
      for (const row of histories || []) {
        const arr = historiesMap.get(row.teacher_id) || [];
        if (arr.length < 5) {
          arr.push({
            id: row.id,
            position_title: row.position_title,
            unit_or_institution: row.unit_or_institution,
            start_date: row.start_date,
            end_date: row.end_date,
          });
          historiesMap.set(row.teacher_id, arr);
        }
      }
    }

    const enrichedTeachers = teacherRows.map((t) => ({
      ...t,
      photo_url: normalizeNullableMediaUrl(t.photo_url),
      thesis_keywords: Array.isArray(t.thesis_keywords) ? t.thesis_keywords : [],
      additional_duties: dutiesMap.get(t.id) || [],
      subjects: subjectsMap.get(t.id) || [],
      subject_groups: groupsMap.get(t.id) || [],
      taught_classes: (classesMap.get(t.id) || []).sort((a, b) => a.localeCompare(b, 'id')),
      employment_histories: historiesMap.get(t.id) || [],
    }));

    return {
      teachers: enrichedTeachers,
      achievements: (achievements || []).map((a) => ({
        ...a,
        image_url: normalizeNullableMediaUrl(a.image_url),
      })),
    };
  } catch {
    return { teachers: [], achievements: [] };
  }
}

export async function getPublicGallery(limit = 60) {
  if (!isSupabaseAdminConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('media_gallery')
      .select('id, title, media_type, media_url, thumbnail_url, description, event_date')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map((item) => ({
      ...item,
      media_url: toPublicMediaProxyUrl(item.media_url),
      thumbnail_url: normalizeNullableMediaUrl(item.thumbnail_url),
    }));
  } catch {
    return [];
  }
}

export async function getPublicFacilities() {
  if (!isSupabaseAdminConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('facilities')
      .select('id, name, category, quantity, condition, description, image_url')
      .order('name');

    if (error) return [];
    return (data || []).map((f) => ({
      ...f,
      image_url: normalizeNullableMediaUrl(f.image_url),
    }));
  } catch {
    return [];
  }
}

export async function getPublicFacilitiesHighlight(limit = 6) {
  if (!isSupabaseAdminConfigured()) {
    return { facilities: [], totalCount: 0 };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, count, error } = await supabase
      .from('facilities')
      .select('id, name, category, quantity, condition, description, image_url', {
        count: 'exact',
      })
      .order('name')
      .limit(limit);

    if (error) {
      return { facilities: [], totalCount: 0 };
    }

    return {
      facilities: (data || []).map((f) => ({
        ...f,
        image_url: normalizeNullableMediaUrl(f.image_url),
      })),
      totalCount: count ?? (data?.length || 0),
    };
  } catch {
    return { facilities: [], totalCount: 0 };
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
      gallery: (gallery || []).map((item) => ({
        ...item,
        media_url: toPublicMediaProxyUrl(item.media_url),
        thumbnail_url: normalizeNullableMediaUrl(item.thumbnail_url),
      })),
      facilities: (facilities || []).map((f) => ({
        ...f,
        image_url: normalizeNullableMediaUrl(f.image_url),
      })),
      faqs: faqs || [],
    };
  } catch {
    return { gallery: [], facilities: [], faqs: [] };
  }
}

export async function getPostBySlug(slug: string): Promise<PostItem | null> {
  if (!slug) return null;
  if (!isSupabaseAdminConfigured()) {
    return DEFAULT_POSTS.find((p) => p.slug === slug) || null;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, slug, category, excerpt, content, cover_image_url, author_display_name, status, published_at')
      .eq('slug', slug)
      .eq('status', 'PUBLISHED')
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      cover_image_url: normalizeNullableMediaUrl(data.cover_image_url),
    } as PostItem;
  } catch {
    return null;
  }
}

export async function getPublicInstitutionStats() {
  if (!isSupabaseAdminConfigured()) {
    return { students: 0, teachers: 0, classrooms: 0, ebooks: 0, alumni: 0 };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [
      { count: students },
      { count: teachers },
      { count: classrooms },
      { count: ebooks },
      { count: alumni },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'AKTIF'),
      supabase.from('teachers_staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('classrooms').select('id', { count: 'exact', head: true }),
      supabase.from('library_books').select('id', { count: 'exact', head: true }),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'LULUS'),
    ]);

    return {
      students: students ?? 0,
      teachers: teachers ?? 0,
      classrooms: classrooms ?? 0,
      ebooks: ebooks ?? 0,
      alumni: alumni ?? 0,
    };
  } catch {
    return { students: 0, teachers: 0, classrooms: 0, ebooks: 0, alumni: 0 };
  }
}

export async function getPublicLeadershipStructure() {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('teacher_additional_duties')
      .select('id, teacher:teachers_staff(id, full_name, photo_url), duty_type:additional_duty_types(code, name)')
      .eq('is_active', true);

    const leadershipKeywords = ['KEPALA', 'WAKA', 'OPERATOR', 'BENDAHARA', 'PERPUSTAKAAN', 'BK', 'OSIM', 'OSIS'];
    const result: Array<{ id: string; roleName: string; personName: string; photoUrl: string | null }> = [];
    const seen = new Set<string>();

    for (const row of data || []) {
      const teacher = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
      const duty = Array.isArray(row.duty_type) ? row.duty_type[0] : row.duty_type;
      if (!teacher?.full_name || !duty?.name) continue;
      const upper = `${duty.code || ''} ${duty.name}`.toUpperCase();
      if (!leadershipKeywords.some((kw) => upper.includes(kw))) continue;
      const key = `${duty.name}::${teacher.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: row.id,
        roleName: duty.name,
        personName: teacher.full_name,
        photoUrl: normalizeNullableMediaUrl(teacher.photo_url),
      });
    }
    return result.slice(0, 12);
  } catch {
    return [];
  }
}
