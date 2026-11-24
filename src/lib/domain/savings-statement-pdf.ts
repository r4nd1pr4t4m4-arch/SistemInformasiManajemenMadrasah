import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import { formatRupiah } from './honorarium';
import {
  describeSavingsFilterLabel,
  getTodayWibIsoDate,
  type SavingsDatePreset,
  type SavingsTransactionLike,
  type SavingsTypeFilter,
} from './savings-history-filter';

export interface SavingsAccountSummaryForPdf {
  id: string;
  account_number: string;
  owner_type: string;
  owner_name: string;
  balance: number;
  is_active: boolean;
}

function formatDateIdShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatWibPrintTimestamp(): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()) + ' WIB'
  );
}

/**
 * Mengekspor riwayat transaksi tabungan pengguna (semua atau sesuai filter aktif) ke dokumen PDF resmi
 * lengkap dengan QR Code verifikasi keaslian dokumen (/verifikasi).
 */
export async function exportSavingsHistoryToPdf(params: {
  institutionName?: string | null;
  institutionAddress?: string | null;
  ownerDisplayName: string;
  accounts: SavingsAccountSummaryForPdf[];
  selectedAccountId: string; // 'ALL' or account.id
  transactions: SavingsTransactionLike[];
  datePreset: SavingsDatePreset;
  typeFilter: SavingsTypeFilter;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<void> {
  const {
    institutionName,
    institutionAddress,
    ownerDisplayName,
    accounts,
    selectedAccountId,
    transactions,
    datePreset,
    typeFilter,
    customStartDate,
    customEndDate,
  } = params;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const todayIso = getTodayWibIsoDate();

  const selectedAccount =
    selectedAccountId !== 'ALL'
      ? accounts.find((a) => a.id === selectedAccountId) || null
      : accounts.length === 1
        ? accounts[0]
        : null;

  const primaryAccount = selectedAccount || accounts[0] || null;
  const accountIdPrefix = (primaryAccount?.id || '00000000')
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, '0');
  const refCode = `MUT-${accountIdPrefix}-${todayIso.replace(/-/g, '')}-${Date.now()
    .toString(36)
    .toUpperCase()}`;

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const showAccountColumn = accounts.length > 1 && selectedAccountId === 'ALL';

  const { periodLabel, typeLabel, fileSlug } = describeSavingsFilterLabel({
    datePreset,
    typeFilter,
    customStartDate,
    customEndDate,
    todayIso,
  });

  const totalSetor = transactions
    .filter((t) => t.transaction_type === 'SETOR')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalTarik = transactions
    .filter((t) => t.transaction_type === 'TARIK')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalFee = transactions
    .filter((t) => t.transaction_type === 'TARIK')
    .reduce((sum, t) => sum + (Number(t.fee_amount) || 0), 0);

  const totalBalance = selectedAccount
    ? Number(selectedAccount.balance) || 0
    : accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  // Header Banner
  doc.setFillColor(6, 95, 70); // emerald-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RIWAYAT MUTASI REKENING TABUNGAN DIGITAL', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const instLine = institutionName?.trim()
    ? `${institutionName.trim()} — SiM-M`
    : 'SiM-M — Sistem Informasi Manajemen Madrasah & Sekolah';
  doc.text(instLine, 14, 17);
  if (institutionAddress?.trim()) {
    doc.setFontSize(7.5);
    doc.text(institutionAddress.trim().slice(0, 110), 14, 22.5);
  }

  // Metadata Cetak & Ref di sebelah kiri QR Code
  const qrSize = 21;
  const qrX = pageWidth - 14 - qrSize;
  const qrY = 3.5;

  doc.setFontSize(8);
  doc.text(`Dicetak: ${formatWibPrintTimestamp()}`, qrX - 5, 10, { align: 'right' });
  doc.text(`Ref: ${refCode}`, qrX - 5, 15.5, { align: 'right' });
  doc.setFontSize(7);
  doc.text('Scan QR untuk verifikasi keaslian dokumen', qrX - 5, 21, { align: 'right' });

  // QR Code Verifikasi (background putih agar kontras & mudah dipindai)
  try {
    const verifyUrl = buildVerificationUrl({ ref: refCode, type: 'MUTASI_TABUNGAN' });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1.5, 1.5, 'F');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {
    // Abaikan jika gagal merender QR
  }

  // Info Nasabah & Filter Box
  doc.setTextColor(15, 23, 42);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 33, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Pemilik Rekening', 18, 39);
  doc.text('Nomor Rekening', 18, 45);
  doc.text('Saldo Saat Ini', 18, 51);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${selectedAccount?.owner_name || ownerDisplayName}`, 52, 39);
  doc.text(
    `: ${
      selectedAccount
        ? `${selectedAccount.account_number} (${selectedAccount.owner_type})`
        : `Semua Rekening (${accounts.length} rekening)`
    }`,
    52,
    45
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`: ${formatRupiah(totalBalance)}`, 52, 51);

  // Kolom kanan: Filter aktif & Ringkasan mutasi
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Periode Filter', 155, 39);
  doc.text('Jenis Transaksi', 155, 45);
  doc.text('Ringkasan Filter', 155, 51);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${periodLabel}`, 185, 39);
  doc.text(`: ${typeLabel}`, 185, 45);
  doc.text(
    `: Setor ${formatRupiah(totalSetor)} | Tarik ${formatRupiah(totalTarik)}${
      totalFee > 0 ? ` (Fee ${formatRupiah(totalFee)})` : ''
    }`,
    185,
    51
  );

  // Tabel Transaksi
  const headers = showAccountColumn
    ? [
        'No',
        'Tanggal',
        'No. Referensi',
        'No. Rekening',
        'Jenis',
        'Nominal',
        'Fee Tarik',
        'Diterima Bersih',
        'Saldo Akhir',
        'Keterangan',
      ]
    : [
        'No',
        'Tanggal',
        'No. Referensi',
        'Jenis',
        'Nominal',
        'Fee Tarik',
        'Diterima Bersih',
        'Saldo Akhir',
        'Keterangan',
      ];

  const rows = transactions.map((trx, idx) => {
    const isTarik = trx.transaction_type === 'TARIK';
    const acc = accountById.get(trx.account_id);
    const feeText =
      isTarik && Number(trx.fee_amount) > 0 ? `- ${formatRupiah(Number(trx.fee_amount))}` : '-';
    const netText = isTarik ? formatRupiah(Number(trx.net_amount ?? trx.amount) || 0) : '-';

    const baseRow = [
      String(idx + 1),
      formatDateIdShort(trx.transaction_date),
      trx.reference_number || '-',
      ...(showAccountColumn ? [acc?.account_number || '-'] : []),
      trx.transaction_type,
      formatRupiah(Number(trx.amount) || 0),
      feeText,
      netText,
      formatRupiah(Number(trx.balance_after) || 0),
      trx.notes?.trim() || '-',
    ];
    return baseRow;
  });

  const amountColStart = showAccountColumn ? 5 : 4;

  autoTable(doc, {
    startY: 60,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      [amountColStart]: { halign: 'right' },
      [amountColStart + 1]: { halign: 'right' },
      [amountColStart + 2]: { halign: 'right' },
      [amountColStart + 3]: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dokumen elektronik sah SiM-M • Verifikasi QR / Ref: ${refCode}`,
        14,
        pageHeight - 8
      );
      doc.text(
        `Halaman ${hookData.pageNumber} dari ${pageCount}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  const safeAccountSlug = (selectedAccount?.account_number || ownerDisplayName || 'nasabah')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);

  doc.save(`Mutasi_Tabungan_${safeAccountSlug}_${fileSlug}_${todayIso}.pdf`);
}
