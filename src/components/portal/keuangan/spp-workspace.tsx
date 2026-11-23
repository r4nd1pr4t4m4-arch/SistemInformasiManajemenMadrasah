'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { isSiblingDiscountCategory } from '@/lib/domain/sibling-discount';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { SppSlipModal } from './spp-slip-modal';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';

interface StudentOption {
  id: string;
  full_name: string;
  nis: string | null;
  status?: string;
}

interface FeeTypeRow {
  id: string;
  name: string;
  category: string;
  default_amount: number;
}

interface BillRow {
  id: string;
  amount: number;
  original_amount?: number | null;
  discount_amount?: number | null;
  is_sibling_exempt?: boolean;
  notes?: string | null;
  paid_amount: number;
  status: string;
  student?: { full_name: string; nis: string | null } | null;
  fee_type?: { name: string; category: string } | null;
}

interface SiblingMemberRow {
  id: string;
  group_id: string;
  student_id: string;
  is_exempt: boolean;
  student?: {
    id: string;
    full_name: string;
    nis: string | null;
    status: string;
  } | null;
}

interface SiblingGroupRow {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  members: SiblingMemberRow[];
  billingSummary: {
    totalSiblings: number;
    payableCount: number;
    exemptCount: number;
    exemptStudentId: string | null;
  };
}

const FEE_CATEGORY_LABELS: Record<string, string> = {
  SPP: 'SPP',
  KOMITE: 'Iuran Komite',
  UANG_GEDUNG: 'Uang Gedung',
  LAINNYA: 'Lainnya',
};

export type SppSection = 'jenis-biaya' | 'terbitkan' | 'pembayaran' | 'kelompok-saudara';

