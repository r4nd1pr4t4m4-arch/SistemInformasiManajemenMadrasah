import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { formatRupiah } from '@/lib/domain/honorarium';
import { extractVerificationParams } from '@/lib/verification/document-verify';

export async function GET(request: NextRequest) {
  const rawRef = request.nextUrl.searchParams.get('ref') || '';
  const typeHint = request.nextUrl.searchParams.get('type') || undefined;
  const parsed = extractVerificationParams(rawRef);
  const ref = parsed.ref;
  const docType = (typeHint || parsed.type || '').toUpperCase();

  if (!ref) {
    return NextResponse.json(
      { valid: false, error: 'Masukkan nomor referensi atau scan QR Code dokumen.' },
      { status: 400 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { valid: false, error: 'Database belum dikonfigurasi.' },
      { status: 503 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 1. TABUNGAN (TRX-...)
  if (!docType || docType === 'TABUNGAN' || ref.toUpperCase().startsWith('TRX-')) {
    const { data: trx } = await supabase
      .from('savings_transactions')
      .select(
        'id, reference_number, transaction_type, amount, fee_percentage, fee_amount, net_amount, balance_after, transaction_date, notes, account:savings_accounts(account_number, owner_name, owner_type)'
      )
      .ilike('reference_number', ref)
      .maybeSingle();

    if (trx) {
      const acc = Array.isArray(trx.account) ? trx.account[0] : trx.account;
      const isTarik = trx.transaction_type === 'TARIK';
      return NextResponse.json({
        valid: true,
        documentType: 'TABUNGAN',
        reference: trx.reference_number,
        title: isTarik ? 'Slip Penarikan Tabungan Digital' : 'Slip Setoran Tabungan Digital',
        statusLabel: 'TERVERIFIKASI SAH',
        issuedAt: trx.transaction_date,
        details: [
          { label: 'Pemilik Rekening', value: acc?.owner_name || '-' },
          { label: 'Nomor Rekening', value: acc?.account_number || '-' },
          { label: 'Jenis Transaksi', value: trx.transaction_type },
          { label: 'Nominal Transaksi', value: formatRupiah(Number(trx.amount) || 0) },
          ...(isTarik
            ? [
                {
                  label: `Fee Penarikan (${Number(trx.fee_percentage) || 0}%)`,
                  value: formatRupiah(Number(trx.fee_amount) || 0),
                },
                {
                  label: 'Diterima Bersih Tunai',
                  value: formatRupiah(Number(trx.net_amount ?? trx.amount) || 0),
                },
              ]
            : []),
          { label: 'Saldo Akhir Rekening', value: formatRupiah(Number(trx.balance_after) || 0) },
        ],
      });
    }
  }

  // 2. HONORARIUM (HON-YYYYMM-XXXXXX or UUID)
  if (!docType || docType === 'HONORARIUM' || ref.toUpperCase().startsWith('HON-')) {
    let honorRow: Record<string, unknown> | null = null;
    const honMatch = ref.toUpperCase().match(/^HON-(\d{4})(\d{2})-([A-F0-9]{6})$/);
    if (honMatch) {
      const year = Number(honMatch[1]);
      const month = Number(honMatch[2]);
      const idPrefix = honMatch[3].toLowerCase();
      const { data: candidates } = await supabase
        .from('teacher_honorariums')
        .select('*, teacher:teachers_staff(full_name, nip)')
        .eq('period_year', year)
        .eq('period_month', month);
      honorRow =
        (candidates || []).find((c) => String(c.id).toLowerCase().startsWith(idPrefix)) || null;
    } else if (/^[0-9a-f-]{36}$/i.test(ref)) {
      const { data } = await supabase
        .from('teacher_honorariums')
        .select('*, teacher:teachers_staff(full_name, nip)')
        .eq('id', ref)
        .maybeSingle();
      honorRow = data;
    }

    if (honorRow) {
      const teacher = Array.isArray(honorRow.teacher) ? honorRow.teacher[0] : honorRow.teacher;
      return NextResponse.json({
        valid: true,
        documentType: 'HONORARIUM',
        reference: ref.toUpperCase(),
        title: 'Slip Honorarium & Tunjangan GTK',
        statusLabel: `TERVERIFIKASI (${String(honorRow.status || 'DRAFT')})`,
        issuedAt: String(honorRow.created_at || ''),
        details: [
          { label: 'Nama Penerima (GTK)', value: teacher?.full_name || '-' },
          {
            label: 'Periode',
            value: `${String(honorRow.period_month)}/${String(honorRow.period_year)}`,
          },
          { label: 'Total JTM', value: `${Number(honorRow.total_jtm) || 0} JTM` },
          {
            label: 'Honorarium JTM',
            value: formatRupiah(Number(honorRow.jtm_honorarium_amount) || 0),
          },
          {
            label: 'Tunjangan Tugas Tambahan',
            value: formatRupiah(Number(honorRow.additional_duty_allowance) || 0),
          },
          {
            label: 'Tunjangan Transportasi',
            value: formatRupiah(Number(honorRow.transport_allowance) || 0),
          },
          {
            label: 'Total Honorarium Diterima',
            value: formatRupiah(Number(honorRow.total_amount) || 0),
          },
        ],
      });
    }
  }

  // 3. SPP & IURAN KOMITE (SPP-XXXXXXXX or bill_payments.reference_number or UUID)
  if (!docType || docType === 'SPP' || ref.toUpperCase().startsWith('SPP-')) {
    let billRow: Record<string, unknown> | null = null;
    const sppMatch = ref.toUpperCase().match(/^SPP-([A-F0-9]{8})$/);
    if (sppMatch) {
      const idPrefix = sppMatch[1].toLowerCase();
      const { data: candidates } = await supabase
        .from('student_bills')
        .select('*, student:students(full_name, nis), fee_type:fee_types(name, category)')
        .order('created_at', { ascending: false })
        .limit(500);
      billRow =
        (candidates || []).find((b) => String(b.id).toLowerCase().startsWith(idPrefix)) || null;
    } else {
      const { data: pay } = await supabase
        .from('bill_payments')
        .select(
          '*, bill:student_bills(*, student:students(full_name, nis), fee_type:fee_types(name, category))'
        )
        .ilike('reference_number', ref)
        .maybeSingle();
      if (pay?.bill) {
        billRow = Array.isArray(pay.bill) ? pay.bill[0] : pay.bill;
      }
    }

    if (billRow) {
      const student = Array.isArray(billRow.student) ? billRow.student[0] : billRow.student;
      const feeType = Array.isArray(billRow.fee_type) ? billRow.fee_type[0] : billRow.fee_type;
      return NextResponse.json({
        valid: true,
        documentType: 'SPP',
        reference: ref.toUpperCase(),
        title: 'Slip Pembayaran SPP / Iuran Komite',
        statusLabel: `TERVERIFIKASI (${String(billRow.status || '-')})`,
        issuedAt: String(billRow.created_at || ''),
        details: [
          { label: 'Nama Siswa', value: student?.full_name || '-' },
          { label: 'NIS', value: student?.nis || '-' },
          { label: 'Jenis Biaya', value: feeType?.name || String(billRow.title || 'SPP / Komite') },
          { label: 'Nominal Tagihan', value: formatRupiah(Number(billRow.amount) || 0) },
          { label: 'Sudah Dibayar', value: formatRupiah(Number(billRow.paid_amount) || 0) },
          { label: 'Status Pembayaran', value: String(billRow.status || '-') },
        ],
      });
    }
  }

  // 4. KARTU PELAJAR (students: qr_token, nisn, nis, id)
  if (!docType || docType === 'KARTU_SISWA') {
    const { data: student } = await supabase
      .from('students')
      .select('id, full_name, nis, nisn, status, qr_token')
      .or(`qr_token.eq.${ref},nisn.eq.${ref},nis.eq.${ref}`)
      .limit(1)
      .maybeSingle();

    if (student) {
      return NextResponse.json({
        valid: true,
        documentType: 'KARTU_SISWA',
        reference: ref,
        title: 'Kartu Pelajar Digital Resmi',
        statusLabel: `TERVERIFIKASI (${student.status || 'AKTIF'})`,
        details: [
          { label: 'Nama Siswa', value: student.full_name },
          { label: 'NIS', value: student.nis || '-' },
          { label: 'NISN', value: student.nisn || '-' },
          { label: 'Status Keaktifan', value: student.status || 'AKTIF' },
        ],
      });
    }
  }

  // 5. KARTU ANGGOTA E-LIBRARY (LIB-...)
  if (!docType || docType === 'KARTU_PERPUSTAKAAN' || ref.toUpperCase().startsWith('LIB-')) {
    const { data: member } = await supabase
      .from('library_members')
      .select('id, member_code, member_type, full_name, status, joined_at')
      .ilike('member_code', ref)
      .maybeSingle();

    if (member) {
      return NextResponse.json({
        valid: true,
        documentType: 'KARTU_PERPUSTAKAAN',
        reference: member.member_code,
        title: 'Kartu Anggota E-Library Resmi',
        statusLabel: `TERVERIFIKASI (${member.status || 'AKTIF'})`,
        issuedAt: member.joined_at,
        details: [
          { label: 'Nama Anggota', value: member.full_name },
          { label: 'Kode Anggota', value: member.member_code },
          { label: 'Kategori', value: member.member_type },
          { label: 'Status Keanggotaan', value: member.status || 'AKTIF' },
        ],
      });
    }
  }

  // 6. SURAT RESMI MADRASAH (letters)
  if (!docType || docType === 'SURAT') {
    const { data: letter } = await supabase
      .from('letters')
      .select('id, letter_number, letter_type, subject, recipient_or_sender, letter_date, created_at')
      .ilike('letter_number', ref)
      .limit(1)
      .maybeSingle();

    if (letter) {
      return NextResponse.json({
        valid: true,
        documentType: 'SURAT',
        reference: letter.letter_number,
        title: 'Dokumen / Surat Resmi Lembaga',
        statusLabel: 'TERVERIFIKASI SAH',
        issuedAt: letter.letter_date || letter.created_at,
        details: [
          { label: 'Nomor Surat', value: letter.letter_number },
          { label: 'Jenis Surat', value: letter.letter_type },
          { label: 'Perihal', value: letter.subject || '-' },
          { label: 'Tujuan / Pengirim', value: letter.recipient_or_sender || '-' },
          { label: 'Tanggal Surat', value: letter.letter_date || '-' },
        ],
      });
    }
  }

  // 7. REKAP ABSENSI PDF (RKP-...)
  if (docType === 'REKAP_ABSENSI' || ref.toUpperCase().startsWith('RKP-')) {
    const parts = ref.toUpperCase().split('-');
    if (parts.length >= 4) {
      return NextResponse.json({
        valid: true,
        documentType: 'REKAP_ABSENSI',
        reference: ref.toUpperCase(),
        title: 'Dokumen Rekapitulasi Absensi Resmi',
        statusLabel: 'FORMAT DOKUMEN VALID',
        details: [
          { label: 'Jenis Rekap', value: parts[1] || '-' },
          { label: 'Periode Mulai', value: parts.slice(2, 5).join('-') || '-' },
          { label: 'Kode Referensi', value: ref.toUpperCase() },
        ],
      });
    }
  }

  // 8. PENILAIAN & RAPORT PDF (PNL-...)
  if (docType === 'PENILAIAN' || ref.toUpperCase().startsWith('PNL-')) {
    const upperRef = ref.toUpperCase();
    const parts = upperRef.split('-');
    if (parts.length >= 3) {
      const docKey = parts.slice(1, -1).join('-');
      const tsToken = parts[parts.length - 1];
      const tsMs = Number.parseInt(tsToken, 36);
      const parsedDate =
        !Number.isNaN(tsMs) && tsMs >= 1577836800000 && tsMs <= 4102444800000
          ? new Date(tsMs).toISOString()
          : undefined;

      const docCategory = docKey.includes('RAPORT')
        ? 'Laporan Nilai Raport Mata Pelajaran'
        : docKey.includes('REKAPNILAI')
        ? 'Rekapitulasi Nilai Siswa / Anak'
        : 'Dokumen Penilaian Mata Pelajaran';

      return NextResponse.json({
        valid: true,
        documentType: 'PENILAIAN',
        reference: upperRef,
        title: docCategory,
        statusLabel: 'FORMAT DOKUMEN VALID',
        issuedAt: parsedDate,
        details: [
          { label: 'Kategori Dokumen', value: docCategory },
          { label: 'Identitas Berkas', value: docKey || '-' },
          { label: 'Kode Referensi', value: upperRef },
          ...(parsedDate
            ? [
                {
                  label: 'Waktu Cetak',
                  value: new Date(parsedDate).toLocaleString('id-ID'),
                },
              ]
            : []),
        ],
      });
    }
  }

  return NextResponse.json(
    {
      valid: false,
      reference: ref,
      error:
        'Dokumen atau nomor referensi tidak ditemukan di sistem. Pastikan nomor referensi atau QR Code benar dan berasal dari dokumen resmi lembaga.',
    },
    { status: 404 }
  );
}
