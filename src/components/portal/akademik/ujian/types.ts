export type UjianSection =
  | 'periode'
  | 'pengawas'
  | 'panitia'
  | 'konfirmasi-pengawas'
  | 'bap'
  | 'pengganti'
  | 'absensi-siswa'
  | 'lpj-panitia';

export interface TeacherOpt {
  id: string;
  full_name: string;
}

export interface ExamPeriodRow {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

export interface SupervisorRow {
  id: string;
  exam_period_id?: string;
  exam_room_id?: string | null;
  teacher_id: string;
  exam_date: string;
  session_name: string;
  subject_name?: string | null;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
  room?: { room_name: string } | null;
  period?: { name: string } | null;
}

export interface CommitteeRow {
  id: string;
  exam_period_id?: string;
  teacher_id: string;
  committee_role: string;
  jtm_allocated: number;
  original_teacher_id?: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
  period?: { name: string } | null;
}

export interface BapRow {
  id: string;
  exam_supervisor_id: string;
  report_date: string;
  present_students_count: number;
  absent_students_count: number;
  incidents: string | null;
  teacher?: { full_name: string } | null;
}

export interface SupervisorAttRow {
  id: string;
  teacher_id: string;
  exam_supervisor_id: string | null;
  attendance_date?: string;
  admin_confirmed?: boolean;
  approved_jtm?: number | null;
  teacher?: { full_name: string } | null;
  exam_supervisor?: { jtm_allocated: number; exam_date: string; session_name: string } | null;
}

export interface CommitteeAttRow {
  id: string;
  teacher_id: string;
  exam_committee_id: string | null;
  attendance_date: string;
  admin_confirmed: boolean;
  approved_jtm?: number | null;
  teacher?: { full_name: string } | null;
}

export interface CommitteeDailyReportRow {
  id: string;
  attendance_id: string;
  exam_committee_id: string;
  report_date: string;
  activities_summary: string;
  logistics_notes?: string | null;
  issues_and_solutions?: string | null;
  jtm_credited: number;
  teacher?: { full_name: string } | null;
  committee?: { committee_role: string } | null;
}

export interface DailyGeofenceAttRow {
  id: string;
  teacher_id: string;
  attendance_date: string;
}

export interface SupervisorSessionConfirmationRow {
  id: string;
  exam_supervisor_id: string | null;
  teacher_id: string;
  approved_jtm: number;
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

export interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
}

export interface ExamRoomRow {
  id: string;
  exam_period_id: string;
  room_name: string;
  capacity: number;
  period?: { name: string } | null;
}

export interface ExamRoomStudentRow {
  id: string;
  exam_period_id: string;
  exam_room_id: string;
  student_id: string;
  student?: { id: string; full_name: string; nis: string | null; status?: string | null } | null;
  room?: { id: string; room_name: string; exam_period_id: string } | null;
}

export interface ExamStudentAttendanceRow {
  id: string;
  exam_date: string;
  session_name: string;
  status: string;
  student?: { full_name: string } | null;
  room?: { room_name: string } | null;
}

export interface RemoveRoomMemberModalState {
  id: string;
  studentName: string;
  roomName: string;
}

export interface SupAdjustModalState {
  sup: SupervisorRow;
  expectedJtm: number;
  approvedJtm: number;
}

export interface SupDiffModalState {
  sup: SupervisorRow;
  expectedJtm: number;
  approvedJtm: number;
  diffJtm: number;
  recipientTeacherId: string;
  reason: string;
}
