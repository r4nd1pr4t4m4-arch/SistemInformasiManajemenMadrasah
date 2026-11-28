import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import { drawLogoInBox, loadInstitutionLogoForPdf } from './pdf-logo-helper';
import {
  extractLinkedStudent,
  extractLinkedTeacher,
  formatLetterCategoryLabel,
  getDefaultClassificationCode,
  type InstitutionInfoForLetter,
  type LetterRecord,
} from './persuratan-agenda-pdf';

export interface OfficialLetterCustomOptions {
  issueCity?: string;
  attachmentCountLabel?: string;
  customBodyText?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryNip?: string;
  ccListText?: string; // Tembusan (dipisahkan baris baru)
}

function formatDateIdLong(dateStr?: string | null): string {
  if (!dateStr) {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function inferCityFromAddress(address?: string | null): string {
  if (!address?.trim()) return 'Tempat';
  const cleaned = address.trim();
  const kabKotaMatch = cleaned.match(/(?:Kab\.|Kabupaten|Kota)\s+([A-Za-z\s]{3,25})/i);
  if (kabKotaMatch?.[1]) {
    return kabKotaMatch[1].trim().replace(/[,.].*$/, '');
  }
  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2].replace(/\d+/g, '').trim();
    if (candidate.length >= 3 && candidate.length <= 28) return candidate;
  }
  return 'Tempat';
}

/**
 * Menghasilkan draf teks isi pokok surat otomatis sesuai kategori, data siswa/GTK, dan ringkasan.
 */
