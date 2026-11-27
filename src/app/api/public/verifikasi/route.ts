import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { formatRupiah } from '@/lib/domain/honorarium';
import { extractVerificationParams } from '@/lib/verification/document-verify';
import { parseCaptchaHeader, verifyCaptchaToken } from '@/lib/security/captcha-server';

function formatSafeDateTime(raw?: string | null): string {
  if (!raw) return '-';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID');
}

function escapePostgrestLikeValue(raw: string): string {
  return raw.replace(/[\\%_]/g, '\\$&').replace(/[(),]/g, ' ').trim();
}

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

  const captchaPayload = parseCaptchaHeader(request);
  const captchaResult = await verifyCaptchaToken(captchaPayload, request);
  if (!captchaResult.success) {
    return NextResponse.json(
      {
        valid: false,
        error: captchaResult.error || 'Verifikasi keamanan (CAPTCHA) gagal.',
        turnstileUnavailable: Boolean(captchaResult.turnstileUnavailable),
      },
      { status: 403 }
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
    const safeRefLike = ref.replace(/[\\%_]/g, '\\$&');
    const { data: trx } = await supabase
      .from('savings_transactions')
      .select(
        'id, reference_number, transaction_type, amount, fee_percentage, fee_amount, net_amount, balance_after, transaction_date, notes, account:savings_accounts(account_number, owner_name, owner_type)'
      )
      .ilike('reference_number', safeRefLike)
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
      const uuidLow = `${idPrefix}-0000-0000-0000-000000000000`;
      const uuidHigh = `${idPrefix}-ffff-ffff-ffff-ffffffffffff`;
      const { data: candidates } = await supabase
        .from('student_bills')
        .select('*, student:students(full_name, nis), fee_type:fee_types(name, category)')
        .gte('id', uuidLow)
        .lte('id', uuidHigh)
        .limit(5);
      billRow =
        (candidates || []).find((b) => String(b.id).toLowerCase().startsWith(idPrefix)) || null;
    } else {
      const { data: pay } = await supabase
        .from('bill_payments')
        .select(
          '*, bill:student_bills(*, student:students(full_name, nis), fee_type:fee_types(name, category))'
        )
        .ilike('receipt_number', ref.replace(/[\\%_]/g, '\\$&'))
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
  if ((!docType || docType === 'KARTU_SISWA') && /^[A-Za-z0-9._-]{1,80}$/.test(ref)) {
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
      .ilike('member_code', ref.replace(/[\\%_]/g, '\\$&'))
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

  // 6. SURAT RESMI MADRASAH & BUKU AGENDA PERSURATAN (letters / AGD-...)
  if (!docType || docType === 'SURAT' || ref.toUpperCase().startsWith('AGD-')) {
    const upperRef = ref.toUpperCase();
    const agdMatch = upperRef.match(/^AGD-(\d{8})-([A-Z0-9]+)$/);
    if (agdMatch) {
      const { data: ledgerRow } = await supabase
        .from('document_verification_ledger')
        .select('reference_code, title, issued_at, metadata, is_revoked')
        .eq('reference_code', upperRef)
        .maybeSingle();

      if (ledgerRow) {
        const meta = (ledgerRow.metadata || {}) as Record<string, unknown>;
        return NextResponse.json({
          valid: !ledgerRow.is_revoked,
          documentType: 'SURAT',
          reference: ledgerRow.reference_code,
          title: ledgerRow.title || 'Buku Agenda Arsip Persuratan Digital Resmi',
          statusLabel: ledgerRow.is_revoked
            ? 'DOKUMEN DICABUT / TIDAK BERLAKU'
            : 'TERVERIFIKASI SAH (LEDGER RESMI)',
          issuedAt: ledgerRow.issued_at,
          details: [
            { label: 'Kategori Dokumen', value: 'Rekapitulasi Buku Agenda Surat Masuk & Keluar' },
            { label: 'Kode Referensi Cetak', value: ledgerRow.reference_code },
            ...(meta.totalRows !== undefined
              ? [{ label: 'Jumlah Entri Surat', value: `${String(meta.totalRows)} surat` }]
              : []),
            {
              label: 'Waktu Terbit',
              value: formatSafeDateTime(ledgerRow.issued_at),
            },
          ],
        });
      }

      return NextResponse.json(
        {
          valid: false,
          reference: upperRef,
          error:
            'Kode Buku Agenda ini tidak tercatat pada ledger penerbitan dokumen resmi lembaga.',
        },
        { status: 404 }
      );
    }

    const safeLetterRef = escapePostgrestLikeValue(ref);
    const { data: letter } = safeLetterRef
      ? await supabase
          .from('letters')
          .select(
            '*, student:students(full_name, nis), teacher:teachers_staff(full_name, nip)'
          )
          .or(`letter_number.ilike.${safeLetterRef},summary.ilike.%${safeLetterRef}%`)
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (letter) {
      const student = Array.isArray(letter.student) ? letter.student[0] : letter.student;
      const teacher = Array.isArray(letter.teacher) ? letter.teacher[0] : letter.teacher;
      const letterStatus = String((letter as Record<string, unknown>).status || 'TERBIT');
      const isCancelled = letterStatus === 'DIBATALKAN';

      return NextResponse.json({
        valid: !isCancelled,
        documentType: 'SURAT',
        reference: letter.letter_number,
        title: 'Dokumen / Surat Resmi Lembaga',
        statusLabel: isCancelled
          ? 'DOKUMEN DIBATALKAN / TIDAK BERLAKU'
          : `TERVERIFIKASI SAH (${letterStatus})`,
        issuedAt: letter.letter_date || letter.created_at,
        details: [
          { label: 'Nomor Surat', value: letter.letter_number },
          {
            label: 'Jenis & Kategori',
            value: `${letter.direction} - ${String(letter.category || '').replace(/_/g, ' ')}`,
          },
          { label: 'Perihal', value: letter.subject || '-' },
          {
            label: letter.direction === 'MASUK' ? 'Pengirim / Asal' : 'Tujuan / Penerima',
            value: letter.counterparty || '-',
          },
          ...(student?.full_name
            ? [
                {
                  label: 'Siswa Terkait',
                  value: `${student.full_name}${student.nis ? ` (NIS: ${student.nis})` : ''}`,
                },
              ]
            : []),
          ...(teacher?.full_name
            ? [
                {
                  label: 'GTK Terkait',
                  value: `${teacher.full_name}${teacher.nip ? ` (NIP: ${teacher.nip})` : ''}`,
                },
              ]
            : []),
          ...(letter.summary ? [{ label: 'Ringkasan Isi', value: letter.summary }] : []),
          { label: 'Tanggal Surat', value: letter.letter_date || '-' },
        ],
      });
    }
  }

  // 7. REKAP ABSENSI PDF (RKP-...) — Wajib Terdaftar di Ledger DB
  if (docType === 'REKAP_ABSENSI' || ref.toUpperCase().startsWith('RKP-')) {
    const upperRef = ref.toUpperCase();
    const { data: ledgerRow } = await supabase
      .from('document_verification_ledger')
      .select('reference_code, title, issued_at, metadata, is_revoked')
      .eq('reference_code', upperRef)
      .maybeSingle();

    if (ledgerRow) {
      const meta = (ledgerRow.metadata || {}) as Record<string, unknown>;
      return NextResponse.json({
        valid: !ledgerRow.is_revoked,
        documentType: 'REKAP_ABSENSI',
        reference: ledgerRow.reference_code,
        title: ledgerRow.title || 'Dokumen Rekapitulasi Absensi Resmi',
        statusLabel: ledgerRow.is_revoked
          ? 'DOKUMEN DICABUT / TIDAK BERLAKU'
          : 'TERVERIFIKASI SAH (LEDGER RESMI)',
        issuedAt: ledgerRow.issued_at,
        details: [
          { label: 'Jenis Rekap', value: String(meta.kind || upperRef.split('-')[1] || '-') },
          ...(meta.period ? [{ label: 'Periode', value: String(meta.period) }] : []),
          { label: 'Kode Referensi', value: ledgerRow.reference_code },
          {
            label: 'Waktu Terbit',
            value: formatSafeDateTime(ledgerRow.issued_at),
          },
        ],
      });
    }
  }

  // 8. PENILAIAN & RAPORT PDF (PNL-...) — Wajib Terdaftar di Ledger DB
  if (docType === 'PENILAIAN' || ref.toUpperCase().startsWith('PNL-')) {
    const upperRef = ref.toUpperCase();
    const { data: ledgerRow } = await supabase
      .from('document_verification_ledger')
      .select('reference_code, title, issued_at, metadata, is_revoked')
      .eq('reference_code', upperRef)
      .maybeSingle();

    if (ledgerRow) {
      const meta = (ledgerRow.metadata || {}) as Record<string, unknown>;
      return NextResponse.json({
        valid: !ledgerRow.is_revoked,
        documentType: 'PENILAIAN',
        reference: ledgerRow.reference_code,
        title: ledgerRow.title || 'Dokumen Penilaian Mata Pelajaran',
        statusLabel: ledgerRow.is_revoked
          ? 'DOKUMEN DICABUT / TIDAK BERLAKU'
          : 'TERVERIFIKASI SAH (LEDGER RESMI)',
        issuedAt: ledgerRow.issued_at,
        details: [
          { label: 'Kategori Dokumen', value: ledgerRow.title || '-' },
          ...(meta.subtitle ? [{ label: 'Keterangan', value: String(meta.subtitle) }] : []),
          { label: 'Kode Referensi', value: ledgerRow.reference_code },
          {
            label: 'Waktu Terbit',
            value: formatSafeDateTime(ledgerRow.issued_at),
          },
        ],
      });
    }
  }

  // 9. MUTASI REKENING TABUNGAN PDF (MUT-<ID8>-<YYYYMMDD>-<TS36>) — Query Indeks UUID
  if (docType === 'MUTASI_TABUNGAN' || ref.toUpperCase().startsWith('MUT-')) {
    const upperRef = ref.toUpperCase();
    const mutMatch = upperRef.match(/^MUT-([A-F0-9]{8})-(\d{8})-([A-Z0-9]+)$/);
    if (mutMatch) {
      const idPrefix = mutMatch[1].toLowerCase();
      const uuidLow = `${idPrefix}-0000-0000-0000-000000000000`;
      const uuidHigh = `${idPrefix}-ffff-ffff-ffff-ffffffffffff`;
      const dateCompact = mutMatch[2];
      const tsToken = mutMatch[3];
      const tsMs = Number.parseInt(tsToken, 36);
      const parsedDate =
        !Number.isNaN(tsMs) && tsMs >= 1577836800000 && tsMs <= 4102444800000
          ? new Date(tsMs).toISOString()
          : `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`;

      const { data: accounts } = await supabase
        .from('savings_accounts')
        .select('id, account_number, owner_name, owner_type, balance, is_active')
        .gte('id', uuidLow)
        .lte('id', uuidHigh)
        .limit(5);

      const matchedAccount = (accounts || []).find((a) =>
        String(a.id).replace(/-/g, '').toLowerCase().startsWith(idPrefix)
      );

      if (matchedAccount) {
        return NextResponse.json({
          valid: true,
          documentType: 'MUTASI_TABUNGAN',
          reference: upperRef,
          title: 'Dokumen Mutasi Rekening Tabungan Digital',
          statusLabel: matchedAccount.is_active
            ? 'TERVERIFIKASI SAH (REKENING AKTIF)'
            : 'TERVERIFIKASI (REKENING NONAKTIF)',
          issuedAt: parsedDate,
          details: [
            { label: 'Pemilik Rekening', value: matchedAccount.owner_name || '-' },
            { label: 'Nomor Rekening', value: matchedAccount.account_number || '-' },
            { label: 'Kategori Nasabah', value: matchedAccount.owner_type || '-' },
            {
              label: 'Saldo Rekening Saat Ini',
              value: formatRupiah(Number(matchedAccount.balance) || 0),
            },
            { label: 'Kode Referensi Dokumen', value: upperRef },
            {
              label: 'Waktu Cetak Dokumen',
              value:
                new Date(parsedDate).toLocaleString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }) + ' WIB',
            },
          ],
        });
      }
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
