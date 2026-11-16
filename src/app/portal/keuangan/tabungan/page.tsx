'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';

interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

export default function TabunganPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SavingsAccountRow[]>([]);

  const [openAccForm, setOpenAccForm] = useState({
    owner_type: 'SISWA' as 'SISWA' | 'GURU' | 'TU' | 'UMUM',
    owner_name: '',
    owner_phone: '',
    initial_deposit: 50000,
  });
  const [trxForm, setTrxForm] = useState({
    account_id: '',
    transaction_type: 'SETOR' as 'SETOR' | 'TARIK',
    amount: 50000,
    notes: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/keuangan/tabungan');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postTabungan(body: unknown, msg: string) {
    const res = await fetch('/api/keuangan/tabungan', {
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku tabungan digital...
      </div>
    );
  }

  const totalTabungan = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

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
          <p className="font-bold text-slate-900 mt-1">Pengelola Tabungan</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tanpa tambahan tunjangan honorarium</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Jumlah Rekening Aktif</p>
          <p className="font-bold text-slate-900 text-lg mt-1">
            {accounts.length} Rekening (Siswa/Guru/TU/Umum)
          </p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Saldo Terkumpul</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">{formatRupiah(totalTabungan)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h1 className="text-sm font-bold text-slate-900">Buka Buku Tabungan Digital</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postTabungan(
                  { action: 'OPEN_ACCOUNT', ...openAccForm },
                  'Buku tabungan baru berhasil dibuka.'
                );
                setOpenAccForm({ ...openAccForm, owner_name: '', owner_phone: '' });
              }}
              className="space-y-2.5"
            >
              <select
                value={openAccForm.owner_type}
                onChange={(e) =>
                  setOpenAccForm({
                    ...openAccForm,
                    owner_type: e.target.value as typeof openAccForm.owner_type,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="SISWA">Siswa</option>
                <option value="GURU">Guru</option>
                <option value="TU">Tata Usaha</option>
                <option value="UMUM">Masyarakat Umum</option>
              </select>
              <input
                required
                placeholder="Nama Pemilik Rekening"
                value={openAccForm.owner_name}
                onChange={(e) => setOpenAccForm({ ...openAccForm, owner_name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="No. HP / WA"
                  value={openAccForm.owner_phone}
                  onChange={(e) => setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Setoran Awal"
                  value={openAccForm.initial_deposit}
                  onChange={(e) =>
                    setOpenAccForm({ ...openAccForm, initial_deposit: Number(e.target.value) })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Buka Rekening Tabungan
              </button>
            </form>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Transaksi Setor / Tarik</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postTabungan(
                  { action: 'TRANSACTION', ...trxForm },
                  'Transaksi tabungan berhasil dicatat.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={trxForm.account_id}
                onChange={(e) => setTrxForm({ ...trxForm, account_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Rekening --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.owner_type}] {a.owner_name} — {formatRupiah(Number(a.balance))}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={trxForm.transaction_type}
                  onChange={(e) =>
                    setTrxForm({
                      ...trxForm,
                      transaction_type: e.target.value as 'SETOR' | 'TARIK',
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="SETOR">Setor Tabungan</option>
                  <option value="TARIK">Tarik Tabungan</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={trxForm.amount}
                  onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Proses Transaksi
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Rekapitulasi Buku Tabungan Digital</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="modular-card rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-mono text-[11px] text-emerald-700 font-bold">
                    {acc.account_number} • {acc.owner_type}
                  </p>
                  <p className="font-bold text-slate-900 text-sm">{acc.owner_name}</p>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {formatRupiah(Number(acc.balance))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
