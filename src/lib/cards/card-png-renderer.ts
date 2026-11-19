import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';

export interface CardInstitutionInfo {
  name: string;
  short_name?: string | null;
  institution_type?: 'MADRASAH' | 'SEKOLAH' | string;
  npsn?: string | null;
  nsm?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  head_title_label?: string | null;
  headmaster_name?: string | null;
}

export interface StudentCardData {
  id: string;
  full_name: string;
  nis?: string | null;
  nisn?: string | null;
  gender?: 'L' | 'P' | string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  address?: string | null;
  entry_year?: number | null;
  status?: string | null;
  photo_url?: string | null;
  qr_token?: string | null;
}

export interface LibraryCardData {
  id: string;
  member_code: string;
  member_type: 'SISWA' | 'GTK' | 'UMUM' | string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
  joined_at?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
}

const CARD_WIDTH = 1012;
const CARD_HEIGHT = 638;

function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'ID';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): number {
  const words = text.trim().split(/\s+/);
  let line = '';
  let currentY = y;
  let linesDrawn = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      if (linesDrawn + 1 >= maxLines) {
        let truncated = line;
        while (
          ctx.measureText(`${truncated}...`).width > maxWidth &&
          truncated.length > 0
        ) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(`${truncated}...`, x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
      linesDrawn += 1;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

async function loadImageSafe(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function generateQrImage(payload: string): Promise<HTMLImageElement | null> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return await loadImageSafe(dataUrl);
  } catch {
    return null;
  }
}

function drawDecorativePattern(
  ctx: CanvasRenderingContext2D,
  accentColor: string,
  w: number,
  h: number
) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(w - 60, h - 40, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w - 210, h + 20, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bgColor = '#ffffff'
) {
  ctx.save();
  drawRoundedRect(ctx, 0, 0, w, h, 32);
  ctx.clip();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
}

function drawCardBorder(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.restore();
  ctx.save();
  drawRoundedRect(ctx, 2, 2, w - 4, h - 4, 30);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawLogoOrBadge(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  fallbackText: string,
  badgeBg: string,
  badgeText: string
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, x + 4, y + 4, size - 8, size - 8);
  } else {
    ctx.fillStyle = badgeBg;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = badgeText;
    ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackText, x + size / 2, y + size / 2);
  }
  ctx.restore();
}

