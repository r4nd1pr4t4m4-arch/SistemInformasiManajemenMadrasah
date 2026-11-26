import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { extractVerificationParams } from '@/lib/verification/document-verify';
import { getWibTodayDateString } from '@/lib/domain/jtm-late-penalty';
import { notifyStudentFamilyEvent } from '@/lib/notifications/event-hooks';
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp-gateway';
import { sanitizeApiError } from '@/lib/security/api-error';

const ScanSchema = z.object({
  rawCode: z.string().trim().min(2),
  scanType: z.enum(['MASUK', 'PULANG']).default('MASUK'),
});

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.PRESENSI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ logs: [] });

  const today = getWibTodayDateString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qr_gate_logs')
    .select('*, student:students(full_name, nis), teacher:teachers_staff(full_name, nip)')
    .gte('scanned_at', `${today}T00:00:00+07:00`)
    .order('scanned_at', { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ logs: [] });
    return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  }
  return NextResponse.json({ logs: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.PRESENSI_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Kode QR tidak valid.' }, { status: 400 });
    }

    const { ref } = extractVerificationParams(parsed.data.rawCode);
    const cleanRef = ref.trim();
    const supabase = createSupabaseAdminClient();
    const todayDate = getWibTodayDateString();
    const wibTime = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    // 1. Cari Siswa
    const { data: student } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, guardian_phone')
      .or(`qr_token.eq.${cleanRef},nisn.eq.${cleanRef},nis.eq.${cleanRef}`)
      .limit(1)
      .maybeSingle();

    if (student) {
      const { data: logRow, error: logErr } = await supabase
        .from('qr_gate_logs')
        .insert({
          person_type: 'SISWA',
          student_id: student.id,
          scan_type: parsed.data.scanType,
          scanned_by: guard.session.userId,
        })
        .select('*')
        .single();
      if (logErr) return NextResponse.json({ error: sanitizeApiError(logErr) }, { status: 500 });

      if (parsed.data.scanType === 'MASUK') {
        const { data: enr } = await supabase
          .from('student_enrollments')
          .select('classroom_id')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enr?.classroom_id) {
          await supabase.from('student_attendances').insert({
            student_id: student.id,
            classroom_id: enr.classroom_id,
            attendance_date: todayDate,
            status: 'HADIR',
            notes: `Presensi QR Gerbang pukul ${wibTime} WIB`,
          });
        }
      }

      const notifBody =
        parsed.data.scanType === 'MASUK'
          ? `Ananda ${student.full_name} telah tiba di madrasah pukul ${wibTime} WIB.`
          : `Ananda ${student.full_name} telah memindai QR pulang pukul ${wibTime} WIB.`;

      await Promise.all([
        notifyStudentFamilyEvent({
          studentId: student.id,
          categoryKey: 'PRESENSI_SISWA',
          title:
            parsed.data.scanType === 'MASUK'
              ? 'Notifikasi Kedatangan Siswa'
              : 'Notifikasi Kepulangan Siswa',
          body: notifBody,
          url: '/portal/orang-tua/absensi',
          createdBy: guard.session.userId,
        }),
        sendWhatsAppMessage({
          phone: student.guardian_phone,
          message: `[SIMMS] ${notifBody}`,
          eventType: 'QR_ARRIVAL',
        }),
      ]);

      return NextResponse.json({
        ok: true,
        personType: 'SISWA',
        personName: student.full_name,
        scanType: parsed.data.scanType,
        timeWib: wibTime,
        log: logRow,
      });
    }

    // 2. Cari GTK
    const { data: teacher } = await supabase
      .from('teachers_staff')
      .select('id, full_name, nip, nuptk')
      .or(`nip.eq.${cleanRef},nuptk.eq.${cleanRef}`)
      .limit(1)
      .maybeSingle();

    if (teacher) {
      const { data: logRow, error: logErr } = await supabase
        .from('qr_gate_logs')
        .insert({
          person_type: 'GTK',
          teacher_id: teacher.id,
          scan_type: parsed.data.scanType,
          scanned_by: guard.session.userId,
        })
        .select('*')
        .single();
      if (logErr) return NextResponse.json({ error: sanitizeApiError(logErr) }, { status: 500 });

      return NextResponse.json({
        ok: true,
        personType: 'GTK',
        personName: teacher.full_name,
        scanType: parsed.data.scanType,
        timeWib: wibTime,
        log: logRow,
      });
    }

    return NextResponse.json(
      { error: `Kode QR "${cleanRef}" tidak cocok dengan data Siswa atau GTK aktif.` },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ error: 'Gagal memproses scan QR gerbang.' }, { status: 500 });
  }
}
