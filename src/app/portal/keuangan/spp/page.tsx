'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';

interface StudentOption {
  id: string;
  full_name: string;
  nis: string | null;
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
  paid_amount: number;
  status: string;
  student?: { full_name: string; nis: string | null } | null;
  fee_type?: { name: string; category: string } | null;
}

export default function SppPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);

  const [feeForm, setFeeForm] = useState({
    name: '',
    category: 'SPP' as 'SPP' | 'KOMITE' | 'UANG_GEDUNG' | 'LAINNYA',
    default_amount: 150000,
  });
  const [billForm, setBillForm] = useState({
    student_id: '',
    fee_type_id: '',
    billing_month: 11,
    billing_year: 2026,
    amount: 150000,
  });
  const [payForm, setPayForm] = useState({
    bill_id: '',
    amount_paid: 150000,
    payment_method: 'TUNAI' as 'TUNAI' | 'TRANSFER' | 'QRIS',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, sppRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/keuangan/spp'),
      ]);
      const bi = await biRes.json();
      const spp = await sppRes.json();
      setStudents(bi.students || []);
      setFeeTypes(spp.feeTypes || []);
      setBills(spp.bills || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postSpp(body: unknown, msg: string) {
    const res = await fetch('/api/keuangan/spp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return;
    }
    showToast(msg);
    await loadData();
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
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
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
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h1 className="text-sm font-bold text-slate-900">Tambah Jenis Biaya</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postSpp(
                  { action: 'CREATE_FEE_TYPE', ...feeForm },
                  'Jenis biaya berhasil ditambahkan.'
                );
                setFeeForm({ ...feeForm, name: '' });
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
                    setFeeForm({ ...feeForm, category: e.target.value as typeof feeForm.category })
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

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Terbitkan Tagihan Siswa</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postSpp(
                  { action: 'CREATE_BILL', ...billForm },
                  'Tagihan siswa berhasil diterbitkan.'
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
        </div>

        <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Catat Pembayaran &amp; Daftar Tagihan
          </h2>
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

          <div className="space-y-2 max-h-80 overflow-y-auto pt-2">
            {bills.map((b) => (
              <div
                key={b.id}
                className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {b.student?.full_name} • {b.fee_type?.name}
                  </p>
                  <p className="text-slate-500">
                    Tagihan: {formatRupiah(Number(b.amount))} • Dibayar:{' '}
                    {formatRupiah(Number(b.paid_amount))}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                    b.status === 'LUNAS'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
