import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { sanitizeApiError } from '@/lib/security/api-error';

export async function GET() {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_VIEW);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ templates: [], classrooms: [] });
  }

  const supabase = createSupabaseAdminClient();
  const [tplRes, clsRes] = await Promise.all([
    supabase.from('letter_templates').select('*').order('created_at', { ascending: false }),
    supabase.from('classrooms').select('id, name, grade_level').order('name'),
  ]);

  return NextResponse.json({
    templates: tplRes.error ? [] : tplRes.data || [],
    classrooms: clsRes.data || [],
  });
}

export async function POST(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'CREATE_TEMPLATE') {
      const p = z
        .object({
          name: z.string().trim().min(3),
          category: z.string().trim().default('SURAT_KETERANGAN_AKTIF'),
          classification_code: z.string().trim().default('PP.00.6'),
          subject_template: z.string().trim().min(3),
          body_template: z.string().trim().min(10),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data template surat tidak valid.' }, { status: 400 });

      const { data, error } = await supabase
        .from('letter_templates')
        .insert({ ...p.data, created_by: guard.session.userId })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
      return NextResponse.json({ template: data });
    }

    if (body.action === 'MAIL_MERGE_BATCH') {
      const p = z
        .object({
          template_id: z.string().uuid(),
          target_type: z.enum(['CLASSROOM_STUDENTS', 'ALL_GTK']),
          classroom_id: z.string().uuid().optional().nullable(),
          letter_date: z.string().min(8),
          number_prefix: z.string().trim().min(2).default('MM'),
        })
        .safeParse(body);
      if (!p.success) return NextResponse.json({ error: 'Data mail merge tidak valid.' }, { status: 400 });

      const { data: tpl } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', p.data.template_id)
        .single();
      if (!tpl) return NextResponse.json({ error: 'Template surat tidak ditemukan.' }, { status: 404 });

      const rowsToInsert: Array<Record<string, unknown>> = [];
      const dateStr = p.data.letter_date;
      const baseSeq = Date.now().toString().slice(-4);

      if (p.data.target_type === 'CLASSROOM_STUDENTS') {
        if (!p.data.classroom_id) {
          return NextResponse.json({ error: 'Pilih rombel target untuk Mail Merge siswa.' }, { status: 400 });
        }
        const [{ data: cls }, { data: enrolls }] = await Promise.all([
          supabase.from('classrooms').select('name').eq('id', p.data.classroom_id).single(),
          supabase
            .from('student_enrollments')
            .select('student:students(id, full_name, nis, nisn, status)')
            .eq('classroom_id', p.data.classroom_id),
        ]);
        const className = cls?.name || '-';
        let idx = 1;
        for (const e of enrolls || []) {
          const st = Array.isArray(e.student) ? e.student[0] : e.student;
          if (!st?.id || st.status !== 'AKTIF') continue;
          const replaceVars = (str: string) =>
            str
              .replaceAll('{{nama_siswa}}', st.full_name)
              .replaceAll('{{nis}}', st.nis || '-')
              .replaceAll('{{nisn}}', st.nisn || '-')
              .replaceAll('{{kelas}}', className)
              .replaceAll('{{tanggal}}', dateStr);

          rowsToInsert.push({
            direction: 'KELUAR',
            category: tpl.category,
            classification_code: tpl.classification_code || 'PP.00.6',
            letter_number: `${p.data.number_prefix}-${baseSeq}-${String(idx++).padStart(3, '0')}`,
            letter_date: dateStr,
            subject: replaceVars(tpl.subject_template),
            counterparty: st.full_name,
            student_id: st.id,
            summary: replaceVars(tpl.body_template),
            status: 'TERBIT',
            priority: 'BIASA',
          });
        }
      } else {
        const { data: teachers } = await supabase
          .from('teachers_staff')
          .select('id, full_name, nip')
          .eq('is_active', true);
        let idx = 1;
        for (const t of teachers || []) {
          const replaceVars = (str: string) =>
            str
              .replaceAll('{{nama_gtk}}', t.full_name)
              .replaceAll('{{nip}}', t.nip || '-')
              .replaceAll('{{tanggal}}', dateStr);

          rowsToInsert.push({
            direction: 'KELUAR',
            category: tpl.category,
            classification_code: tpl.classification_code || 'KP.01.2',
            letter_number: `${p.data.number_prefix}-${baseSeq}-${String(idx++).padStart(3, '0')}`,
            letter_date: dateStr,
            subject: replaceVars(tpl.subject_template),
            counterparty: t.full_name,
            teacher_id: t.id,
            summary: replaceVars(tpl.body_template),
            status: 'TERBIT',
            priority: 'BIASA',
          });
        }
      }

      if (rowsToInsert.length === 0) {
        return NextResponse.json({ error: 'Tidak ada penerima aktif pada target terpilih.' }, { status: 400 });
      }

      const { error: insErr } = await supabase.from('letters').insert(rowsToInsert);
      if (insErr) return NextResponse.json({ error: sanitizeApiError(insErr) }, { status: 500 });

      return NextResponse.json({ ok: true, generatedCount: rowsToInsert.length });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses template persuratan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireApiRoles(PERMISSIONS.PERSURATAN_MANAGE);
  if (guard.errorResponse) return guard.errorResponse;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('letter_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: sanitizeApiError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
