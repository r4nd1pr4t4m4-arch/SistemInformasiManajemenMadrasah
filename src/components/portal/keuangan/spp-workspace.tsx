'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  Users,
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

export type SppSection = 'jenis-biaya' | 'terbitkan' | 'pembayaran' | 'kelompok-saudara';

export function SppWorkspace({ section }: { section: SppSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SPP_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [siblingGroups, setSiblingGroups] = useState<SiblingGroupRow[]>([]);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);

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

  function showToast(text: string, type: 'ok' | 'err' = 'ok') {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, sppRes] = await Promise.all([
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
        fetch('/api/keuangan/spp', { cache: 'no-store' }),
      ]);
      const bi = await biRes.json();
      const spp = await sppRes.json();
      setStudents(bi.students || []);
      setFeeTypes(spp.feeTypes || []);
      setBills(spp.bills || []);
      setSiblingGroups(spp.siblingGroups || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postSpp(body: unknown, successMsg: string) {
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
    await loadData();
    return true;
  }

  // Check if selected student in individual bill form has sibling exemption
  const selectedBillSiblingStatus = useMemo(() => {
    if (!billForm.student_id || !billForm.fee_type_id) return null;
    const ft = feeTypes.find((f) => f.id === billForm.fee_type_id);
    if (!ft || !isSiblingDiscountCategory(ft.category)) return null;

    for (const g of siblingGroups) {
      if (!g.is_active) continue;
      const isMember = g.members.some((m) => m.student_id === billForm.student_id);
      if (isMember) {
        return {
          groupName: g.name,
          totalSiblings: g.billingSummary.totalSiblings,
          payableCount: g.billingSummary.payableCount,
          isExempt: g.billingSummary.exemptStudentId === billForm.student_id,
        };
      }
    }
    return null;
  }, [billForm.student_id, billForm.fee_type_id, feeTypes, siblingGroups]);

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
    <div className="max-w-7xl mx-auto space-y-6">
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

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Pengelola Modul</p>
          <p className="font-bold text-slate-900 mt-1">Bendahara Komite</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tanpa tambahan tunjangan honorarium</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Tagihan Tercatat</p>
          <p className="font-bold text-slate-900 text-lg mt-1">{bills.length} Tagihan</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Tunggakan</p>
          <p className="font-bold text-rose-600 text-lg mt-1">{formatRupiah(totalTunggakan)}</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Kelompok Saudara Aktif</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">
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
            <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
              <h1 className="text-sm font-bold text-slate-900">Tambah Jenis Biaya</h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await postSpp(
                    { action: 'CREATE_FEE_TYPE', ...feeForm },
                    'Jenis biaya berhasil ditambahkan.'
                  );
                  if (ok) setFeeForm({ ...feeForm, name: '' });
                }}
                className="space-y-2.5"
              >
                <input
                  required
                  placeholder="Nama Biaya (cth: SPP Bulanan)"
                  value={feeForm.name}
                  onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={feeForm.category}
                    onChange={(e) =>
                      setFeeForm({
                        ...feeForm,
                        category: e.target.value as typeof feeForm.category,
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="SPP">SPP</option>
                    <option value="KOMITE">Iuran Komite</option>
                    <option value="UANG_GEDUNG">Uang Gedung</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                  <input
                    type="number"
                    value={feeForm.default_amount}
                    onChange={(e) =>
                      setFeeForm({ ...feeForm, default_amount: Number(e.target.value) })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Simpan Jenis Biaya
                </button>
              </form>
            </div>
            )}

            <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-6 space-y-3`}>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Jenis Biaya ({feeTypes.length})
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {feeTypes.map((f) => (
                  <div
                    key={f.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{f.name}</p>
                      <p className="text-slate-500">{f.category}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">
                      Rp {Number(f.default_amount).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}

          {section === 'terbitkan' && canManage && (
            <div className="glass-card rounded-3xl p-6 space-y-3 max-w-2xl">
              <h2 className="text-sm font-bold text-slate-900">Terbitkan Tagihan Siswa</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postSpp(
                    { action: 'CREATE_BILL', ...billForm },
                    selectedBillSiblingStatus?.isExempt
                      ? 'Tagihan diterbitkan: Gratis Kelompok Saudara (Rp 0 / LUNAS).'
                      : 'Tagihan siswa berhasil diterbitkan.'
                  );
                }}
                className="space-y-2.5"
              >
                <select
                  required
                  value={billForm.student_id}
                  onChange={(e) => setBillForm({ ...billForm, student_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
                <select
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Jenis Biaya --</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatRupiah(Number(f.default_amount))})
                    </option>
                  ))}
                </select>

                {selectedBillSiblingStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] border ${
                      selectedBillSiblingStatus.isExempt
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                  >
                    Anggota Kelompok Saudara <strong>{selectedBillSiblingStatus.groupName}</strong> (
                    {selectedBillSiblingStatus.totalSiblings} saudara → bayar{' '}
                    {selectedBillSiblingStatus.payableCount} siswa).{' '}
                    {selectedBillSiblingStatus.isExempt ? (
                      <strong>Siswa ini mendapat slot GRATIS (Rp 0 / LUNAS otomatis).</strong>
                    ) : (
                      <span>Siswa ini termasuk yang berbayar penuh.</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={billForm.billing_month}
                    onChange={(e) =>
                      setBillForm({ ...billForm, billing_month: Number(e.target.value) })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                  />
                  <input
                    type="number"
                    value={billForm.billing_year}
                    onChange={(e) =>
                      setBillForm({ ...billForm, billing_year: Number(e.target.value) })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                  />
                  <input
                    type="number"
                    value={billForm.amount}
                    onChange={(e) => setBillForm({ ...billForm, amount: Number(e.target.value) })}
                    className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Buat Tagihan
                </button>
              </form>
            </div>
          )}

          {section === 'pembayaran' && (
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              {canManage ? 'Catat Pembayaran & Daftar Tagihan' : 'Daftar Tagihan SPP & Komite'}
            </h2>
            {canManage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postSpp(
                  { action: 'RECORD_PAYMENT', ...payForm },
                  'Pembayaran SPP/Komite berhasil dicatat.'
                );
              }}
              className="grid sm:grid-cols-4 gap-2"
            >
              <select
                required
                value={payForm.bill_id}
                onChange={(e) => setPayForm({ ...payForm, bill_id: e.target.value })}
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Tagihan Belum Lunas --</option>
                {bills
                  .filter((b) => b.status !== 'LUNAS')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.student?.full_name} — {b.fee_type?.name} (Sisa:{' '}
                      {formatRupiah(Number(b.amount) - Number(b.paid_amount))})
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min={1}
                value={payForm.amount_paid}
                onChange={(e) => setPayForm({ ...payForm, amount_paid: Number(e.target.value) })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="bg-emerald-600 text-white font-semibold rounded-xl text-xs py-2"
              >
                Bayar
              </button>
            </form>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto pt-2">
              {bills.map((b) => (
                <div
                  key={b.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-slate-900">
                        {b.student?.full_name} • {b.fee_type?.name}
                      </p>
                      {b.is_sibling_exempt && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                          Gratis Saudara
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">
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
                    {b.notes && <p className="text-[11px] text-slate-400 mt-0.5">{b.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                        b.status === 'LUNAS'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {b.status}
                    </span>
                    {(Number(b.paid_amount) > 0 || b.status === 'LUNAS' || b.is_sibling_exempt) && (
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                        title="Lihat & Unduh Slip PNG"
                      >
                        <Download className="w-3 h-3" /> PNG
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900">
            <strong>Aturan Kelompok Saudara (SPP &amp; Iuran Komite):</strong> Jika terdapat{' '}
            <strong>2 saudara</strong> aktif dalam satu kelompok maka cukup membayar untuk{' '}
            <strong>1 siswa</strong> (1 siswa gratis). Jika ada <strong>3 saudara</strong> maka
            cukup membayar untuk <strong>2 siswa</strong> (1 siswa gratis), dan seterusnya mengikuti
            pola <strong>N saudara → bayar (N - 1) siswa</strong>.
          </div>

          {siblingGroups.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500">
              Belum ada Kelompok Saudara. Klik <strong>Tambah Kelompok Saudara</strong> untuk
              mengelompokkan siswa bersaudara.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {siblingGroups.map((g) => (
                <div key={g.id} className="glass-card rounded-3xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{g.name}</h3>
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
                      {g.notes && <p className="text-xs text-slate-500 mt-0.5">{g.notes}</p>}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditGroup(g)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Edit Kelompok"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Hapus kelompok saudara "${g.name}"?`)) return;
                            await postSpp(
                              { action: 'DELETE_SIBLING_GROUP', group_id: g.id },
                              'Kelompok saudara berhasil dihapus.'
                            );
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Hapus Kelompok"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                          className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {m.student?.full_name || '-'}
                            </span>
                            <span className="text-slate-400 ml-2">
                              NIS: {m.student?.nis || '-'}
                            </span>
                          </div>
                          {isExempt ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              Gratis SPP &amp; Komite
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                              Bayar Normal
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canManage && g.is_active && g.billingSummary.totalSiblings > 0 && (
                    <button
                      onClick={() => {
                        const firstFee = feeTypes.find((f) => isSiblingDiscountCategory(f.category)) || feeTypes[0];
                        setGenModalGroup(g);
                        setGenForm({
                          fee_type_id: firstFee?.id || '',
                          billing_month: new Date().getMonth() + 1,
                          billing_year: new Date().getFullYear(),
                          amount: firstFee ? Number(firstFee.default_amount) : 150000,
                        });
                      }}
                      className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Terbitkan Tagihan Kelompok Ini
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && groupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingGroupId ? 'Edit Kelompok Saudara' : 'Tambah Kelompok Saudara'}
              </h2>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postSpp(
                  {
                    action: editingGroupId ? 'UPDATE_SIBLING_GROUP' : 'CREATE_SIBLING_GROUP',
                    ...(editingGroupId ? { group_id: editingGroupId } : {}),
                    ...groupForm,
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Kelompok / Keluarga *
                </label>
                <input
                  required
                  placeholder="Contoh: Keluarga Bpk. Ahmad"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  placeholder="Opsional"
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tambah Anggota Siswa
                </label>
                <div className="flex gap-2">
                  <select
                    value={studentPickerId}
                    onChange={(e) => setStudentPickerId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
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
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {st?.full_name || sid}
                      </span>
                      <div className="flex items-center gap-3">
                        {groupForm.student_ids.length >= 2 && (
                          <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
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
                          className="text-rose-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={groupForm.is_active}
                  onChange={(e) => setGroupForm({ ...groupForm, is_active: e.target.checked })}
                />
                Kelompok Aktif
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={groupForm.student_ids.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
                >
                  Simpan Kelompok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManage && genModalGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Terbitkan Tagihan: {genModalGroup.name}
              </h2>
              <button
                onClick={() => setGenModalGroup(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {genModalGroup.billingSummary.totalSiblings} saudara aktif → akan diterbitkan tagihan
              berbayar untuk <strong>{genModalGroup.billingSummary.payableCount} siswa</strong> dan{' '}
              <strong>{genModalGroup.billingSummary.exemptCount} siswa Gratis</strong> (Rp 0).
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
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
                <label className="block font-semibold text-slate-700 mb-1">Jenis Biaya</label>
                <select
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Pilih Jenis Biaya --</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bulan</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={genForm.billing_month}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_month: Number(e.target.value) })
                    }
                    className="w-full px-2 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    value={genForm.billing_year}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_year: Number(e.target.value) })
                    }
                    className="w-full px-2 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal/Siswa</label>
                  <input
                    type="number"
                    value={genForm.amount}
                    onChange={(e) => setGenForm({ ...genForm, amount: Number(e.target.value) })}
                    className="w-full px-2 py-2 rounded-xl border border-slate-300"
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGenModalGroup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
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