export function buildDefaultOfficialLetterBody(params: {
  letter: LetterRecord;
  institution?: InstitutionInfoForLetter | null;
}): string {
  const { letter, institution } = params;
  const instName = institution?.name?.trim() || 'Madrasah / Sekolah';
  const student = extractLinkedStudent(letter);
  const teacher = extractLinkedTeacher(letter);
  const summaryNote = letter.summary?.trim() || '';
  const counterparty = letter.counterparty?.trim() || '';

  switch (letter.category) {
    case 'SURAT_KETERANGAN_AKTIF':
      return [
        `Adalah benar peserta didik yang terdaftar dan aktif mengikuti kegiatan pembelajaran pada ${instName}.`,
        summaryNote
          ? `Surat keterangan ini diterbitkan untuk keperluan: ${summaryNote}.`
          : counterparty
            ? `Surat keterangan ini diterbitkan untuk dipergunakan sebagaimana mestinya pada ${counterparty}.`
            : 'Surat keterangan ini diterbitkan untuk dapat dipergunakan sebagaimana mestinya.',
        'Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat digunakan sebagaimana mestinya.',
      ].join('\n\n');

    case 'SURAT_MUTASI':
      return [
        `Berdasarkan permohonan orang tua/wali peserta didik yang bersangkutan, nama tersebut di atas telah mengajukan pindah / mutasi belajar dari ${instName}${
          counterparty ? ` ke ${counterparty}` : ''
        }.`,
        summaryNote ||
          'Selama menjadi peserta didik di lembaga kami, yang bersangkutan berkelakuan baik dan telah menyelesaikan administrasi akademik sesuai ketentuan yang berlaku.',
        'Demikian surat keterangan pindah/mutasi ini diterbitkan untuk dipergunakan sebagaimana mestinya.',
      ].join('\n\n');

    case 'SURAT_REKOMENDASI':
      return [
        `Berdasarkan rekam jejak akademik dan penilaian karakter di ${instName}, kami memberikan rekomendasi kepada ${
          student?.full_name
            ? `peserta didik tersebut di atas`
            : teacher?.full_name
              ? `pendidik/tenaga kependidikan tersebut di atas`
              : 'yang bersangkutan'
        } untuk mengikuti / mengajukan: ${letter.subject}.`,
        summaryNote ||
          (counterparty
            ? `Rekomendasi ini disampaikan kepada ${counterparty} sebagai bahan pertimbangan yang sah.`
            : 'Kami menilai yang bersangkutan memiliki dedikasi, integritas, dan kompetensi yang baik.'),
        'Demikian surat rekomendasi ini diberikan untuk dapat dipergunakan sebagaimana mestinya.',
      ].join('\n\n');

    case 'SURAT_TUGAS':
      return [
        `Menugaskan kepada Pendidik / Tenaga Kependidikan yang namanya tercantum di atas untuk melaksanakan tugas: ${letter.subject}${
          counterparty ? ` bertempat di / penyelenggara: ${counterparty}` : ''
        }.`,
        summaryNote ||
          'Setelah selesai melaksanakan tugas ini, diharapkan menyampaikan laporan tertulis mengenai hasil pelaksanaan kegiatan kepada Kepala Lembaga.',
        'Demikian Surat Tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.',
      ].join('\n\n');

    case 'SURAT_KEPUTUSAN':
      return [
        `KESATU : Menetapkan dan menunjuk nama yang tercantum dalam keputusan ini untuk melaksanakan tugas terkait "${letter.subject}".`,
        `KEDUA : ${
          summaryNote ||
          'Segala tugas dan tanggung jawab dilaksanakan sesuai ketentuan peraturan perundang-undangan serta pedoman akademik lembaga.'
        }`,
        'KETIGA : Keputusan ini mulai berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diadakan perbaikan sebagaimana mestinya.',
      ].join('\n\n');

    case 'SURAT_UNDANGAN':
      return [
        `Sehubungan dengan akan dilaksanakannya kegiatan "${letter.subject}" di lingkungan ${instName}, melalui surat ini kami mengundang Bapak/Ibu/Saudara untuk hadir dalam kegiatan tersebut.`,
        summaryNote ||
          'Mengingat pentingnya acara tersebut, kehadiran Bapak/Ibu/Saudara tepat pada waktunya sangat kami harapkan.',
        'Demikian surat undangan ini kami sampaikan. Atas perhatian dan kehadirannya kami ucapkan terima kasih.',
      ].join('\n\n');

    case 'SURAT_EDARAN':
      return [
        `Dalam rangka tertib administrasi dan kelancaran agenda kegiatan di ${instName}, bersama ini kami sampaikan edaran resmi mengenai: ${letter.subject}.`,
        summaryNote ||
          'Seluruh warga lembaga, peserta didik, serta orang tua/wali diharapkan memperhatikan dan melaksanakan ketentuan dalam surat edaran ini.',
        'Demikian surat edaran ini disampaikan untuk menjadi perhatian dan dilaksanakan sebagaimana mestinya.',
      ].join('\n\n');

    case 'SURAT_PANGGILAN':
      return [
        `Mengharap dengan hormat kehadiran Bapak/Ibu Orang Tua/Wali dari peserta didik${
          student?.full_name ? ` a.n. ${student.full_name}${student.nis ? ` (NIS: ${student.nis})` : ''}` : ''
        } di ${instName} sehubungan dengan keperluan: ${letter.subject}.`,
        summaryNote ||
          'Mengingat pentingnya pembinaan dan koordinasi perkembangan peserta didik, kami sangat mengharapkan kehadiran Bapak/Ibu tepat waktu.',
        'Demikian surat panggilan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu kami ucapkan terima kasih.',
      ].join('\n\n');

    case 'SURAT_IZIN':
      return [
        `Melalui surat ini kami sampaikan permohonan izin / dispensasi terkait "${letter.subject}"${
          student?.full_name
            ? ` bagi peserta didik a.n. ${student.full_name}${student.nis ? ` (NIS: ${student.nis})` : ''}`
            : teacher?.full_name
              ? ` bagi GTK a.n. ${teacher.full_name}`
              : ''
        }.`,
        summaryNote ||
          'Mohon kiranya yang bersangkutan dapat diberikan izin/dispensasi sesuai ketentuan yang berlaku.',
        'Demikian surat ini disampaikan. Atas perhatian dan kebijaksanaannya kami ucapkan terima kasih.',
      ].join('\n\n');

    default:
      return [
        `Bersama surat ini kami sampaikan informasi/dokumen resmi terkait "${letter.subject}" dari ${instName}.`,
        summaryNote ||
          'Kiranya surat ini dapat menjadi maklum dan ditindaklanjuti sebagaimana mestinya.',
        'Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama yang baik kami ucapkan terima kasih.',
      ].join('\n\n');
  }
}

