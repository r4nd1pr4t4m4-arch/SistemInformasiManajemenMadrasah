'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
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

  const filteredFeeTypes = useMemo(() => {
    const q = feeSearch.trim().toLowerCase();
    if (!q) return feeTypes;
    return feeTypes.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (FEE_CATEGORY_LABELS[f.category] || f.category).toLowerCase().includes(q)
    );
  }, [feeTypes, feeSearch]);

  return (
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

        {filteredFeeTypes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">
            {feeTypes.length === 0
              ? 'Belum ada jenis biaya yang terdaftar.'
              : 'Tidak ada jenis biaya yang sesuai pencarian.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredFeeTypes.map((f) => (
              <div
                key={f.id}
                className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 break-words">{f.name}</p>
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {FEE_CATEGORY_LABELS[f.category] || f.category}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums shrink-0">
                  {formatRupiah(Number(f.default_amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
        <h2 className="text-base font-bold text-slate-900">
          Tagihan Terbaru ({bills.length})
        </h2>
        {bills.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">
            Belum ada tagihan siswa yang diterbitkan.
          </p>
        ) : (
          <div className="space-y-2">
            {bills.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 break-words">
                    {b.student?.full_name || 'Siswa'}
                  </p>
                  <p className="text-slate-500 break-words">
                    {b.fee_type?.name || '-'}
                    {b.is_sibling_exempt ? ' • Gratis Saudara' : ''}
                  </p>
                </div>
                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