export async function renderStudentCardFrontCanvas(
  student: StudentCardData,
  institution: CardInstitutionInfo
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const [logoImg, photoImg, qrImg] = await Promise.all([
    loadImageSafe(institution.logo_url),
    loadImageSafe(student.photo_url),
    generateQrImage(
      buildVerificationUrl({
        ref: student.qr_token || student.nisn || student.nis || student.id,
        type: 'KARTU_SISWA',
      })
    ),
  ]);

  drawCardShell(ctx, CARD_WIDTH, CARD_HEIGHT, '#f8fafc');
  drawDecorativePattern(ctx, '#059669', CARD_WIDTH, CARD_HEIGHT);

  // Header gradient
  const headerGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 160);
  headerGrad.addColorStop(0, '#064e3b');
  headerGrad.addColorStop(0.6, '#047857');
  headerGrad.addColorStop(1, '#0f766e');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, 152);

  // Gold accent bar
  const goldGrad = ctx.createLinearGradient(0, 152, CARD_WIDTH, 152);
  goldGrad.addColorStop(0, '#d97706');
  goldGrad.addColorStop(0.5, '#fbbf24');
  goldGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 152, CARD_WIDTH, 8);

  drawLogoOrBadge(
    ctx,
    logoImg,
    40,
    30,
    92,
    getInitials(institution.short_name || institution.name || 'SM'),
    '#ecfdf5',
    '#065f46'
  );

  // Institution title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText((institution.name || 'MADRASAH / SEKOLAH').toUpperCase(), 154, 34, 620);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  const regCodes = [
    institution.nsm ? `NSM: ${institution.nsm}` : null,
    institution.npsn ? `NPSN: ${institution.npsn}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  ctx.fillText(regCodes || 'Sistem Informasi Manajemen Madrasah & Sekolah', 154, 72, 620);

  ctx.fillStyle = '#d1fae5';
  ctx.font = '400 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(institution.address || 'Alamat Lembaga Pendidikan', 154, 102, 620);

  // Card type pill on header right
  ctx.save();
  drawRoundedRect(ctx, 792, 44, 180, 44, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KARTU PELAJAR', 882, 66);
  ctx.restore();

  // Photo box
  const photoX = 44;
  const photoY = 196;
  const photoW = 192;
  const photoH = 248;

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 20);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.clip();
  if (photoImg) {
    ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
  } else {
    const avatarGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    avatarGrad.addColorStop(0, '#059669');
    avatarGrad.addColorStop(1, '#0f766e');
    ctx.fillStyle = avatarGrad;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(student.full_name), photoX + photoW / 2, photoY + photoH / 2);
  }
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 20);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Status badge under photo
  const statusLabel = (student.status || 'AKTIF').toUpperCase();
  ctx.save();
  drawRoundedRect(ctx, photoX, photoY + photoH + 18, photoW, 38, 19);
  ctx.fillStyle = statusLabel === 'AKTIF' ? '#d1fae5' : '#fef3c7';
  ctx.fill();
  ctx.fillStyle = statusLabel === 'AKTIF' ? '#065f46' : '#92400e';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`STATUS: ${statusLabel}`, photoX + photoW / 2, photoY + photoH + 37);
  ctx.restore();

  // Student info
  const infoX = 270;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('IDENTITAS PESERTA DIDIK', infoX, 196);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(student.full_name.toUpperCase(), infoX, 224, 510);

  // Divider
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(infoX, 274, 490, 2);

  const rows: Array<[string, string]> = [
    ['NIS / NISN', `${student.nis || '-'}  /  ${student.nisn || '-'}`],
    [
      'Tempat, Tgl Lahir',
      `${student.birth_place || '-'}${student.birth_date ? `, ${formatDateId(student.birth_date)}` : ''}`,
    ],
    ['Jenis Kelamin', student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : '-'],
    ['Tahun Masuk', student.entry_year ? String(student.entry_year) : '-'],
  ];

  let rowY = 294;
  for (const [label, val] of rows) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, infoX, rowY);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`:  ${val}`, infoX + 170, rowY, 340);
    rowY += 38;
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Alamat', infoX, rowY);
  ctx.fillStyle = '#334155';
  ctx.font = '500 17px "Segoe UI", system-ui, sans-serif';
  wrapText(ctx, `:  ${student.address || '-'}`, infoX + 170, rowY, 340, 24, 2);

  // QR Box on bottom right
  const qrBoxX = 796;
  const qrBoxY = 344;
  const qrSize = 172;
  ctx.save();
  drawRoundedRect(ctx, qrBoxX - 12, qrBoxY - 12, qrSize + 24, qrSize + 54, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX, qrBoxY, qrSize, qrSize);
  }
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN VERIFIKASI', qrBoxX + qrSize / 2, qrBoxY + qrSize + 14);
  ctx.restore();

  // Bottom footer bar
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, CARD_HEIGHT - 44, CARD_WIDTH, 44);
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Token: ${student.qr_token || student.id.slice(0, 12).toUpperCase()}`, 44, CARD_HEIGHT - 22);
  ctx.textAlign = 'right';
  ctx.fillText('Kartu Pelajar Digital Resmi', CARD_WIDTH - 44, CARD_HEIGHT - 22);

  drawCardBorder(ctx, CARD_WIDTH, CARD_HEIGHT, '#cbd5e1');
  return canvas;
}

