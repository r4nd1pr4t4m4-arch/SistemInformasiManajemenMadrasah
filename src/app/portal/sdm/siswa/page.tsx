'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  GraduationCap,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type StudentItem = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  nik: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  birth_place: string | null;
  birth_date: string | null;
  religion: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  entry_year: number | null;
  graduation_year: number | null;
  status: 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF';
  profile?: ActiveAccount | null;
};

const EMPTY_FORM = {
  full_name: '',
  nis: '',
  nisn: '',
  nik: '',
  gender: 'L' as 'L' | 'P',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  phone: '',
  email: '',
  address: '',
  father_name: '',
  mother_name: '',
  guardian_name: '',
  entry_year: String(new Date().getFullYear()),
  graduation_year: '',
  status: 'AKTIF' as 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF',
  profile_id: '',
};

const STATUS_BADGES: Record<StudentItem['status'], string> = {
  AKTIF: 'bg-emerald-100 text-emerald-700',
  LULUS: 'bg-blue-100 text-blue-700',
  MUTASI: 'bg-amber-100 text-amber-700',
  NONAKTIF: 'bg-slate-200 text-slate-700',
};

const PAGE_SIZE = 12;

export default function ManajemenSiswaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SDM_MANAGE);

  const [items, setItems] = useState<StudentItem[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadData = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/sdm?scope=siswa', { cache: 'no-store', signal });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data siswa.');
      hasLoadedOnceRef.current = true;
      setItems(data.items || []);
      setAccounts(data.activeAccounts || []);
    } catch (e) {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadData(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        setModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, saving]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.nis || '').toLowerCase().includes(q) ||
        (item.nisn || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart]
  );

  const stats = useMemo(() => {
    return {
      total: items.length,
      aktif: items.filter((i) => i.status === 'AKTIF').length,
      lulus: items.filter((i) => i.status === 'LULUS').length,
      mutasi: items.filter((i) => i.status === 'MUTASI').length,
    };
  }, [items]);

  const hasCustomFilter = Boolean(search.trim()) || filterStatus !== 'ALL';

  function resetFilters() {
    setSearch('');
    setFilterStatus('ALL');
    setPage(1);
  }

  function openCreate() {
    setEditingId(null);
    setModalError(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: StudentItem) {
    setEditingId(item.id);
    setModalError(null);
    setForm({
      full_name: item.full_name || '',
      nis: item.nis || '',
      nisn: item.nisn || '',
      nik: item.nik || '',
      gender: item.gender || 'L',
      birth_place: item.birth_place || '',
      birth_date: item.birth_date || '',
      religion: item.religion || 'Islam',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      father_name: item.father_name || '',
      mother_name: item.mother_name || '',
      guardian_name: item.guardian_name || '',
      entry_year: item.entry_year ? String(item.entry_year) : '',
      graduation_year: item.graduation_year ? String(item.graduation_year) : '',
      status: item.status || 'AKTIF',
      profile_id: item.profile_id || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = form.full_name.trim();
    if (trimmedName.length < 2) {
      setModalError('Nama lengkap siswa minimal 2 karakter.');
      return;
    }

    const entryYearNum = form.entry_year ? Number(form.entry_year) : null;
    const gradYearNum = form.graduation_year ? Number(form.graduation_year) : null;
    if (
      entryYearNum !== null &&
      (!Number.isInteger(entryYearNum) || entryYearNum < 1980 || entryYearNum > 2100)
    ) {
      setModalError('Tahun masuk harus antara 1980 dan 2100.');
      return;
    }
    if (
      gradYearNum !== null &&
      (!Number.isInteger(gradYearNum) || gradYearNum < 1980 || gradYearNum > 2100)
    ) {
      setModalError('Tahun lulus harus antara 1980 dan 2100.');
      return;
    }

    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'siswa',
          ...(editingId ? { id: editingId } : {}),
          ...form,
          full_name: trimmedName,
          nis: form.nis.trim(),
          nisn: form.nisn.trim(),
          nik: form.nik.trim(),
          birth_place: form.birth_place.trim(),
          religion: form.religion.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          father_name: form.father_name.trim(),
          mother_name: form.mother_name.trim(),
          guardian_name: form.guardian_name.trim(),
          entry_year: entryYearNum,
          graduation_year: gradYearNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data siswa.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId
          ? 'Data siswa berhasil diperbarui.'
          : 'Data siswa baru berhasil ditambahkan.',
      });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: StudentItem) {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/sdm?scope=siswa&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data siswa.');
      setConfirmDeleteId(null);
      setMessage({ type: 'ok', text: `Data ${item.full_name} berhasil dihapus.` });
      await loadData(true);
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Siswa
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Kelola data induk peserta didik, status akademik, dan penautan akun siswa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah Siswa
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          className={`p-3.5 rounded-2xl text-xs sm:text-sm border flex items-start sm:items-center justify-between gap-3 ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="break-words leading-relaxed">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Tutup pesan"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Data Siswa</span>
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Siswa Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.aktif}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Lulus / Alumni</span>
            <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.lulus}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Mutasi</span>
            <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.mutasi}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama siswa, NIS, NISN, atau email..."
              aria-label="Cari data siswa"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            aria-label="Filter status siswa"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-44 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="LULUS">Lulus (Alumni)</option>
            <option value="MUTASI">Mutasi</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
          {hasCustomFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Memuat data siswa...
          </div>
        ) : pagedItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {items.length === 0
              ? 'Belum ada data siswa terdaftar.'
              : 'Belum ada data siswa yang sesuai filter.'}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {pagedItems.map((item) => {
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 break-words">
                          {item.full_name}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {item.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {item.phone || '-'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGES[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white rounded-xl p-2 border border-slate-100 tabular-nums">
                      <div className="truncate">NIS: {item.nis || '-'}</div>
                      <div className="truncate">NISN: {item.nisn || '-'}</div>
                      <div className="truncate">Masuk: {item.entry_year || '-'}</div>
                      <div className="truncate">Lulus: {item.graduation_year || '-'}</div>
                    </div>

                    {item.profile && (
                      <div className="flex">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                          <Link2 className="w-3 h-3 shrink-0" />
                          {item.profile.full_name}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                      <Link
                        href={`/portal/sdm/siswa/${item.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                      >
                        Detail
                      </Link>
                      {canManage &&
                        (isConfirming ? (
                          <>
                            <button
                              type="button"
                              aria-busy={isDeleting || undefined}
                              disabled={isDeleting}
                              onClick={() => void handleDelete(item)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                            >
                              {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                              Hapus
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                              aria-label={`Edit ${item.full_name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 bg-white border border-rose-200 hover:bg-rose-50"
                              aria-label={`Hapus ${item.full_name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[740px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">NIS / NISN</th>
                    <th className="py-3 px-3">Tahun Masuk / Lulus</th>
                    <th className="py-3 px-3">Akun Portal</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedItems.map((item) => {
                    const isConfirming = confirmDeleteId === item.id;
                    const isDeleting = deletingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {item.phone || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>NIS: {item.nis || '-'}</div>
                          <div>NISN: {item.nisn || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>Masuk: {item.entry_year || '-'}</div>
                          <div>Lulus: {item.graduation_year || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {item.profile ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                              <Link2 className="w-3 h-3 shrink-0" />
                              {item.profile.full_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Belum ditautkan</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGES[item.status]}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/portal/sdm/siswa/${item.id}`}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                            >
                              Detail
                            </Link>
                            {canManage &&
                              (isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => void handleDelete(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                                  >
                                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                                    title="Edit"
                                    aria-label={`Edit ${item.full_name}`}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(item.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                    title="Hapus"
                                    aria-label={`Hapus ${item.full_name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}{' '}
                  dari {filtered.length} siswa
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Halaman sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Halaman berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {canManage && modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="siswa-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="siswa-modal-title" className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm"
            >
              <div className="sm:col-span-2">
                <label
                  htmlFor="siswa-full-name"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nama Lengkap *
                </label>
                <input
                  id="siswa-full-name"
                  required
                  minLength={2}
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-nis"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  NIS
                </label>
                <input
                  id="siswa-nis"
                  type="text"
                  value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-nisn"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  NISN
                </label>
                <input
                  id="siswa-nisn"
                  type="text"
                  value={form.nisn}
                  onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-nik"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  NIK
                </label>
                <input
                  id="siswa-nik"
                  type="text"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-gender"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Jenis Kelamin
                </label>
                <select
                  id="siswa-gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="siswa-birth-place"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tempat Lahir
                </label>
                <input
                  id="siswa-birth-place"
                  type="text"
                  value={form.birth_place}
                  onChange={(e) => setForm({ ...form, birth_place: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-birth-date"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tanggal Lahir
                </label>
                <input
                  id="siswa-birth-date"
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-religion"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Agama
                </label>
                <input
                  id="siswa-religion"
                  type="text"
                  value={form.religion}
                  onChange={(e) => setForm({ ...form, religion: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-status"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Status
                </label>
                <select
                  id="siswa-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as 'AKTIF' | 'MUTASI' | 'LULUS' | 'NONAKTIF',
                    })
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="AKTIF">AKTIF</option>
                  <option value="LULUS">LULUS (Alumni)</option>
                  <option value="MUTASI">MUTASI</option>
                  <option value="NONAKTIF">NONAKTIF</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="siswa-entry-year"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tahun Masuk
                </label>
                <input
                  id="siswa-entry-year"
                  type="number"
                  min={1980}
                  max={2100}
                  value={form.entry_year}
                  onChange={(e) => setForm({ ...form, entry_year: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-grad-year"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tahun Lulus
                </label>
                <input
                  id="siswa-grad-year"
                  type="number"
                  min={1980}
                  max={2100}
                  value={form.graduation_year}
                  onChange={(e) => setForm({ ...form, graduation_year: e.target.value })}
                  placeholder="Isi jika sudah lulus"
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-phone"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  No. HP
                </label>
                <input
                  id="siswa-phone"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-email"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Email
                </label>
                <input
                  id="siswa-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-father"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nama Ayah
                </label>
                <input
                  id="siswa-father"
                  type="text"
                  value={form.father_name}
                  onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-mother"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nama Ibu
                </label>
                <input
                  id="siswa-mother"
                  type="text"
                  value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-guardian"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nama Wali (Opsional)
                </label>
                <input
                  id="siswa-guardian"
                  type="text"
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="siswa-profile"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tautkan Akun Portal Siswa
                </label>
                <select
                  id="siswa-profile"
                  value={form.profile_id}
                  onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Tidak Ditautkan --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="siswa-address"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Alamat
                </label>
                <textarea
                  id="siswa-address"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
