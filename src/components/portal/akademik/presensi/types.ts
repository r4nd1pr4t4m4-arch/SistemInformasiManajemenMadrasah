export type PresensiSection =
  | 'gps'
  | 'jurnal'
  | 'konfirmasi'
  | 'pengganti'
  | 'absensi-siswa'
  | 'laporan-piket'
  | 'jam-manual'
  | 'izin-keluar';

export const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export interface TeacherOpt {
  id: string;
  full_name: string;
}

export interface ClassroomOpt {
  id: string;
  name: string;
}

export interface EnrollmentRow {
  student_id: string;
  classroom_id: string;
  student?: { id: string; full_name: string; nis: string | null; status: string } | null;
}

export interface StudentAttendanceRow {
  id: string;
  attendance_date: string;
  status: string;
  student?: { full_name: string } | null;
  classroom?: { name: string } | null;
}

export interface ScheduleRow {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  jtm_count: number;
  classroom?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { full_name: string } | null;
}

export interface ExamSupervisorOpt {
  id: string;
  teacher_id: string;
  exam_date: string;
  session_name: string;
  subject_name: string | null;
  jtm_allocated: number;
  teacher?: { full_name: string } | null;
  room?: { room_name: string } | null;
}

export interface ExamCommitteeOpt {
  id: string;
  teacher_id: string;
  committee_role: string;
  jtm_allocated: number;
  teacher?: { full_name: string } | null;
  period?: { name: string } | null;
}

export interface TeacherAttendanceRow {
  id: string;
  teacher_id: string;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string | null;
  attendance_type: 'HARIAN' | 'MENGAJAR' | 'PIKET' | 'PENGAWAS_UJIAN' | 'PANITIA_UJIAN';
  schedule_id: string | null;
  delegation_id: string | null;
  exam_supervisor_id: string | null;
  exam_committee_id: string | null;
  jtm_earned: number;
  approved_jtm?: number | null;
  distance_meters: number | null;
  is_within_geofence: boolean;
  admin_confirmed: boolean;
  teacher?: { full_name: string } | null;
  delegation?: { jtm_transferred: number } | null;
  schedule?: {
    classroom_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

export interface DelegationRow {
  id: string;
  delegation_date: string;
  delegation_type: string;
  original_teacher_id: string;
  substitute_teacher_id: string;
  schedule_id: string | null;
  jtm_transferred: number;
  reason: string | null;
  original?: { full_name: string } | null;
  substitute?: { full_name: string } | null;
  schedule?: {
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

export interface JournalRow {
  id: string;
  attendance_id: string;
  session_confirmation_id?: string | null;
  journal_date: string;
  topic: string;
  learning_activities: string | null;
  jtm_credited: number;
  teacher?: { full_name: string } | null;
  schedule?: {
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
}

export interface PicketReportRow {
  id: string;
  attendance_id: string;
  report_date: string;
  summary: string;
  late_students_notes?: string | null;
  teacher_substitution_notes?: string | null;
  incidents?: string | null;
  jtm_credited: number;
  teacher?: { full_name: string } | null;
}

export interface ShortLeaveRow {
  id: string;
  leave_date: string;
  leave_start_time: string;
  leave_end_time: string;
  duration_minutes: number;
  reason: string | null;
  recorded_by_role: string;
  teacher?: { full_name: string } | null;
}

export interface SessionConfirmationRow {
  id: string;
  session_type: 'MENGAJAR' | 'PENGAWAS_UJIAN';
  session_date: string;
  teacher_id: string;
  schedule_id: string | null;
  delegation_id: string | null;
  exam_supervisor_id: string | null;
  expected_jtm: number;
  approved_jtm: number;
  teacher?: { full_name: string } | null;
  schedule?: {
    classroom_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    classroom?: { name: string } | null;
    subject?: { name: string } | null;
  } | null;
  delegation?: {
    jtm_transferred: number;
    reason: string | null;
    original?: { full_name: string } | null;
  } | null;
}

export interface PendingScheduleSessionItem {
  key: string;
  session_type: 'MENGAJAR';
  session_date: string;
  teacher_id: string;
  teacher_name: string;
  schedule_id: string | null;
  delegation_id: string | null;
  label: string;
  expectedJtm: number;
}

export interface GeofenceConfig {
  enabled: boolean;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeofenceModalState {
  distanceMeters: number;
  radiusMeters: number;
  schoolLat: number;
  schoolLng: number;
  teacherLat: number;
  teacherLng: number;
}

export interface JtmAdjustModalState {
  sessionItem?: PendingScheduleSessionItem;
  att?: TeacherAttendanceRow;
  teacherName: string;
  label: string;
  expectedJtm: number;
  approvedJtm: number;
  picketAttendanceId: string | null;
}

export interface JtmDiffModalState {
  sessionItem?: PendingScheduleSessionItem;
  att?: TeacherAttendanceRow;
  teacherId: string;
  expectedJtm: number;
  approvedJtm: number;
  diffJtm: number;
  picketAttendanceId: string | null;
  recipientTeacherId: string;
  reason: string;
}

export interface TeacherAttFormState {
  teacher_id: string;
  attendance_type: 'HARIAN' | 'MENGAJAR' | 'PIKET' | 'PENGAWAS_UJIAN' | 'PANITIA_UJIAN';
  schedule_id: string;
  delegation_id: string;
  exam_supervisor_id: string;
  exam_committee_id: string;
  notes: string;
  latitude: number;
  longitude: number;
}

export interface PostPresensiResponse {
  geofence?: {
    enabled: boolean;
    distanceMeters: number;
    radiusMeters: number;
    schoolLat: number;
    schoolLng: number;
    teacherLat: number;
    teacherLng: number;
  };
  percentage?: number;
  jtmCredited?: number;
  savedCount?: number;
  [key: string]: unknown;
}

export type PostPresensiFn = (body: unknown) => Promise<PostPresensiResponse | null>;
export type ShowToastFn = (type: 'success' | 'error', message: string) => void;
