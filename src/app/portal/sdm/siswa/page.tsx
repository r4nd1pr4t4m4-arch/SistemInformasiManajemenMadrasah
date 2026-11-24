'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  buildStudentPayload,
  EMPTY_FORM,
  PAGE_SIZE,
  studentToForm,
} from '@/components/portal/sdm/siswa/types';
import type {
  ActiveAccount,
  StudentFormState,
  StudentItem,
} from '@/components/portal/sdm/siswa/types';
import { SiswaListSection } from '@/components/portal/sdm/siswa/siswa-list-section';
import { SiswaFormModal } from '@/components/portal/sdm/siswa/siswa-form-modal';

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
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);

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

  const stats = useMemo(
    () => ({
      total: items.length,
      aktif: items.filter((i) => i.status === 'AKTIF').length,
      lulus: items.filter((i) => i.status === 'LULUS').length,
      mutasi: items.filter((i) => i.status === 'MUTASI').length,
    }),
    [items]
  );

  const hasCustomFilter = Boolean(search.trim()) || filterStatus !== 'ALL';

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleFilterStatusChange(value: string) {
    setFilterStatus(value);
    setPage(1);
  }

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
    setForm(studentToForm(item));
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const result = buildStudentPayload(form, editingId);
    if (!result.ok) {
      setModalError(result.error);
      return;
    }

    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
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
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl text-xs font-medium border flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            message.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
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

      <SiswaListSection
        stats={stats}
        itemsCount={items.length}
        filteredCount={filtered.length}
        pagedItems={pagedItems}
        loading={loading}
        canManage={canManage}
        search={search}
        filterStatus={filterStatus}
        hasCustomFilter={hasCustomFilter}
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={pageStart}
        confirmDeleteId={confirmDeleteId}
        deletingId={deletingId}
        onSearchChange={handleSearchChange}
        onFilterStatusChange={handleFilterStatusChange}
        onResetFilters={resetFilters}
        onPageChange={setPage}
        onEdit={openEdit}
        onRequestDelete={setConfirmDeleteId}
        onConfirmDelete={(item) => void handleDelete(item)}
      />

      {canManage && modalOpen && (
        <SiswaFormModal
          isEditing={Boolean(editingId)}
          form={form}
          accounts={accounts}
          saving={saving}
          modalError={modalError}
          onFormChange={setForm}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
