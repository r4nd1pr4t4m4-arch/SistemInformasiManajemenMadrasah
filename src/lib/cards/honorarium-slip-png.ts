import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { formatRupiah } from '@/lib/domain/honorarium';
import { downloadCanvasAsPng } from './card-png-renderer';
import { buildVerificationUrl } from '@/lib/verification/document-verify';

export interface HonorariumDutyItem {
  id?: string;
  duty_name: string;
  duty_code?: string | null;
  allowance_amount: number;
  is_excluded?: boolean;
}

export interface HonorariumSlipData {
  id: string;
  teacherName: string;
  teacherNip?: string | null;
  homeDistanceKm?: number | null;
  periodMonth: number;
  periodYear: number;
  teachingJtm: number;
  substituteJtm: number;
  examSupervisorJtm: number;
  examCommitteeJtm: number;
  eventJtm: number;
  picketJtm: number;
  ceremonyJtm: number;
  paidHolidayJtm: number;
  totalJtm: number;
  ratePerJtm: number;
  jtmHonorariumAmount: number;
  additionalDutyAllowance: number;
  transportAllowance: number;
  totalAmount: number;
  status: string;
  dutyItems?: HonorariumDutyItem[];
}

const MONTH_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

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

export async function renderHonorariumSlipCanvas(
  data: HonorariumSlipData,
  institutionName = 'SIMMS — Administrasi Keuangan'
): Promise<HTMLCanvasElement> {
  const dutyCount = Math.min(data.dutyItems?.length ?? 0, 5);
  const extraDutyHeight = dutyCount > 0 ? dutyCount * 28 + 16 : 0;
  const width = 920;
  const height = 1320 + extraDutyHeight;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');
  ctx.scale(scale, scale);

  const periodLabel = `${MONTH_NAMES[data.periodMonth] || data.periodMonth} ${data.periodYear}`;
  const refCode = `HON-${data.periodYear}${String(data.periodMonth).padStart(2, '0')}-${data.id
    .slice(0, 6)
    .toUpperCase()}`;
  const isPaid = data.status === 'PAID';

  // Background
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // Main Card
  const cardX = 40;
  const cardY = 40;
  const cardW = width - 80;
  const cardH = height - 80;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Header Banner
  const headerH = 200;
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, headerH, 28);
  ctx.clip();
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, isPaid ? '#047857' : '#0f766e');
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY, cardW, headerH);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(cardX + cardW - 60, cardY + 40, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cardX, cardY + headerH - 28, 28, 28);
  ctx.fillStyle = isPaid ? '#047857' : '#0f766e';
  ctx.fillRect(cardX + cardW - 28, cardY + headerH - 28, 28, 28);

  // Header Text
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(institutionName.toUpperCase(), cardX + 36, cardY + 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('SLIP HONORARIUM & TUNJANGAN GTK', cardX + 36, cardY + 94);

  drawRoundedRect(ctx, cardX + 36, cardY + 120, 210, 34, 17);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`STATUS: ${data.status}`, cardX + 54, cardY + 142);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('PERIODE HONORARIUM', cardX + cardW - 36, cardY + 116);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(periodLabel, cardX + cardW - 36, cardY + 144);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '600 12px ui-monospace, monospace';
  ctx.fillText(refCode, cardX + cardW - 36, cardY + 168);
  ctx.textAlign = 'left';

  // Recipient Info Box
  const infoY = cardY + headerH + 26;
  drawRoundedRect(ctx, cardX + 36, infoY, cardW - 72, 108, 18);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('NAMA PENERIMA (GTK)', cardX + 60, infoY + 32);
  ctx.fillText('TARIF PER JTM', cardX + cardW - 240, infoY + 32);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 21px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.teacherName.slice(0, 34), cardX + 60, infoY + 62);

  ctx.font = '800 19px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#047857';
  ctx.fillText(formatRupiah(Number(data.ratePerJtm) || 0), cardX + cardW - 240, infoY + 62);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  const metaParts = [
    data.teacherNip ? `NIP: ${data.teacherNip}` : null,
    data.homeDistanceKm != null ? `Jarak Rumah: ${data.homeDistanceKm} KM` : null,
  ].filter(Boolean);
  ctx.fillText(
    metaParts.length > 0 ? metaParts.join('  •  ') : 'Pendidik / Tenaga Kependidikan',
    cardX + 60,
    infoY + 90
  );

  // Section A: Rincian Perolehan JTM
  let curY = infoY + 142;
  const rowX = cardX + 36;
  const rowW = cardW - 72;

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('A. RINCIAN PEROLEHAN JAM TATAP MUKA (JTM)', rowX, curY);
  curY += 20;

  const jtmSources: Array<[string, number]> = [
    ['1. Mengajar Reguler', data.teachingJtm],
    ['2. Guru Pengganti (Delegasi)', data.substituteJtm],
    ['3. Pengawas Ruang Ujian', data.examSupervisorJtm],
    ['4. Panitia Ujian', data.examCommitteeJtm],
    ['5. Piket Harian Sekolah/Madrasah', data.picketJtm],
    ['6. Kegiatan & Acara Resmi', data.eventJtm],
    ['7. Upacara Bendera Senin', data.ceremonyJtm],
    ['8. Hari Libur Nasional Berbayar', data.paidHolidayJtm],
  ];

  for (const [label, jtmVal] of jtmSources) {
    const val = Number(jtmVal) || 0;
    const nominal = val * (Number(data.ratePerJtm) || 0);

    ctx.fillStyle = val > 0 ? '#1e293b' : '#94a3b8';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, rowX + 8, curY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = val > 0 ? '#0f172a' : '#94a3b8';
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText(`${val} JTM`, rowX + rowW - 190, curY + 20);
    ctx.fillText(formatRupiah(nominal), rowX + rowW - 8, curY + 20);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rowX, curY + 32);
    ctx.lineTo(rowX + rowW, curY + 32);
    ctx.stroke();
    curY += 38;
  }

  // Subtotal JTM Box
  drawRoundedRect(ctx, rowX, curY + 4, rowW, 46, 12);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Subtotal Honorarium JTM (${data.totalJtm} JTM × ${formatRupiah(data.ratePerJtm)})`,
    rowX + 16,
    curY + 32
  );
  ctx.textAlign = 'right';
  ctx.font = '800 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatRupiah(Number(data.jtmHonorariumAmount) || 0), rowX + rowW - 16, curY + 32);
  ctx.textAlign = 'left';

  curY += 78;

  // Section B: Tunjangan Tugas Tambahan & Transportasi
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('B. TUNJANGAN TUGAS TAMBAHAN & TRANSPORTASI', rowX, curY);
  curY += 24;

  if (data.dutyItems && data.dutyItems.length > 0) {
    for (const item of data.dutyItems.slice(0, 5)) {
      ctx.fillStyle = item.is_excluded ? '#94a3b8' : '#334155';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        `• ${item.duty_name}${item.is_excluded ? ' (Tidak mendapat tunjangan)' : ''}`,
        rowX + 12,
        curY + 14
      );
      ctx.textAlign = 'right';
      ctx.font = '600 14px ui-monospace, monospace';
      ctx.fillText(
        item.is_excluded ? 'Rp 0' : formatRupiah(Number(item.allowance_amount) || 0),
        rowX + rowW - 8,
        curY + 14
      );
      ctx.textAlign = 'left';
      curY += 28;
    }
    curY += 8;
  }

  // Row: Total Tunjangan Tugas Tambahan
  ctx.fillStyle = '#475569';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('Total Tunjangan Tugas Tambahan', rowX + 8, curY + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    formatRupiah(Number(data.additionalDutyAllowance) || 0),
    rowX + rowW - 8,
    curY + 18
  );
  ctx.textAlign = 'left';
  curY += 38;

  // Row: Tunjangan Transportasi
  ctx.fillStyle = '#475569';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('Tunjangan Transportasi (Pembulatan)', rowX + 8, curY + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatRupiah(Number(data.transportAllowance) || 0), rowX + rowW - 8, curY + 18);
  ctx.textAlign = 'left';
  curY += 44;

  // Grand Total Highlight Box
  drawRoundedRect(ctx, rowX, curY, rowW, 66, 16);
  ctx.fillStyle = '#ecfdf5';
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#064e3b';
  ctx.font = '800 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL HONORARIUM DITERIMA', rowX + 20, curY + 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#047857';
  ctx.font = '900 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatRupiah(Number(data.totalAmount) || 0), rowX + rowW - 20, curY + 42);
  ctx.textAlign = 'left';

  // Footer with QR Verification
  const footerY = cardY + cardH - 155;
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cardX + 36, footerY);
  ctx.lineTo(cardX + cardW - 36, footerY);
  ctx.stroke();
  ctx.setLineDash([]);

  const qrPayload = buildVerificationUrl({
    ref: refCode,
    type: 'HONORARIUM',
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 140, margin: 1 });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('Gagal memuat QR code.'));
    qrImg.src = qrDataUrl;
  });

  ctx.drawImage(qrImg, cardX + 36, footerY + 20, 108, 108);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('Slip Honorarium Resmi Terverifikasi', cardX + 164, footerY + 50);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    'Dokumen ini dihasilkan secara elektronik berdasarkan rekap JTM, tugas tambahan,',
    cardX + 164,
    footerY + 76
  );
  ctx.fillText(
    'dan tunjangan transportasi yang tercatat di sistem.',
    cardX + 164,
    footerY + 96
  );
  ctx.fillStyle = '#047857';
  ctx.font = '600 12px ui-monospace, monospace';
  ctx.fillText(`REF: ${refCode}`, cardX + 164, footerY + 122);

  return canvas;
}

function buildFilename(data: HonorariumSlipData, ext: 'png' | 'pdf') {
  const safeName = data.teacherName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `slip-honorarium-${safeName || 'gtk'}-${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}.${ext}`;
}

export async function downloadHonorariumSlipPng(
  data: HonorariumSlipData,
  institutionName?: string
) {
  const canvas = await renderHonorariumSlipCanvas(data, institutionName);
  downloadCanvasAsPng(canvas, buildFilename(data, 'png'));
}

export async function downloadHonorariumSlipPdf(
  data: HonorariumSlipData,
  institutionName?: string
) {
  const canvas = await renderHonorariumSlipCanvas(data, institutionName);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  const aspect = canvas.height / canvas.width;
  let drawW = maxW;
  let drawH = drawW * aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH / aspect;
  }

  const x = (pageWidth - drawW) / 2;
  const y = (pageHeight - drawH) / 2;
  pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
  pdf.save(buildFilename(data, 'pdf'));
}
