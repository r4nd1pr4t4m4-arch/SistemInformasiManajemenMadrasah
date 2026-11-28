'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface BudgetRow {
  id: string;
  fiscal_year: number;
  is_archived?: boolean;
  funding_source: string;
  code: string;
  name: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  absorption_pct: number;
}

interface CashbookRow {
  id: string;
  entry_date: string;
  fiscal_year?: number;
  is_archived?: boolean;
  entry_type: 'MASUK' | 'KELUAR';
  funding_source: string;
  category: string;
  description: string;
  amount: number;
  reference_no: string | null;
  receipt_url: string | null;
  budget?: { id?: string; code: string; name: string; fiscal_year?: number } | null;
}

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-700 mb-1';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function getTodayWibIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function getCurrentWibYear(): number {
  const parsed = Number(getTodayWibIso().slice(0, 4));
  return Number.isFinite(parsed) && parsed >= 2020 ? parsed : new Date().getFullYear();
}

function isSafeReceiptUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('/');
}

export default function KasRkasPage() {
  const [tab, setTab] = useState<'BKU' | 'RKAS'>('BKU');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CashbookRow | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentFiscalYear, setCurrentFiscalYear] = useState<number>(() => getCurrentWibYear());
  const [availableFiscalYears, setAvailableFiscalYears] = useState<number[]>(() => [
    getCurrentWibYear(),
  ]);
  const [archivedYears, setArchivedYears] = useState<number[]>([]);

  // Filter aktif (default: hanya tahun anggaran berjalan; tahun sebelumnya masuk arsip)
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('ACTIVE');
  const [fundingSourceFilter, setFundingSourceFilter] = useState<string>('ALL');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [entries, setEntries] = useState<CashbookRow[]>([]);

  const [bkuForm, setBkuForm] = useState(() => ({
    entry_date: getTodayWibIso(),
    entry_type: 'KELUAR' as 'MASUK' | 'KELUAR',
    funding_source: 'BOS' as 'BOS' | 'KOMITE' | 'YAYASAN' | 'LAINNYA',
    budget_plan_id: '',
    category: 'Operasional',
    description: '',
    amount: 0,
    reference_no: '',
    receipt_url: '',
  }));

  const [rkasForm, setRkasForm] = useState(() => ({
    fiscal_year: getCurrentWibYear(),
    funding_source: 'BOS' as 'BOS' | 'KOMITE' | 'YAYASAN' | 'LAINNYA',
    code: '',
    name: '',
    allocated_amount: 0,
    notes: '',
  }));

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmDeleteEntry) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingId) setConfirmDeleteEntry(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteEntry, deletingId]);

  const loadData = useCallback(async (targetFiscalYear: string = fiscalYearFilter) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const qs = `?fiscalYear=${encodeURIComponent(targetFiscalYear)}`;
      const res = await fetch(`/api/keuangan/kas-rkas${qs}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        if (typeof data.currentFiscalYear === 'number') {
          setCurrentFiscalYear(data.currentFiscalYear);
        }
        if (Array.isArray(data.availableFiscalYears)) {
          setAvailableFiscalYears(data.availableFiscalYears);
        }
        if (Array.isArray(data.archivedYears)) {
          setArchivedYears(data.archivedYears);
        }
        setBudgets(Array.isArray(data.budgets) ? data.budgets : []);
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      } else {
        setLoadError(data.error || 'Gagal memuat data Buku Kas Umum & RKAS.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat data kas.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fiscalYearFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData(fiscalYearFilter);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fiscalYearFilter, loadData]);

  // Pos RKAS pada formulir BKU disesuaikan dengan tahun tanggal transaksi BKU
  const bkuEntryYear = useMemo(() => {
    const parsed = Number(String(bkuForm.entry_date || '').slice(0, 4));
    return Number.isFinite(parsed) && parsed >= 2000 ? parsed : currentFiscalYear;
  }, [bkuForm.entry_date, currentFiscalYear]);

  const bkuBudgetOptions = useMemo(
    () => budgets.filter((b) => b.fiscal_year === bkuEntryYear),
    [budgets, bkuEntryYear]
  );

  const futureFiscalYears = useMemo(
    () => availableFiscalYears.filter((yr) => yr > currentFiscalYear),
    [availableFiscalYears, currentFiscalYear]
  );

  // Filter sisi klien (Sumber Dana, Jenis Transaksi, Kata Kunci) di atas data tahun anggaran terpilih
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (fundingSourceFilter !== 'ALL' && e.funding_source !== fundingSourceFilter) return false;
      if (entryTypeFilter !== 'ALL' && e.entry_type !== entryTypeFilter) return false;
      if (!q) return true;
      return (
        (e.description || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.reference_no || '').toLowerCase().includes(q) ||
        (e.funding_source || '').toLowerCase().includes(q) ||
        (e.budget?.code || '').toLowerCase().includes(q) ||
        (e.budget?.name || '').toLowerCase().includes(q)
      );
    });
  }, [entries, fundingSourceFilter, entryTypeFilter, searchQuery]);

  const filteredBudgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return budgets.filter((b) => {
      if (fundingSourceFilter !== 'ALL' && b.funding_source !== fundingSourceFilter) return false;
      if (!q) return true;
      return (
        (b.code || '').toLowerCase().includes(q) ||
        (b.name || '').toLowerCase().includes(q) ||
        (b.funding_source || '').toLowerCase().includes(q) ||
        String(b.fiscal_year).includes(q)
      );
    });
  }, [budgets, fundingSourceFilter, searchQuery]);

  // Ringkasan kas & pagu mengikuti filter aktif
  const filteredSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const e of filteredEntries) {
      const amt = Number(e.amount || 0);
      if (e.entry_type === 'MASUK') totalIn += amt;
      else totalOut += amt;
    }
    const totalBudget = filteredBudgets.reduce((s, b) => s + Number(b.allocated_amount || 0), 0);
    return {
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
      totalBudget,
    };
  }, [filteredEntries, filteredBudgets]);

  const isViewingArchive = useMemo(() => {
    if (fiscalYearFilter === 'ARCHIVE') return true;
    const yr = Number(fiscalYearFilter);
    return Number.isInteger(yr) && yr < currentFiscalYear;
  }, [fiscalYearFilter, currentFiscalYear]);

  const activePeriodLabel = useMemo(() => {
    if (fiscalYearFilter === 'ACTIVE') return `Tahun Anggaran ${currentFiscalYear} (Aktif)`;
    if (fiscalYearFilter === 'ARCHIVE') return `Semua Arsip (< ${currentFiscalYear})`;
    if (fiscalYearFilter === 'ALL') return 'Semua Tahun (Aktif + Arsip)';
    const yr = Number(fiscalYearFilter);
    if (Number.isInteger(yr)) {
      return yr < currentFiscalYear
        ? `Arsip Tahun Anggaran ${yr}`
        : `Tahun Anggaran ${yr}`;
    }
    return `Tahun Anggaran ${currentFiscalYear}`;
  }, [fiscalYearFilter, currentFiscalYear]);

  const hasActiveFilter =
    fiscalYearFilter !== 'ACTIVE' ||
    fundingSourceFilter !== 'ALL' ||
    entryTypeFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  function resetAllFilters() {
    setFiscalYearFilter('ACTIVE');
    setFundingSourceFilter('ALL');
    setEntryTypeFilter('ALL');
    setSearchQuery('');
  }

  async function handleAddBku(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/keuangan/kas-rkas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_CASHBOOK',
          ...bkuForm,
          budget_plan_id: bkuForm.budget_plan_id || null,
          amount: Number(bkuForm.amount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal mencatat BKU.', 'err');
      else {
        const entryYear = Number(bkuForm.entry_date.slice(0, 4));
        const archivedHint =
          entryYear < currentFiscalYear
            ? ` (masuk kategori Arsip Tahun ${entryYear})`
            : '';
        showToast(`Transaksi Buku Kas Umum berhasil dicatat${archivedHint}.`);
        setBkuForm((p) => ({ ...p, description: '', amount: 0, reference_no: '', receipt_url: '' }));
        await loadData(fiscalYearFilter);
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mencatat BKU.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRkas(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/keuangan/kas-rkas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BUDGET',
          ...rkasForm,
          fiscal_year: Number(rkasForm.fiscal_year),
          allocated_amount: Number(rkasForm.allocated_amount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.error || 'Gagal menambah pos anggaran.', 'err');
      else {
        const archivedHint =
          Number(rkasForm.fiscal_year) < currentFiscalYear
            ? ` (masuk kategori Arsip Tahun ${rkasForm.fiscal_year})`
            : '';
        showToast(`Pos anggaran BOS/RKAS berhasil ditambahkan${archivedHint}.`);
        setRkasForm((p) => ({ ...p, code: '', name: '', allocated_amount: 0, notes: '' }));
        await loadData(fiscalYearFilter);
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menambah pos anggaran.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry: CashbookRow) {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      const res = await fetch(
        `/api/keuangan/kas-rkas?id=${encodeURIComponent(entry.id)}&target=entry`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmDeleteEntry(null);
        showToast('Entri Buku Kas Umum berhasil dihapus.');
        await loadData(fiscalYearFilter);
      } else {
        showToast(data.error || 'Gagal menghapus entri BKU.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menghapus entri BKU.', 'err');
    } finally {
      setDeletingId(null);
    }
  }

  function handleExportExcel() {
    const bkuRows = filteredEntries.map((e) => [
      e.entry_date,
      e.fiscal_year || Number(e.entry_date.slice(0, 4)),
      e.entry_type,
      e.funding_source,
      e.category,
      e.description,
      e.budget ? `${e.budget.code} - ${e.budget.name}` : '-',
      e.entry_type === 'MASUK' ? Number(e.amount) : 0,
      e.entry_type === 'KELUAR' ? Number(e.amount) : 0,
      e.reference_no || '-',
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([
      [
        'Tanggal',
        'Tahun Anggaran',
        'Jenis',
        'Sumber Dana',
        'Kategori',
        'Uraian',
        'Pos RKAS',
        'Debet (Masuk)',
        'Kredit (Keluar)',
        'No. Bukti',
      ],
      ...bkuRows,
    ]);
    const rkasRows = filteredBudgets.map((b) => [
      b.fiscal_year,
      b.is_archived ? 'Arsip' : 'Aktif',
      b.funding_source,
      b.code,
      b.name,
      Number(b.allocated_amount),
      Number(b.spent_amount),
      Number(b.remaining_amount),
      `${b.absorption_pct}%`,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Tahun', 'Status', 'Sumber Dana', 'Kode', 'Pos Anggaran', 'Pagu', 'Realisasi', 'Sisa', 'Serapan'],
      ...rkasRows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Buku Kas Umum');
    XLSX.utils.book_append_sheet(wb, ws2, 'Realisasi RKAS');
    const yearSlug =
      fiscalYearFilter === 'ACTIVE' ? String(currentFiscalYear) : fiscalYearFilter.toLowerCase();
    XLSX.writeFile(wb, `Laporan_BKU_RKAS_${yearSlug}_${getTodayWibIso()}.xlsx`);
  }

  async function handleExportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const printedAt = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Header Laporan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('LAPORAN BUKU KAS UMUM (BKU) & REALISASI ANGGARAN BOS / RKAS', 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const filterParts = [
        `Periode: ${activePeriodLabel}`,
        `Sumber Dana: ${fundingSourceFilter === 'ALL' ? 'Semua' : fundingSourceFilter}`,
        `Jenis Transaksi: ${
          entryTypeFilter === 'ALL'
            ? 'Semua'
            : entryTypeFilter === 'MASUK'
            ? 'Kas Masuk'
            : 'Kas Keluar'
        }`,
      ];
      if (searchQuery.trim()) {
        filterParts.push(`Kata Kunci: "${searchQuery.trim()}"`);
      }
      doc.text(filterParts.join('  |  '), 14, 20);
      doc.text(`Dicetak: ${printedAt} WIB`, pageWidth - 14, 20, { align: 'right' });

      // Ringkasan Keuangan (sesuai filter aktif)
      autoTable(doc, {
        startY: 24,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold' },
        head: [['Total Kas Masuk', 'Total Kas Keluar', 'Saldo Kas (Surplus/Defisit)', 'Total Pagu RKAS / BOS']],
        body: [
          [
            formatRupiah(filteredSummary.totalIn),
            formatRupiah(filteredSummary.totalOut),
            formatRupiah(filteredSummary.balance),
            formatRupiah(filteredSummary.totalBudget),
          ],
        ],
      });

      const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 42;

      // Bagian 1: Buku Kas Umum (BKU)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`1. Buku Kas Umum (${filteredEntries.length} transaksi)`, 14, afterSummaryY + 7);

      autoTable(doc, {
        startY: afterSummaryY + 10,
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 16 },
          2: { cellWidth: 20 },
          3: { cellWidth: 26 },
          6: { halign: 'right', cellWidth: 30 },
          7: { halign: 'right', cellWidth: 30 },
        },
        head: [['Tanggal', 'Jenis', 'Sumber', 'Kategori', 'Uraian & Pos RKAS', 'No. Bukti', 'Debet (Masuk)', 'Kredit (Keluar)']],
        body:
          filteredEntries.length > 0
            ? [
                ...filteredEntries.map((e) => [
                  e.entry_date,
                  e.entry_type,
                  e.funding_source,
                  e.category,
                  e.budget ? `${e.description}\n[RKAS: ${e.budget.code} - ${e.budget.name}]` : e.description,
                  e.reference_no || '-',
                  e.entry_type === 'MASUK' ? formatRupiah(Number(e.amount)) : '-',
                  e.entry_type === 'KELUAR' ? formatRupiah(Number(e.amount)) : '-',
                ]),
                [
                  '',
                  '',
                  '',
                  '',
                  'TOTAL',
                  '',
                  formatRupiah(filteredSummary.totalIn),
                  formatRupiah(filteredSummary.totalOut),
                ],
              ]
            : [['-', '-', '-', '-', 'Tidak ada data transaksi BKU sesuai filter aktif.', '-', '-', '-']],
      });

      const afterBkuY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 100;
      const rkasStartY = afterBkuY + 10 > doc.internal.pageSize.getHeight() - 35 ? (doc.addPage(), 16) : afterBkuY + 10;

      // Bagian 2: Anggaran BOS & RKAS
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`2. Realisasi Anggaran BOS & RKAS (${filteredBudgets.length} pos anggaran)`, 14, rkasStartY);

      const totalSpent = filteredBudgets.reduce((s, b) => s + Number(b.spent_amount || 0), 0);
      const totalRemaining = filteredBudgets.reduce((s, b) => s + Number(b.remaining_amount || 0), 0);
      const overallPct =
        filteredSummary.totalBudget > 0
          ? Math.min(100, Math.round((totalSpent / filteredSummary.totalBudget) * 100))
          : 0;

      autoTable(doc, {
        startY: rkasStartY + 3,
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 22 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 32 },
          6: { halign: 'right', cellWidth: 32 },
          7: { halign: 'center', cellWidth: 20 },
        },
        head: [['Tahun', 'Sumber Dana', 'Kode', 'Nama Pos Anggaran', 'Pagu', 'Realisasi', 'Sisa', 'Serapan']],
        body:
          filteredBudgets.length > 0
            ? [
                ...filteredBudgets.map((b) => [
                  String(b.fiscal_year),
                  b.funding_source,
                  b.code,
                  b.name,
                  formatRupiah(Number(b.allocated_amount)),
                  formatRupiah(Number(b.spent_amount)),
                  formatRupiah(Number(b.remaining_amount)),
                  `${b.absorption_pct}%`,
                ]),
                [
                  '',
                  '',
                  '',
                  'TOTAL ANGGARAN',
                  formatRupiah(filteredSummary.totalBudget),
                  formatRupiah(totalSpent),
                  formatRupiah(totalRemaining),
                  `${overallPct}%`,
                ],
              ]
            : [['-', '-', '-', 'Tidak ada data pos anggaran BOS/RKAS sesuai filter aktif.', '-', '-', '-', '-']],
      });

      // Nomor halaman di footer setiap halaman
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `SIMMS — Buku Kas Umum & RKAS (${activePeriodLabel})`,
          14,
          doc.internal.pageSize.getHeight() - 7
        );
        doc.text(
          `Halaman ${i} / ${totalPages}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 7,
          { align: 'right' }
        );
      }

      const yearSlug =
        fiscalYearFilter === 'ACTIVE' ? String(currentFiscalYear) : fiscalYearFilter.toLowerCase();
      doc.save(`Laporan_BKU_RKAS_${yearSlug}_${getTodayWibIso()}.pdf`);
      showToast('Laporan PDF Buku Kas Umum & RKAS berhasil diunduh.');
    } catch {
      showToast('Gagal mengekspor laporan PDF. Silakan coba lagi.', 'err');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-w-0">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Ringkasan Arus Kas (mengikuti filter aktif) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Kas Masuk</p>
          <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5 tabular-nums">
            {formatRupiah(filteredSummary.totalIn)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Kas Keluar</p>
          <p className="text-base sm:text-lg font-black text-rose-600 mt-0.5 tabular-nums">
            {formatRupiah(filteredSummary.totalOut)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Saldo Kas (Surplus/Defisit)</p>
          <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5 tabular-nums">
            {formatRupiah(filteredSummary.balance)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Pagu RKAS / BOS</p>
          <p className="text-base sm:text-lg font-black text-indigo-700 mt-0.5 tabular-nums">
            {formatRupiah(filteredSummary.totalBudget)}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Buku Kas Umum (BKU) &amp; Anggaran BOS / RKAS</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan arus kas masuk/keluar operasional, serapan anggaran BOS/RKAS per tahun anggaran, dan ekspor laporan keuangan formal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || exportingPdf}
              onClick={() => void handleExportPdf()}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Ekspor PDF</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleExportExcel}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor XLSX</span>
            </button>
            <button
              type="button"
              onClick={() => void loadData(fiscalYearFilter)}
              aria-label="Segarkan data kas dan RKAS"
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabulasi */}
        <div
          role="tablist"
          aria-label="Menu Buku Kas Umum dan RKAS"
          className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3 -mx-1 px-1 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'BKU'}
            onClick={() => setTab('BKU')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              tab === 'BKU'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" /> Buku Kas Umum ({filteredEntries.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'RKAS'}
            onClick={() => setTab('RKAS')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              tab === 'RKAS'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 shrink-0" /> Anggaran BOS &amp; RKAS ({filteredBudgets.length})
          </button>
        </div>

        {/* Toolbar Filter Tahun Anggaran (termasuk Arsip), Sumber Dana, Jenis, & Pencarian */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-3 min-w-0">
            <label htmlFor="filter-fiscal-year" className={LABEL_CLASS}>
              Tahun Anggaran / Arsip
            </label>
            <select
              id="filter-fiscal-year"
              value={fiscalYearFilter}
              onChange={(e) => setFiscalYearFilter(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="ACTIVE">Tahun Aktif ({currentFiscalYear})</option>
              {futureFiscalYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Tahun Anggaran {yr}
                </option>
              ))}
              {archivedYears.length > 0 && (
                <optgroup label="Arsip Tahun Sebelumnya">
                  <option value="ARCHIVE">Semua Arsip (&lt; {currentFiscalYear})</option>
                  {archivedYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Arsip Tahun {yr}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="ALL">Semua Tahun (Aktif + Arsip)</option>
            </select>
          </div>

          <div className="lg:col-span-2 min-w-0">
            <label htmlFor="filter-funding-source" className={LABEL_CLASS}>
              Sumber Dana
            </label>
            <select
              id="filter-funding-source"
              value={fundingSourceFilter}
              onChange={(e) => setFundingSourceFilter(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="ALL">Semua Sumber</option>
              <option value="BOS">Dana BOS</option>
              <option value="KOMITE">Dana Komite</option>
              <option value="YAYASAN">Dana Yayasan</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>

          {tab === 'BKU' && (
            <div className="lg:col-span-2 min-w-0">
              <label htmlFor="filter-entry-type" className={LABEL_CLASS}>
                Jenis Transaksi
              </label>
              <select
                id="filter-entry-type"
                value={entryTypeFilter}
                onChange={(e) => setEntryTypeFilter(e.target.value as 'ALL' | 'MASUK' | 'KELUAR')}
                className={INPUT_CLASS}
              >
                <option value="ALL">Semua Jenis</option>
                <option value="MASUK">Kas Masuk</option>
                <option value="KELUAR">Kas Keluar</option>
              </select>
            </div>
          )}

          <div className={`${tab === 'BKU' ? 'lg:col-span-5' : 'lg:col-span-7'} min-w-0`}>
            <label htmlFor="filter-search-kas" className={LABEL_CLASS}>
              Pencarian
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="filter-search-kas"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    tab === 'BKU'
                      ? 'Cari uraian, kategori, no. bukti, atau pos RKAS...'
                      : 'Cari kode atau nama pos anggaran...'
                  }
                  className={`${INPUT_CLASS} pl-9`}
                />
              </div>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  title="Reset filter ke tahun aktif"
                  aria-label="Reset filter"
                  className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shrink-0 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner Informasi Mode Arsip */}
        {isViewingArchive && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Menampilkan data <strong>{activePeriodLabel}</strong>. Data tahun sebelumnya tersimpan sebagai arsip dan tidak ditampilkan secara default.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFiscalYearFilter('ACTIVE')}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 transition"
            >
              Kembali ke Tahun Aktif ({currentFiscalYear})
            </button>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadData(fiscalYearFilter)}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {tab === 'BKU' ? (
          <div className="space-y-4 text-xs">
            {/* Formulir Tambah Buku Kas Umum */}
            <form
              onSubmit={handleAddBku}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Tambah Transaksi Buku Kas Umum</h2>
                <span className="text-[11px] font-semibold text-slate-500">
                  Melekat pada Tahun Anggaran: <strong className="text-emerald-700">{bkuEntryYear}</strong>
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="bku-entry-date" className={LABEL_CLASS}>
                    Tanggal Transaksi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="bku-entry-date"
                    type="date"
                    required
                    value={bkuForm.entry_date}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      const nextYr = Number(nextDate.slice(0, 4));
                      setBkuForm((prev) => ({
                        ...prev,
                        entry_date: nextDate,
                        budget_plan_id:
                          prev.budget_plan_id &&
                          !budgets.some(
                            (b) => b.id === prev.budget_plan_id && b.fiscal_year === nextYr
                          )
                            ? ''
                            : prev.budget_plan_id,
                      }));
                    }}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="bku-entry-type" className={LABEL_CLASS}>
                    Jenis Transaksi <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="bku-entry-type"
                    value={bkuForm.entry_type}
                    onChange={(e) =>
                      setBkuForm({ ...bkuForm, entry_type: e.target.value as 'MASUK' | 'KELUAR' })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="KELUAR">Kas Keluar (Pengeluaran)</option>
                    <option value="MASUK">Kas Masuk (Penerimaan)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bku-funding-source" className={LABEL_CLASS}>
                    Sumber Dana <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="bku-funding-source"
                    value={bkuForm.funding_source}
                    onChange={(e) =>
                      setBkuForm({
                        ...bkuForm,
                        funding_source: e.target.value as typeof bkuForm.funding_source,
                      })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="BOS">Dana BOS</option>
                    <option value="KOMITE">Dana Komite</option>
                    <option value="YAYASAN">Dana Yayasan</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bku-budget-plan" className={LABEL_CLASS}>
                    Pos Anggaran RKAS (Opsional)
                  </label>
                  <select
                    id="bku-budget-plan"
                    value={bkuForm.budget_plan_id}
                    onChange={(e) => setBkuForm({ ...bkuForm, budget_plan_id: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Tidak Dikaitkan ke Pos RKAS --</option>
                    {bkuBudgetOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name} ({b.fiscal_year})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="bku-category" className={LABEL_CLASS}>
                    Kategori <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="bku-category"
                    required
                    value={bkuForm.category}
                    onChange={(e) => setBkuForm({ ...bkuForm, category: e.target.value })}
                    placeholder="ATK, Listrik, Honor..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bku-description" className={LABEL_CLASS}>
                    Uraian Transaksi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="bku-description"
                    required
                    value={bkuForm.description}
                    onChange={(e) => setBkuForm({ ...bkuForm, description: e.target.value })}
                    placeholder="Tuliskan keterangan transaksi..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="bku-amount" className={LABEL_CLASS}>
                    Nominal (Rp) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="bku-amount"
                    type="number"
                    required
                    min={1}
                    value={bkuForm.amount}
                    onChange={(e) => setBkuForm({ ...bkuForm, amount: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="bku-reference-no" className={LABEL_CLASS}>
                    No. Kwitansi / Bukti (Opsional)
                  </label>
                  <input
                    id="bku-reference-no"
                    value={bkuForm.reference_no}
                    onChange={(e) => setBkuForm({ ...bkuForm, reference_no: e.target.value })}
                    placeholder="Mis. KW-2026-001"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bku-receipt-url" className={LABEL_CLASS}>
                    URL Foto Nota / Bukti (Opsional)
                  </label>
                  <input
                    id="bku-receipt-url"
                    type="url"
                    value={bkuForm.receipt_url}
                    onChange={(e) => setBkuForm({ ...bkuForm, receipt_url: e.target.value })}
                    placeholder="https://..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Catat BKU
                  </button>
                </div>
              </div>
            </form>

            {/* Daftar Transaksi BKU */}
            {filteredEntries.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-1.5">
                <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-sm">
                  Belum ada transaksi Buku Kas Umum untuk {activePeriodLabel}.
                </p>
                {archivedYears.length > 0 && fiscalYearFilter === 'ACTIVE' && (
                  <p className="text-[11px] text-slate-500">
                    Data tahun sebelumnya tersimpan pada filter <strong>Arsip Tahun Sebelumnya</strong>.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntries.map((e) => (
                  <div
                    key={e.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            e.entry_type === 'MASUK'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {e.entry_type}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {e.funding_source} • {e.category}
                        </span>
                        <span className="text-[11px] text-slate-400">{e.entry_date}</span>
                        {e.is_archived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                            <Archive className="w-3 h-3" /> Arsip {e.fiscal_year}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">{e.description}</p>
                      {e.budget && (
                        <p className="text-[11px] text-indigo-700">
                          Pos RKAS: {e.budget.code} — {e.budget.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold text-sm tabular-nums ${
                          e.entry_type === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {e.entry_type === 'MASUK' ? '+' : '-'}
                        {formatRupiah(Number(e.amount))}
                      </span>
                      {isSafeReceiptUrl(e.receipt_url) && (
                        <a
                          href={e.receipt_url!.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                        >
                          Nota <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === e.id}
                        onClick={() => setConfirmDeleteEntry(e)}
                        aria-label={`Hapus transaksi ${e.description}`}
                        title="Hapus transaksi BKU"
                        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                      >
                        {deletingId === e.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Formulir Tambah Anggaran BOS & RKAS */}
            <form
              onSubmit={handleAddRkas}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
            >
              <h2 className="text-sm font-bold text-slate-900">Tambah Pos Anggaran BOS &amp; RKAS</h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label htmlFor="rkas-fiscal-year" className={LABEL_CLASS}>
                    Tahun Anggaran <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rkas-fiscal-year"
                    type="number"
                    required
                    min={2020}
                    max={2100}
                    value={rkasForm.fiscal_year}
                    onChange={(e) =>
                      setRkasForm({ ...rkasForm, fiscal_year: Number(e.target.value) || currentFiscalYear })
                    }
                    placeholder={String(currentFiscalYear)}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="rkas-funding-source" className={LABEL_CLASS}>
                    Sumber Dana <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="rkas-funding-source"
                    value={rkasForm.funding_source}
                    onChange={(e) =>
                      setRkasForm({
                        ...rkasForm,
                        funding_source: e.target.value as typeof rkasForm.funding_source,
                      })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="BOS">BOS</option>
                    <option value="KOMITE">KOMITE</option>
                    <option value="YAYASAN">YAYASAN</option>
                    <option value="LAINNYA">LAINNYA</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rkas-code" className={LABEL_CLASS}>
                    Kode Pos Anggaran <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rkas-code"
                    required
                    value={rkasForm.code}
                    onChange={(e) => setRkasForm({ ...rkasForm, code: e.target.value })}
                    placeholder="Mis. 01.02"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="rkas-name" className={LABEL_CLASS}>
                    Nama Pos Anggaran <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rkas-name"
                    required
                    value={rkasForm.name}
                    onChange={(e) => setRkasForm({ ...rkasForm, name: e.target.value })}
                    placeholder="Nama kegiatan / pos"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="rkas-allocated-amount" className={LABEL_CLASS}>
                    Pagu Anggaran (Rp) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rkas-allocated-amount"
                    type="number"
                    required
                    min={0}
                    value={rkasForm.allocated_amount}
                    onChange={(e) =>
                      setRkasForm({ ...rkasForm, allocated_amount: Number(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Tambah Pos
                  </button>
                </div>
              </div>
            </form>

            {/* Daftar Pos Anggaran RKAS */}
            {filteredBudgets.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-1.5">
                <Landmark className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-sm">
                  Belum ada pos anggaran BOS / RKAS untuk {activePeriodLabel}.
                </p>
                {archivedYears.length > 0 && fiscalYearFilter === 'ACTIVE' && (
                  <p className="text-[11px] text-slate-500">
                    Data tahun sebelumnya tersimpan pada filter <strong>Arsip Tahun Sebelumnya</strong>.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredBudgets.map((b) => (
                  <div key={b.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-700">{b.code}</span>
                        <span className="font-bold text-slate-900">{b.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {b.funding_source} {b.fiscal_year}
                        </span>
                        {b.is_archived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            <Archive className="w-3 h-3" /> Arsip
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-emerald-700 tabular-nums">{b.absorption_pct}% Terserap</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          b.absorption_pct >= 90 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(b.absorption_pct) || 0))}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-600">
                      <span>Pagu: <strong className="tabular-nums">{formatRupiah(b.allocated_amount)}</strong></span>
                      <span>Realisasi: <strong className="tabular-nums">{formatRupiah(b.spent_amount)}</strong></span>
                      <span>Sisa: <strong className="tabular-nums">{formatRupiah(b.remaining_amount)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDeleteEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-bku-title"
          onClick={() => {
            if (!deletingId) setConfirmDeleteEntry(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="delete-bku-title" className="text-base font-bold text-slate-900">
                Hapus Transaksi Buku Kas Umum?
              </h2>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteEntry(null)}
                aria-label="Tutup dialog"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
              Entri <strong>&ldquo;{confirmDeleteEntry.description}&rdquo;</strong> sebesar{' '}
              <strong>{formatRupiah(Number(confirmDeleteEntry.amount))}</strong> akan dihapus
              permanen dan saldo kas akan dihitung ulang.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteEntry(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDeleteEntry(confirmDeleteEntry)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Entri</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