export async function renderStudentCardBackCanvas(
  student: StudentCardData,
  institution: CardInstitutionInfo
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const qrImg = await generateQrImage(
    buildVerificationUrl({
      ref: student.qr_token || student.nisn || student.nis || student.id,
      type: 'KARTU_SISWA',
    })
  );

  drawCardShell(ctx, CARD_WIDTH, CARD_HEIGHT, '#ffffff');
  drawDecorativePattern(ctx, '#0f766e', CARD_WIDTH, CARD_HEIGHT);

  // Top dark strip
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, CARD_WIDTH, 92);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 92, CARD_WIDTH, 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('KETENTUAN & VALIDASI KARTU PELAJAR', 44, 46);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText((institution.short_name || institution.name || 'LEMBAGA').toUpperCase(), CARD_WIDTH - 44, 46);

  // Rules list
  const rules = [
    '1. Kartu ini adalah identitas resmi peserta didik yang tercatat pada Buku Induk lembaga.',
    '2. Wajib dibawa saat mengikuti kegiatan belajar mengajar, ujian, serta layanan akademik.',
    '3. Kartu berlaku selama pemegang masih berstatus sebagai siswa aktif dan tidak dapat dipindahtangankan.',
    '4. Apabila kartu ini ditemukan atau hilang, harap segera mengembalikan/melapor ke Tata Usaha lembaga.',
  ];

  let ruleY = 132;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const r of rules) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ruleY = wrapText(ctx, r, 48, ruleY, CARD_WIDTH - 96, 26, 2) + 10;
  }

  // Info & Signature box
  ctx.save();
  drawRoundedRect(ctx, 44, 386, 560, 174, 18);
  ctx.fillStyle = '#f1f5f9';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('INFORMASI LEMBAGA & MASA BERLAKU', 66, 408);

  ctx.fillStyle = '#334155';
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  wrapText(ctx, institution.address || 'Alamat Lembaga Pendidikan', 66, 438, 516, 22, 2);
  ctx.fillText(
    `Telp: ${institution.phone || '-'}  •  Email: ${institution.email || '-'}`,
    66,
    492,
    516
  );
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Masa Berlaku: Selama berstatus Siswa Aktif', 66, 524);
  ctx.restore();

  // Signature area + small QR
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Diterbitkan: ${formatDateId(new Date().toISOString())}`, 790, 396);
  ctx.fillText(institution.head_title_label || 'Kepala Madrasah / Sekolah', 790, 422);

  if (qrImg) {
    ctx.drawImage(qrImg, 742, 444, 96, 96);
  }
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(institution.headmaster_name || 'Pimpinan Lembaga', 790, 546, 300);

  // Footer
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, CARD_HEIGHT - 44, CARD_WIDTH, 44);
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`NIS/NISN: ${student.nis || '-'} / ${student.nisn || '-'}`, 44, CARD_HEIGHT - 22);
  ctx.textAlign = 'right';
  ctx.fillText(institution.website_url || institution.email || 'SIMMS Digital ID', CARD_WIDTH - 44, CARD_HEIGHT - 22);

  drawCardBorder(ctx, CARD_WIDTH, CARD_HEIGHT, '#cbd5e1');
  return canvas;
}

export async function renderLibraryCardFrontCanvas(
  member: LibraryCardData,
  institution: CardInstitutionInfo
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const [logoImg, qrImg] = await Promise.all([
    loadImageSafe(institution.logo_url),
    generateQrImage(
      buildVerificationUrl({
        ref: member.member_code,
        type: 'KARTU_PERPUSTAKAAN',
      })
    ),
  ]);

  drawCardShell(ctx, CARD_WIDTH, CARD_HEIGHT, '#f8fafc');
  drawDecorativePattern(ctx, '#0284c7', CARD_WIDTH, CARD_HEIGHT);

  // Header gradient
  const headerGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 154);
  headerGrad.addColorStop(0, '#0f172a');
  headerGrad.addColorStop(0.55, '#1e3a8a');
  headerGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, 152);

  // Cyan accent line
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 152, CARD_WIDTH, 8);

  drawLogoOrBadge(
    ctx,
    logoImg,
    40,
    30,
    92,
    'LIB',
    '#e0f2fe',
    '#0369a1'
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('KARTU ANGGOTA PERPUSTAKAAN', 154, 34, 580);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`E-Library • ${(institution.name || 'Madrasah / Sekolah').toUpperCase()}`, 154, 72, 600);

  ctx.fillStyle = '#e0f2fe';
  ctx.font = '400 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(institution.address || 'Layanan Perpustakaan & Literasi Digital', 154, 102, 600);

  // Member type pill
  ctx.save();
  drawRoundedRect(ctx, 796, 44, 176, 44, 22);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(member.member_type.toUpperCase(), 884, 66);
  ctx.restore();

  // Avatar badge left
  const avX = 44;
  const avY = 198;
  const avW = 192;
  const avH = 220;
  ctx.save();
  drawRoundedRect(ctx, avX, avY, avW, avH, 24);
  const avGrad = ctx.createLinearGradient(avX, avY, avX + avW, avY + avH);
  avGrad.addColorStop(0, '#1e3a8a');
  avGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = avGrad;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getInitials(member.full_name), avX + avW / 2, avY + avH / 2);
  ctx.restore();

  // Member code pill under avatar
  ctx.save();
  drawRoundedRect(ctx, avX, avY + avH + 18, avW, 44, 14);
  ctx.fillStyle = '#e0f2fe';
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 18px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(member.member_code, avX + avW / 2, avY + avH + 40);
  ctx.restore();

  // Member details
  const infoX = 272;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('IDENTITAS ANGGOTA E-LIBRARY', infoX, 198);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(member.full_name.toUpperCase(), infoX, 226, 510);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(infoX, 276, 490, 2);

  const memberTypeLabel =
    member.member_type === 'SISWA'
      ? 'Peserta Didik (Siswa)'
      : member.member_type === 'GTK'
      ? 'Guru & Tenaga Kependidikan'
      : 'Anggota Masyarakat Umum';

  const rows: Array<[string, string]> = [
    ['No. Anggota', member.member_code],
    ['Kategori', memberTypeLabel],
    ['No. HP / WA', member.phone || '-'],
    ['Email', member.email || '-'],
    ['Terdaftar', formatDateId(member.joined_at)],
  ];

  let rowY = 296;
  for (const [label, val] of rows) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, infoX, rowY);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`:  ${val}`, infoX + 146, rowY, 354);
    rowY += 38;
  }

  // QR Box bottom right
  const qrBoxX = 796;
  const qrBoxY = 344;
  const qrSize = 172;
  ctx.save();
  drawRoundedRect(ctx, qrBoxX - 12, qrBoxY - 12, qrSize + 24, qrSize + 54, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX, qrBoxY, qrSize, qrSize);
  }
  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN PEMINJAMAN', qrBoxX + qrSize / 2, qrBoxY + qrSize + 14);
  ctx.restore();

  // Footer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, CARD_HEIGHT - 44, CARD_WIDTH, 44);
  ctx.fillStyle = '#bae6fd';
  ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Status Keanggotaan: ${(member.status || 'AKTIF').toUpperCase()}`, 44, CARD_HEIGHT - 22);
  ctx.textAlign = 'right';
  ctx.fillText('Perpustakaan Digital Terpadu', CARD_WIDTH - 44, CARD_HEIGHT - 22);

  drawCardBorder(ctx, CARD_WIDTH, CARD_HEIGHT, '#bae6fd');
  return canvas;
}

