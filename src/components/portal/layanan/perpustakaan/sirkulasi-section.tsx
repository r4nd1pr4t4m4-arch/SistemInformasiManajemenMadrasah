'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { BookRow, LoanRow, MemberRow, PostLibFn, ShowToastFn } from './types';

interface SirkulasiSectionProps {
  books: BookRow[];
  members: MemberRow[];
  loans: LoanRow[];
  canManage: boolean;
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  postLib: PostLibFn;
  showToast: ShowToastFn;
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function SirkulasiSection({
  books,
  members,
  loans,
  canManage,
  refreshing,
  submittingAction,
  onRefresh,
  postLib,
  showToast,
}: SirkulasiSectionProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIPINJAM' | 'TERLAMBAT' | 'DIKEMBALIKAN'>(
    'ALL'
  );
  const [borrowForm, setBorrowForm] = useState({
    book_id: '',
    member_id: '',
    due_date: getDefaultDueDate(),
  });
  const [returnTarget, setReturnTarget] = useState<LoanRow | null>(null);
  const [returnFine, setReturnFine] = useState(0);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const borrowableBooks = useMemo(
    () =>
      books.filter(
        (b) =>
          (b.book_format === 'FISIK' || b.book_format === 'KEDUANYA') &&
          Number(b.available_copies || 0) > 0
      ),
    [books]
  );

