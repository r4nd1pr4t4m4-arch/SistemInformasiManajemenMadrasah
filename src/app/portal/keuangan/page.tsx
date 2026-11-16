'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Coins,
  Loader2,
  PiggyBank,
  Receipt,
  Settings2,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { AdditionalDutyType } from '@/types/database';

interface StudentOption {
  id: string;
  full_name: string;
  nis: string | null;
}

interface TeacherOption {
  id: string;
  full_name: string;
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
  billing_month: number | null;
  billing_year: number | null;
  student?: { full_name: string; nis: string | null } | null;
  fee_type?: { name: string; category: string } | null;
}

interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

interface HonorariumRow {
  id: string;
  period_month: number;
  period_year: number;
  total_jtm: number;
  rate_per_jtm: number;
  jtm_honorarium_amount: number;
  additional_duty_allowance: number;
  total_amount: number;
  status: string;
  teacher?: { full_name: string } | null;
}

export default function PortalKeuanganPage() {
  const [tab, setTab] = useState<'spp' | 'tabungan' | 'honorarium'>('spp');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  // SPP state
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

  // Tabungan state
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

  // Honorarium state
  const [ratePerJtm, setRatePerJtm] = useState(25000);
  const [dutyTypes, setDutyTypes] = useState<AdditionalDutyType[]>([]);
  const [honorariums, setHonorariums] = useState<HonorariumRow[]>([]);
  const [assignDutyForm, setAssignDutyForm] = useState({
    teacher_id: '',
    duty_type_id: '',
  });
  const [genForm, setGenForm] = useState({
    teacher_id: '',
    period_month: 11,
    period_year: 2026,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const [biRes, sppRes, tabRes, honRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/keuangan/spp'),
        fetch('/api/keuangan/tabungan'),
        fetch('/api/keuangan/honorarium'),
      ]);
      const bi = await biRes.json();
      const spp = await sppRes.json();
      const tabData = await tabRes.json();
      const hon = await honRes.json();

      setStudents(bi.students || []);
      setTeachers(bi.teachers || []);
      setFeeTypes(spp.feeTypes || []);
      setBills(spp.bills || []);
      setAccounts(tabData.accounts || []);
      setRatePerJtm(hon.ratePerJtm ?? 25000);
      setDutyTypes(hon.dutyTypes || []);
      setHonorariums(hon.honorariums || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function callApi(url: string, method: 'POST' | 'PATCH', body: unknown, msg: string) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return null;
    }
    showToast(msg);
    await refreshAll();
    return data;
  }

  const totalTabungan = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalTunggakan = bills.reduce(
    (sum, b) => sum + Math.max(0, Number(b.amount) - Number(b.paid_amount)),
    0
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-white/80 p-1 rounded-2xl border border-slate-200/80">
            {[
              { id: 'spp', label: 'SPP & Iuran Komite', icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: 'tabungan', label: 'Tabungan Digital', icon: <PiggyBank className="w-3.5 h-3.5" /> },
              { id: 'honorarium', label: 'Honorarium Guru', icon: <Calculator className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                  tab === item.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data keuangan...
          </div>
        ) : (
          <>
            {/* TAB 1: SPP & KOMITE */}
            {tab === 'spp' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Pengelola Modul</p>
                    <p className="font-bold text-slate-900 mt-1">Bendahara Komite</p>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      Tanpa tambahan tunjangan honorarium
                    </p>
                  </div>
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Tagihan Tercatat</p>
                    <p className="font-bold text-slate-900 text-lg mt-1">{bills.length} Tagihan</p>
                  </div>
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Tunggakan</p>
                    <p className="font-bold text-rose-600 text-lg mt-1">
                      {formatRupiah(totalTunggakan)}
                    </p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-5">
                    <div className="glass-card rounded-3xl p-6 space-y-3">
                      <h2 className="text-sm font-bold text-slate-900">Tambah Jenis Biaya</h2>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await callApi(
                            '/api/keuangan/spp',
                            'POST',
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

                    <div className="glass-card rounded-3xl p-6 space-y-3">
                      <h2 className="text-sm font-bold text-slate-900">Terbitkan Tagihan Siswa</h2>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await callApi(
                            '/api/keuangan/spp',
                            'POST',
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
                            placeholder="Bulan"
                            className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                          />
                          <input
                            type="number"
                            value={billForm.billing_year}
                            onChange={(e) =>
                              setBillForm({ ...billForm, billing_year: Number(e.target.value) })
                            }
                            placeholder="Tahun"
                            className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs"
                          />
                          <input
                            type="number"
                            value={billForm.amount}
                            onChange={(e) =>
                              setBillForm({ ...billForm, amount: Number(e.target.value) })
                            }
                            placeholder="Nominal"
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
                        await callApi(
                          '/api/keuangan/spp',
                          'POST',
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
                        onChange={(e) =>
                          setPayForm({ ...payForm, amount_paid: Number(e.target.value) })
                        }
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
            )}

            {/* TAB 2: TABUNGAN DIGITAL */}
            {tab === 'tabungan' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Pengelola Modul</p>
                    <p className="font-bold text-slate-900 mt-1">Pengelola Tabungan</p>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      Tanpa tambahan tunjangan honorarium
                    </p>
                  </div>
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Jumlah Rekening Aktif</p>
                    <p className="font-bold text-slate-900 text-lg mt-1">
                      {accounts.length} Rekening (Siswa/Guru/TU/Umum)
                    </p>
                  </div>
                  <div className="modular-card rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Saldo Terkumpul</p>
                    <p className="font-bold text-emerald-700 text-lg mt-1">
                      {formatRupiah(totalTabungan)}
                    </p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-5">
                    <div className="glass-card rounded-3xl p-6 space-y-3">
                      <h2 className="text-sm font-bold text-slate-900">
                        Buka Buku Tabungan Digital
                      </h2>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await callApi(
                            '/api/keuangan/tabungan',
                            'POST',
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
                          onChange={(e) =>
                            setOpenAccForm({ ...openAccForm, owner_name: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="No. HP / WA"
                            value={openAccForm.owner_phone}
                            onChange={(e) =>
                              setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Setoran Awal"
                            value={openAccForm.initial_deposit}
                            onChange={(e) =>
                              setOpenAccForm({
                                ...openAccForm,
                                initial_deposit: Number(e.target.value),
                              })
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
                          await callApi(
                            '/api/keuangan/tabungan',
                            'POST',
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
                            onChange={(e) =>
                              setTrxForm({ ...trxForm, amount: Number(e.target.value) })
                            }
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
                    <h2 className="text-base font-bold text-slate-900">
                      Rekapitulasi Buku Tabungan Digital
                    </h2>
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
            )}

            {/* TAB 3: HONORARIUM GURU */}
            {tab === 'honorarium' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-emerald-700" /> Atur Tarif per JTM
                    </h2>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={ratePerJtm}
                        onChange={(e) => setRatePerJtm(Number(e.target.value) || 0)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          callApi(
                            '/api/keuangan/honorarium',
                            'PATCH',
                            { action: 'UPDATE_RATE', rate_per_jtm: ratePerJtm },
                            'Tarif per JTM diperbarui.'
                          )
                        }
                        className="bg-emerald-600 text-white font-semibold px-4 rounded-xl text-xs"
                      >
                        Simpan Tarif
                      </button>
                    </div>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Tugaskan Tugas Tambahan ke Guru
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await callApi(
                          '/api/keuangan/honorarium',
                          'POST',
                          { action: 'ASSIGN_DUTY', ...assignDutyForm },
                          'Tugas tambahan guru berhasil disimpan.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={assignDutyForm.teacher_id}
                        onChange={(e) =>
                          setAssignDutyForm({ ...assignDutyForm, teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Guru --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={assignDutyForm.duty_type_id}
                        onChange={(e) =>
                          setAssignDutyForm({ ...assignDutyForm, duty_type_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Tugas Tambahan --</option>
                        {dutyTypes.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}{' '}
                            {d.receives_allowance
                              ? `(${formatRupiah(Number(d.monthly_allowance))}/bln)`
                              : '(Tanpa Tunjangan)'}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Tugaskan
                      </button>
                    </form>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-600" /> Generate Honorarium Bulanan
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await callApi(
                          '/api/keuangan/honorarium',
                          'POST',
                          { action: 'GENERATE_HONORARIUM', ...genForm },
                          'Honorarium guru berhasil dihitung dari JTM & tunjangan.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={genForm.teacher_id}
                        onChange={(e) => setGenForm({ ...genForm, teacher_id: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Guru --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={genForm.period_month}
                          onChange={(e) =>
                            setGenForm({ ...genForm, period_month: Number(e.target.value) })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        <input
                          type="number"
                          value={genForm.period_year}
                          onChange={(e) =>
                            setGenForm({ ...genForm, period_year: Number(e.target.value) })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Hitung &amp; Simpan Slip Honorarium
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-base font-bold text-slate-900">
                      Master Tunjangan Tugas Tambahan (Dapat Diatur Admin)
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
                      {dutyTypes.map((d) => (
                        <div
                          key={d.id}
                          className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{d.name}</p>
                            {!d.receives_allowance && (
                              <span className="text-[10px] font-semibold text-rose-600">
                                Tanpa tunjangan honorarium
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            disabled={!d.receives_allowance}
                            defaultValue={Number(d.monthly_allowance)}
                            onBlur={(e) => {
                              if (!d.receives_allowance) return;
                              const val = Number(e.target.value) || 0;
                              if (val !== Number(d.monthly_allowance)) {
                                callApi(
                                  '/api/keuangan/honorarium',
                                  'PATCH',
                                  {
                                    action: 'UPDATE_DUTY_ALLOWANCE',
                                    duty_type_id: d.id,
                                    monthly_allowance: val,
                                  },
                                  `Tunjangan ${d.name} diperbarui.`
                                );
                              }
                            }}
                            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono disabled:bg-slate-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-base font-bold text-slate-900">
                      Rekap Honorarium Guru ({honorariums.length})
                    </h2>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {honorariums.map((h) => (
                        <div
                          key={h.id}
                          className="modular-card rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {h.teacher?.full_name} ({h.period_month}/{h.period_year})
                            </p>
                            <p className="text-slate-500">
                              {h.total_jtm} JTM ({formatRupiah(Number(h.jtm_honorarium_amount))}) +
                              Tunjangan ({formatRupiah(Number(h.additional_duty_allowance))})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700 text-sm">
                              {formatRupiah(Number(h.total_amount))}
                            </span>
                            <select
                              value={h.status}
                              onChange={(e) =>
                                callApi(
                                  '/api/keuangan/honorarium',
                                  'PATCH',
                                  {
                                    action: 'UPDATE_STATUS',
                                    honorarium_id: h.id,
                                    status: e.target.value,
                                  },
                                  'Status honorarium diperbarui.'
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold"
                            >
                              <option value="DRAFT">DRAFT</option>
                              <option value="APPROVED">APPROVED</option>
                              <option value="PAID">PAID</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
