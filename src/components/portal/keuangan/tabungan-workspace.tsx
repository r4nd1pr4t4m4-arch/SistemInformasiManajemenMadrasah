'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileText,
  History,
  Loader2,
  Percent,
  PiggyBank,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import {
  calculateWithdrawalFee,
  DEFAULT_WITHDRAWAL_FEE_TIERS,
  generateTierLabel,
  type SavingsFeeTier,
} from '@/lib/domain/tabungan-fee';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  student_id?: string | null;
  teacher_id?: string | null;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

interface SavingsTransactionRow {
  id: string;
  account_id: string;
  transaction_type: 'SETOR' | 'TARIK';
  amount: number;
  fee_percentage?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
  balance_after: number;
  reference_number: string;
  notes: string | null;
  transaction_date: string;
  account?: {
    account_number: string;
    owner_name: string;
    owner_type: string;
  } | null;
}

interface StudentCandidate {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  phone: string | null;
}

interface GtkCandidate {
  id: string;
  full_name: string;
  nip: string | null;
  phone: string | null;
  staff_type: string;
}

interface PublicCandidate {
  id: string;
  full_name: string;
  phone: string | null;
  label: string;
}

export type TabunganSection = 'buka-rekening' | 'transaksi' | 'rekap' | 'aturan-fee';

