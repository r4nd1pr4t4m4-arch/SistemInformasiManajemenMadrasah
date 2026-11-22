import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDutyCodeToRole } from '@/lib/auth/rbac';
import type { TaughtSubjectMenu } from '@/lib/domain/penilaian';
import type { AppRole } from '@/types/database';

export interface TeacherOperationalAssignments {
  teacherId: string;
  dutyCodes: string[];
  dutyNames: string[];
  homeroomClassroomIds: string[];
  taughtClassroomIds: string[];
  taughtSubjectIds: string[];
  taughtSubjects: TaughtSubjectMenu[];
  guruWaliStudentIds: string[];
  isHomeroomTeacher: boolean;
  isGuruWali: boolean;
  isPicketTeacher: boolean;
  isExamSupervisor: boolean;
  isExamCommittee: boolean;
}

export interface AuthenticatedSession {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  primaryRole: AppRole;
  roles: AppRole[];
  teacherAssignments?: TeacherOperationalAssignments | null;
}

export async function getCurrentUserWithRoles(): Promise<AuthenticatedSession | null> {
  if (!isSupabaseServerConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const db = isSupabaseAdminConfigured() ? createSupabaseAdminClient() : supabase;

    const { data: profile } = await db
      .from('profiles')
      .select('full_name, primary_role, email, avatar_url, is_active, account_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.is_active || (profile.account_status && profile.account_status !== 'AKTIF')) {
      return null;
    }

    const [{ data: extraRoles }, { data: teacherRow }, { data: guardianRows }] = await Promise.all([
      db.from('user_roles').select('role').eq('user_id', user.id),
      db.from('teachers_staff').select('id').eq('profile_id', user.id).maybeSingle(),
      db.from('student_guardians').select('id').eq('profile_id', user.id).limit(1),
    ]);

    const primaryRole = (profile?.primary_role as AppRole) || 'UMUM';
    const rolesSet = new Set<AppRole>([primaryRole]);
    for (const row of extraRoles || []) {
      rolesSet.add(row.role as AppRole);
    }
    if ((guardianRows || []).length > 0) {
      rolesSet.add('ORANG_TUA');
    }

    let teacherAssignments: TeacherOperationalAssignments | null = null;

    if (teacherRow?.id) {
      const teacherId = teacherRow.id as string;
      const { data: activeYearRow } = await db
        .from('academic_years')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const activeYearId = (activeYearRow?.id as string | undefined) ?? null;

      let schedulesQuery = db
        .from('schedules')
        .select(
          'classroom_id, subject_id, academic_year_id, classroom:classrooms(id, name, grade_level), subject:subjects(id, code, name)'
        )
        .eq('teacher_id', teacherId);

      if (activeYearId) {
        schedulesQuery = schedulesQuery.eq('academic_year_id', activeYearId);
      }

      const [
        { data: dutyRows },
        { data: homeroomRows },
        { data: scheduleRows },
        { data: guruWaliRows },
        { data: picketRows },
        { data: picketDelegationRows },
        { data: examSupRows },
        { data: examComRows },
      ] = await Promise.all([
        db
          .from('teacher_additional_duties')
          .select('duty_type:additional_duty_types(code, name)')
          .eq('teacher_id', teacherId)
          .eq('is_active', true),
        db.from('classrooms').select('id').eq('homeroom_teacher_id', teacherId),
        schedulesQuery,
        db.from('guru_wali_assignments').select('id, student_id').eq('teacher_id', teacherId),
        db.from('picket_schedules').select('id').eq('teacher_id', teacherId).limit(1),
        db
          .from('teacher_delegations')
          .select('id')
          .eq('substitute_teacher_id', teacherId)
          .eq('delegation_type', 'PIKET')
          .limit(1),
        db.from('exam_supervisors').select('id').eq('teacher_id', teacherId).limit(1),
        db.from('exam_committees').select('id').eq('teacher_id', teacherId).limit(1),
      ]);

      const dutyCodes: string[] = [];
      const dutyNames: string[] = [];

      for (const d of dutyRows || []) {
        const dt = Array.isArray(d.duty_type) ? d.duty_type[0] : d.duty_type;
        const code = String(dt?.code || '');
        const name = String(dt?.name || code);
        if (code) dutyCodes.push(code);
        if (name) dutyNames.push(name);
        const mapped = mapDutyCodeToRole(code) || mapDutyCodeToRole(name);
        if (mapped) rolesSet.add(mapped);
      }

      const homeroomClassroomIds = Array.from(
        new Set((homeroomRows || []).map((r) => r.id as string).filter(Boolean))
      );
      const taughtClassroomIds = Array.from(
        new Set((scheduleRows || []).map((r) => r.classroom_id as string).filter(Boolean))
      );
      const taughtSubjectIds = Array.from(
        new Set((scheduleRows || []).map((r) => r.subject_id as string).filter(Boolean))
      );
      const guruWaliStudentIds = Array.from(
        new Set((guruWaliRows || []).map((r) => r.student_id as string).filter(Boolean))
      );

      const isHomeroomTeacher = homeroomClassroomIds.length > 0 || rolesSet.has('WALI_KELAS');
      if (isHomeroomTeacher) {
        rolesSet.add('WALI_KELAS');
      }

      const isGuruWali = guruWaliStudentIds.length > 0 || rolesSet.has('GURU_WALI');
      if (isGuruWali) {
        rolesSet.add('GURU_WALI');
      }

      const isPicketTeacher =
        (picketRows || []).length > 0 || (picketDelegationRows || []).length > 0;
      const isExamSupervisor = (examSupRows || []).length > 0;
      const isExamCommittee = (examComRows || []).length > 0;

      // Build taughtSubjects grouped by subject_id for active academic year
      const subjectMap = new Map<
        string,
        {
          subjectId: string;
          subjectCode: string;
          subjectName: string;
          classroomsMap: Map<string, { id: string; name: string; gradeLevel: string }>;
        }
      >();

      for (const row of scheduleRows || []) {
        const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject;
        const cls = Array.isArray(row.classroom) ? row.classroom[0] : row.classroom;
        if (!sub?.id || !cls?.id) continue;

        let entry = subjectMap.get(sub.id as string);
        if (!entry) {
          entry = {
            subjectId: sub.id as string,
            subjectCode: String(sub.code || ''),
            subjectName: String(sub.name || ''),
            classroomsMap: new Map(),
          };
          subjectMap.set(sub.id as string, entry);
        }
        entry.classroomsMap.set(cls.id as string, {
          id: cls.id as string,
          name: String(cls.name || ''),
          gradeLevel: String(cls.grade_level || ''),
        });
      }

      const taughtSubjects: TaughtSubjectMenu[] = [];
      if (subjectMap.size > 0 && activeYearId) {
        const subjectIds = Array.from(subjectMap.keys());
        const { data: chapterRows } = await db
          .from('assessment_chapters')
          .select('id, subject_id, grade_level, chapter_number, title, sort_order')
          .eq('academic_year_id', activeYearId)
          .in('subject_id', subjectIds)
          .order('sort_order', { ascending: true })
          .order('chapter_number', { ascending: true });

        for (const entry of subjectMap.values()) {
          const classrooms = Array.from(entry.classroomsMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          const gradeLevels = new Set(classrooms.map((c) => c.gradeLevel));
          const chapters = (chapterRows || [])
            .filter(
              (ch) =>
                ch.subject_id === entry.subjectId &&
                gradeLevels.has(String(ch.grade_level || ''))
            )
            .map((ch) => ({
              id: ch.id as string,
              gradeLevel: String(ch.grade_level || ''),
              chapterNumber: Number(ch.chapter_number),
              title: (ch.title as string | null) ?? null,
              sortOrder: Number(ch.sort_order),
            }));

          taughtSubjects.push({
            subjectId: entry.subjectId,
            subjectCode: entry.subjectCode,
            subjectName: entry.subjectName,
            classrooms,
            chapters,
          });
        }
        taughtSubjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      }

      teacherAssignments = {
        teacherId,
        dutyCodes,
        dutyNames,
        homeroomClassroomIds,
        taughtClassroomIds,
        taughtSubjectIds,
        taughtSubjects,
        guruWaliStudentIds,
        isHomeroomTeacher,
        isGuruWali,
        isPicketTeacher,
        isExamSupervisor,
        isExamCommittee,
      };
    }

    return {
      userId: user.id,
      email: user.email ?? profile?.email ?? null,
      fullName: profile?.full_name || user.email || 'Pengguna',
      avatarUrl: profile?.avatar_url ?? null,
      primaryRole,
      roles: Array.from(rolesSet),
      teacherAssignments,
    };
  } catch {
    return null;
  }
}

export function hasAnyRole(
  session: AuthenticatedSession | null,
  allowed: readonly AppRole[]
): boolean {
  if (!session) return false;
  return session.roles.some((r) => allowed.includes(r));
}

export const CMS_MANAGER_ROLES: AppRole[] = [
  'SUPERADMIN',
  'OPERATOR',
  'KEPALA_LEMBAGA',
  'WAKA_HUMAS',
  'STAF_TU',
  'KEPALA_TU',
];
