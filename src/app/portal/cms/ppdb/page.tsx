'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';

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

export default function CmsPpdbPage() {
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'LULUS_UNSYNCED' | 'SYNCED' | 'MUTASI' | 'PENDING'>('ALL');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ppdbList, setPpdbList] = useState<PpdbRow[]>([]);

  async function loadRegistrations() {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/ppdb', { cache: 'no-store' });
      const data = await res.json();
      if (data.registrations) setPpdbList(data.registrations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegistrations();
  }, []);

  function showToast(text: string, type: 'ok' | 'err' = 'ok') {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleUpdatePpdbStatus(id: string, status: string) {
    const res = await fetch('/api/cms/ppdb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (res.ok && data.registration) {
      setPpdbList((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: data.registration.status } : row))
      );
      showToast(`Status pendaftar diperbarui menjadi ${status}.`);
    } else {
      showToast(data.error || 'Gagal memperbarui status.', 'err');
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
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal menyinkronkan ke Buku Induk Siswa.', 'err');
        return;
      }
      showToast(
        `Biodata & ${data.totalDocsSynced || 0} dokumen "${row.full_name}" berhasil disinkronkan ke Buku Induk Digital / Manajemen Siswa.`
      );
      await loadRegistrations();
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
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal sinkronisasi massal.', 'err');
        return;
      }
      showToast(
        `Berhasil menyinkronkan ${data.syncedCount} calon siswa LULUS & ${data.totalDocsSynced || 0} dokumen ke Buku Induk Digital Siswa.`
      );
      await loadRegistrations();
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
        row.full_name.toLowerCase().includes(q) ||
        row.registration_number.toLowerCase().includes(q) ||
        (row.nisn || '').toLowerCase().includes(q) ||
        (row.previous_school || '').toLowerCase().includes(q)
      );
    });
  }, [ppdbList, search, filterTab]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data pendaftar PPDB &amp; Mutasi...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Daftar Pendaftar PPDB &amp; Mutasi Masuk ({ppdbList.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pendaftar berstatus <strong>LULUS</strong> (termasuk jalur <strong>Mutasi Masuk</strong>)
              dapat langsung disinkronkan biodata dan dokumennya ke Buku Induk Digital / Manajemen Siswa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unsyncedLulusIds.length > 0 && (
              <button
                type="button"
                disabled={bulkSyncing}
                onClick={handleBulkSync}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {bulkSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                Sinkronkan Semua Lulus ({unsyncedLulusIds.length})
              </button>
            )}
            <Link
              href="/portal/sdm/siswa"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manajemen Siswa <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-2xl">
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
                onClick={() => setFilterTab(t.id as typeof filterTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, no. daftar, NISN..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 text-center">
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
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => {
              const docCount = row.ppdb_documents?.length || 0;
              const isSynced = Boolean(row.synced_student_id);
              const isSyncing = syncingId === row.id;
              return (
                <div
                  key={row.id}
                  className="modular-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-700">
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
                    <p className="font-bold text-slate-900 text-sm">{row.full_name}</p>
                    <p className="text-xs text-slate-500">
                      NISN: {row.nisn || '-'} • Asal: {row.previous_school || '-'} • Ortu/Wali:{' '}
                      {row.parent_name} ({row.parent_phone})
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {docCount} dokumen terlampir
                      </span>
                      {row.admin_notes && (
                        <span className="text-slate-600 italic">Catatan: {row.admin_notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.status}
                      onChange={(e) => handleUpdatePpdbStatus(row.id, e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
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
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
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
                        {isSynced ? 'Sinkron Ulang' : 'Sinkron ke Buku Induk'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