export function TabunganWorkspace({ section }: { section: TabunganSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.TABUNGAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [accounts, setAccounts] = useState<SavingsAccountRow[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransactionRow[]>([]);
  const [feeTiers, setFeeTiers] = useState<SavingsFeeTier[]>(DEFAULT_WITHDRAWAL_FEE_TIERS);
  const [students, setStudents] = useState<StudentCandidate[]>([]);
  const [teachers, setTeachers] = useState<GtkCandidate[]>([]);
  const [tuStaff, setTuStaff] = useState<GtkCandidate[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  // Form Buka Rekening
  const [openAccForm, setOpenAccForm] = useState({
    owner_type: 'SISWA' as 'SISWA' | 'GURU' | 'TU' | 'UMUM',
    student_id: null as string | null,
    teacher_id: null as string | null,
    owner_name: '',
    owner_phone: '',
    initial_deposit: 50000,
  });

  // Form Transaksi
  const [trxForm, setTrxForm] = useState({
    account_id: '',
    transaction_type: 'SETOR' as 'SETOR' | 'TARIK',
    amount: 50000,
    notes: '',
  });

  // Struk / Kuitansi Transaksi Terakhir
  const [lastReceipt, setLastReceipt] = useState<{
    referenceNumber: string;
    accountNumber: string;
    ownerName: string;
    ownerType: string;
    type: 'SETOR' | 'TARIK';
    amount: number;
    feePercentage: number;
    feeAmount: number;
    netAmount: number;
    balanceAfter: number;
  } | null>(null);

  // State Manajemen Aturan Fee
  const [editingTiers, setEditingTiers] = useState<SavingsFeeTier[]>([]);
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [tierForm, setTierForm] = useState<{
    tier_order: number;
    label: string;
    min_amount: number;
    max_amount: number | null;
    is_unbounded: boolean;
    fee_percentage: number;
    is_active: boolean;
  }>({
    tier_order: 1,
    label: '',
    min_amount: 0,
    max_amount: 500000,
    is_unbounded: false,
    fee_percentage: 2.0,
    is_active: true,
  });

  // Simulator Fee
  const [simAmount, setSimAmount] = useState<number>(1000000);

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/keuangan/tabungan');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTransactions(data.transactions || []);
      const loadedTiers: SavingsFeeTier[] =
        data.feeTiers && data.feeTiers.length > 0 ? data.feeTiers : DEFAULT_WITHDRAWAL_FEE_TIERS;
      setFeeTiers(loadedTiers);
      setEditingTiers(loadedTiers);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setTuStaff(data.tuStaff || []);
      setPublicUsers(data.publicUsers || []);
    } catch {
      showToast('err', 'Gagal memuat data buku tabungan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Perhitungan Real-Time Fee Penarikan saat kasir / pengelola menginput nominal di form transaksi
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === trxForm.account_id) || null,
    [accounts, trxForm.account_id]
  );

  const realTimeFeeCalc = useMemo(() => {
    if (trxForm.transaction_type !== 'TARIK') return null;
    return calculateWithdrawalFee(trxForm.amount, feeTiers);
  }, [trxForm.transaction_type, trxForm.amount, feeTiers]);

  // Perhitungan Simulasi Fee
  const simFeeCalc = useMemo(() => {
    return calculateWithdrawalFee(simAmount, editingTiers);
  }, [simAmount, editingTiers]);

  async function postTabungan(body: unknown, successMsg: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/tabungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('err', data.error || 'Terjadi kesalahan.');
        return false;
      }
      showToast('ok', successMsg);
      await loadData();
      return data;
    } catch {
      showToast('err', 'Gagal terhubung ke server.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Simpan Aturan Fee
  async function handleSaveFeeTiers() {
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
        if (data.feeTiers) {
          setFeeTiers(data.feeTiers);
          setEditingTiers(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal menyimpan aturan fee.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Reset ke 6 Aturan Default
  async function handleResetFeeTiers() {
    if (!confirm('Kembalikan aturan fee penarikan ke 6 ketentuan standar (2% s/d 3.5%)?')) {
      return;
    }
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
        if (data.feeTiers) {
          setFeeTiers(data.feeTiers);
          setEditingTiers(data.feeTiers);
        }
      } else {
        showToast('err', data.error || 'Gagal mereset aturan fee.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openAddTierModal() {
    setEditingTierIdx(null);
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
    const finalMax = tierForm.is_unbounded ? null : Number(tierForm.max_amount);
    const finalLabel =
      tierForm.label.trim() || generateTierLabel(Number(tierForm.min_amount), finalMax);

    const updatedItem: SavingsFeeTier = {
      tier_order: tierForm.tier_order,
      label: finalLabel,
      min_amount: Number(tierForm.min_amount),
      max_amount: finalMax,
      fee_percentage: Number(tierForm.fee_percentage),
      is_active: tierForm.is_active,
    };

    if (editingTierIdx === null) {
      // Tambah baru
      setEditingTiers([...editingTiers, updatedItem]);
    } else {
      // Edit
      const nextList = [...editingTiers];
      nextList[editingTierIdx] = updatedItem;
      setEditingTiers(nextList);
    }

    setTierModalOpen(false);
  }

  function handleDeleteTier(idx: number) {
    if (!confirm('Hapus tingkatan aturan fee ini?')) return;
    const nextList = editingTiers.filter((_, i) => i !== idx);
    setEditingTiers(nextList);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku tabungan digital...
      </div>
    );
  }

  const totalTabungan = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalFeePenarikan = transactions
    .filter((t) => t.transaction_type === 'TARIK')
    .reduce((sum, t) => sum + Number(t.fee_amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header & Tab Navigation */}
      <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-700" />
            Tabungan Digital Warga &amp; Umum
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola pembukaan buku rekening, transaksi setor &amp; penarikan dengan fee otomatis, serta rekapitulasi saldo.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/portal/keuangan/tabungan/transaksi"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'transaksi'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Transaksi Setor / Tarik
          </Link>
          <Link
            href="/portal/keuangan/tabungan/buka-rekening"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'buka-rekening'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Buka Rekening
          </Link>
          <Link
            href="/portal/keuangan/tabungan/rekap"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              section === 'rekap'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Rekapitulasi
          </Link>
          {canManage && (
            <Link
              href="/portal/keuangan/tabungan/aturan-fee"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                section === 'aturan-fee'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Percent className="w-3.5 h-3.5" /> Aturan Fee Penarikan
            </Link>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Pengelola Tabungan</p>
          <p className="font-bold text-slate-900 mt-1">Admin &amp; Petugas Tabungan</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Siswa, Guru, TU &amp; Warga Umum</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Jumlah Rekening Aktif</p>
          <p className="font-bold text-slate-900 text-lg mt-1">{accounts.length} Rekening</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Semua peran terdaftar</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Saldo Terkumpul</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">{formatRupiah(totalTabungan)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Dana simpanan aktif</p>
        </div>
        <div className="modular-card rounded-2xl p-5 border border-amber-200/70 bg-amber-50/40">
          <p className="text-xs text-amber-800">Total Fee Penarikan</p>
          <p className="font-bold text-amber-900 text-lg mt-1">{formatRupiah(totalFeePenarikan)}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Akumulasi pendapatan fee</p>
        </div>
      </div>

      {/* SECTION 1: TRANSAKSI SETOR / TARIK (DENGAN FEE PENARIKAN REAL-TIME) */}
      {section === 'transaksi' && canManage && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700" /> Transaksi Setor / Tarik Tabungan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih nomor rekening dan tentukan jenis transaksi. Pada penarikan, fee transaksi akan dihitung secara otomatis.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!trxForm.account_id) {
                  showToast('err', 'Pilih rekening tabungan terlebih dahulu.');
                  return;
                }
                if (!selectedAccount) {
                  showToast('err', 'Data rekening tidak ditemukan.');
                  return;
                }
                if (trxForm.transaction_type === 'TARIK' && trxForm.amount > selectedAccount.balance) {
                  showToast('err', 'Saldo tabungan tidak mencukupi untuk penarikan.');
                  return;
                }

                const result = await postTabungan(
                  { action: 'TRANSACTION', ...trxForm },
                  trxForm.transaction_type === 'TARIK'
                    ? 'Transaksi penarikan tabungan berhasil diproses.'
                    : 'Transaksi setoran tabungan berhasil dicatat.'
                );

                if (result && result.transaction) {
                  setLastReceipt({
                    referenceNumber: result.transaction.reference_number,
                    accountNumber: selectedAccount.account_number,
                    ownerName: selectedAccount.owner_name,
                    ownerType: selectedAccount.owner_type,
                    type: trxForm.transaction_type,
                    amount: trxForm.amount,
                    feePercentage: result.fee_percentage || 0,
                    feeAmount: result.fee_amount || 0,
                    netAmount: result.net_amount || trxForm.amount,
                    balanceAfter: result.balance,
                  });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Rekening Tabungan <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={trxForm.account_id}
                  onChange={(e) => setTrxForm({ ...trxForm, account_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium"
                >
                  <option value="">-- Cari / Pilih Rekening --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.account_number}] {a.owner_name} ({a.owner_type}) — Saldo:{' '}
                      {formatRupiah(Number(a.balance))}
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pemilik:{' '}
                    <strong className="text-slate-800">{selectedAccount.owner_name}</strong> • Saldo
                    Tersedia:{' '}
                    <strong className="text-emerald-700">
                      {formatRupiah(Number(selectedAccount.balance))}
                    </strong>
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Transaksi <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={trxForm.transaction_type}
                    onChange={(e) =>
                      setTrxForm({
                        ...trxForm,
                        transaction_type: e.target.value as 'SETOR' | 'TARIK',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold"
                  >
                    <option value="SETOR">📥 SETOR TABUNGAN (Simpanan)</option>
                    <option value="TARIK">📤 TARIK TABUNGAN (Penarikan Tunai)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal Transaksi (Rp) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={trxForm.amount}
                    onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatRupiah(Number(trxForm.amount) || 0)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Keperluan bayar buku, biaya praktikum, dll"
                  value={trxForm.notes}
                  onChange={(e) => setTrxForm({ ...trxForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses Transaksi...
                  </>
                ) : trxForm.transaction_type === 'TARIK' ? (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-amber-400" /> Proses Penarikan Tunai
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Proses Setor Tabungan
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Rincian Fee & Estimasi Penarikan / Struk Terakhir */}
          <div className="lg:col-span-5 space-y-4">
            {trxForm.transaction_type === 'TARIK' && realTimeFeeCalc && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Rincian Fee Penarikan Otomatis
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-amber-200/70 text-slate-600">
                    <span>Nominal Penarikan Saldo:</span>
                    <strong className="text-slate-900">
                      {formatRupiah(realTimeFeeCalc.amount)}
                    </strong>
                  </div>

                  <div className="flex justify-between py-1 border-b border-amber-200/70 text-slate-600">
                    <span>Tarif Fee Dikenakan:</span>
                    <span className="font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px]">
                      {realTimeFeeCalc.feePercentage}% ({realTimeFeeCalc.matchedTier?.label || '-'})
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-amber-200/70 text-rose-700">
                    <span>Potongan Fee Transaksi:</span>
                    <strong className="text-rose-700">
                      - {formatRupiah(realTimeFeeCalc.feeAmount)}
                    </strong>
                  </div>

                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Nominal Uang Yang Diterima Pemilik:
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">
                      {formatRupiah(realTimeFeeCalc.netAmount)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed">
                  💡 <strong>Ketentuan Fee:</strong> Nominal fee langsung mengurangi nominal uang tunai
                  yang diserahkan ke pemilik tabungan. Saldo rekening tetap berkurang sebesar nominal penarikan penuh (
                  <strong>{formatRupiah(realTimeFeeCalc.amount)}</strong>).
                </div>
              </div>
            )}

            {/* Bukti Transaksi Terakhir */}
            {lastReceipt && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Kuitansi Transaksi Terakhir
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {lastReceipt.referenceNumber}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 bg-white p-4 rounded-2xl border border-emerald-100">
                  <p className="text-slate-600">
                    Rekening:{' '}
                    <strong className="text-slate-900">
                      {lastReceipt.accountNumber} ({lastReceipt.ownerName})
                    </strong>
                  </p>
                  <p className="text-slate-600">
                    Jenis:{' '}
                    <strong className="text-slate-900">
                      {lastReceipt.type === 'TARIK' ? 'PENARIKAN TABUNGAN' : 'SETORAN TABUNGAN'}
                    </strong>
                  </p>
                  <p className="text-slate-600">
                    Nominal Transaksi:{' '}
                    <strong className="text-slate-900">{formatRupiah(lastReceipt.amount)}</strong>
                  </p>
                  {lastReceipt.type === 'TARIK' && (
                    <>
                      <p className="text-rose-600">
                        Fee Penarikan ({lastReceipt.feePercentage}%):{' '}
                        <strong>- {formatRupiah(lastReceipt.feeAmount)}</strong>
                      </p>
                      <p className="text-emerald-700 font-bold border-t border-slate-100 pt-1">
                        Uang Diserahkan ke Nasabah: {formatRupiah(lastReceipt.netAmount)}
                      </p>
                    </>
                  )}
                  <p className="text-slate-600 border-t border-slate-100 pt-1">
                    Sisa Saldo Rekening:{' '}
                    <strong className="text-emerald-700">
                      {formatRupiah(lastReceipt.balanceAfter)}
                    </strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: BUKA BUKU TABUNGAN DIGITAL */}
      {section === 'buka-rekening' && canManage && (
        <div className="glass-card rounded-3xl p-6 space-y-4 max-w-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-700" /> Buka Buku Tabungan Digital
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftarkan rekening tabungan baru untuk Siswa, Guru, Staf TU, atau Warga Umum.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!openAccForm.owner_name.trim()) {
                showToast('err', 'Pilih atau masukkan nama pemilik rekening terlebih dahulu.');
                return;
              }
              await postTabungan(
                { action: 'OPEN_ACCOUNT', ...openAccForm },
                'Buku tabungan baru berhasil dibuka.'
              );
              setSelectedCandidateId('');
              setOpenAccForm({
                ...openAccForm,
                student_id: null,
                teacher_id: null,
                owner_name: '',
                owner_phone: '',
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Pemilik Rekening <span className="text-rose-600">*</span>
              </label>
              <select
                value={openAccForm.owner_type}
                onChange={(e) => {
                  const nextType = e.target.value as typeof openAccForm.owner_type;
                  setSelectedCandidateId('');
                  setOpenAccForm({
                    ...openAccForm,
                    owner_type: nextType,
                    student_id: null,
                    teacher_id: null,
                    owner_name: '',
                    owner_phone: '',
                  });
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="SISWA">Siswa Madrasah</option>
                <option value="GURU">Guru / Pendidik</option>
                <option value="TU">Tenaga Kependidikan (TU)</option>
                <option value="UMUM">Masyarakat Umum / Warga</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Nama Pemilik Rekening ({openAccForm.owner_type}){' '}
                <span className="text-rose-600">*</span>
              </label>

              {openAccForm.owner_type === 'SISWA' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const s = students.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: s ? s.id : null,
                      teacher_id: null,
                      owner_name: s ? s.full_name : '',
                      owner_phone: s?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Siswa Aktif --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : s.nisn ? `(NISN: ${s.nisn})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'GURU' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const g = teachers.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: null,
                      teacher_id: g ? g.id : null,
                      owner_name: g ? g.full_name : '',
                      owner_phone: g?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} {g.nip ? `(NIP: ${g.nip})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'TU' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const t = tuStaff.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: null,
                      teacher_id: t ? t.id : null,
                      owner_name: t ? t.full_name : '',
                      owner_phone: t?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Staf Tata Usaha --</option>
                  {tuStaff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.nip ? `(NIP: ${t.nip})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'UMUM' && (
                <div className="space-y-2">
                  <select
                    required={publicUsers.length > 0 && selectedCandidateId !== '__MANUAL__'}
                    value={selectedCandidateId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCandidateId(id);
                      if (id === '__MANUAL__') {
                        setOpenAccForm({
                          ...openAccForm,
                          student_id: null,
                          teacher_id: null,
                          owner_name: '',
                          owner_phone: '',
                        });
                        return;
                      }
                      const u = publicUsers.find((item) => item.id === id);
                      setOpenAccForm({
                        ...openAccForm,
                        student_id: null,
                        teacher_id: null,
                        owner_name: u ? u.full_name : '',
                        owner_phone: u?.phone || '',
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Pengguna / Anggota Umum --</option>
                    {publicUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                    <option value="__MANUAL__">+ Input Nama Masyarakat Umum Lainnya...</option>
                  </select>

                  {selectedCandidateId === '__MANUAL__' && (
                    <input
                      required
                      placeholder="Masukkan Nama Lengkap Masyarakat Umum"
                      value={openAccForm.owner_name}
                      onChange={(e) =>
                        setOpenAccForm({ ...openAccForm, owner_name: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  placeholder="08xxxxxxxxxx"
                  value={openAccForm.owner_phone}
                  onChange={(e) => setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Setoran Awal (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={openAccForm.initial_deposit}
                  onChange={(e) =>
                    setOpenAccForm({ ...openAccForm, initial_deposit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              {submitting ? 'Membuka Rekening...' : 'Buka Rekening Tabungan'}
            </button>
          </form>
        </div>
      )}

      {/* SECTION 3: REKAPITULASI BUKU TABUNGAN & RIWAYAT TRANSAKSI */}
      {section === 'rekap' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-700" /> Rekapitulasi Riwayat Transaksi &amp;
              Fee Penarikan
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">No. Ref</th>
                    <th className="py-2.5 px-3">Rekening &amp; Nasabah</th>
                    <th className="py-2.5 px-3">Jenis</th>
                    <th className="py-2.5 px-3 text-right">Nominal Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Potongan Fee</th>
                    <th className="py-2.5 px-3 text-right">Uang Diterima / Masuk</th>
                    <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada riwayat transaksi tabungan.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {new Date(t.transaction_date).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {t.reference_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">
                            {t.account?.owner_name || 'Nasabah'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {t.account?.account_number} • {t.account?.owner_type}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.transaction_type === 'SETOR'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {t.transaction_type === 'SETOR' ? '📥 SETOR' : '📤 TARIK'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatRupiah(Number(t.amount))}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {t.transaction_type === 'TARIK' && Number(t.fee_amount) > 0 ? (
                            <span className="text-rose-600 font-semibold">
                              - {formatRupiah(Number(t.fee_amount))} ({t.fee_percentage}%)
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {formatRupiah(Number(t.net_amount || t.amount))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatRupiah(Number(t.balance_after))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" /> Daftar Rekening Buku Tabungan (
              {accounts.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="modular-card rounded-2xl p-4 flex flex-col justify-between text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-emerald-700 font-bold">
                        {acc.account_number}
                      </p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{acc.owner_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {acc.owner_type}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Saldo Rekening:</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatRupiah(Number(acc.balance))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: ATURAN FEE PENARIKAN TABUNGAN (ADMIN & PENGELOLA TABUNGAN) */}
      {section === 'aturan-fee' && canManage && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-700" /> Pengaturan Tingkatan Fee Penarikan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin dan Pengelola Tabungan dapat mengatur persentase fee serta batas bawah (minimum) dan batas atas (maksimum) nominal penarikan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetFeeTiers}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset Default (6 Tingkatan)
                </button>
                <button
                  type="button"
                  onClick={openAddTierModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Aturan Fee
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeeTiers}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Pengaturan
                </button>
              </div>
            </div>

            {/* Tabel Tingkatan Fee */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3">Keterangan Tingkatan</th>
                    <th className="py-2.5 px-3 text-right">Batas Bawah (Min)</th>
                    <th className="py-2.5 px-3 text-right">Batas Atas (Maks)</th>
                    <th className="py-2.5 px-3 text-center">Persentase Fee</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Aksi</th>
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
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatRupiah(Number(tier.min_amount))}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {tier.max_amount != null ? (
                          formatRupiah(Number(tier.max_amount))
                        ) : (
                          <span className="text-amber-700 font-sans italic text-[11px]">
                            Tanpa Batas Atas
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
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
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTierModal(idx)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                            title="Edit Aturan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTier(idx)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                            title="Hapus Aturan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simulator Kalkulasi Fee */}
          <div className="glass-card rounded-3xl p-6 space-y-4 border border-emerald-200/60 bg-emerald-50/20">
            <div className="flex items-center gap-2 text-slate-900">
              <Calculator className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold">Simulator &amp; Uji Coba Aturan Fee Penarikan</h3>
            </div>
            <p className="text-xs text-slate-500">
              Uji coba nominal penarikan untuk memvalidasi apakah tingkatan fee yang Anda atur berjalan sesuai harapan sebelum diterapkan.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Masukkan Nominal Penarikan (Rp):
                </label>
                <input
                  type="number"
                  min={1000}
                  step={50000}
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900"
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
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Potongan Fee:</p>
                <p className="font-bold text-rose-600 text-sm mt-0.5">
                  - {formatRupiah(simFeeCalc.feeAmount)}
                </p>
                <p className="text-[10px] text-slate-400">Masuk ke kas madrasah</p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/50">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Uang Diterima Pemilik:</p>
                <p className="font-black text-emerald-800 text-base mt-0.5">
                  {formatRupiah(simFeeCalc.netAmount)}
                </p>
                <p className="text-[10px] text-emerald-600">Diterima bersih tunai</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Tingkatan Aturan Fee */}
      {tierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingTierIdx === null ? 'Tambah Tingkatan Aturan Fee' : 'Edit Tingkatan Aturan Fee'}
              </h3>
              <button
                type="button"
                onClick={() => setTierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Label (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Penarikan Rp 500.000 s/d Rp 1.000.000"
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Jika dikosongkan, label otomatis terbuat dari batas bawah dan atas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Bawah (Min Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={tierForm.min_amount}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, min_amount: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {formatRupiah(tierForm.min_amount)}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Atas (Maks Rp)
                  </label>
                  <input
                    type="number"
                    disabled={tierForm.is_unbounded}
                    min={tierForm.min_amount}
                    step={10000}
                    value={tierForm.max_amount || 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, max_amount: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {!tierForm.is_unbounded && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Persentase Fee (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.05}
                    value={tierForm.fee_percentage}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, fee_percentage: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
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
    </div>
  );
}
