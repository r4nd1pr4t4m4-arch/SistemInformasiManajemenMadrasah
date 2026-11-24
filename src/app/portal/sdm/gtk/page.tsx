'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { GtkListSection } from '@/components/portal/sdm/gtk/gtk-list-section';
import { GtkFormModal } from '@/components/portal/sdm/gtk/gtk-form-and-delete-modals';
import {
  EMPTY_FORM,
  PAGE_SIZE,
  type ActiveAccount,
  type GtkFormState,
  type GtkItem,
} from '@/components/portal/sdm/gtk/types';

export default function ManajemenGtkPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SDM_MANAGE);

  const [items, setItems] = useState<GtkItem[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterActive, setFilterActive] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GtkFormState>(EMPTY_FORM);

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
      const res = await fetch('/api/sdm?scope=gtk', { cache: 'no-store', signal });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data GTK.');
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
      if (filterType !== 'ALL' && item.staff_type !== filterType) return false;
      if (filterActive === 'AKTIF' && !item.is_active) return false;
      if (filterActive === 'NONAKTIF' && item.is_active) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        (item.nip || '').toLowerCase().includes(q) ||
        (item.nuptk || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, filterType, filterActive]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const guru = items.filter((i) => i.staff_type === 'GURU').length;
    const tu = items.filter((i) => i.staff_type === 'TATA_USAHA').length;
    const active = items.filter((i) => i.is_active).length;
    return { total, guru, tu, active };
  }, [items]);

  const hasCustomFilter =
    Boolean(search.trim()) || filterType !== 'ALL' || filterActive !== 'ALL';

  function resetFilters() {
    setSearch('');
    setFilterType('ALL');
    setFilterActive('ALL');
    setPage(1);
  }

  function openCreate() {
    setEditingId(null);
    setModalError(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: GtkItem) {
    setEditingId(item.id);
    setModalError(null);
    setForm({
      full_name: item.full_name || '',
      staff_type: item.staff_type || 'GURU',
      nip: item.nip || '',
      nuptk: item.nuptk || '',
      nik: item.nik || '',
      gender: item.gender || 'L',
      birth_place: item.birth_place || '',
      birth_date: item.birth_date || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      education_level: item.education_level || '',
      major: item.major || '',
      last_campus: item.last_campus || '',
      graduation_year: item.graduation_year ? String(item.graduation_year) : '',
      thesis_title: item.thesis_title || '',
      thesis_abstract: item.thesis_abstract || '',
      thesis_keywords: Array.isArray(item.thesis_keywords) ? item.thesis_keywords.join(', ') : '',
      thesis_article_url: item.thesis_article_url || '',
      employment_status: item.employment_status || 'GTY',
      join_date: item.join_date || '',
      profile_id: item.profile_id || '',
      is_active: item.is_active,
      show_in_public_directory: item.show_in_public_directory,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = form.full_name.trim();
    if (trimmedName.length < 2) {
      setModalError('Nama lengkap minimal 2 karakter.');
      return;
    }

    const gradYearTrimmed = form.graduation_year.trim();
    let parsedGradYear: number | null = null;
    if (gradYearTrimmed) {
      const yr = Number(gradYearTrimmed);
      if (!Number.isInteger(yr) || yr < 1950 || yr > 2100) {
        setModalError('Tahun lulus harus berupa tahun valid antara 1950 hingga 2100.');
        return;
      }
      parsedGradYear = yr;
    }

    const parsedKeywords = form.thesis_keywords
      .split(',')
      .map((kw) => kw.trim().replace(/^#+/, '').trim())
      .filter(Boolean);

    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'gtk',
          ...(editingId ? { id: editingId } : {}),
          ...form,
          full_name: trimmedName,
          nip: form.nip.trim(),
          nuptk: form.nuptk.trim(),
          nik: form.nik.trim(),
          birth_place: form.birth_place.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          education_level: form.education_level.trim(),
          major: form.major.trim(),
          last_campus: form.last_campus.trim(),
          graduation_year: parsedGradYear,
          thesis_title: form.thesis_title.trim(),
          thesis_abstract: form.thesis_abstract.trim(),
          thesis_keywords: parsedKeywords,
          thesis_article_url: form.thesis_article_url.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data GTK.');
      setModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingId ? 'Data GTK berhasil diperbarui.' : 'Data GTK baru berhasil ditambahkan.',
      });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: GtkItem) {
    if (togglingId) return;
    setTogglingId(item.id);
    try {
      const res = await fetch('/api/sdm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'gtk',
          id: item.id,
          is_active: !item.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status GTK.');
      setMessage({ type: 'ok', text: `Status ${item.full_name} berhasil diperbarui.` });
      await loadData(true);
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(item: GtkItem) {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/sdm?scope=gtk&id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data GTK.');
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
            Manajemen GTK
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Kelola data Guru dan Tenaga Kependidikan, status kepegawaian, dan penautan akun
            portal.
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
              Tambah GTK
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

      <GtkListSection
        stats={stats}
        loading={loading}
        totalItemsCount={items.length}
        filteredCount={filtered.length}
        pagedItems={pagedItems}
        pageStart={pageStart}
        currentPage={currentPage}
        totalPages={totalPages}
        search={search}
        filterType={filterType}
        filterActive={filterActive}
        hasCustomFilter={hasCustomFilter}
        canManage={canManage}
        confirmDeleteId={confirmDeleteId}
        deletingId={deletingId}
        togglingId={togglingId}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onFilterTypeChange={(value) => {
          setFilterType(value);
          setPage(1);
        }}
        onFilterActiveChange={(value) => {
          setFilterActive(value);
          setPage(1);
        }}
        onResetFilters={resetFilters}
        onPageChange={setPage}
        onToggleStatus={(item) => void toggleStatus(item)}
        onOpenEdit={openEdit}
        onConfirmDeleteChange={setConfirmDeleteId}
        onDelete={(item) => void handleDelete(item)}
      />

      {canManage && (
        <GtkFormModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          accounts={accounts}
          saving={saving}
          modalError={modalError}
          onClose={() => setModalOpen(false)}
          onFormChange={setForm}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
