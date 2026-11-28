export interface PwaExportDeviceItem {
  id: string;
  platform: string;
  device_label: string;
  launch_count: number;
  installed_at: string;
  last_seen_at: string;
}

export interface PwaExportUserRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  is_installed: boolean;
  device_count: number;
  platforms: string[];
  devices: PwaExportDeviceItem[];
  first_installed_at: string | null;
  last_seen_at: string | null;
  total_launches: number;
  activity_status: 'ACTIVE' | 'IDLE' | 'STALE' | 'NOT_INSTALLED';
}

export interface PwaExportFilters {
  statusLabel: string;
  roleLabel: string;
  platformLabel: string;
  searchQuery: string;
}

export interface PwaExportSummary {
  totalUsers: number;
  installedUsers: number;
  notInstalledUsers: number;
  adoptionRatePercent: number;
  activeLast14Days: number;
  staleOver30Days: number;
  totalDevices: number;
  roleBreakdown: Array<{
    role: string;
    total: number;
    installed: number;
    percentage: number;
  }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  'android-chrome': 'Android (Chrome)',
  'ios-safari': 'iOS (Safari)',
  'desktop-chromium': 'Desktop (Chrome/Edge)',
  'desktop-safari': 'Desktop (Safari)',
  other: 'Lainnya',
};

const ACTIVITY_LABELS: Record<PwaExportUserRow['activity_status'], string> = {
  ACTIVE: 'Aktif di PWA (≤14 Hari)',
  IDLE: 'Jarang Aktif (15-30 Hari)',
  STALE: 'Lama Tidak Aktif (>30 Hari)',
  NOT_INSTALLED: 'Belum Install',
};

function formatDateId(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function buildFileSlug(filters: PwaExportFilters): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const roleSlug = filters.roleLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const statusSlug = filters.statusLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `monitoring-pwa-${statusSlug}-${roleSlug}-${datePart}`;
}