  const stats = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let returned = 0;
    let totalFine = 0;
    for (const loan of loans) {
      if (loan.status === 'DIKEMBALIKAN') {
        returned++;
      } else {
        active++;
        if (loan.due_date && loan.due_date < todayIso) overdue++;
      }
      totalFine += Number(loan.fine_amount || 0);
    }
    return { active, overdue, returned, totalFine };
  }, [loans, todayIso]);

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans.filter((loan) => {
      const isOverdue = loan.status !== 'DIKEMBALIKAN' && Boolean(loan.due_date && loan.due_date < todayIso);
      if (statusFilter === 'DIPINJAM' && loan.status === 'DIKEMBALIKAN') return false;
      if (statusFilter === 'TERLAMBAT' && !isOverdue) return false;
      if (statusFilter === 'DIKEMBALIKAN' && loan.status !== 'DIKEMBALIKAN') return false;
      if (!q) return true;
      const hay = `${loan.book?.title || ''} ${loan.member?.full_name || ''} ${
        loan.member?.member_code || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [loans, search, statusFilter, todayIso]);

  async function handleBorrow(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!borrowForm.book_id || !borrowForm.member_id || !borrowForm.due_date) {
      showToast('Lengkapi pilihan buku, anggota peminjam, dan tanggal jatuh tempo.', 'error');
      return;
    }
    const ok = await postLib(
      {
        action: 'BORROW_BOOK',
        book_id: borrowForm.book_id,
        member_id: borrowForm.member_id,
        due_date: borrowForm.due_date,
      },
      'Peminjaman buku fisik berhasil dicatat.'
    );
    if (ok) {
      setBorrowForm({
        book_id: '',
        member_id: '',
        due_date: getDefaultDueDate(),
      });
    }
  }

  async function handleConfirmReturn(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !returnTarget || submittingAction) return;
    const fine = Math.max(0, Math.round(Number(returnFine) || 0));
    const ok = await postLib(
      {
        action: 'RETURN_BOOK',
        loan_id: returnTarget.id,
        fine_amount: fine,
      },
      'Pengembalian buku berhasil dicatat dan stok eksemplar diperbarui.'
    );
    if (ok) {
      setReturnTarget(null);
      setReturnFine(0);
    }
  }

  return (
    <div className="space-y-5">
      {/* Statistik Sirkulasi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Sedang Dipinjam</p>
          <p className="text-xl font-black text-sky-700 mt-0.5">{stats.active}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Terlambat Kembali</p>
          <p className="text-xl font-black text-rose-600 mt-0.5">{stats.overdue}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Sudah Dikembalikan</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{stats.returned}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Denda Tercatat</p>
          <p className="text-lg font-black text-amber-700 mt-0.5">{formatRupiah(stats.totalFine)}</p>
        </div>
      </div>

      {/* Form Peminjaman Buku Fisik */}
      {canManage && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Sirkulasi Peminjaman &amp; Pengembalian Buku Fisik</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Catat peminjaman buku fisik anggota, pantau jatuh tempo, dan proses pengembalian beserta denda.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>

          <form
            onSubmit={handleBorrow}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Buku Fisik Tersedia <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={borrowForm.book_id}
                onChange={(e) => setBorrowForm({ ...borrowForm, book_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Buku ({borrowableBooks.length} tersedia) --</option>
                {borrowableBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} — Stok: {b.available_copies}/{b.total_copies}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Anggota Peminjam <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={borrowForm.member_id}
                onChange={(e) => setBorrowForm({ ...borrowForm, member_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">-- Pilih Anggota Perpustakaan --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Jatuh Tempo <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={borrowForm.due_date}
                onChange={(e) => setBorrowForm({ ...borrowForm, due_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submittingAction === 'BORROW_BOOK'}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                {submittingAction === 'BORROW_BOOK' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Catat Pinjam</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Sirkulasi Peminjaman */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul buku, nama peminjam, atau kode anggota..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'DIPINJAM', label: 'Sedang Dipinjam' },
                { id: 'TERLAMBAT', label: 'Terlambat' },
                { id: 'DIKEMBALIKAN', label: 'Dikembalikan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                  statusFilter === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada data sirkulasi peminjaman buku fisik yang sesuai filter.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLoans.map((loan) => {
              const isReturned = loan.status === 'DIKEMBALIKAN';
              const isOverdue = !isReturned && Boolean(loan.due_date && loan.due_date < todayIso);
              return (
                <div
                  key={loan.id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-200/80"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {loan.book?.title || 'Judul Buku'}
                      </span>
                      {isReturned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Dikembalikan
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px]">
                          <AlertTriangle className="w-3 h-3" /> Terlambat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[10px]">
                          <Clock className="w-3 h-3" /> Dipinjam
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600">
                      Peminjam: <strong>{loan.member?.full_name || '-'}</strong>{' '}
                      <span className="font-mono text-slate-400">
                        ({loan.member?.member_code || '-'})
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Pinjam: {loan.loan_date} • Jatuh Tempo: <strong>{loan.due_date}</strong>
                      {loan.return_date ? ` • Kembali: ${loan.return_date}` : ''}
                      {Number(loan.fine_amount || 0) > 0
                        ? ` • Denda: ${formatRupiah(Number(loan.fine_amount))}`
                        : ''}
                    </p>
                  </div>

                  {canManage && !isReturned && (
                    <button
                      type="button"
                      onClick={() => {
                        setReturnTarget(loan);
                        // Kalkulasi saran denda otomatis Rp 1.000 per hari keterlambatan
                        let suggestedFine = 0;
                        if (loan.due_date && loan.due_date < todayIso) {
                          const dueMs = new Date(`${loan.due_date}T00:00:00Z`).getTime();
                          const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();
                          const lateDays = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
                          suggestedFine = lateDays * 1000;
                        }
                        setReturnFine(suggestedFine);
                      }}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                    >
                      <BookCheck className="w-3.5 h-3.5" />
                      <span>Proses Kembali</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Pengembalian Buku */}
      {returnTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReturnTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <form
            onSubmit={handleConfirmReturn}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">Konfirmasi Pengembalian Buku</h2>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-900">{returnTarget.book?.title || '-'}</p>
              <p className="text-slate-600">
                Peminjam: {returnTarget.member?.full_name || '-'} ({returnTarget.member?.member_code})
              </p>
              <p className="text-slate-500">Jatuh tempo: {returnTarget.due_date}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominal Denda Keterlambatan / Kerusakan (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={returnFine}
                onChange={(e) => setReturnFine(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingAction === 'RETURN_BOOK'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {submittingAction === 'RETURN_BOOK' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Pengembalian</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
