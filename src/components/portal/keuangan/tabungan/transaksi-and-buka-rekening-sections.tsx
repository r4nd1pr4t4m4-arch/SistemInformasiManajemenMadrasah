'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Download,
  Loader2,
  User,
  Wallet,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { calculateWithdrawalFee, type SavingsFeeTier } from '@/lib/domain/tabungan-fee';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import type {
  GtkCandidate,
  LastReceipt,
  OwnerType,
  PostTabunganFn,
  PublicCandidate,
  SavingsAccountRow,
  StudentCandidate,
} from './types';

interface TransaksiSectionProps {
  canManage: boolean;
  accounts: SavingsAccountRow[];
  feeTiers: SavingsFeeTier[];
  submitting: boolean;
  postTabungan: PostTabunganFn;
  showToast: (type: 'ok' | 'err', msg: string) => void;
  onOpenSlip: (slip: SavingsSlipData) => void;
}

export function TransaksiSection({
  canManage,
  accounts,
  feeTiers,
  submitting,
  postTabungan,
  showToast,
  onOpenSlip,
}: TransaksiSectionProps) {
  const [trxForm, setTrxForm] = useState({
    account_id: '',
    transaction_type: 'SETOR' as 'SETOR' | 'TARIK',
    amount: 50000,
    notes: '',
  });
  const [lastReceipt, setLastReceipt] = useState<LastReceipt | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === trxForm.account_id) || null,
    [accounts, trxForm.account_id]
  );

  const realTimeFeeCalc = useMemo(() => {
    if (trxForm.transaction_type !== 'TARIK') return null;
    return calculateWithdrawalFee(trxForm.amount, feeTiers);
  }, [trxForm.transaction_type, trxForm.amount, feeTiers]);

  if (!canManage) {
    return (
      <div className="glass-card rounded-3xl p-6 text-xs text-slate-500">
        Anda memiliki akses lihat saja. Hubungi Petugas Tabungan untuk memproses transaksi setor atau tarik tunai.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-700 shrink-0" /> Transaksi Setor / Tarik Tabungan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
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
            if (
              !Number.isInteger(trxForm.amount) ||
              trxForm.amount < 1000 ||
              trxForm.amount % 1000 !== 0
            ) {
              showToast(
                'err',
                'Nominal transaksi minimal Rp 1.000 dan harus kelipatan Rp 1.000 (sebelum dikurangi fee penarikan).'
              );
              return;
            }
            if (
              trxForm.transaction_type === 'TARIK' &&
              trxForm.amount > Number(selectedAccount.balance)
            ) {
              showToast('err', 'Saldo tabungan tidak mencukupi untuk penarikan.');
              return;
            }

            const result = await postTabungan(
              {
                action: 'TRANSACTION',
                ...trxForm,
                notes: trxForm.notes.trim(),
              },
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
                netAmount: result.net_amount ?? trxForm.amount,
                balanceAfter: Number(result.balance ?? 0),
                transactionDate:
                  result.transaction.transaction_date || new Date().toISOString(),
              });
              setTrxForm((prev) => ({ ...prev, notes: '' }));
            }
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="trx-account"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Pilih Rekening Tabungan <span className="text-rose-600">*</span>
            </label>
            <select
              id="trx-account"
              required
              value={trxForm.account_id}
              onChange={(e) => setTrxForm({ ...trxForm, account_id: e.target.value })}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
                <strong className="text-emerald-700 tabular-nums">
                  {formatRupiah(Number(selectedAccount.balance))}
                </strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="trx-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Jenis Transaksi <span className="text-rose-600">*</span>
              </label>
              <select
                id="trx-type"
                value={trxForm.transaction_type}
                onChange={(e) =>
                  setTrxForm({
                    ...trxForm,
                    transaction_type: e.target.value as 'SETOR' | 'TARIK',
                  })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="SETOR">SETOR TABUNGAN (Simpanan)</option>
                <option value="TARIK">TARIK TABUNGAN (Penarikan Tunai)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="trx-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nominal Transaksi (Rp) <span className="text-rose-600">*</span>
              </label>
              <input
                id="trx-amount"
                type="number"
                min={1000}
                step={1000}
                required
                value={trxForm.amount}
                onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {formatRupiah(Number(trxForm.amount) || 0)}
                {trxForm.transaction_type === 'TARIK' ? ' (sebelum dikurangi fee)' : ''}
              </p>
              {(!Number.isInteger(trxForm.amount) ||
                trxForm.amount < 1000 ||
                trxForm.amount % 1000 !== 0) ? (
                <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                  Minimal Rp 1.000 dan harus kelipatan Rp 1.000.
                </p>
              ) : selectedAccount &&
                trxForm.transaction_type === 'TARIK' &&
                trxForm.amount > Number(selectedAccount.balance) ? (
                <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                  Saldo rekening tidak mencukupi ({formatRupiah(Number(selectedAccount.balance))}).
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Minimal Rp 1.000 &amp; kelipatan Rp 1.000
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="trx-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Catatan / Keterangan (Opsional)
            </label>
            <input
              id="trx-notes"
              type="text"
              placeholder="Contoh: Keperluan bayar buku, biaya praktikum, dll"
              value={trxForm.notes}
              onChange={(e) => setTrxForm({ ...trxForm, notes: e.target.value })}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
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

              <div className="flex justify-between items-start py-1 border-b border-amber-200/70 text-rose-700">
                <span>Potongan Fee Transaksi:</span>
                <div className="text-right">
                  <strong className="text-rose-700 block">
                    - {formatRupiah(realTimeFeeCalc.feeAmount)}
                  </strong>
                  {realTimeFeeCalc.rawFeeAmount !== realTimeFeeCalc.feeAmount && (
                    <span className="text-[10px] text-amber-800 block">
                      (Dibulatkan dari {formatRupiah(realTimeFeeCalc.rawFeeAmount)})
                    </span>
                  )}
                </div>
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

            <div className="rounded-2xl bg-white/80 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed space-y-1">
              <p>
                💡 <strong>Ketentuan Fee:</strong> Nominal fee langsung mengurangi nominal uang tunai
                yang diserahkan ke pemilik tabungan. Saldo rekening tetap berkurang sebesar nominal penarikan penuh (
                <strong>{formatRupiah(realTimeFeeCalc.amount)}</strong>).
              </p>
              <p className="text-amber-800">
                <strong>Aturan Pembulatan Fee:</strong> Ratusan &lt; 330 → 000 | 330–660 → 500 | &gt; 660 → 1.000.
              </p>
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

            <button
              type="button"
              onClick={() =>
                onOpenSlip({
                  referenceNumber: lastReceipt.referenceNumber,
                  accountNumber: lastReceipt.accountNumber,
                  ownerName: lastReceipt.ownerName,
                  ownerType: lastReceipt.ownerType,
                  transactionType: lastReceipt.type,
                  amount: lastReceipt.amount,
                  feePercentage: lastReceipt.feePercentage,
                  feeAmount: lastReceipt.feeAmount,
                  netAmount: lastReceipt.netAmount,
                  balanceAfter: lastReceipt.balanceAfter,
                  transactionDate: lastReceipt.transactionDate,
                })
              }
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-3 text-xs transition"
            >
              <Download className="w-3.5 h-3.5" /> Lihat &amp; Unduh Slip PNG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface BukaRekeningSectionProps {
  canManage: boolean;
  accounts: SavingsAccountRow[];
  students: StudentCandidate[];
  teachers: GtkCandidate[];
  tuStaff: GtkCandidate[];
  publicUsers: PublicCandidate[];
  submitting: boolean;
  postTabungan: PostTabunganFn;
  showToast: (type: 'ok' | 'err', msg: string) => void;
}

export function BukaRekeningSection({
  canManage,
  accounts,
  students,
  teachers,
  tuStaff,
  publicUsers,
  submitting,
  postTabungan,
  showToast,
}: BukaRekeningSectionProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [openAccForm, setOpenAccForm] = useState({
    owner_type: 'SISWA' as OwnerType,
    student_id: null as string | null,
    teacher_id: null as string | null,
    owner_name: '',
    owner_phone: '',
    initial_deposit: 50000,
  });

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {canManage ? (
        <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-4 h-fit">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-700 shrink-0" /> Buka Buku Tabungan Digital
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Daftarkan rekening tabungan baru untuk Siswa, Guru, Staf TU, atau Warga Umum.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmedName = openAccForm.owner_name.trim();
              if (trimmedName.length < 2) {
                showToast(
                  'err',
                  'Pilih atau masukkan nama pemilik rekening (minimal 2 karakter).'
                );
                return;
              }
              if (
                !Number.isInteger(openAccForm.initial_deposit) ||
                openAccForm.initial_deposit < 0 ||
                (openAccForm.initial_deposit > 0 &&
                  (openAccForm.initial_deposit < 1000 ||
                    openAccForm.initial_deposit % 1000 !== 0))
              ) {
                showToast(
                  'err',
                  'Setoran awal minimal Rp 1.000 dan harus kelipatan Rp 1.000 (atau Rp 0 jika tanpa setoran awal).'
                );
                return;
              }
              const res = await postTabungan(
                {
                  action: 'OPEN_ACCOUNT',
                  ...openAccForm,
                  owner_name: trimmedName,
                  owner_phone: openAccForm.owner_phone.trim(),
                },
                'Buku tabungan baru berhasil dibuka.'
              );
              if (res) {
                setSelectedCandidateId('');
                setOpenAccForm((prev) => ({
                  ...prev,
                  student_id: null,
                  teacher_id: null,
                  owner_name: '',
                  owner_phone: '',
                }));
              }
            }}
            className="space-y-3.5"
          >
            <div>
              <label
                htmlFor="open-owner-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Kategori Pemilik Rekening <span className="text-rose-600">*</span>
              </label>
              <select
                id="open-owner-type"
                value={openAccForm.owner_type}
                onChange={(e) => {
                  const nextType = e.target.value as OwnerType;
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
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="SISWA">Siswa Madrasah</option>
                <option value="GURU">Guru / Pendidik</option>
                <option value="TU">Tenaga Kependidikan (TU)</option>
                <option value="UMUM">Masyarakat Umum / Warga</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="open-candidate"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Pilih Nama Pemilik Rekening ({openAccForm.owner_type}){' '}
                <span className="text-rose-600">*</span>
              </label>

              {openAccForm.owner_type === 'SISWA' && (
                <select
                  id="open-candidate"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Siswa Aktif --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{' '}
                      {s.nis ? `(NIS: ${s.nis})` : s.nisn ? `(NISN: ${s.nisn})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'GURU' && (
                <select
                  id="open-candidate"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
                  id="open-candidate"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
                    id="open-candidate"
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
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
                      minLength={2}
                      placeholder="Masukkan Nama Lengkap Masyarakat Umum"
                      aria-label="Nama lengkap masyarakat umum"
                      value={openAccForm.owner_name}
                      onChange={(e) =>
                        setOpenAccForm({ ...openAccForm, owner_name: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="open-owner-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nomor HP / WhatsApp
                </label>
                <input
                  id="open-owner-phone"
                  placeholder="08xxxxxxxxxx"
                  value={openAccForm.owner_phone}
                  onChange={(e) =>
                    setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="open-initial-deposit"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Setoran Awal (Rp)
                </label>
                <input
                  id="open-initial-deposit"
                  type="number"
                  min={0}
                  step={1000}
                  value={openAccForm.initial_deposit}
                  onChange={(e) =>
                    setOpenAccForm({ ...openAccForm, initial_deposit: Number(e.target.value) })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Rp 0 atau minimal Rp 1.000 (kelipatan Rp 1.000)
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? 'Membuka Rekening...' : 'Buka Rekening Tabungan'}
            </button>
          </form>
        </div>
      ) : (
        <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 text-xs text-slate-500">
          Anda memiliki akses lihat saja. Hubungi Petugas Tabungan untuk membuka rekening baru.
        </div>
      )}

      <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          Rekening Terbaru ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">
            Belum ada rekening tabungan yang terdaftar.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 break-words">{a.owner_name}</p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    {a.account_number} • {a.owner_type}
                  </p>
                </div>
                <span className="font-bold text-emerald-700 tabular-nums shrink-0">
                  {formatRupiah(Number(a.balance))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