export async function exportPwaMonitoringToXlsx(params: {
  items: PwaExportUserRow[];
  summary: PwaExportSummary;
  filters: PwaExportFilters;
}): Promise<void> {
  const XLSX = await import('xlsx');
  const { items, summary, filters } = params;

  const userRows = items.map((u, idx) => ({
    No: idx + 1,
    'Nama Lengkap': u.full_name,
    Peran: u.primary_role,
    Email: u.email || '-',
    'No. HP': u.phone || '-',
    'Status PWA': ACTIVITY_LABELS[u.activity_status] || u.activity_status,
    'Jumlah Perangkat': u.device_count,
    Platform:
      u.platforms.length > 0
        ? u.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')
        : '-',
    'Detail Perangkat':
      u.devices.length > 0
        ? u.devices
            .map(
              (d) =>
                `${d.device_label || PLATFORM_LABELS[d.platform] || d.platform} (${d.launch_count}x)`
            )
            .join('; ')
        : '-',
    'Tanggal Install Pertama': formatDateId(u.first_installed_at),
    'Terakhir Aktif di PWA': formatDateId(u.last_seen_at),
    'Total Sesi PWA': u.total_launches,
  }));

  const wsUsers = XLSX.utils.json_to_sheet(
    userRows.length > 0
      ? userRows
      : [{ Keterangan: 'Tidak ada data pengguna sesuai filter yang dipilih.' }]
  );
  wsUsers['!cols'] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 26 },
    { wch: 36 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
  ];

  const filteredInstalled = items.filter((u) => u.is_installed).length;
  const filteredNotInstalled = items.length - filteredInstalled;
  const filteredActive = items.filter((u) => u.activity_status === 'ACTIVE').length;

  const metaRows = [
    { Bagian: 'Filter Aktif', Keterangan: 'Status', Nilai: filters.statusLabel },
    { Bagian: 'Filter Aktif', Keterangan: 'Peran', Nilai: filters.roleLabel },
    { Bagian: 'Filter Aktif', Keterangan: 'Platform', Nilai: filters.platformLabel },
    {
      Bagian: 'Filter Aktif',
      Keterangan: 'Kata Kunci Pencarian',
      Nilai: filters.searchQuery || '(Semua)',
    },
    {
      Bagian: 'Filter Aktif',
      Keterangan: 'Waktu Ekspor',
      Nilai: formatDateId(new Date().toISOString()),
    },
    { Bagian: 'Hasil Filter', Keterangan: 'Total Baris Diekspor', Nilai: items.length },
    { Bagian: 'Hasil Filter', Keterangan: 'Sudah Install (Hasil Filter)', Nilai: filteredInstalled },
    {
      Bagian: 'Hasil Filter',
      Keterangan: 'Belum Install (Hasil Filter)',
      Nilai: filteredNotInstalled,
    },
    { Bagian: 'Hasil Filter', Keterangan: 'Aktif ≤14 Hari (Hasil Filter)', Nilai: filteredActive },
    { Bagian: 'Global SIMMS', Keterangan: 'Total Akun Terdaftar', Nilai: summary.totalUsers },
    { Bagian: 'Global SIMMS', Keterangan: 'Total Sudah Install', Nilai: summary.installedUsers },
    {
      Bagian: 'Global SIMMS',
      Keterangan: 'Tingkat Adopsi Global',
      Nilai: `${summary.adoptionRatePercent}%`,
    },
    { Bagian: 'Global SIMMS', Keterangan: 'Total Perangkat Terpasang', Nilai: summary.totalDevices },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(metaRows);
  wsSummary['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 32 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsUsers, 'Data Pengguna PWA');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan & Filter');

  XLSX.writeFile(wb, `${buildFileSlug(filters)}.xlsx`);
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
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export async function exportPwaMonitoringToPng(params: {
  items: PwaExportUserRow[];
  filters: PwaExportFilters;
}): Promise<void> {
  const { items, filters } = params;
  const MAX_PNG_ROWS = 80;
  const visibleRows = items.slice(0, MAX_PNG_ROWS);
  const hiddenCount = Math.max(0, items.length - visibleRows.length);

  const width = 1400;
  const padX = 44;
  const headerHeight = 142;
  const kpiHeight = 98;
  const tableHeaderHeight = 42;
  const rowHeight = 46;
  const footerHeight = hiddenCount > 0 ? 74 : 52;
  const tableBodyHeight = Math.max(1, visibleRows.length) * rowHeight;
  const height = headerHeight + 22 + kpiHeight + 24 + tableHeaderHeight + tableBodyHeight + footerHeight + 36;

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung rendering kanvas PNG.');

  ctx.scale(dpr, dpr);

  // Latar utama
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Header gradient
  const grad = ctx.createLinearGradient(0, 0, width, headerHeight);
  grad.addColorStop(0, '#064e3b');
  grad.addColorStop(1, '#0f766e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('Laporan Monitoring Instalasi PWA', padX, 50);

  ctx.fillStyle = '#d1fae5';
  ctx.font = '500 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(
    `Diekspor pada ${formatDateId(new Date().toISOString())} • Total hasil filter: ${items.length} pengguna`,
    padX,
    78
  );

  // Filter chips di header (dibatasi agar tidak pernah keluar lebar kanvas)
  const filterChips = [
    `Status: ${filters.statusLabel}`,
    `Peran: ${filters.roleLabel}`,
    `Platform: ${filters.platformLabel}`,
    ...(filters.searchQuery ? [`Cari: "${filters.searchQuery}"`] : []),
  ];
  let chipX = padX;
  const chipY = 96;
  const maxChipRight = width - padX;
  ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (const rawChip of filterChips) {
    const remainingW = maxChipRight - chipX;
    if (remainingW < 80) break;
    const chip = truncateText(ctx, rawChip, remainingW - 22);
    const textW = ctx.measureText(chip).width;
    const boxW = Math.min(remainingW, textW + 22);
    drawRoundedRect(ctx, chipX, chipY, boxW, 28, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(chip, chipX + 11, chipY + 18);
    chipX += boxW + 10;
  }

  // 4 Kartu KPI hasil filter aktif
  const installedCount = items.filter((u) => u.is_installed).length;
  const notInstalledCount = items.length - installedCount;
  const activeCount = items.filter((u) => u.activity_status === 'ACTIVE').length;
  const adoptionPct =
    items.length > 0 ? Math.round((installedCount / items.length) * 1000) / 10 : 0;

  const kpis = [
    { label: 'Total Hasil Filter', value: `${items.length} Akun`, accent: '#0f172a', bg: '#ffffff' },
    {
      label: 'Sudah Install PWA',
      value: `${installedCount} (${adoptionPct}%)`,
      accent: '#047857',
      bg: '#ecfdf5',
    },
    { label: 'Belum Install PWA', value: `${notInstalledCount} Akun`, accent: '#b45309', bg: '#fffbeb' },
    { label: 'Aktif di PWA (≤14 Hari)', value: `${activeCount} Akun`, accent: '#0369a1', bg: '#f0f9ff' },
  ];

  const kpiGap = 16;
  const kpiW = (width - padX * 2 - kpiGap * 3) / 4;
  const kpiY = headerHeight + 22;

  kpis.forEach((k, i) => {
    const x = padX + i * (kpiW + kpiGap);
    drawRoundedRect(ctx, x, kpiY, kpiW, kpiHeight, 16);
    ctx.fillStyle = k.bg;
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(k.label, x + 18, kpiY + 32);

    ctx.fillStyle = k.accent;
    ctx.font = '700 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(k.value, x + 18, kpiY + 70);
  });

  // Tabel Data
  const tableX = padX;
  const tableY = kpiY + kpiHeight + 24;
  const tableW = width - padX * 2;
  const tableTotalH = tableHeaderHeight + tableBodyHeight;

  drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header kolom
  ctx.save();
  drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
  ctx.clip();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(tableX, tableY, tableW, tableHeaderHeight);

  const cols = [
    { label: 'NO', x: tableX + 16, w: 42 },
    { label: 'NAMA PENGGUNA', x: tableX + 62, w: 270 },
    { label: 'PERAN', x: tableX + 340, w: 145 },
    { label: 'STATUS PWA', x: tableX + 495, w: 175 },
    { label: 'PERANGKAT & PLATFORM', x: tableX + 680, w: 300 },
    { label: 'TERAKHIR AKTIF', x: tableX + 990, w: 195 },
    { label: 'SESI', x: tableX + 1195, w: 100 },
  ];

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (const c of cols) {
    ctx.fillText(c.label, c.x, tableY + 26);
  }

  if (visibleRows.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(
      'Tidak ada pengguna yang cocok dengan filter aktif.',
      tableX + 20,
      tableY + tableHeaderHeight + 28
    );
  } else {
    visibleRows.forEach((u, idx) => {
      const y = tableY + tableHeaderHeight + idx * rowHeight;
      if (idx % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(tableX, y, tableW, rowHeight);
      }
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(tableX, y);
      ctx.lineTo(tableX + tableW, y);
      ctx.stroke();

      // No
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(String(idx + 1), cols[0].x, y + 27);

      // Nama & kontak
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(truncateText(ctx, u.full_name, cols[1].w), cols[1].x, y + 21);
      ctx.fillStyle = '#64748b';
      ctx.font = '400 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(truncateText(ctx, u.email || u.phone || '-', cols[1].w), cols[1].x, y + 37);

      // Peran
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(truncateText(ctx, u.primary_role, cols[2].w), cols[2].x, y + 27);

      // Status Pill
      const pillStyle =
        u.activity_status === 'ACTIVE'
          ? { bg: '#d1fae5', fg: '#065f46', text: 'Aktif di PWA' }
          : u.activity_status === 'IDLE'
            ? { bg: '#e0f2fe', fg: '#075985', text: 'Jarang Aktif' }
            : u.activity_status === 'STALE'
              ? { bg: '#fef3c7', fg: '#92400e', text: 'Lama Tidak Aktif' }
              : { bg: '#f1f5f9', fg: '#475569', text: 'Belum Install' };

      ctx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const pillW = Math.min(cols[3].w, ctx.measureText(pillStyle.text).width + 20);
      drawRoundedRect(ctx, cols[3].x, y + 12, pillW, 22, 11);
      ctx.fillStyle = pillStyle.bg;
      ctx.fill();
      ctx.fillStyle = pillStyle.fg;
      ctx.fillText(pillStyle.text, cols[3].x + 10, y + 27);

      // Perangkat & Platform
      const devSummary =
        u.device_count > 0
          ? `${u.device_count} perangkat (${u.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')})`
          : '-';
      ctx.fillStyle = u.device_count > 0 ? '#1e293b' : '#94a3b8';
      ctx.font = '500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(truncateText(ctx, devSummary, cols[4].w), cols[4].x, y + 27);

      // Terakhir aktif
      ctx.fillStyle = '#334155';
      ctx.font = '500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(truncateText(ctx, formatDateId(u.last_seen_at), cols[5].w), cols[5].x, y + 27);

      // Sesi
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(u.total_launches > 0 ? `${u.total_launches}x` : '-', cols[6].x, y + 27);
    });
  }

  ctx.restore();

  // Footer
  const footerY = tableY + tableTotalH + 26;
  if (hiddenCount > 0) {
    ctx.fillStyle = '#b45309';
    ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(
      `Menampilkan ${visibleRows.length} baris pertama dari ${items.length} pengguna (+${hiddenCount} baris lainnya). Gunakan Export XLSX untuk seluruh data lengkap.`,
      padX,
      footerY
    );
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(
    'SIMMS — Sistem Informasi Manajemen Madrasah / Sekolah • Laporan Monitoring Instalasi PWA',
    padX,
    hiddenCount > 0 ? footerY + 22 : footerY
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1)
  );
  if (!blob) throw new Error('Gagal menghasilkan file PNG.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildFileSlug(filters)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
