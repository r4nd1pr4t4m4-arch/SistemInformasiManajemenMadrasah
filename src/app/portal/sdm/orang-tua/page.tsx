'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { OrangTuaListSection } from '@/components/portal/sdm/orang-tua/orang-tua-list-section';
import { OrangTuaFormModal } from '@/components/portal/sdm/orang-tua/orang-tua-form-modal';
import {
  ActiveAccount,
  EMPTY_FORM,
  GuardianFormState,
  GuardianItem,
  guardianToFormState,
  PAGE_SIZE,
  StudentRef,
} from '@/components/portal/sdm/orang-tua/types';

export default function ManajemenOrangTuaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SDM_MANAGE);

  const [items, setItems] = useState<GuardianItem[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterRel, setFilterRel] = useState('ALL');
  const [page, setPage] = useState(1);

  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GuardianFormState>(EMPTY_FORM);

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
      const res = await fetch('/api/sdm?scope=orang-tua', { cache: 'no-store', signal });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data orang tua/wali.');
      hasLoadedOnceRef.current = true;
      setItems(data.items || []);
      setStudents(data.students || []);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterRel !== 'ALL' && item.relationship !== filterRel) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.student?.full_name || '').toLowerCase().includes(q) ||
        (item.student?.nis || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterRel]);

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
      linked: items.filter((i) => !!i.profile_id).length,
      primary: items.filter((i) => i.is_primary).length,
      active: items.filter((i) => i.is_active).length,
    }),
    [items]
  );

  const hasCustomFilter = Boolean(search.trim()) || filterRel !== 'ALL';

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleFilterRelChange(value: string) {
    setFilterRel(value);
    setPage(1);
  }

  function resetFilters() {
    setSearch('');
    setFilterRel('ALL');
    setPage(1);
  }

  function openCreate() {
    setEditingId(null);
    setModalError(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: GuardianItem) {
    setEditingId(item.id);
    setModalError(null);
    setForm(guardianToFormState(item));
    setModalOpen(true);
  }

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    if (!form.student_id) {
      setModalError('Siswa terkait wajib dipilih.');
      return;
    }
    const trimmedName = form.full_name.trim();
    if (trimmedName.length < 2) {
      setModalError('Nama lengkap orang tua/wali minimal 2 karakter.');
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
          scope: 'orang-tua',
          ...(editingId ? { id: editingId } : {}),
          ...form,
          full_name: trimmedName,
          nik: form.nik.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          occupation: form.occupation.trim(),
          address: form.address.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data orang tua/wali.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId
          ? 'Data orang tua/wali berhasil diperbarui.'
          : 'Data orang tua/wali baru berhasil ditambahkan.',
      });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GuardianItem) {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/sdm?scope=orang-tua&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data orang tua/wali.');
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
            Manajemen Orang Tua / Wali Siswa
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Kelola data orang tua/wali siswa beserta relasi ke peserta didik dan akun portal orang
            tua.
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
              Tambah Orang Tua/Wali
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

      <OrangTuaListSection
        stats={stats}
        search={search}
        onSearchChange={handleSearchChange}
        filterRel={filterRel}
        onFilterRelChange={handleFilterRelChange}
        hasCustomFilter={hasCustomFilter}
        onResetFilters={resetFilters}
        loading={loading}
        totalItemsCount={items.length}
        filteredCount={filtered.length}
        pagedItems={pagedItems}
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={pageStart}
        onPageChange={setPage}
        canManage={canManage}
        confirmDeleteId={confirmDeleteId}
        deletingId={deletingId}
        onOpenEdit={openEdit}
        onRequestDelete={setConfirmDeleteId}
        onCancelDelete={() => setConfirmDeleteId(null)}
        onConfirmDelete={(item) => void handleDelete(item)}
      />

      {canManage && (
        <OrangTuaFormModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          onFormChange={setForm}
          students={students}
          accounts={accounts}
          saving={saving}
          modalError={modalError}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
