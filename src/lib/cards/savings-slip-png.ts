import QRCode from 'qrcode';
import { formatRupiah } from '@/lib/domain/honorarium';
import { downloadCanvasAsPng } from './card-png-renderer';
import { buildVerificationUrl } from '@/lib/verification/document-verify';

export interface SavingsSlipData {
  referenceNumber: string;
  accountNumber: string;
  ownerName: string;
  ownerType?: string | null;
  transactionType: 'SETOR' | 'TARIK';
  amount: number;
  feePercentage?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  balanceAfter: number;
  transactionDate?: string | null;
  notes?: string | null;
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

export async function renderSavingsSlipCanvas(
  data: SavingsSlipData,
  institutionName = 'SIMMS — Tabungan Digital'
): Promise<HTMLCanvasElement> {
  const width = 880;
  const height = 1080;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');
  ctx.scale(scale, scale);

  const isTarik = data.transactionType === 'TARIK';

  // Background
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // Main Slip Card
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
  const headerH = 210;
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, headerH, 28);
  ctx.clip();
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  if (isTarik) {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#92400e');
  } else {
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(1, '#0f766e');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY, cardW, headerH);

  // Decorative circles
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(cardX + cardW - 60, cardY + 40, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + 90, cardY + headerH, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Square off bottom corners of header
  ctx.fillStyle = isTarik ? '#0f172a' : '#064e3b';
  ctx.fillRect(cardX, cardY + headerH - 28, 28, 28);
  ctx.fillStyle = isTarik ? '#92400e' : '#0f766e';
  ctx.fillRect(cardX + cardW - 28, cardY + headerH - 28, 28, 28);

  // Header Text
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(institutionName.toUpperCase(), cardX + 36, cardY + 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isTarik ? 'SLIP PENARIKAN TABUNGAN' : 'SLIP SETORAN TABUNGAN',
    cardX + 36,
    cardY + 98
  );

  // Status Pill
  drawRoundedRect(ctx, cardX + 36, cardY + 124, 190, 34, 17);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('✓  TRANSAKSI BERHASIL', cardX + 54, cardY + 146);

  // Reference & Date on right of header
  const dateLabel = data.transactionDate
    ? new Date(data.transactionDate).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('NO. REFERENSI', cardX + cardW - 36, cardY + 125);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 18px ui-monospace, monospace';
  ctx.fillText(data.referenceNumber, cardX + cardW - 36, cardY + 150);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${dateLabel} WIB`, cardX + cardW - 36, cardY + 174);
  ctx.textAlign = 'left';

  // Account Info Box
  const infoY = cardY + headerH + 30;
  drawRoundedRect(ctx, cardX + 36, infoY, cardW - 72, 118, 18);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('PEMILIK REKENING', cardX + 60, infoY + 34);
  ctx.fillText('NOMOR REKENING', cardX + cardW - 260, infoY + 34);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.ownerName.slice(0, 32), cardX + 60, infoY + 66);

  ctx.font = '700 19px ui-monospace, monospace';
  ctx.fillText(data.accountNumber, cardX + cardW - 260, infoY + 66);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Kategori Nasabah: ${data.ownerType || 'UMUM'}`, cardX + 60, infoY + 96);

  // Transaction Breakdown Rows
  let curY = infoY + 156;
  const rowX = cardX + 36;
  const rowW = cardW - 72;

  const drawRow = (
    label: string,
    value: string,
    opts?: { valueColor?: string; bold?: boolean; highlightBg?: string }
  ) => {
    if (opts?.highlightBg) {
      drawRoundedRect(ctx, rowX, curY - 12, rowW, 56, 14);
      ctx.fillStyle = opts.highlightBg;
      ctx.fill();
    }
    ctx.fillStyle = opts?.bold ? '#0f172a' : '#475569';
    ctx.font = `${opts?.bold ? '700' : '600'} 16px system-ui, -apple-system, sans-serif`;
    ctx.fillText(label, rowX + (opts?.highlightBg ? 18 : 4), curY + 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = opts?.valueColor || '#0f172a';
    ctx.font = `${opts?.bold ? '800 22px' : '700 17px'} system-ui, -apple-system, sans-serif`;
    ctx.fillText(value, rowX + rowW - (opts?.highlightBg ? 18 : 4), curY + 23);
    ctx.textAlign = 'left';

    if (!opts?.highlightBg) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rowX, curY + 42);
      ctx.lineTo(rowX + rowW, curY + 42);
      ctx.stroke();
    }
    curY += opts?.highlightBg ? 68 : 54;
  };

  drawRow(
    isTarik ? 'Nominal Penarikan Saldo' : 'Nominal Setoran Tabungan',
    formatRupiah(Number(data.amount) || 0)
  );

  if (isTarik) {
    const feeAmt = Number(data.feeAmount) || 0;
    const feePct = Number(data.feePercentage) || 0;
    const netAmt = Number(data.netAmount ?? data.amount - feeAmt);

    drawRow(
      `Potongan Fee Transaksi (${feePct}%)`,
      feeAmt > 0 ? `- ${formatRupiah(feeAmt)}` : 'Rp 0',
      { valueColor: feeAmt > 0 ? '#e11d48' : '#475569' }
    );

    drawRow('Nominal Uang Diterima Bersih', formatRupiah(netAmt), {
      valueColor: '#047857',
      bold: true,
      highlightBg: '#ecfdf5',
    });
  } else {
    drawRow('Nominal Masuk ke Rekening', formatRupiah(Number(data.amount) || 0), {
      valueColor: '#047857',
      bold: true,
      highlightBg: '#ecfdf5',
    });
  }

  drawRow('Saldo Rekening Setelah Transaksi', formatRupiah(Number(data.balanceAfter) || 0), {
    valueColor: '#0f172a',
    bold: true,
  });

  if (data.notes) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Catatan: ${data.notes.slice(0, 72)}`, rowX + 4, curY + 18);
  }

  // Footer with QR Verification
  const footerY = cardY + cardH - 165;
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cardX + 36, footerY);
  ctx.lineTo(cardX + cardW - 36, footerY);
  ctx.stroke();
  ctx.setLineDash([]);

  const qrPayload = buildVerificationUrl({
    ref: data.referenceNumber,
    type: 'TABUNGAN',
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 140, margin: 1 });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('Gagal memuat QR code.'));
    qrImg.src = qrDataUrl;
  });

  ctx.drawImage(qrImg, cardX + 36, footerY + 22, 112, 112);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('Bukti Transaksi Digital Terverifikasi', cardX + 168, footerY + 54);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    'Slip ini diterbitkan secara otomatis oleh Sistem Tabungan Digital',
    cardX + 168,
    footerY + 80
  );
  ctx.fillText(
    'dan sah digunakan sebagai bukti resmi setoran maupun penarikan.',
    cardX + 168,
    footerY + 100
  );
  ctx.fillStyle = '#0f766e';
  ctx.font = '600 12px ui-monospace, monospace';
  ctx.fillText(`REF: ${data.referenceNumber}`, cardX + 168, footerY + 126);

  return canvas;
}

export async function downloadSavingsSlipPng(
  data: SavingsSlipData,
  institutionName?: string
) {
  const canvas = await renderSavingsSlipCanvas(data, institutionName);
  const typeSlug = data.transactionType === 'TARIK' ? 'tarik' : 'setor';
  const safeRef = data.referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  downloadCanvasAsPng(canvas, `slip-tabungan-${typeSlug}-${safeRef}.png`);
}