export async function renderLibraryCardBackCanvas(
  member: LibraryCardData,
  institution: CardInstitutionInfo
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const qrImg = await generateQrImage(
    buildVerificationUrl({
      ref: member.member_code,
      type: 'KARTU_PERPUSTAKAAN',
    })
  );

  drawCardShell(ctx, CARD_WIDTH, CARD_HEIGHT, '#ffffff');
  drawDecorativePattern(ctx, '#0284c7', CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, CARD_WIDTH, 92);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 92, CARD_WIDTH, 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HAK AKSES & TATA TERTIB E-LIBRARY', 44, 46);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText((institution.short_name || institution.name || 'E-LIBRARY').toUpperCase(), CARD_WIDTH - 44, 46);

  const rules = [
    '1. Kartu ini memberikan hak akses peminjaman koleksi buku fisik serta bacaan E-Book resmi perpustakaan.',
    '2. Peminjam wajib menjaga keutuhan buku dan mengembalikan tepat waktu sesuai tanggal jatuh tempo.',
    '3. Kartu bersifat pribadi dan tidak dapat digunakan oleh orang lain tanpa izin petugas perpustakaan.',
    '4. Jika kartu hilang atau terdapat perubahan data anggota, harap segera menghubungi Pustakawan.',
  ];

  let ruleY = 132;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const r of rules) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ruleY = wrapText(ctx, r, 48, ruleY, CARD_WIDTH - 96, 26, 2) + 10;
  }

  ctx.save();
  drawRoundedRect(ctx, 44, 386, 560, 174, 18);
  ctx.fillStyle = '#f0f9ff';
  ctx.fill();
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('LAYANAN & KONTAK PERPUSTAKAAN', 66, 408);

  ctx.fillStyle = '#334155';
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  wrapText(ctx, institution.address || 'Alamat Perpustakaan Lembaga', 66, 438, 516, 22, 2);
  ctx.fillText(
    `Telp: ${institution.phone || '-'}  •  Email: ${institution.email || '-'}`,
    66,
    492,
    516
  );
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Kode Anggota: ${member.member_code}`, 66, 524);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Dicetak: ${formatDateId(new Date().toISOString())}`, 790, 396);
  ctx.fillText('Pengelola Perpustakaan', 790, 422);

  if (qrImg) {
    ctx.drawImage(qrImg, 742, 444, 96, 96);
  }
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(institution.short_name || institution.name || 'E-Library', 790, 546, 300);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, CARD_HEIGHT - 44, CARD_WIDTH, 44);
  ctx.fillStyle = '#bae6fd';
  ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Anggota: ${member.full_name}`, 44, CARD_HEIGHT - 22);
  ctx.textAlign = 'right';
  ctx.fillText(institution.website_url || institution.email || 'E-Library Card', CARD_WIDTH - 44, CARD_HEIGHT - 22);

  drawCardBorder(ctx, CARD_WIDTH, CARD_HEIGHT, '#bae6fd');
  return canvas;
}

export function combineFrontBackCanvases(
  front: HTMLCanvasElement,
  back: HTMLCanvasElement
): HTMLCanvasElement {
  const padding = 48;
  const gap = 56;
  const combined = document.createElement('canvas');
  combined.width = CARD_WIDTH + padding * 2;
  combined.height = CARD_HEIGHT * 2 + padding * 2 + gap;

  const ctx = combined.getContext('2d')!;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, combined.width, combined.height);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SISI DEPAN', padding, padding - 16);
  ctx.drawImage(front, padding, padding);

  // Dashed cut/fold divider
  const midY = padding + CARD_HEIGHT + gap / 2;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, midY);
  ctx.lineTo(padding + CARD_WIDTH, midY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#475569';
  ctx.fillText('SISI BELAKANG', padding, padding + CARD_HEIGHT + gap - 16);
  ctx.drawImage(back, padding, padding + CARD_HEIGHT + gap);

  return combined;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
