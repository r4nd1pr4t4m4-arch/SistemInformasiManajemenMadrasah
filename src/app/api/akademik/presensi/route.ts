import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { verifyGeofence } from '@/lib/domain/geofence';

const StudentAttendanceSchema = z.object({
  action: z.literal('STUDENT_ATTENDANCE'),
  student_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional().nullable(),
  attendance_date: z.string().optional(),
  status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPA']),
  notes: z.string().optional().nullable(),
});

const TeacherAttendanceSchema = z.object({
  action: z.literal('TEACHER_ATTENDANCE'),
  teacher_id: z.string().uuid(),
  attendance_type: z.enum(['HARIAN', 'MENGAJAR', 'PIKET', 'PENGAWAS_UJIAN', 'PANITIA_UJIAN']),
  schedule_id: z.string().uuid().optional().nullable(),
  jtm_earned: z.number().min(0).default(0),
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().optional().nullable(),
});

const DelegationSchema = z.object({
  action: z.literal('CREATE_DELEGATION'),
  delegation_date: z.string(),
  delegation_type: z.enum(['MENGAJAR', 'PIKET']),
  original_teacher_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional().nullable(),
  jtm_transferred: z.number().min(0).default(2),
  reason: z.string().optional().nullable(),
});

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      studentAttendances: [],
      teacherAttendances: [],
      delegations: [],
    });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: studentAtt }, { data: teacherAtt }, { data: delegations }] =
    await Promise.all([
      supabase
        .from('student_attendances')
        .select('*, student:students(full_name), classroom:classrooms(name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('teacher_attendances')
        .select('*, teacher:teachers_staff(full_name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('teacher_delegations')
        .select(
          '*, original:teachers_staff!teacher_delegations_original_teacher_id_fkey(full_name), substitute:teachers_staff!teacher_delegations_substitute_teacher_id_fkey(full_name)'
        )
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  return NextResponse.json({
    studentAttendances: studentAtt || [],
    teacherAttendances: teacherAtt || [],
    delegations: delegations || [],
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'STUDENT_ATTENDANCE') {
      const parsed = StudentAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data presensi siswa tidak valid.' }, { status: 400 });
      }
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('student_attendances')
        .insert({
          ...payload,
          schedule_id: payload.schedule_id || null,
          attendance_date: payload.attendance_date || new Date().toISOString().slice(0, 10),
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data });
    }

    if (body.action === 'TEACHER_ATTENDANCE') {
      const parsed = TeacherAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data presensi guru tidak valid.' }, { status: 400 });
      }

      const { data: settings } = await supabase
        .from('institution_settings')
        .select('geofence_lat, geofence_lng, geofence_radius_meters')
        .limit(1)
        .maybeSingle();

      const schoolLat = settings?.geofence_lat ?? -6.2;
      const schoolLng = settings?.geofence_lng ?? 106.816666;
      const radius = settings?.geofence_radius_meters ?? 100;

      const geo = verifyGeofence(
        { lat: parsed.data.latitude, lng: parsed.data.longitude },
        { lat: schoolLat, lng: schoolLng },
        radius
      );

      const { data, error } = await supabase
        .from('teacher_attendances')
        .insert({
          teacher_id: parsed.data.teacher_id,
          attendance_type: parsed.data.attendance_type,
          schedule_id: parsed.data.schedule_id || null,
          jtm_earned: geo.isWithinGeofence ? parsed.data.jtm_earned : 0,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          distance_meters: geo.distanceMeters,
          is_within_geofence: geo.isWithinGeofence,
          status: 'HADIR',
          notes: parsed.data.notes || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data, geofence: geo });
    }

    if (body.action === 'CREATE_DELEGATION') {
      const parsed = DelegationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data delegasi guru tidak valid.' }, { status: 400 });
      }
      if (parsed.data.original_teacher_id === parsed.data.substitute_teacher_id) {
        return NextResponse.json(
          { error: 'Guru pengganti tidak boleh sama dengan guru yang berhalangan.' },
          { status: 400 }
        );
      }

      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('teacher_delegations')
        .insert({
          ...payload,
          schedule_id: payload.schedule_id || null,
          status: 'APPROVED',
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ delegation: data });
    }

    return NextResponse.json({ error: 'Aksi presensi tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses presensi.' }, { status: 500 });
  }
}
