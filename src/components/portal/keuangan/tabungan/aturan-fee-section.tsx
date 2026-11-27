'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AlertCircle,
  Calculator,
  Edit2,
  Loader2,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import {
  calculateWithdrawalFee,
  generateTierLabel,
  type SavingsFeeTier,
} from '@/lib/domain/tabungan-fee';
import type { TierFormState } from './types';

interface AturanFeeSectionProps {
  canManage: boolean;
  editingTiers: SavingsFeeTier[];
  setEditingTiers: Dispatch<SetStateAction<SavingsFeeTier[]>>;
  onFeeTiersSaved: (tiers: SavingsFeeTier[]) => void;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  showToast: (type: 'ok' | 'err', msg: string) => void;
}

export function AturanFeeSection({
  canManage,
  editingTiers,
  setEditingTiers,
  onFeeTiersSaved,
  submitting,
  setSubmitting,
  showToast,
}: AturanFeeSectionProps) {
  const [hasUnsavedTiers, setHasUnsavedTiers] = useState(false);
  const [confirmResetTiers, setConfirmResetTiers] = useState(false);
  const [confirmDeleteTierIdx, setConfirmDeleteTierIdx] = useState<number | null>(null);
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [tierModalError, setTierModalError] = useState<string | null>(null);
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [tierForm, setTierForm] = useState<TierFormState>({
    tier_order: 1,
    label: '',
    min_amount: 0,
    max_amount: 500000,
    is_unbounded: false,
    fee_percentage: 2.0,
    is_active: true,
  });
  const [simAmount, setSimAmount] = useState<number>(1000000);

  useEffect(() => {
    if (!tierModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTierModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tierModalOpen]);

  const simFeeCalc = useMemo(() => {
    return calculateWithdrawalFee(simAmount, editingTiers);
  }, [simAmount, editingTiers]);

  async function handleSaveFeeTiers() {
    if (submitting || editingTiers.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_FEE_TIERS',
          tiers: editingTiers.map((t, i) => ({
            tier_order: i + 1,
            label: t.label || generateTierLabel(t.min_amount, t.max_amount),
            min_amount: Number(t.min_amount) || 0,
            max_amount: t.max_amount != null ? Number(t.max_amount) : null,
            fee_percentage: Number(t.fee_percentage) || 0,
            is_active: Boolean(t.is_active),
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', 'Aturan fee penarikan tabungan berhasil diperbarui.');
        setHasUnsavedTiers(false);
        if (data.feeTiers) {
          onFeeTiersSaved(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal menyimpan aturan fee.');
      }
    } catch {
      showToast('err', 'Gagal terhubung ke server saat menyimpan aturan fee.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetFeeTiers() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_FEE_TIERS' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', 'Aturan fee dikembalikan ke 6 ketentuan standar.');
        setConfirmResetTiers(false);
        setHasUnsavedTiers(false);
        if (data.feeTiers) {
          onFeeTiersSaved(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal mereset aturan fee.');
      }
    } catch {
      showToast('err', 'Gagal terhubung ke server saat mereset aturan fee.');
    } finally {
      setSubmitting(false);
    }
  }

  function openAddTierModal() {
    setEditingTierIdx(null);
    setTierModalError(null);
    const lastTier = editingTiers[editingTiers.length - 1];
    const nextMin = lastTier?.max_amount != null ? Number(lastTier.max_amount) : 0;
    setTierForm({
      tier_order: editingTiers.length + 1,
      label: '',
      min_amount: nextMin,
      max_amount: nextMin + 1000000,
      is_unbounded: false,
      fee_percentage: 2.0,
      is_active: true,
    });
    setTierModalOpen(true);
  }

  function openEditTierModal(idx: number) {
    const target = editingTiers[idx];
    if (!target) return;
    setEditingTierIdx(idx);
    setTierModalError(null);
    setTierForm({
      tier_order: target.tier_order,
      label: target.label || '',
      min_amount: Number(target.min_amount) || 0,
      max_amount: target.max_amount != null ? Number(target.max_amount) : null,
      is_unbounded: target.max_amount == null,
      fee_percentage: Number(target.fee_percentage) || 0,
      is_active: Boolean(target.is_active),
    });
    setTierModalOpen(true);
  }

  function handleSaveTierModal() {
    const minVal = Number(tierForm.min_amount);
    const maxVal = tierForm.is_unbounded ? null : Number(tierForm.max_amount);
    const pctVal = Number(tierForm.fee_percentage);

    if (!Number.isFinite(minVal) || minVal < 0) {
      setTierModalError('Batas bawah harus berupa angka minimal Rp 0.');
      return;
    }
    if (maxVal !== null && (!Number.isFinite(maxVal) || maxVal <= minVal)) {
      setTierModalError('Batas atas harus lebih besar dari batas bawah.');
      return;
    }
    if (!Number.isFinite(pctVal) || pctVal < 0 || pctVal > 100) {
      setTierModalError('Persentase fee harus antara 0% sampai 100%.');
      return;
    }

    const finalLabel = tierForm.label.trim() || generateTierLabel(minVal, maxVal);
    const updatedItem: SavingsFeeTier = {
      tier_order: tierForm.tier_order,
      label: finalLabel,
      min_amount: minVal,
      max_amount: maxVal,
      fee_percentage: pctVal,
      is_active: tierForm.is_active,
    };

    if (editingTierIdx === null) {
      setEditingTiers([...editingTiers, updatedItem]);
    } else {
      const nextList = [...editingTiers];
      nextList[editingTierIdx] = updatedItem;
      setEditingTiers(nextList);
    }

    setHasUnsavedTiers(true);
    setTierModalError(null);
    setTierModalOpen(false);
  }

  function handleDeleteTier(idx: number) {
    const nextList = editingTiers.filter((_, i) => i !== idx);
    setEditingTiers(nextList);
    setConfirmDeleteTierIdx(null);
    setHasUnsavedTiers(true);
  }

  if (!canManage) {
    return (
      <div className="glass-card rounded-3xl p-6 text-xs text-slate-500">
        Anda tidak memiliki izin untuk mengubah pengaturan tingkatan fee penarikan tabungan.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-700 shrink-0" /> Pengaturan Tingkatan Fee Penarikan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Admin dan Pengelola Tabungan dapat mengatur persentase fee serta batas bawah (minimum) dan batas atas (maksimum) nominal penarikan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {confirmResetTiers ? (
                <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-xs">
                  <span className="text-amber-900 font-medium">Reset ke 6 standar?</span>
                  <button
                    type="button"
                    aria-busy={submitting || undefined}
                    disabled={submitting}
                    onClick={handleResetFeeTiers}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50 transition"
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Ya</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmResetTiers(false)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-amber-200 text-slate-600 transition"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetTiers(true)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset Default (6 Tingkatan)
                </button>
              )}
              <button
                type="button"
                onClick={openAddTierModal}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Aturan Fee
              </button>
              <button
                type="button"
                onClick={handleSaveFeeTiers}
                disabled={submitting || editingTiers.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Simpan Pengaturan
              </button>
            </div>
          </div>

          {hasUnsavedTiers && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              Terdapat perubahan aturan fee yang belum disimpan ke server. Klik{' '}
              <strong>Simpan Pengaturan</strong> untuk menerapkan secara permanen.
            </div>
          )}

          {editingTiers.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Belum ada tingkatan aturan fee. Klik <strong>Tambah Aturan Fee</strong> atau{' '}
              <strong>Reset Default</strong>.
            </p>
          ) : (
            <>
              {/* Mobile Tier Cards */}
              <div className="md:hidden space-y-2.5">
                {editingTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="modular-card rounded-2xl p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-words">
                          #{idx + 1} • {tier.label || generateTierLabel(tier.min_amount, tier.max_amount)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {formatRupiah(Number(tier.min_amount))} –{' '}
                          {tier.max_amount != null
                            ? formatRupiah(Number(tier.max_amount))
                            : 'Tanpa Batas Atas'}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg tabular-nums">
                        {tier.fee_percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tier.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {tier.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {confirmDeleteTierIdx === idx ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteTier(idx)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTierIdx(null)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditTierModal(idx)}
                              className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                              aria-label={`Edit aturan ${idx + 1}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTierIdx(idx)}
                              className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                              aria-label={`Hapus aturan ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Tier Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50 whitespace-nowrap">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3">Keterangan Tingkatan</th>
                      <th className="py-2.5 px-3 text-right">Batas Bawah (Min)</th>
                      <th className="py-2.5 px-3 text-right">Batas Atas (Maks)</th>
                      <th className="py-2.5 px-3 text-center">Persentase Fee</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editingTiers.map((tier, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">
                            {tier.label || generateTierLabel(tier.min_amount, tier.max_amount)}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                          {formatRupiah(Number(tier.min_amount))}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                          {tier.max_amount != null ? (
                            formatRupiah(Number(tier.max_amount))
                          ) : (
                            <span className="text-amber-700 font-sans italic text-[11px]">
                              Tanpa Batas Atas
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg tabular-nums">
                            {tier.fee_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tier.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {tier.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {confirmDeleteTierIdx === idx ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteTier(idx)}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTierIdx(null)}
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] transition"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditTierModal(idx)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                                title="Edit Aturan"
                                aria-label={`Edit aturan ${idx + 1}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTierIdx(idx)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                                title="Hapus Aturan"
                                aria-label={`Hapus aturan ${idx + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Simulator Kalkulasi Fee */}
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-emerald-200/60 bg-emerald-50/20">
          <div className="flex items-center gap-2 text-slate-900">
            <Calculator className="w-4 h-4 text-emerald-700 shrink-0" />
            <h3 className="text-sm font-bold">Simulator &amp; Uji Coba Aturan Fee Penarikan</h3>
          </div>
          <p className="text-xs text-slate-500">
            Uji coba nominal penarikan untuk memvalidasi apakah tingkatan fee yang Anda atur berjalan sesuai harapan sebelum diterapkan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end pt-1">
            <div>
              <label
                htmlFor="sim-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Masukkan Nominal Penarikan (Rp):
              </label>
              <input
                id="sim-amount"
                type="number"
                min={1000}
                step={50000}
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Tingkatan Cocok:</p>
              <p className="font-bold text-slate-900 text-xs mt-0.5 truncate">
                {simFeeCalc.matchedTier?.label || 'Tidak ada aturan aktif'}
              </p>
              <p className="text-[11px] text-emerald-700 font-bold">
                Tarif: {simFeeCalc.feePercentage}%
              </p>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Potongan Fee (Setelah Pembulatan):</p>
              <p className="font-bold text-rose-600 text-sm mt-0.5">
                - {formatRupiah(simFeeCalc.feeAmount)}
              </p>
              {simFeeCalc.rawFeeAmount !== simFeeCalc.feeAmount ? (
                <p className="text-[10px] text-amber-700 font-medium">
                  Fee murni: {formatRupiah(simFeeCalc.rawFeeAmount)}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">Masuk ke kas madrasah</p>
              )}
            </div>

            <div className="p-3 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/50">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Uang Diterima Pemilik:</p>
              <p className="font-black text-emerald-800 text-base mt-0.5">
                {formatRupiah(simFeeCalc.netAmount)}
              </p>
              <p className="text-[10px] text-emerald-600">Diterima bersih tunai</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 border border-emerald-200 p-4 text-xs text-slate-700 space-y-1.5">
            <p className="font-bold text-emerald-900">Aturan Pembulatan Nominal Fee:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600">
              <li>Jika nominal ratusannya <strong>kurang dari 330</strong>, dibulatkan menjadi <strong>000</strong> (contoh: Rp 2.300 → Rp 2.000).</li>
              <li>Jika nominal ratusannya <strong>antara 330 hingga 660</strong>, dibulatkan menjadi <strong>500</strong> (contoh: Rp 2.560 → Rp 2.500).</li>
              <li>Jika nominal ratusannya <strong>lebih dari 660</strong>, dibulatkan menjadi <strong>1.000</strong> (contoh: Rp 2.870 → Rp 3.000).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Tingkatan Aturan Fee */}
      {tierModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tier-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTierModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="tier-modal-title" className="text-sm font-bold text-slate-900">
                {editingTierIdx === null ? 'Tambah Tingkatan Aturan Fee' : 'Edit Tingkatan Aturan Fee'}
              </h3>
              <button
                type="button"
                onClick={() => setTierModalOpen(false)}
                aria-label="Tutup modal aturan fee"
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tierModalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{tierModalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="tier-label"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Keterangan / Label (Opsional)
                </label>
                <input
                  id="tier-label"
                  type="text"
                  placeholder="Contoh: Penarikan Rp 500.000 s/d Rp 1.000.000"
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                  className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Jika dikosongkan, label otomatis terbuat dari batas bawah dan atas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tier-min"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Batas Bawah (Min Rp)
                  </label>
                  <input
                    id="tier-min"
                    type="number"
                    min={0}
                    step={10000}
                    value={tierForm.min_amount}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, min_amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tabular-nums"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    {formatRupiah(tierForm.min_amount)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="tier-max"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Batas Atas (Maks Rp)
                  </label>
                  <input
                    id="tier-max"
                    type="number"
                    disabled={tierForm.is_unbounded}
                    min={tierForm.min_amount}
                    step={10000}
                    value={tierForm.max_amount || 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, max_amount: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {!tierForm.is_unbounded && (
                    <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                      {formatRupiah(Number(tierForm.max_amount) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="unbounded_check"
                  checked={tierForm.is_unbounded}
                  onChange={(e) =>
                    setTierForm({
                      ...tierForm,
                      is_unbounded: e.target.checked,
                      max_amount: e.target.checked ? null : 1000000,
                    })
                  }
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="unbounded_check"
                  className="text-xs text-slate-700 cursor-pointer select-none font-medium"
                >
                  Tanpa Batas Atas (Untuk penarikan di atas batas bawah)
                </label>
              </div>

              <div>
                <label
                  htmlFor="tier-pct"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Persentase Fee (%)
                </label>
                <div className="relative">
                  <input
                    id="tier-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={0.05}
                    value={tierForm.fee_percentage}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, fee_percentage: Number(e.target.value) })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 pr-7 py-2 text-xs font-bold text-slate-900 tabular-nums"
                  />
                  <span className="absolute right-3 top-2 font-bold text-slate-400 text-xs">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Contoh: 2.0, 2.25, 2.5, 3.5</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active_check"
                  checked={tierForm.is_active}
                  onChange={(e) => setTierForm({ ...tierForm, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="active_check"
                  className="text-xs text-slate-700 cursor-pointer select-none font-medium"
                >
                  Status Aturan Aktif
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTierModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTierModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Terapkan Aturan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