function drawKeyValueBlock(
  doc: jsPDF,
  rows: Array<[string, string]>,
  startX: number,
  startY: number,
  labelWidth: number,
  maxWidth: number
): number {
  let y = startY;
  doc.setFontSize(10.5);
  for (const [label, value] of rows) {
    doc.setFont('times', 'normal');
    doc.text(label, startX, y);
    doc.text(':', startX + labelWidth, y);
    doc.setFont('times', label.toLowerCase().includes('nama') ? 'bold' : 'normal');
    const wrappedVal = doc.splitTextToSize(value || '-', maxWidth - labelWidth - 6);
    doc.text(wrappedVal, startX + labelWidth + 4, y);
    y += Math.max(wrappedVal.length * 5.2, 6.2);
  }
  return y;
}

/**
 * Menghasilkan Dokumen Naskah Surat Resmi (PDF A4 Portrait) lengkap dengan
 * Kop Surat Lembaga, Format Tata Naskah Dinas, dan Tanda Tangan Elektronik (TTE) QR Code.
 */
export async function generateOfficialLetterPdf(params: {
  letter: LetterRecord;
  institution?: InstitutionInfoForLetter | null;
  options?: OfficialLetterCustomOptions;
}): Promise<void> {
  const { letter, institution, options } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  const instName = (
    institution?.name || 'MADRASAH / SEKOLAH PENYELENGGARA PENDIDIKAN'
  ).toUpperCase();
  const headTitle =
    options?.signatoryTitle?.trim() ||
    letter.signatory_title?.trim() ||
    institution?.head_title_label?.trim() ||
    'Kepala Madrasah';
  const headName =
    options?.signatoryName?.trim() ||
    letter.signatory_name?.trim() ||
    institution?.headmaster_name?.trim() ||
    'Kepala Lembaga';
  const issueCity =
    options?.issueCity?.trim() || inferCityFromAddress(institution?.address);

  // =========================================================================
  // 1. KOP SURAT RESMI (OFFICIAL LETTERHEAD)
  // =========================================================================
  // Logo Institusi di Kiri Kop (fallback ke emblem inisial jika logo belum diunggah)
  const instLogo = await loadInstitutionLogoForPdf(institution?.logo_url);
  if (instLogo) {
    drawLogoInBox(doc, instLogo, marginX, 11.5, 19, 19);
  } else {
    doc.setFillColor(6, 95, 70);
    doc.roundedRect(marginX, 12, 18, 18, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const acronym = (institution?.short_name || instName.slice(0, 3))
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase();
    doc.text(acronym || 'SIMM', marginX + 9, 22.8, { align: 'center' });
  }

  const kopCenterX = pageWidth / 2 + 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  const wrappedInstName = doc.splitTextToSize(instName, contentWidth - 24);
  doc.text(wrappedInstName, kopCenterX, 15.5, { align: 'center' });

  let kopY = 15.5 + wrappedInstName.length * 5.2;

  // Baris NSM / NPSN / Akreditasi
  const idParts = [
    institution?.nsm ? `NSM: ${institution.nsm}` : null,
    institution?.npsn ? `NPSN: ${institution.npsn}` : null,
    (institution as Record<string, unknown> | null)?.accreditation
      ? `Terakreditasi: ${String((institution as Record<string, unknown>).accreditation)}`
      : null,
  ].filter(Boolean);

  if (idParts.length > 0) {
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text(idParts.join('   •   '), kopCenterX, kopY, { align: 'center' });
    kopY += 4.5;
  }

  // Baris Alamat & Kontak
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  if (institution?.address?.trim()) {
    const addrLines = doc.splitTextToSize(institution.address.trim(), contentWidth - 22);
    doc.text(addrLines, kopCenterX, kopY, { align: 'center' });
    kopY += addrLines.length * 3.8;
  }

  const contactParts = [
    institution?.phone ? `Telp: ${institution.phone}` : null,
    institution?.email ? `Email: ${institution.email}` : null,
    institution?.website_url ? `Web: ${institution.website_url}` : null,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), kopCenterX, kopY, { align: 'center' });
    kopY += 3.5;
  }

  const dividerY = Math.max(kopY + 2, 34);
  // Garis Ganda Kop Surat Standar Tata Naskah Dinas
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(marginX, dividerY, pageWidth - marginX, dividerY);
  doc.setLineWidth(0.25);
  doc.line(marginX, dividerY + 1.1, pageWidth - marginX, dividerY + 1.1);

  // =========================================================================
  // 2. ISI SURAT BERDASARKAN FORMAT TATA NASKAH DINAS
  // =========================================================================
  let cursorY = dividerY + 9;
  doc.setTextColor(15, 23, 42);

  const student = extractLinkedStudent(letter) as
    | (ReturnType<typeof extractLinkedStudent> & {
        nik?: string | null;
        gender?: string | null;
        birth_place?: string | null;
        birth_date?: string | null;
        father_name?: string | null;
        mother_name?: string | null;
        address?: string | null;
        status?: string | null;
      })
    | null;

  const teacher = extractLinkedTeacher(letter) as
    | (ReturnType<typeof extractLinkedTeacher> & {
        nuptk?: string | null;
        gender?: string | null;
        employment_status?: string | null;
        education_level?: string | null;
        major?: string | null;
      })
    | null;

  const bodyText =
    options?.customBodyText?.trim() ||
    buildDefaultOfficialLetterBody({ letter, institution });
  const bodyParagraphs = bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const isCenteredFormat = [
    'SURAT_KETERANGAN_AKTIF',
    'SURAT_MUTASI',
    'SURAT_REKOMENDASI',
    'SURAT_TUGAS',
    'SURAT_KEPUTUSAN',
  ].includes(letter.category);

  if (isCenteredFormat) {
    // Judul Tengah Bergaris Bawah
    const titleMap: Record<string, string> = {
      SURAT_KETERANGAN_AKTIF: 'SURAT KETERANGAN SISWA AKTIF',
      SURAT_MUTASI: 'SURAT KETERANGAN PINDAH / MUTASI',
      SURAT_REKOMENDASI: 'SURAT REKOMENDASI',
      SURAT_TUGAS: 'SURAT TUGAS',
      SURAT_KEPUTUSAN: `KEPUTUSAN ${headTitle.toUpperCase()}`,
    };
    const mainTitle = titleMap[letter.category] || formatLetterCategoryLabel(letter.category).toUpperCase();

    doc.setFont('times', 'bold');
    doc.setFontSize(12.5);
    doc.text(mainTitle, pageWidth / 2, cursorY, { align: 'center' });
    const titleWidth = doc.getTextWidth(mainTitle);
    doc.setLineWidth(0.35);
    doc.line(
      pageWidth / 2 - titleWidth / 2,
      cursorY + 1.2,
      pageWidth / 2 + titleWidth / 2,
      cursorY + 1.2
    );
    cursorY += 6;

    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Nomor: ${letter.letter_number}`, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 8;

    if (letter.category === 'SURAT_KEPUTUSAN') {
      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.text('TENTANG', pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 5.5;
      const subjLines = doc.splitTextToSize(letter.subject.toUpperCase(), contentWidth - 16);
      doc.text(subjLines, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += subjLines.length * 5.2 + 5;
    }

    // Paragraf Pembuka Penandatangan
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    const introText =
      letter.category === 'SURAT_TUGAS'
        ? `Yang bertanda tangan di bawah ini, ${headTitle} ${institution?.name || ''}, dengan ini memberikan tugas kepada:`
        : letter.category === 'SURAT_KEPUTUSAN'
          ? `${headTitle} ${institution?.name || ''}, setelah menimbang kebutuhan akademik dan kelembagaan, memutuskan:`
          : `Yang bertanda tangan di bawah ini:`;

    const wrappedIntro = doc.splitTextToSize(introText, contentWidth);
    doc.text(wrappedIntro, marginX, cursorY);
    cursorY += wrappedIntro.length * 5.2 + 2;

    if (letter.category !== 'SURAT_TUGAS' && letter.category !== 'SURAT_KEPUTUSAN') {
      cursorY = drawKeyValueBlock(
        doc,
        [
          ['Nama Pejabat', headName],
          ['Jabatan', `${headTitle} ${institution?.name || ''}`.trim()],
          ...(options?.signatoryNip ? [['NIP / NIY', options.signatoryNip] as [string, string]] : []),
        ],
        marginX + 6,
        cursorY,
        42,
        contentWidth - 8
      );
      cursorY += 2;
      doc.setFont('times', 'normal');
      doc.text('Dengan ini menerangkan dengan sesungguhnya bahwa:', marginX, cursorY);
      cursorY += 6.5;
    }

    // Blok Data Siswa atau GTK
    if (student?.full_name) {
      const ttl = [
        student.birth_place || null,
        student.birth_date ? formatDateIdLong(student.birth_date) : null,
      ]
        .filter(Boolean)
        .join(', ');
      const parentNames = [student.father_name, student.mother_name].filter(Boolean).join(' / ');

      cursorY = drawKeyValueBlock(
        doc,
        [
          ['Nama Peserta Didik', student.full_name],
          [
            'NIS / NISN',
            `${student.nis || '-'} / ${student.nisn || '-'}`,
          ],
          ...(ttl ? [['Tempat, Tanggal Lahir', ttl] as [string, string]] : []),
          ...(student.gender
            ? [
                [
                  'Jenis Kelamin',
                  student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : student.gender,
                ] as [string, string],
              ]
            : []),
          ...(parentNames ? [['Nama Orang Tua / Wali', parentNames] as [string, string]] : []),
          ...(student.address ? [['Alamat', student.address] as [string, string]] : []),
        ],
        marginX + 6,
        cursorY,
        42,
        contentWidth - 8
      );
      cursorY += 3;
    } else if (teacher?.full_name) {
      cursorY = drawKeyValueBlock(
        doc,
        [
          ['Nama Lengkap', teacher.full_name],
          ['NIP / NUPTK', `${teacher.nip || '-'}${teacher.nuptk ? ` / ${teacher.nuptk}` : ''}`],
          [
            'Jabatan / Status',
            `${teacher.staff_type === 'TATA_USAHA' ? 'Tenaga Administrasi / TU' : 'Pendidik / Guru'}${
              teacher.employment_status ? ` (${teacher.employment_status})` : ''
            }`,
          ],
          ...(teacher.education_level || teacher.major
            ? [
                [
                  'Kualifikasi Akademik',
                  [teacher.education_level, teacher.major].filter(Boolean).join(' - '),
                ] as [string, string],
              ]
            : []),
          ['Unit Kerja', institution?.name || 'Madrasah / Sekolah'],
        ],
        marginX + 6,
        cursorY,
        42,
        contentWidth - 8
      );
      cursorY += 3;
    } else if (letter.counterparty) {
      cursorY = drawKeyValueBlock(
        doc,
        [
          ['Nama / Pihak Terkait', letter.counterparty],
          ['Perihal', letter.subject],
        ],
        marginX + 6,
        cursorY,
        42,
        contentWidth - 8
      );
      cursorY += 3;
    }

    // Paragraf Isi Pokok
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    for (const para of bodyParagraphs) {
      const lines = doc.splitTextToSize(para, contentWidth);
      doc.text(lines, marginX, cursorY);
      cursorY += lines.length * 5.4 + 3;
    }
  } else {
    // =========================================================================
    // FORMAT SURAT DINAS STANDAR (UNDANGAN, EDARAN, PANGGILAN, PENGANTAR, DLL)
    // =========================================================================
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.text(
      `${issueCity}, ${formatDateIdLong(letter.letter_date)}`,
      pageWidth - marginX,
      cursorY,
      { align: 'right' }
    );

    const metaRows: Array<[string, string]> = [
      ['Nomor', letter.letter_number],
      ['Sifat', String(letter.priority || 'Biasa')],
      ['Lampiran', options?.attachmentCountLabel?.trim() || (letter.file_url ? '1 (Satu) Berkas' : '-')],
      ['Perihal', letter.subject],
    ];

    cursorY = drawKeyValueBlock(doc, metaRows, marginX, cursorY, 22, contentWidth * 0.62);
    cursorY += 4;

    // Tujuan Surat (Kepada Yth.)
    const recipient =
      letter.counterparty?.trim() ||
      (student?.full_name
        ? `Orang Tua / Wali dari ${student.full_name}`
        : teacher?.full_name
          ? teacher.full_name
          : 'Bapak/Ibu/Saudara');

    doc.setFont('times', 'normal');
    doc.text('Kepada Yth.', marginX, cursorY);
    cursorY += 5.2;
    doc.setFont('times', 'bold');
    const recipLines = doc.splitTextToSize(recipient, contentWidth * 0.7);
    doc.text(recipLines, marginX, cursorY);
    cursorY += recipLines.length * 5.2;
    doc.setFont('times', 'normal');
    doc.text('di Tempat', marginX, cursorY);
    cursorY += 8.5;

    // Salam Pembuka
    doc.setFont('times', 'italic');
    doc.text("Assalamu'alaikum Warahmatullahi Wabarakatuh,", marginX, cursorY);
    cursorY += 6;
    doc.setFont('times', 'normal');
    doc.text(
      'Segala puji bagi Allah SWT, semoga kita senantiasa dalam lindungan-Nya dalam menjalankan aktivitas sehari-hari.',
      marginX,
      cursorY
    );
    cursorY += 7.5;

    // Paragraf Isi
    for (const para of bodyParagraphs) {
      const lines = doc.splitTextToSize(para, contentWidth);
      doc.text(lines, marginX, cursorY);
      cursorY += lines.length * 5.4 + 3.2;
    }

    // Salam Penutup
    cursorY += 1;
    doc.setFont('times', 'italic');
    doc.text("Wassalamu'alaikum Warahmatullahi Wabarakatuh.", marginX, cursorY);
    cursorY += 6;
  }

  // =========================================================================
  // 3. BLOK TANDA TANGAN ELEKTRONIK (TTE), TEMBUSAN RATA BAWAH & FOOTER
  // =========================================================================
  const footerTopY = pageHeight - 16;
  const sigX = pageWidth - marginX - 68;
  const sigBlockHeight = options?.signatoryNip?.trim() ? 50 : 46;
  const maxSigY = footerTopY - 5 - sigBlockHeight;

  // Siapkan baris Tembusan terlebih dahulu agar tinggi blok tembusan dapat dihitung akurat
  const rawCcLines = (options?.ccListText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const ccMaxWidth = sigX - marginX - 6;
  const ccLineSpacing = 4.2;
  doc.setFont('times', 'normal');
  doc.setFontSize(9);

  const wrappedCcItems: string[][] = rawCcLines.map((line, idx) => {
    const cleanText = `${idx + 1}. ${line.replace(/^\d+\.\s*/, '')}`;
    return doc.splitTextToSize(cleanText, ccMaxWidth) as string[];
  });
  const totalCcWrappedLines = wrappedCcItems.reduce((acc, item) => acc + item.length, 0);

  // Posisi Tembusan Rata Bawah (tepat di atas garis batas footer dengan jarak aman 4.5 mm)
  const ccBottomAnchorY = footerTopY - 4.5;
  const ccHeaderY =
    totalCcWrappedLines > 0 ? ccBottomAnchorY - totalCcWrappedLines * ccLineSpacing : ccBottomAnchorY;

  let sigY = Math.max(cursorY + 8, 170);

  // Jika tanda tangan melewati batas bawah halaman ATAU teks isi surat menabrak area tembusan rata bawah, pindah ke halaman baru
  if (sigY > maxSigY || (totalCcWrappedLines > 0 && cursorY + 4 > ccHeaderY)) {
    doc.addPage();
    sigY = 30;
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`Ditetapkan di : ${issueCity}`, sigX, sigY);
  doc.text(`Pada tanggal : ${formatDateIdLong(letter.letter_date)}`, sigX, sigY + 5.2);
  doc.setFont('times', 'bold');
  doc.text(`${headTitle},`, sigX, sigY + 11.5);

  // Kotak QR TTE
  try {
    const verifyUrl = buildVerificationUrl({ ref: letter.letter_number, type: 'SURAT' });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.setDrawColor(167, 243, 208);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(sigX, sigY + 14, 64, 24, 1.8, 1.8, 'FD');
    doc.addImage(qrDataUrl, 'PNG', sigX + 2, sigY + 15.5, 21, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(6, 95, 70);
    doc.text('DITANDATANGANI SECARA', sigX + 25, sigY + 21);
    doc.text('ELEKTRONIK (TTE QR CODE)', sigX + 25, sigY + 24.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text('Scan QR untuk verifikasi keaslian', sigX + 25, sigY + 29);
    doc.text(
      `Kode: ${letter.classification_code || getDefaultClassificationCode(letter.category)}`,
      sigX + 25,
      sigY + 32.5
    );
  } catch {
    // ignore QR render error
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bold');
  doc.setFontSize(10.8);
  doc.text(headName, sigX, sigY + 44);
  const headNameW = doc.getTextWidth(headName);
  doc.setLineWidth(0.3);
  doc.line(sigX, sigY + 44.8, sigX + headNameW, sigY + 44.8);

  if (options?.signatoryNip?.trim()) {
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.text(`NIP/NIY. ${options.signatoryNip.trim()}`, sigX, sigY + 49);
  }

  // Tembusan Rata Bawah (di atas garis footer surat)
  if (totalCcWrappedLines > 0) {
    let ccY = ccHeaderY;
    doc.setTextColor(15, 23, 42);
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('Tembusan Yth.:', marginX, ccY);
    doc.setFont('times', 'normal');
    for (const wrappedLines of wrappedCcItems) {
      for (const wLine of wrappedLines) {
        ccY += ccLineSpacing;
        doc.text(wLine, marginX + 2, ccY);
      }
    }
  }

  // Footer Verifikasi Elektronik
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(marginX, footerTopY, pageWidth - marginX, footerTopY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Dokumen resmi ${institution?.name || 'SiM-M'} • Terdaftar di Buku Agenda Digital No: ${letter.letter_number}`,
    marginX,
    footerTopY + 4.5
  );
  doc.text(
    'Keaslian dokumen dapat diverifikasi melalui pemindaian QR Code atau portal /verifikasi.',
    marginX,
    footerTopY + 8
  );

  const safeSlug = letter.letter_number.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  doc.save(`Surat_Resmi_${safeSlug}.pdf`);
}