export function SppWorkspace({ section }: { section: SppSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SPP_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [siblingGroups, setSiblingGroups] = useState<SiblingGroupRow[]>([]);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);
  const [feeSearch, setFeeSearch] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<
    'ALL' | 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS'
  >('ALL');
  const [billPage, setBillPage] = useState(1);
  const [groupSearch, setGroupSearch] = useState('');
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  const [feeForm, setFeeForm] = useState({
    name: '',
    category: 'SPP' as 'SPP' | 'KOMITE' | 'UANG_GEDUNG' | 'LAINNYA',
    default_amount: 150000,
  });
  const [billForm, setBillForm] = useState({
    student_id: '',
    fee_type_id: '',
    billing_month: new Date().getMonth() + 1,
    billing_year: new Date().getFullYear(),
    amount: 150000,
  });
  const [payForm, setPayForm] = useState({
    bill_id: '',
    amount_paid: 150000,
    payment_method: 'TUNAI' as 'TUNAI' | 'TRANSFER' | 'QRIS',
  });

  // Sibling Group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: '',
    notes: '',
    is_active: true,
    student_ids: [] as string[],
    exempt_student_id: '',
  });
  const [studentPickerId, setStudentPickerId] = useState('');

  // Generate bills for a sibling group modal
  const [genModalGroup, setGenModalGroup] = useState<SiblingGroupRow | null>(null);
  const [genForm, setGenForm] = useState({
    fee_type_id: '',
    billing_month: new Date().getMonth() + 1,
    billing_year: new Date().getFullYear(),
    amount: 150000,
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [biRes, sppRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store', signal }),
        fetch('/api/keuangan/spp', { cache: 'no-store', signal }),
      ]);
      const [bi, spp] = await Promise.all([biRes.json(), sppRes.json()]);
      if (reqId !== requestIdRef.current) return;
      if (!sppRes.ok) throw new Error(spp.error || 'Gagal memuat data SPP.');
      hasLoadedOnceRef.current = true;
      setLoadError(null);
      setStudents(biRes.ok ? bi.students || [] : []);
      setFeeTypes(spp.feeTypes || []);
      setBills(spp.bills || []);
      setSiblingGroups(spp.siblingGroups || []);
    } catch (e) {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      setLoadError(e instanceof Error ? e.message : 'Gagal terhubung ke server.');
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

  async function postSpp(body: unknown, successMsg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan/spp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Terjadi kesalahan.', 'err');
        return false;
      }
      showToast(successMsg, 'ok');
      await loadData(true);
      return true;
    } catch {
      showToast('Terjadi kesalahan jaringan. Silakan coba lagi.', 'err');
      return false;
    } finally {
      setSubmitting(false);
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

  function openCreateGroup() {
    setEditingGroupId(null);
    setGroupForm({
      name: '',
      notes: '',
      is_active: true,
      student_ids: [],
      exempt_student_id: '',
    });
    setStudentPickerId('');
    setGroupModalOpen(true);
  }

  function openEditGroup(g: SiblingGroupRow) {
    setEditingGroupId(g.id);
    setGroupForm({
      name: g.name,
      notes: g.notes || '',
      is_active: g.is_active,
      student_ids: g.members.map((m) => m.student_id),
      exempt_student_id: g.billingSummary.exemptStudentId || g.members[0]?.student_id || '',
    });
    setStudentPickerId('');
    setGroupModalOpen(true);
  }

  function addStudentToGroup() {
    if (!studentPickerId || groupForm.student_ids.includes(studentPickerId)) return;
    const nextIds = [...groupForm.student_ids, studentPickerId];
    setGroupForm({
      ...groupForm,
      student_ids: nextIds,
      exempt_student_id: groupForm.exempt_student_id || (nextIds.length >= 2 ? nextIds[0] : ''),
    });
    setStudentPickerId('');
  }

  function removeStudentFromGroup(sid: string) {
    const nextIds = groupForm.student_ids.filter((id) => id !== sid);
    setGroupForm({
      ...groupForm,
      student_ids: nextIds,
      exempt_student_id:
        groupForm.exempt_student_id === sid ? nextIds[0] || '' : groupForm.exempt_student_id,
    });
  }

  const filteredFeeTypes = useMemo(() => {
    const q = feeSearch.trim().toLowerCase();
    if (!q) return feeTypes;
    return feeTypes.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (FEE_CATEGORY_LABELS[f.category] || f.category).toLowerCase().includes(q)
    );
  }, [feeTypes, feeSearch]);

  const unpaidBills = useMemo(
    () => bills.filter((b) => b.status !== 'LUNAS'),
    [bills]
  );

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    return bills.filter((b) => {
      if (billStatusFilter !== 'ALL' && b.status !== billStatusFilter) return false;
      if (!q) return true;
      return (
        (b.student?.full_name || '').toLowerCase().includes(q) ||
        (b.student?.nis || '').toLowerCase().includes(q) ||
        (b.fee_type?.name || '').toLowerCase().includes(q)
      );
    });
  }, [bills, billStatusFilter, billSearch]);

  const BILL_PAGE_SIZE = 10;
  const totalBillPages = Math.max(1, Math.ceil(filteredBills.length / BILL_PAGE_SIZE));
  const currentBillPage = Math.min(billPage, totalBillPages);
  const billPageStart = (currentBillPage - 1) * BILL_PAGE_SIZE;
  const pagedBills = useMemo(
    () => filteredBills.slice(billPageStart, billPageStart + BILL_PAGE_SIZE),
    [filteredBills, billPageStart]
  );

  const filteredSiblingGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return siblingGroups;
    return siblingGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q) ||
        g.members.some(
          (m) =>
            (m.student?.full_name || '').toLowerCase().includes(q) ||
            (m.student?.nis || '').toLowerCase().includes(q)
        )
    );
  }, [siblingGroups, groupSearch]);

  const anySppModalOpen = groupModalOpen || Boolean(genModalGroup);
  useEffect(() => {
    if (!anySppModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        setGroupModalOpen(false);
        setGenModalGroup(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anySppModalOpen, submitting]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data SPP &amp; Iuran Komite...
      </div>
    );
  }

  const totalTunggakan = bills.reduce(
    (sum, b) => sum + Math.max(0, Number(b.amount) - Number(b.paid_amount)),
    0
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {section === 'jenis-biaya'
              ? 'Master Jenis Biaya SPP & Komite'
              : section === 'terbitkan'
              ? 'Terbitkan Tagihan Siswa'
              : section === 'pembayaran'
              ? 'Pembayaran & Riwayat Tagihan SPP'
              : 'Kelompok Saudara (N -> N-1)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Pengelolaan tagihan SPP, iuran komite, potongan kelompok saudara, dan kwitansi pembayaran.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 font-semibold shrink-0 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start sm:items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-0.5 rounded-md hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Pengelola Modul</p>
          <p className="font-bold text-slate-900 mt-1 text-sm sm:text-base">Bendahara Komite</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tanpa tambahan tunjangan honorarium</p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Tagihan Tercatat</p>
          <p className="font-bold text-slate-900 text-base sm:text-lg mt-1 tabular-nums">
            {bills.length} Tagihan
          </p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Tunggakan</p>
          <p className="font-bold text-rose-600 text-base sm:text-lg mt-1 tabular-nums">
            {formatRupiah(totalTunggakan)}
          </p>
        </div>
        <div className="modular-card rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Kelompok Saudara Aktif</p>
          <p className="font-bold text-emerald-700 text-base sm:text-lg mt-1 tabular-nums">
            {siblingGroups.filter((g) => g.is_active).length} Kelompok
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">N saudara → bayar N-1</p>
        </div>
      </div>

      {section === 'kelompok-saudara' && canManage && (
        <div className="flex justify-end">
          <button
            onClick={openCreateGroup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Tambah Kelompok Saudara
          </button>
        </div>
      )}

      {section !== 'kelompok-saudara' ? (
        <div className="space-y-6">
          {section === 'jenis-biaya' && (
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
                              category: e.target.value as typeof feeForm.category,
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
          )}

          {section === 'terbitkan' && (
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
          )}

          {section === 'pembayaran' && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {canManage ? 'Catat Pembayaran & Daftar Tagihan' : 'Daftar Tagihan SPP & Komite'}
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {unpaidBills.length} tagihan belum lunas
                </span>
              </div>

              {canManage && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!payForm.bill_id) {
                      showToast('Pilih tagihan yang akan dibayar terlebih dahulu.', 'err');
                      return;
                    }
                    if (!Number.isFinite(payForm.amount_paid) || payForm.amount_paid < 1) {
                      showToast('Nominal pembayaran minimal Rp 1.', 'err');
                      return;
                    }
                    const ok = await postSpp(
                      { action: 'RECORD_PAYMENT', ...payForm },
                      'Pembayaran SPP/Komite berhasil dicatat.'
                    );
                    if (ok) {
                      setPayForm((prev) => ({ ...prev, bill_id: '' }));
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl"
                >
                  <div className="sm:col-span-2 lg:col-span-5">
                    <label
                      htmlFor="pay-bill"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Tagihan Belum Lunas *
                    </label>
                    <select
                      id="pay-bill"
                      required
                      value={payForm.bill_id}
                      onChange={(e) => {
                        const selected = unpaidBills.find((b) => b.id === e.target.value);
                        const remaining = selected
                          ? Math.max(1, Number(selected.amount) - Number(selected.paid_amount))
                          : payForm.amount_paid;
                        setPayForm({
                          ...payForm,
                          bill_id: e.target.value,
                          amount_paid: remaining,
                        });
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Tagihan Belum Lunas --</option>
                      {unpaidBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.student?.full_name} — {b.fee_type?.name} (Sisa:{' '}
                          {formatRupiah(Math.max(0, Number(b.amount) - Number(b.paid_amount)))})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-3">
                    <label
                      htmlFor="pay-amount"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Nominal Bayar (Rp) *
                    </label>
                    <input
                      id="pay-amount"
                      type="number"
                      required
                      min={1}
                      value={payForm.amount_paid}
                      onChange={(e) =>
                        setPayForm({ ...payForm, amount_paid: Number(e.target.value) })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label
                      htmlFor="pay-method"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Metode
                    </label>
                    <select
                      id="pay-method"
                      value={payForm.payment_method}
                      onChange={(e) =>
                        setPayForm({
                          ...payForm,
                          payment_method: e.target.value as 'TUNAI' | 'TRANSFER' | 'QRIS',
                        })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="TUNAI">Tunai</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs py-2.5 px-3 transition shadow-sm"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Bayar
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1 min-w-0 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={billSearch}
                    onChange={(e) => {
                      setBillSearch(e.target.value);
                      setBillPage(1);
                    }}
                    placeholder="Cari nama siswa, NIS, atau biaya..."
                    aria-label="Cari daftar tagihan"
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {billSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setBillSearch('');
                        setBillPage(1);
                      }}
                      aria-label="Hapus pencarian tagihan"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  aria-label="Filter status tagihan"
                  value={billStatusFilter}
                  onChange={(e) => {
                    setBillStatusFilter(
                      e.target.value as 'ALL' | 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS'
                    );
                    setBillPage(1);
                  }}
                  className="w-full sm:w-44 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="ALL">Semua Status ({bills.length})</option>
                  <option value="BELUM_LUNAS">Belum Lunas</option>
                  <option value="CICILAN">Cicilan</option>
                  <option value="LUNAS">Lunas</option>
                </select>
              </div>

              {pagedBills.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  {bills.length === 0
                    ? 'Belum ada tagihan SPP atau komite yang tercatat.'
                    : 'Tidak ada tagihan yang cocok dengan filter pencarian.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pagedBills.map((b) => (
                    <div
                      key={b.id}
                      className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-slate-900 break-words">
                            {b.student?.full_name} • {b.fee_type?.name}
                          </p>
                          {b.is_sibling_exempt && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                              Gratis Saudara
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 tabular-nums">
                          Tagihan:{' '}
                          {b.is_sibling_exempt && b.original_amount ? (
                            <>
                              <span className="line-through text-slate-400 mr-1">
                                {formatRupiah(Number(b.original_amount))}
                              </span>
                              <span className="font-semibold text-emerald-700">Rp 0</span>
                            </>
                          ) : (
                            formatRupiah(Number(b.amount))
                          )}{' '}
                          • Dibayar: {formatRupiah(Number(b.paid_amount))}
                        </p>
                        {b.notes && (
                          <p className="text-[11px] text-slate-400 break-words mt-0.5">{b.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                            b.status === 'LUNAS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : b.status === 'CICILAN'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {b.status}
                        </span>
                        {(Number(b.paid_amount) > 0 ||
                          b.status === 'LUNAS' ||
                          b.is_sibling_exempt) && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSppSlip({
                                billId: b.id,
                                studentName: b.student?.full_name || 'Siswa',
                                studentNis: b.student?.nis || null,
                                feeName: b.fee_type?.name || 'SPP / Iuran',
                                feeCategory: b.fee_type?.category || null,
                                amount: Number(b.amount) || 0,
                                originalAmount: b.original_amount ?? null,
                                discountAmount: b.discount_amount ?? null,
                                isSiblingExempt: Boolean(b.is_sibling_exempt),
                                paidAmount: Number(b.paid_amount) || 0,
                                status: b.status,
                                notes: b.notes || null,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                            title="Lihat & Unduh Slip PNG"
                          >
                            <Download className="w-3 h-3" /> PNG
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredBills.length > BILL_PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Menampilkan {billPageStart + 1}–
                    {Math.min(billPageStart + BILL_PAGE_SIZE, filteredBills.length)} dari{' '}
                    {filteredBills.length} tagihan
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBillPage((p) => Math.max(1, p - 1))}
                      disabled={currentBillPage <= 1}
                      aria-label="Halaman tagihan sebelumnya"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-medium text-slate-700 tabular-nums">
                      Hal {currentBillPage} / {totalBillPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBillPage((p) => Math.min(totalBillPages, p + 1))}
                      disabled={currentBillPage >= totalBillPages}
                      aria-label="Halaman tagihan berikutnya"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 leading-relaxed">
            <strong>Aturan Kelompok Saudara (SPP &amp; Iuran Komite):</strong> Jika terdapat{' '}
            <strong>2 saudara</strong> aktif dalam satu kelompok maka cukup membayar untuk{' '}
            <strong>1 siswa</strong> (1 siswa gratis). Jika ada <strong>3 saudara</strong> maka
            cukup membayar untuk <strong>2 siswa</strong> (1 siswa gratis), dan seterusnya mengikuti
            pola <strong>N saudara → bayar (N - 1) siswa</strong>.
          </div>

          {siblingGroups.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">
                Daftar Kelompok Saudara ({filteredSiblingGroups.length})
              </p>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Cari nama kelompok atau anggota..."
                  aria-label="Cari kelompok saudara"
                  className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => setGroupSearch('')}
                    aria-label="Hapus pencarian kelompok"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredSiblingGroups.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500">
              {siblingGroups.length === 0 ? (
                <>
                  Belum ada Kelompok Saudara. Klik <strong>Tambah Kelompok Saudara</strong> untuk
                  mengelompokkan siswa bersaudara.
                </>
              ) : (
                'Tidak ada kelompok saudara yang cocok dengan pencarian.'
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredSiblingGroups.map((g) => {
                const isConfirming = confirmDeleteGroupId === g.id;
                return (
                <div key={g.id} className="glass-card rounded-3xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm break-words">{g.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {g.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      {g.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 break-words">{g.notes}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              aria-busy={submitting || undefined}
                              disabled={submitting}
                              onClick={async () => {
                                const ok = await postSpp(
                                  { action: 'DELETE_SIBLING_GROUP', group_id: g.id },
                                  'Kelompok saudara berhasil dihapus.'
                                );
                                if (ok) setConfirmDeleteGroupId(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold disabled:opacity-50 transition"
                            >
                              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>Hapus</span>
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setConfirmDeleteGroupId(null)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditGroup(g)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              title="Edit Kelompok"
                              aria-label={`Edit ${g.name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGroupId(g.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                              title="Hapus Kelompok"
                              aria-label={`Hapus ${g.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Saudara Aktif: <strong>{g.billingSummary.totalSiblings}</strong>
                    </span>
                    <span>
                      Bayar: <strong className="text-slate-900">{g.billingSummary.payableCount}</strong>{' '}
                      siswa
                    </span>
                    <span>
                      Gratis:{' '}
                      <strong className="text-emerald-700">{g.billingSummary.exemptCount}</strong>{' '}
                      siswa
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {g.members.map((m) => {
                      const isExempt = g.billingSummary.exemptStudentId === m.student_id;
                      return (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 break-words">
                              {m.student?.full_name || '-'}
                            </span>
                            <span className="text-slate-400 ml-2">
                              NIS: {m.student?.nis || '-'}
                            </span>
                          </div>
                          {isExempt ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] shrink-0">
                              Gratis SPP &amp; Komite
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] shrink-0">
                              Bayar Normal
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canManage && g.is_active && g.billingSummary.totalSiblings > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstFee =
                          feeTypes.find((f) => isSiblingDiscountCategory(f.category)) || feeTypes[0];
                        setGenModalGroup(g);
                        setGenForm({
                          fee_type_id: firstFee?.id || '',
                          billing_month: new Date().getMonth() + 1,
                          billing_year: new Date().getFullYear(),
                          amount: firstFee ? Number(firstFee.default_amount) : 150000,
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                    >
                      Terbitkan Tagihan Kelompok Ini
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canManage && groupModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setGroupModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="group-modal-title" className="text-base font-bold text-slate-900">
                {editingGroupId ? 'Edit Kelompok Saudara' : 'Tambah Kelompok Saudara'}
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setGroupModalOpen(false)}
                aria-label="Tutup modal kelompok saudara"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedName = groupForm.name.trim();
                if (trimmedName.length < 2) {
                  showToast('Nama kelompok saudara minimal 2 karakter.', 'err');
                  return;
                }
                if (groupForm.student_ids.length === 0) {
                  showToast('Minimal pilih 1 anggota siswa.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: editingGroupId ? 'UPDATE_SIBLING_GROUP' : 'CREATE_SIBLING_GROUP',
                    ...(editingGroupId ? { group_id: editingGroupId } : {}),
                    ...groupForm,
                    name: trimmedName,
                    notes: groupForm.notes.trim(),
                    exempt_student_id: groupForm.exempt_student_id || null,
                  },
                  editingGroupId
                    ? 'Kelompok saudara berhasil diperbarui.'
                    : 'Kelompok saudara berhasil dibuat.'
                );
                if (ok) setGroupModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label
                  htmlFor="group-name"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nama Kelompok / Keluarga *
                </label>
                <input
                  id="group-name"
                  required
                  minLength={2}
                  placeholder="Contoh: Keluarga Bpk. Ahmad"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="group-notes"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Catatan
                </label>
                <input
                  id="group-notes"
                  placeholder="Opsional"
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="group-student-picker"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tambah Anggota Siswa
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="group-student-picker"
                    value={studentPickerId}
                    onChange={(e) => setStudentPickerId(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students
                      .filter((s) => !groupForm.student_ids.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addStudentToGroup}
                    disabled={!studentPickerId}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shrink-0 transition"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-700">
                  Anggota ({groupForm.student_ids.length} siswa →{' '}
                  {groupForm.student_ids.length >= 2
                    ? `bayar ${groupForm.student_ids.length - 1}, 1 gratis`
                    : 'bayar penuh'}
                  )
                </p>
                {groupForm.student_ids.map((sid) => {
                  const st = students.find((s) => s.id === sid);
                  return (
                    <div
                      key={sid}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <span className="font-medium text-slate-900 break-words">
                        {st?.full_name || sid}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        {groupForm.student_ids.length >= 2 && (
                          <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold cursor-pointer">
                            <input
                              type="radio"
                              name="exempt_student"
                              checked={groupForm.exempt_student_id === sid}
                              onChange={() =>
                                setGroupForm({ ...groupForm, exempt_student_id: sid })
                              }
                            />
                            Slot Gratis
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => removeStudentFromGroup(sid)}
                          className="text-rose-600 hover:underline font-medium"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupForm.is_active}
                  onChange={(e) => setGroupForm({ ...groupForm, is_active: e.target.checked })}
                />
                Kelompok Aktif
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || groupForm.student_ids.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Kelompok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManage && genModalGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gen-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setGenModalGroup(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="gen-modal-title" className="text-base font-bold text-slate-900 break-words">
                Terbitkan Tagihan: {genModalGroup.name}
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setGenModalGroup(null)}
                aria-label="Tutup modal tagihan kelompok"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
              {genModalGroup.billingSummary.totalSiblings} saudara aktif → akan diterbitkan tagihan
              berbayar untuk <strong>{genModalGroup.billingSummary.payableCount} siswa</strong> dan{' '}
              <strong>{genModalGroup.billingSummary.exemptCount} siswa Gratis</strong> (Rp 0).
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!genForm.fee_type_id) {
                  showToast('Pilih jenis biaya terlebih dahulu.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(genForm.billing_month) ||
                  genForm.billing_month < 1 ||
                  genForm.billing_month > 12
                ) {
                  showToast('Bulan tagihan harus antara 1 sampai 12.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(genForm.billing_year) ||
                  genForm.billing_year < 2020 ||
                  genForm.billing_year > 2100
                ) {
                  showToast('Tahun tagihan harus antara 2020 dan 2100.', 'err');
                  return;
                }
                if (!Number.isFinite(genForm.amount) || genForm.amount < 0) {
                  showToast('Nominal per siswa minimal Rp 0.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: 'GENERATE_SIBLING_GROUP_BILLS',
                    group_id: genModalGroup.id,
                    ...genForm,
                  },
                  `Tagihan kelompok "${genModalGroup.name}" berhasil diterbitkan (${genModalGroup.billingSummary.payableCount} bayar, ${genModalGroup.billingSummary.exemptCount} gratis).`
                );
                if (ok) setGenModalGroup(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label
                  htmlFor="gen-fee-type"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Jenis Biaya *
                </label>
                <select
                  id="gen-fee-type"
                  required
                  value={genForm.fee_type_id}
                  onChange={(e) => {
                    const ft = feeTypes.find((f) => f.id === e.target.value);
                    setGenForm({
                      ...genForm,
                      fee_type_id: e.target.value,
                      amount: ft ? Number(ft.default_amount) : genForm.amount,
                    });
                  }}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Jenis Biaya --</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({FEE_CATEGORY_LABELS[f.category] || f.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="gen-month"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Bulan
                  </label>
                  <input
                    id="gen-month"
                    type="number"
                    required
                    min={1}
                    max={12}
                    value={genForm.billing_month}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_month: Number(e.target.value) })
                    }
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-year"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Tahun
                  </label>
                  <input
                    id="gen-year"
                    type="number"
                    required
                    min={2020}
                    max={2100}
                    value={genForm.billing_year}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_year: Number(e.target.value) })
                    }
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-amount"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Nominal/Siswa
                  </label>
                  <input
                    id="gen-amount"
                    type="number"
                    required
                    min={0}
                    value={genForm.amount}
                    onChange={(e) => setGenForm({ ...genForm, amount: Number(e.target.value) })}
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700">
                Total Tagihan Kelompok:{' '}
                <strong>
                  {formatRupiah(genForm.amount * genModalGroup.billingSummary.payableCount)}
                </strong>{' '}
                ({genModalGroup.billingSummary.payableCount} × {formatRupiah(genForm.amount)})
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setGenModalGroup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Terbitkan Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSppSlip && (
        <SppSlipModal slip={activeSppSlip} onClose={() => setActiveSppSlip(null)} />
      )}
    </div>
  );
}
