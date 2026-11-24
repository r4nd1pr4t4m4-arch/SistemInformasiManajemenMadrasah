'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { isSiblingDiscountCategory } from '@/lib/domain/sibling-discount';
import {
  FEE_CATEGORY_LABELS,
  type BillRow,
  type FeeCategory,
  type FeeTypeRow,
  type PostSppFn,
  type ShowToastFn,
  type SiblingGroupRow,
  type StudentOption,
} from './types';

const VALID_FEE_CATEGORIES: FeeCategory[] = ['SPP', 'KOMITE', 'UANG_GEDUNG', 'LAINNYA'];

function toFeeCategory(value: string): FeeCategory {
  return VALID_FEE_CATEGORIES.includes(value as FeeCategory)
    ? (value as FeeCategory)
    : 'LAINNYA';
}

interface JenisBiayaSectionProps {
  canManage: boolean;
  submitting: boolean;
  feeTypes: FeeTypeRow[];
  postSpp: PostSppFn;
  showToast: ShowToastFn;
}

export function JenisBiayaSection({
  canManage,
  submitting,
  feeTypes,
  postSpp,
  showToast,
}: JenisBiayaSectionProps) {
  const [feeSearch, setFeeSearch] = useState('');
  const [feeForm, setFeeForm] = useState({
    name: '',
    category: 'SPP' as FeeCategory,
    default_amount: 150000,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingFeeType, setEditingFeeType] = useState<FeeTypeRow | null>(null);
  const [editFeeForm, setEditFeeForm] = useState({
    name: '',
    category: 'SPP' as FeeCategory,
    default_amount: 0,
  });
  const [deleteTargets, setDeleteTargets] = useState<FeeTypeRow[] | null>(null);

  const filteredFeeTypes = useMemo(() => {
    const q = feeSearch.trim().toLowerCase();
    if (!q) return feeTypes;
    return feeTypes.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (FEE_CATEGORY_LABELS[f.category] || f.category).toLowerCase().includes(q)
    );
  }, [feeTypes, feeSearch]);

  const visibleIdSet = useMemo(
    () => new Set(filteredFeeTypes.map((f) => f.id)),
    [filteredFeeTypes]
  );

  const activeSelectedIds = useMemo(
    () => selectedIds.filter((id) => visibleIdSet.has(id)),
    [selectedIds, visibleIdSet]
  );

  const allVisibleSelected =
    filteredFeeTypes.length > 0 && activeSelectedIds.length === filteredFeeTypes.length;

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIdSet.has(id)));
    } else {
      const visibleIds = filteredFeeTypes.map((f) => f.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  function openEditModal(f: FeeTypeRow) {
    setEditingFeeType(f);
    setEditFeeForm({
      name: f.name,
      category: toFeeCategory(f.category),
      default_amount: Number(f.default_amount),
    });
  }

  async function handleConfirmDelete() {
    if (!deleteTargets || deleteTargets.length === 0) return;
    const ids = deleteTargets.map((t) => t.id);
    const ok = await postSpp(
      { action: 'DELETE_FEE_TYPES', ids },
      ids.length === 1
        ? 'Jenis biaya berhasil dihapus.'
        : `${ids.length} jenis biaya berhasil dihapus.`
    );
    if (ok) {
      const removed = new Set(ids);
      setSelectedIds((prev) => prev.filter((id) => !removed.has(id)));
      setDeleteTargets(null);
    }
  }

  return (
    <>
      <div className="grid lg:grid-cols-12 gap-6">
        {canManage && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
            <h2 className="text-base font-bold text-slate-900">Tambah Jenis Biaya</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedName = feeForm.name.trim();
                if (trimmedName.length < 2) {
                  showToast('Nama biaya minimal 2 karakter.', 'err');
                  return;
                }
                if (!Number.isFinite(feeForm.default_amount) || feeForm.default_amount < 0) {
                  showToast('Nominal default harus berupa angka minimal 0.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: 'CREATE_FEE_TYPE',
                    ...feeForm,
                    name: trimmedName,
                  },
                  'Jenis biaya berhasil ditambahkan.'
                );
                if (ok) setFeeForm((prev) => ({ ...prev, name: '' }));
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="spp-fee-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Jenis Biaya *
                </label>
                <input
                  id="spp-fee-name"
                  required
                  minLength={2}
                  placeholder="Mis. SPP Bulanan / Iuran Komite"
                  value={feeForm.name}
                  onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="spp-fee-category"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kategori
                  </label>
                  <select
                    id="spp-fee-category"
                    value={feeForm.category}
                    onChange={(e) =>
                      setFeeForm({
                        ...feeForm,
                        category: e.target.value as FeeCategory,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="SPP">SPP</option>
                    <option value="KOMITE">Iuran Komite</option>
                    <option value="UANG_GEDUNG">Uang Gedung</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="spp-fee-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nominal Default (Rp)
                  </label>
                  <input
                    id="spp-fee-amount"
                    type="number"
                    min={0}
                    required
                    value={feeForm.default_amount}
                    onChange={(e) =>
                      setFeeForm({ ...feeForm, default_amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Jenis Biaya
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Jenis Biaya ({filteredFeeTypes.length})
            </h2>
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={feeSearch}
                onChange={(e) => setFeeSearch(e.target.value)}
                placeholder="Cari jenis atau kategori..."
                aria-label="Cari jenis biaya"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {feeSearch && (
                <button
                  type="button"
                  onClick={() => setFeeSearch('')}
                  aria-label="Hapus pencarian jenis biaya"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {canManage && filteredFeeTypes.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Pilih Semua</span>
              </label>
              {activeSelectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds((prev) => prev.filter((id) => !visibleIdSet.has(id)))
                    }
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-200/60 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setDeleteTargets(
                        filteredFeeTypes.filter((f) => activeSelectedIds.includes(f.id))
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-semibold transition shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Terpilih ({activeSelectedIds.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {filteredFeeTypes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              {feeTypes.length === 0
                ? 'Belum ada jenis biaya yang terdaftar.'
                : 'Tidak ada jenis biaya yang sesuai pencarian.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredFeeTypes.map((f) => {
                const isSelected = activeSelectedIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                      isSelected ? 'ring-2 ring-emerald-500/40 bg-emerald-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(f.id)}
                          aria-label={`Pilih ${f.name}`}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-words">{f.name}</p>
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {FEE_CATEGORY_LABELS[f.category] || f.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                        {formatRupiah(Number(f.default_amount))}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => openEditModal(f)}
                            title="Edit jenis biaya"
                            aria-label={`Edit ${f.name}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setDeleteTargets([f])}
                            title="Hapus jenis biaya"
                            aria-label={`Hapus ${f.name}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingFeeType && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-fee-type-title"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 id="edit-fee-type-title" className="text-base font-bold text-slate-900">
                Edit Jenis Biaya
              </h3>
              <button
                type="button"
                onClick={() => setEditingFeeType(null)}
                aria-label="Tutup modal edit jenis biaya"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedName = editFeeForm.name.trim();
                if (trimmedName.length < 2) {
                  showToast('Nama biaya minimal 2 karakter.', 'err');
                  return;
                }
                if (
                  !Number.isFinite(editFeeForm.default_amount) ||
                  editFeeForm.default_amount < 0
                ) {
                  showToast('Nominal default harus berupa angka minimal 0.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: 'UPDATE_FEE_TYPE',
                    id: editingFeeType.id,
                    name: trimmedName,
                    category: editFeeForm.category,
                    default_amount: editFeeForm.default_amount,
                  },
                  'Jenis biaya berhasil diperbarui.'
                );
                if (ok) setEditingFeeType(null);
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="edit-fee-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Jenis Biaya *
                </label>
                <input
                  id="edit-fee-name"
                  required
                  minLength={2}
                  value={editFeeForm.name}
                  onChange={(e) => setEditFeeForm({ ...editFeeForm, name: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="edit-fee-category"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kategori
                  </label>
                  <select
                    id="edit-fee-category"
                    value={editFeeForm.category}
                    onChange={(e) =>
                      setEditFeeForm({
                        ...editFeeForm,
                        category: e.target.value as FeeCategory,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="SPP">SPP</option>
                    <option value="KOMITE">Iuran Komite</option>
                    <option value="UANG_GEDUNG">Uang Gedung</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-fee-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nominal Default (Rp)
                  </label>
                  <input
                    id="edit-fee-amount"
                    type="number"
                    min={0}
                    required
                    value={editFeeForm.default_amount}
                    onChange={(e) =>
                      setEditFeeForm({
                        ...editFeeForm,
                        default_amount: Number(e.target.value),
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFeeType(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTargets && deleteTargets.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-fee-type-title"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-fee-type-title" className="text-base font-bold text-slate-900">
                  {deleteTargets.length === 1
                    ? 'Hapus Jenis Biaya'
                    : `Hapus ${deleteTargets.length} Jenis Biaya`}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {deleteTargets.length === 1 ? (
                    <>
                      Anda yakin ingin menghapus jenis biaya{' '}
                      <strong className="text-slate-900">{deleteTargets[0].name}</strong>?
                    </>
                  ) : (
                    <>
                      Anda yakin ingin menghapus{' '}
                      <strong className="text-slate-900">
                        {deleteTargets.length} jenis biaya
                      </strong>{' '}
                      yang dipilih?
                    </>
                  )}{' '}
                  Jenis biaya yang masih digunakan oleh tagihan siswa tidak dapat dihapus.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteTargets(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface TerbitkanSectionProps {
  canManage: boolean;
  submitting: boolean;
  students: StudentOption[];
  feeTypes: FeeTypeRow[];
  bills: BillRow[];
  siblingGroups: SiblingGroupRow[];
  postSpp: PostSppFn;
  showToast: ShowToastFn;
}

export function TerbitkanSection({
  canManage,
  submitting,
  students,
  feeTypes,
  bills,
  siblingGroups,
  postSpp,
  showToast,
}: TerbitkanSectionProps) {
  const [billForm, setBillForm] = useState({
    student_id: '',
    fee_type_id: '',
    billing_month: new Date().getMonth() + 1,
    billing_year: new Date().getFullYear(),
    amount: 150000,
  });
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [editingBill, setEditingBill] = useState<BillRow | null>(null);
  const [editBillForm, setEditBillForm] = useState({
    billing_month: '',
    billing_year: '',
    amount: 0,
    notes: '',
  });
  const [deleteBillTargets, setDeleteBillTargets] = useState<BillRow[] | null>(null);

  const recentBills = useMemo(() => bills.slice(0, 10), [bills]);

  const visibleBillIdSet = useMemo(
    () => new Set(recentBills.map((b) => b.id)),
    [recentBills]
  );

  const activeSelectedBillIds = useMemo(
    () => selectedBillIds.filter((id) => visibleBillIdSet.has(id)),
    [selectedBillIds, visibleBillIdSet]
  );

  const allVisibleBillsSelected =
    recentBills.length > 0 && activeSelectedBillIds.length === recentBills.length;

  function toggleSelectBill(id: string) {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllBills() {
    if (allVisibleBillsSelected) {
      setSelectedBillIds((prev) => prev.filter((id) => !visibleBillIdSet.has(id)));
    } else {
      const visibleIds = recentBills.map((b) => b.id);
      setSelectedBillIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  function openEditBillModal(b: BillRow) {
    setEditingBill(b);
    setEditBillForm({
      billing_month: b.billing_month != null ? String(b.billing_month) : '',
      billing_year: b.billing_year != null ? String(b.billing_year) : '',
      amount: Number(b.amount),
      notes: b.notes || '',
    });
  }

  async function handleConfirmDeleteBills() {
    if (!deleteBillTargets || deleteBillTargets.length === 0) return;
    const ids = deleteBillTargets.map((b) => b.id);
    const ok = await postSpp(
      { action: 'DELETE_BILLS', ids },
      ids.length === 1
        ? 'Tagihan siswa berhasil dihapus.'
        : `${ids.length} tagihan siswa berhasil dihapus.`
    );
    if (ok) {
      const removed = new Set(ids);
      setSelectedBillIds((prev) => prev.filter((id) => !removed.has(id)));
      setDeleteBillTargets(null);
    }
  }

  // Check if selected student in individual bill form has sibling exemption
  const { student_id: billStudentId, fee_type_id: billFeeTypeId } = billForm;
  const selectedBillSiblingStatus = useMemo(() => {
    if (!billStudentId || !billFeeTypeId) return null;
    const ft = feeTypes.find((f) => f.id === billFeeTypeId);
    if (!ft || !isSiblingDiscountCategory(ft.category)) return null;

    const matchedGroup = siblingGroups.find(
      (g) => g.is_active && g.members.some((m) => m.student_id === billStudentId)
    );
    if (!matchedGroup) return null;

    return {
      groupName: matchedGroup.name,
      totalSiblings: matchedGroup.billingSummary.totalSiblings,
      payableCount: matchedGroup.billingSummary.payableCount,
      isExempt: matchedGroup.billingSummary.exemptStudentId === billStudentId,
    };
  }, [billStudentId, billFeeTypeId, feeTypes, siblingGroups]);

  return (
    <>
      <div className="grid lg:grid-cols-12 gap-6">
        {canManage ? (
          <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
            <h2 className="text-base font-bold text-slate-900">Terbitkan Tagihan Siswa</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!billForm.student_id || !billForm.fee_type_id) {
                  showToast('Pilih siswa dan jenis biaya terlebih dahulu.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(billForm.billing_month) ||
                  billForm.billing_month < 1 ||
                  billForm.billing_month > 12
                ) {
                  showToast('Bulan tagihan harus antara 1 sampai 12.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(billForm.billing_year) ||
                  billForm.billing_year < 2020 ||
                  billForm.billing_year > 2100
                ) {
                  showToast('Tahun tagihan harus antara 2020 dan 2100.', 'err');
                  return;
                }
                if (!Number.isFinite(billForm.amount) || billForm.amount < 0) {
                  showToast('Nominal tagihan minimal Rp 0.', 'err');
                  return;
                }
                const ok = await postSpp(
                  { action: 'CREATE_BILL', ...billForm },
                  selectedBillSiblingStatus?.isExempt
                    ? 'Tagihan diterbitkan: Gratis Kelompok Saudara (Rp 0 / LUNAS).'
                    : 'Tagihan siswa berhasil diterbitkan.'
                );
                if (ok) {
                  setBillForm((prev) => ({ ...prev, student_id: '' }));
                }
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="bill-student"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Siswa *
                </label>
                <select
                  id="bill-student"
                  required
                  value={billForm.student_id}
                  onChange={(e) => setBillForm({ ...billForm, student_id: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bill-fee-type"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Jenis Biaya *
                </label>
                <select
                  id="bill-fee-type"
                  required
                  value={billForm.fee_type_id}
                  onChange={(e) => {
                    const ft = feeTypes.find((f) => f.id === e.target.value);
                    setBillForm({
                      ...billForm,
                      fee_type_id: e.target.value,
                      amount: ft ? Number(ft.default_amount) : billForm.amount,
                    });
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Jenis Biaya --</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatRupiah(Number(f.default_amount))})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBillSiblingStatus && (
                <div
                  className={`p-3 rounded-xl text-[11px] border leading-relaxed ${
                    selectedBillSiblingStatus.isExempt
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  Anggota Kelompok Saudara{' '}
                  <strong>{selectedBillSiblingStatus.groupName}</strong> (
                  {selectedBillSiblingStatus.totalSiblings} saudara → bayar{' '}
                  {selectedBillSiblingStatus.payableCount} siswa).{' '}
                  {selectedBillSiblingStatus.isExempt ? (
                    <strong>
                      Siswa ini mendapat slot GRATIS (Rp 0 / LUNAS otomatis).
                    </strong>
                  ) : (
                    <span>Siswa ini termasuk yang berbayar penuh.</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="bill-month"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Bulan (1–12)
                  </label>
                  <input
                    id="bill-month"
                    type="number"
                    required
                    min={1}
                    max={12}
                    value={billForm.billing_month}
                    onChange={(e) =>
                      setBillForm({ ...billForm, billing_month: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bill-year"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tahun
                  </label>
                  <input
                    id="bill-year"
                    type="number"
                    required
                    min={2020}
                    max={2100}
                    value={billForm.billing_year}
                    onChange={(e) =>
                      setBillForm({ ...billForm, billing_year: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bill-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nominal (Rp)
                  </label>
                  <input
                    id="bill-amount"
                    type="number"
                    required
                    min={0}
                    value={billForm.amount}
                    onChange={(e) =>
                      setBillForm({ ...billForm, amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Buat Tagihan
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 text-xs text-slate-500">
            Anda memiliki akses lihat saja. Hubungi Bendahara Komite untuk menerbitkan
            tagihan baru.
          </div>
        )}

        <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Tagihan Terbaru ({bills.length})
            </h2>
            {bills.length > 10 && (
              <span className="text-[11px] font-medium text-slate-500">
                Menampilkan 10 terbaru
              </span>
            )}
          </div>

          {canManage && recentBills.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleBillsSelected}
                  onChange={toggleSelectAllBills}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Pilih Semua</span>
              </label>
              {activeSelectedBillIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBillIds((prev) =>
                        prev.filter((id) => !visibleBillIdSet.has(id))
                      )
                    }
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-200/60 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setDeleteBillTargets(
                        recentBills.filter((b) => activeSelectedBillIds.includes(b.id))
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-semibold transition shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Terpilih ({activeSelectedBillIds.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              Belum ada tagihan siswa yang diterbitkan.
            </p>
          ) : (
            <div className="space-y-2">
              {recentBills.map((b) => {
                const isSelected = activeSelectedBillIds.includes(b.id);
                const periodLabel =
                  b.billing_month && b.billing_year
                    ? ` • ${String(b.billing_month).padStart(2, '0')}/${b.billing_year}`
                    : '';
                return (
                  <div
                    key={b.id}
                    className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                      isSelected ? 'ring-2 ring-emerald-500/40 bg-emerald-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectBill(b.id)}
                          aria-label={`Pilih tagihan ${b.student?.full_name || 'Siswa'}`}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-words">
                          {b.student?.full_name || 'Siswa'}
                        </p>
                        <p className="text-slate-500 break-words">
                          {b.fee_type?.name || '-'}
                          {periodLabel}
                          {b.is_sibling_exempt ? ' • Gratis Saudara' : ''}
                        </p>
                        {b.notes && (
                          <p className="text-[11px] text-slate-400 mt-0.5 break-words">
                            {b.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="flex items-center sm:flex-col sm:items-end gap-1.5 sm:gap-1">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatRupiah(Number(b.amount))}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-700'
                              : b.status === 'CICILAN'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => openEditBillModal(b)}
                            title="Edit tagihan"
                            aria-label={`Edit tagihan ${b.student?.full_name || 'Siswa'}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setDeleteBillTargets([b])}
                            title="Hapus tagihan"
                            aria-label={`Hapus tagihan ${b.student?.full_name || 'Siswa'}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingBill && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-bill-title"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 id="edit-bill-title" className="text-base font-bold text-slate-900">
                  Edit Tagihan Siswa
                </h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {editingBill.student?.full_name || 'Siswa'} •{' '}
                  {editingBill.fee_type?.name || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                aria-label="Tutup modal edit tagihan"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const parsedMonth =
                  editBillForm.billing_month.trim() === ''
                    ? null
                    : Number(editBillForm.billing_month);
                const parsedYear =
                  editBillForm.billing_year.trim() === ''
                    ? null
                    : Number(editBillForm.billing_year);

                if (
                  parsedMonth !== null &&
                  (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)
                ) {
                  showToast('Bulan tagihan harus antara 1 sampai 12.', 'err');
                  return;
                }
                if (
                  parsedYear !== null &&
                  (!Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2100)
                ) {
                  showToast('Tahun tagihan harus antara 2020 dan 2100.', 'err');
                  return;
                }
                if (!Number.isFinite(editBillForm.amount) || editBillForm.amount < 0) {
                  showToast('Nominal tagihan minimal Rp 0.', 'err');
                  return;
                }
                const paidAmount = Number(editingBill.paid_amount ?? 0);
                if (editBillForm.amount < paidAmount) {
                  showToast(
                    `Nominal tagihan tidak boleh kurang dari jumlah sudah dibayar (${formatRupiah(paidAmount)}).`,
                    'err'
                  );
                  return;
                }

                const ok = await postSpp(
                  {
                    action: 'UPDATE_BILL',
                    id: editingBill.id,
                    billing_month: parsedMonth,
                    billing_year: parsedYear,
                    amount: editBillForm.amount,
                    notes: editBillForm.notes.trim() || null,
                  },
                  'Tagihan siswa berhasil diperbarui.'
                );
                if (ok) setEditingBill(null);
              }}
              className="space-y-3"
            >
              {Number(editingBill.paid_amount ?? 0) > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  Sudah dibayar:{' '}
                  <strong className="font-mono">
                    {formatRupiah(Number(editingBill.paid_amount))}
                  </strong>
                  . Nominal tagihan tidak dapat lebih kecil dari jumlah ini.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="edit-bill-month"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Bulan (1–12)
                  </label>
                  <input
                    id="edit-bill-month"
                    type="number"
                    min={1}
                    max={12}
                    placeholder="-"
                    value={editBillForm.billing_month}
                    onChange={(e) =>
                      setEditBillForm({ ...editBillForm, billing_month: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-bill-year"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tahun
                  </label>
                  <input
                    id="edit-bill-year"
                    type="number"
                    min={2020}
                    max={2100}
                    placeholder="-"
                    value={editBillForm.billing_year}
                    onChange={(e) =>
                      setEditBillForm({ ...editBillForm, billing_year: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-bill-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nominal (Rp)
                  </label>
                  <input
                    id="edit-bill-amount"
                    type="number"
                    required
                    min={Number(editingBill.paid_amount ?? 0)}
                    value={editBillForm.amount}
                    onChange={(e) =>
                      setEditBillForm({ ...editBillForm, amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="edit-bill-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Catatan
                </label>
                <textarea
                  id="edit-bill-notes"
                  rows={2}
                  placeholder="Catatan tambahan (opsional)"
                  value={editBillForm.notes}
                  onChange={(e) =>
                    setEditBillForm({ ...editBillForm, notes: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteBillTargets && deleteBillTargets.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-bill-title"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-bill-title" className="text-base font-bold text-slate-900">
                  {deleteBillTargets.length === 1
                    ? 'Hapus Tagihan Siswa'
                    : `Hapus ${deleteBillTargets.length} Tagihan Siswa`}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {deleteBillTargets.length === 1 ? (
                    <>
                      Anda yakin ingin menghapus tagihan{' '}
                      <strong className="text-slate-900">
                        {deleteBillTargets[0].fee_type?.name || 'SPP'}
                      </strong>{' '}
                      milik{' '}
                      <strong className="text-slate-900">
                        {deleteBillTargets[0].student?.full_name || 'Siswa'}
                      </strong>
                      ?
                    </>
                  ) : (
                    <>
                      Anda yakin ingin menghapus{' '}
                      <strong className="text-slate-900">
                        {deleteBillTargets.length} tagihan siswa
                      </strong>{' '}
                      yang dipilih?
                    </>
                  )}{' '}
                  Seluruh riwayat pembayaran terkait tagihan ini juga akan ikut terhapus.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteBillTargets(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteBills}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
