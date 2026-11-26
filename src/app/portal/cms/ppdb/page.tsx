'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface PpdbDocRow {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  is_verified: boolean;
}

interface PpdbRow {
  id: string;
  registration_number: string;
  full_name: string;
  nisn: string | null;
  nik: string;
  gender?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  address?: string | null;
  previous_school: string | null;
  pathway: string;
  parent_name: string;
  parent_phone: string;
  status: string;
  admin_notes: string | null;
  synced_student_id: string | null;
  synced_at: string | null;
  ppdb_documents?: PpdbDocRow[];
}

const PAGE_SIZE = 20;

const CMS_QUICK_LINKS = [
  { href: '/portal/cms/profil', label: 'Identitas & Profil', icon: Building2, active: false },
  { href: '/portal/cms/berita', label: 'Berita & Artikel', icon: Newspaper, active: false },
  { href: '/portal/cms/ppdb', label: 'PPDB Online', icon: UserPlus, active: true },
  { href: '/portal/cms/sarana-prasarana', label: 'Sarana Prasarana', icon: Wrench, active: false },
];

function isSafeDocUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('/') ||
    url.startsWith('data:')
  );
}

export default function CmsPpdbPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_PPDB_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<
    'ALL' | 'LULUS_UNSYNCED' | 'SYNCED' | 'MUTASI' | 'PENDING'
  >('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailRow, setDetailRow] = useState<PpdbRow | null>(null);
  const [detailNotesDraft, setDetailNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ppdbList, setPpdbList] = useState<PpdbRow[]>([]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function showToast(text: string, type: 'ok' | 'err' = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }

  const loadRegistrations = useCallback(async (isSilent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/cms/ppdb', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memuat data pendaftar PPDB.');
      }
      setPpdbList(Array.isArray(data?.registrations) ? data.registrations : []);
      setLoadError(null);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setLoadError((err as Error)?.message || 'Tidak dapat terhubung ke server.');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/cms/ppdb', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat data pendaftar PPDB.');
        return data;
      })
      .then((data) => {
        setPpdbList(Array.isArray(data?.registrations) ? data.registrations : []);
        setLoadError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError((err as Error)?.message || 'Tidak dapat terhubung ke server.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!detailRow) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailRow(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailRow]);

  useEffect(() => {
    setDetailNotesDraft(detailRow?.admin_notes || '');
  }, [detailRow?.id, detailRow?.admin_notes]);

  async function handleSaveAdminNotes() {
    if (!detailRow) return;
    setSavingNotes(true);
    try {
      const res = await fetch('/api/cms/ppdb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailRow.id,
          status: detailRow.status,
          admin_notes: detailNotesDraft.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.registration) {
        const nextNotes = data.registration.admin_notes ?? null;
        setPpdbList((prev) =>
          prev.map((row) => (row.id === detailRow.id ? { ...row, admin_notes: nextNotes } : row))
        );
        setDetailRow((prev) => (prev ? { ...prev, admin_notes: nextNotes } : prev));
        showToast('Catatan admin PPDB berhasil disimpan.');
      } else {
        showToast(data?.error || 'Gagal menyimpan catatan admin.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan catatan.', 'err');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleToggleDocVerify(docId: string, nextVerified: boolean) {
    try {
      const res = await fetch('/api/cms/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_DOC_VERIFY',
          document_id: docId,
          is_verified: nextVerified,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || 'Gagal memperbarui status verifikasi berkas.', 'err');
        return;
      }
      setPpdbList((prev) =>
        prev.map((row) => ({
          ...row,
          ppdb_documents: row.ppdb_documents?.map((d) =>
            d.id === docId ? { ...d, is_verified: nextVerified } : d
          ),
        }))
      );
      setDetailRow((prev) =>
        prev
          ? {
              ...prev,
              ppdb_documents: prev.ppdb_documents?.map((d) =>
                d.id === docId ? { ...d, is_verified: nextVerified } : d
              ),
            }
          : prev
      );
      showToast(nextVerified ? 'Berkas ditandai terverifikasi.' : 'Status verifikasi berkas dibatalkan.');
    } catch {
      showToast('Gagal terhubung ke server.', 'err');
    }
  }

  function handleExportPpdbExcel() {
    const headers = [
      'No. Pendaftaran',
      'Nama Lengkap',
      'NISN',
      'NIK',
      'Asal Sekolah',
      'Jalur',
      'Orang Tua/Wali',
      'No. WA',
      'Status',
      'Catatan Admin',
    ];
    const rows = filtered.map((r) => [
      r.registration_number,
      r.full_name,
      r.nisn || '-',
      r.nik || '-',
      r.previous_school || '-',
      r.pathway,
      r.parent_name,
      r.parent_phone,
      r.status,
      r.admin_notes || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar PPDB');
    XLSX.writeFile(wb, `Rekap_PPDB_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleUpdatePpdbStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/cms/ppdb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.registration) {
        setPpdbList((prev) =>
          prev.map((row) => (row.id === id ? { ...row, status: data.registration.status } : row))
        );
        setDetailRow((prev) =>
          prev && prev.id === id ? { ...prev, status: data.registration.status } : prev
        );
        showToast(`Status pendaftar diperbarui menjadi ${status.replace(/_/g, ' ')}.`);
      } else {
        showToast(data?.error || 'Gagal memperbarui status.', 'err');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memperbarui status.', 'err');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSyncSingle(row: PpdbRow) {
    setSyncingId(row.id);
    try {
      const res = await fetch('/api/cms/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_TO_STUDENT', id: row.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyinkronkan ke Buku Induk Siswa.', 'err');
        return;
      }
      showToast(
        `Biodata & ${data?.totalDocsSynced || 0} dokumen "${row.full_name}" berhasil disinkronkan ke Buku Induk Digital / Manajemen Siswa.`
      );
      await loadRegistrations(true);
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyinkronkan data.', 'err');
    } finally {
      setSyncingId(null);
    }
  }

  const unsyncedLulusIds = useMemo(
    () => ppdbList.filter((r) => r.status === 'LULUS' && !r.synced_student_id).map((r) => r.id),
    [ppdbList]
  );

  async function handleBulkSync() {
    if (unsyncedLulusIds.length === 0) return;
    setBulkSyncing(true);
    try {
      const res = await fetch('/api/cms/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_TO_STUDENT', ids: unsyncedLulusIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || 'Gagal sinkronisasi massal.', 'err');
        return;
      }
      showToast(
        `Berhasil menyinkronkan ${data?.syncedCount || 0} calon siswa LULUS & ${data?.totalDocsSynced || 0} dokumen ke Buku Induk Digital Siswa.`
      );
      await loadRegistrations(true);
    } catch {
      showToast('Terjadi kesalahan jaringan saat sinkronisasi massal.', 'err');
    } finally {
      setBulkSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ppdbList.filter((row) => {
      if (filterTab === 'LULUS_UNSYNCED' && !(row.status === 'LULUS' && !row.synced_student_id)) {
        return false;
      }
      if (filterTab === 'SYNCED' && !row.synced_student_id) return false;
      if (filterTab === 'MUTASI' && row.pathway !== 'MUTASI') return false;
      if (filterTab === 'PENDING' && row.status !== 'MENUNGGU_VERIFIKASI') return false;

      if (!q) return true;
      return (
        (row.full_name || '').toLowerCase().includes(q) ||
        (row.registration_number || '').toLowerCase().includes(q) ||
        (row.nisn || '').toLowerCase().includes(q) ||
        (row.previous_school || '').toLowerCase().includes(q)
      );
    });
  }, [ppdbList, search, filterTab]);

  const displayedList = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const hasActiveFilter = search.trim().length > 0 || filterTab !== 'ALL';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat data pendaftar PPDB &amp; Mutasi...</span>
      </div>
    );
  }

  if (loadError && ppdbList.length === 0) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center space-y-3 border border-rose-200">
        <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
        <h1 className="text-base sm:text-lg font-bold text-slate-900">
          Gagal Memuat Data Pendaftar PPDB
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadRegistrations(false)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      {/* Quick CMS Sub-navigation */}
      <nav
        aria-label="Navigasi Modul CMS"
        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {CMS_QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 ${
                item.active
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white/90 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 break-words">
              Daftar Pendaftar PPDB &amp; Mutasi Masuk ({ppdbList.length})
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Pendaftar berstatus <strong>LULUS</strong> (termasuk jalur{' '}
              <strong>Mutasi Masuk</strong>) dapat langsung disinkronkan biodata dan dokumennya ke
              Buku Induk Digital / Manajemen Siswa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadRegistrations(true)}
              disabled={refreshing}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            {canManage && unsyncedLulusIds.length > 0 && (
              <button
                type="button"
                disabled={bulkSyncing}
                onClick={handleBulkSync}
                className="min-h-[38px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {bulkSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>Sinkronkan Semua Lulus ({unsyncedLulusIds.length})</span>
              </button>
            )}
            <Link
              href="/portal/sdm/siswa"
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Manajemen Siswa</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 justify-between lg:items-center">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: `Semua (${ppdbList.length})` },
              { id: 'LULUS_UNSYNCED', label: `Lulus Siap Sinkron (${unsyncedLulusIds.length})` },
              {
                id: 'SYNCED',
                label: `Sudah Tersinkron (${ppdbList.filter((r) => !!r.synced_student_id).length})`,
              },
              {
                id: 'MUTASI',
                label: `Mutasi Masuk (${ppdbList.filter((r) => r.pathway === 'MUTASI').length})`,
              },
              {
                id: 'PENDING',
                label: `Menunggu (${ppdbList.filter((r) => r.status === 'MENUNGGU_VERIFIKASI').length})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setFilterTab(t.id as typeof filterTab);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  filterTab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Cari nama, no. daftar, NISN..."
              aria-label="Cari pendaftar PPDB"
              className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-slate-600">
              Tidak ada data pendaftar yang sesuai filter. Formulir publik tersedia di{' '}
              <Link href="/ppdb" className="text-emerald-700 font-semibold underline">
                /ppdb
              </Link>{' '}
              dan{' '}
              <Link href="/ppdb/mutasi" className="text-emerald-700 font-semibold underline">
                /ppdb/mutasi
              </Link>
              .
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterTab('ALL');
                  setVisibleCount(PAGE_SIZE);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedList.map((row) => {
                const docCount = row.ppdb_documents?.length || 0;
                const isSynced = Boolean(row.synced_student_id);
                const isSyncing = syncingId === row.id;
                const isUpdating = updatingId === row.id;
                return (
                  <div
                    key={row.id}
                    className="modular-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700 break-all">
                          {row.registration_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.pathway === 'MUTASI'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.pathway === 'MUTASI' ? 'MUTASI MASUK' : `Jalur ${row.pathway}`}
                        </span>
                        {isSynced && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <UserCheck className="w-3 h-3" /> Tersinkron ke Buku Induk
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-sm break-words">
                        {row.full_name}
                      </p>
                      <p className="text-xs text-slate-500 break-words leading-relaxed">
                        NISN: {row.nisn || '-'} • Asal: {row.previous_school || '-'} • Ortu/Wali:{' '}
                        {row.parent_name} ({row.parent_phone})
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail &amp; {docCount} Berkas</span>
                        </button>
                        {row.admin_notes && (
                          <span className="text-slate-600 italic break-words">
                            Catatan: {row.admin_notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
                      {canManage ? (
                        <>
                          <select
                            value={row.status}
                            disabled={isUpdating}
                            onChange={(e) => handleUpdatePpdbStatus(row.id, e.target.value)}
                            aria-label={`Ubah status ${row.full_name}`}
                            className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                          >
                            <option value="MENUNGGU_VERIFIKASI">MENUNGGU_VERIFIKASI</option>
                            <option value="TERVERIFIKASI">TERVERIFIKASI</option>
                            <option value="PERLU_PERBAIKAN">PERLU_PERBAIKAN</option>
                            <option value="LULUS">LULUS</option>
                            <option value="CADANGAN">CADANGAN</option>
                            <option value="TIDAK_LULUS">TIDAK_LULUS</option>
                          </select>

                          {row.status === 'LULUS' && (
                            <button
                              type="button"
                              disabled={isSyncing}
                              onClick={() => handleSyncSingle(row)}
                              className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                                isSynced
                                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              } disabled:opacity-50`}
                            >
                              {isSyncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              <span>{isSynced ? 'Sinkron Ulang' : 'Sinkron ke Buku Induk'}</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold text-center">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                >
                  Muat Lebih Banyak ({filtered.length - displayedList.length} tersisa)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Detail Biodata & Berkas Pendaftar */}
      {detailRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ppdb-detail-title"
          onClick={() => setDetailRow(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-emerald-700">
                  {detailRow.registration_number}
                </span>
                <h2
                  id="ppdb-detail-title"
                  className="text-base sm:text-lg font-bold text-slate-900 break-words"
                >
                  {detailRow.full_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label="Tutup detail pendaftar"
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 rounded-2xl p-4 border border-slate-200/70">
              <div>
                <span className="text-slate-500">NISN / NIK:</span>
                <p className="font-mono font-semibold text-slate-900 break-all">
                  {detailRow.nisn || '-'} / {detailRow.nik || '-'}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Asal Sekolah:</span>
                <p className="font-semibold text-slate-900 break-words">
                  {detailRow.previous_school || '-'}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Orang Tua / Wali:</span>
                <p className="font-semibold text-slate-900 break-words">
                  {detailRow.parent_name} ({detailRow.parent_phone})
                </p>
              </div>
              <div>
                <span className="text-slate-500">Jalur &amp; Status:</span>
                <p className="font-semibold text-emerald-800">
                  {detailRow.pathway} • {detailRow.status.replace(/_/g, ' ')}
                </p>
              </div>
              {detailRow.address && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Alamat:</span>
                  <p className="font-medium text-slate-800 break-words">{detailRow.address}</p>
                </div>
              )}
              <div className="sm:col-span-2 space-y-1.5">
                <span className="text-slate-500">Catatan Verifikasi / Mutasi:</span>
                {canManage ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={detailNotesDraft}
                      onChange={(e) => setDetailNotesDraft(e.target.value)}
                      placeholder="Tambahkan catatan verifikasi, alasan perbaikan, atau info kelas tujuan mutasi..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="button"
                      disabled={savingNotes}
                      onClick={handleSaveAdminNotes}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-semibold transition"
                    >
                      {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                      Simpan Catatan
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-slate-800 break-words">
                    {detailRow.admin_notes || '-'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                Berkas Terlampir ({detailRow.ppdb_documents?.length || 0})
              </p>
              {!detailRow.ppdb_documents || detailRow.ppdb_documents.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Tidak ada dokumen yang diunggah secara daring.
                </p>
              ) : (
                <div className="space-y-2">
                  {detailRow.ppdb_documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">
                          {doc.file_name || doc.document_type}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {doc.document_type} •{' '}
                          <span className={doc.is_verified ? 'text-emerald-700 font-bold' : 'text-amber-700'}>
                            {doc.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi'}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => void handleToggleDocVerify(doc.id, !doc.is_verified)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                              doc.is_verified
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
                            }`}
                          >
                            {doc.is_verified ? '✓ Valid' : 'Verifikasi'}
                          </button>
                        )}
                        {isSafeDocUrl(doc.file_url) && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 font-semibold transition"
                          >
                            <span>Buka</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExportPpdbExcel}
                className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
              >
                Ekspor Daftar PPDB (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
