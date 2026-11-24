'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { AkademikEmptyState } from '../akademik-ui';
import {
  STUDENT_PAGE_SIZE,
  type ActiveAccountRow,
  type ShowToastFn,
  type SubmitEntityFn,
} from './types';

interface PenempatanAkunSectionProps {
  canManage: boolean;
  activeAccounts: ActiveAccountRow[];
  refreshing: boolean;
  submitting: boolean;
  onRefresh: () => void;
  submitEntity: SubmitEntityFn;
  showToast: ShowToastFn;
}

export function PenempatanAkunSection({
  canManage,
  activeAccounts,
  refreshing,
  submitting,
  onRefresh,
  submitEntity,
  showToast,
}: PenempatanAkunSectionProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [placementGender, setPlacementGender] = useState<'L' | 'P'>('L');
  const [placementStaffType, setPlacementStaffType] = useState<'GURU' | 'TATA_USAHA' | 'LAINNYA'>(
    'GURU'
  );
  const [accountFilter, setAccountFilter] = useState<
    'ALL' | 'UNASSIGNED' | 'STUDENT' | 'TEACHER' | 'LIBRARY'
  >('ALL');
  const [accountPage, setAccountPage] = useState(1);

  const accountStats = useMemo(() => {
    let unassigned = 0;
    let studentCount = 0;
    let teacherCount = 0;
    let libraryCount = 0;
    for (const acc of activeAccounts) {
      if (!acc.is_student && !acc.is_teacher && !acc.is_library_member) unassigned++;
      if (acc.is_student) studentCount++;
      if (acc.is_teacher) teacherCount++;
      if (acc.is_library_member) libraryCount++;
    }
    return {
      total: activeAccounts.length,
      unassigned,
      studentCount,
      teacherCount,
      libraryCount,
    };
  }, [activeAccounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeAccounts.filter((acc) => {
      if (
        accountFilter === 'UNASSIGNED' &&
        (acc.is_student || acc.is_teacher || acc.is_library_member)
      ) {
        return false;
      }
      if (accountFilter === 'STUDENT' && !acc.is_student) return false;
      if (accountFilter === 'TEACHER' && !acc.is_teacher) return false;
      if (accountFilter === 'LIBRARY' && !acc.is_library_member) return false;
      if (!q) return true;
      return (
        acc.full_name.toLowerCase().includes(q) ||
        (acc.email || '').toLowerCase().includes(q) ||
        acc.primary_role.toLowerCase().includes(q)
      );
    });
  }, [activeAccounts, searchQuery, accountFilter]);

  const totalAccountPages = Math.max(1, Math.ceil(filteredAccounts.length / STUDENT_PAGE_SIZE));
  const safeAccountPage = Math.min(accountPage, totalAccountPages);
  const paginatedAccounts = useMemo(() => {
    const start = (safeAccountPage - 1) * STUDENT_PAGE_SIZE;
    return filteredAccounts.slice(start, start + STUDENT_PAGE_SIZE);
  }, [filteredAccounts, safeAccountPage]);

  if (!canManage) {
    return (
      <div className="glass-card rounded-3xl p-6 flex items-center gap-3 text-xs text-slate-600">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <span>Anda tidak memiliki izin untuk mengelola penempatan akun ke Buku Induk.</span>
      </div>
    );
  }

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId) || null;

  return (
    <div className="space-y-5">
      {/* Ringkasan Statistik Akun Aktif */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Akun Aktif</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{accountStats.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Belum Ditempatkan</p>
          <p className="text-xl font-black text-amber-600 mt-0.5">{accountStats.unassigned}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Sudah Siswa / GTK</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">
            {accountStats.studentCount + accountStats.teacherCount}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Anggota E-Library</p>
          <p className="text-xl font-black text-teal-700 mt-0.5">{accountStats.libraryCount}</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Penempatan Akun Aktif ke Buku Induk / E-Library</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Pilih akun yang sudah disetujui &amp; aktif untuk dimasukkan sebagai Siswa, Guru/GTK, atau hanya Anggota Perpustakaan Digital.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
            <Link
              href="/portal/akun/manajemen-pengguna"
              className="inline-flex items-center px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition"
            >
              Kelola Persetujuan Akun →
            </Link>
          </div>
        </div>

        {/* Panel Penempatan Cepat */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6">
              <label
                htmlFor="placement-account-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Pilih Akun Aktif
              </label>
              <select
                id="placement-account-select"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">
                  -- Pilih Akun Aktif ({activeAccounts.length} akun tersedia) --
                </option>
                {activeAccounts.map((acc) => {
                  const tags = [
                    acc.is_student ? 'Sudah Siswa' : '',
                    acc.is_teacher ? 'Sudah GTK' : '',
                    acc.is_library_member ? 'Sudah E-Library' : '',
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || 'tanpa email'}) • Role: {acc.primary_role}
                      {tags ? ` [${tags}]` : ' [Belum ditempatkan]'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5 lg:col-span-6">
              <div>
                <label
                  htmlFor="placement-gender"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Jenis Kelamin (Siswa/GTK)
                </label>
                <select
                  id="placement-gender"
                  value={placementGender}
                  onChange={(e) => setPlacementGender(e.target.value as 'L' | 'P')}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="placement-staff-type"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Jenis GTK (Jika ke GTK)
                </label>
                <select
                  id="placement-staff-type"
                  value={placementStaffType}
                  onChange={(e) =>
                    setPlacementStaffType(
                      e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA'
                    )
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="GURU">Guru</option>
                  <option value="TATA_USAHA">Tata Usaha</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pratinjau Akun Terpilih */}
          {selectedAccount && (
            <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0 space-y-0.5">
                <p className="font-bold text-slate-900 break-words">
                  {selectedAccount.full_name}
                </p>
                <p className="text-slate-500 break-words">
                  {selectedAccount.email || 'Tanpa email'} • Telp:{' '}
                  {selectedAccount.phone || '-'} • Role:{' '}
                  <strong className="text-slate-700">{selectedAccount.primary_role}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {selectedAccount.is_student && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px]">
                    Sudah Siswa
                  </span>
                )}
                {selectedAccount.is_teacher && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                    Sudah GTK
                  </span>
                )}
                {selectedAccount.is_library_member && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold text-[11px]">
                    Sudah E-Library
                  </span>
                )}
                {!selectedAccount.is_student &&
                  !selectedAccount.is_teacher &&
                  !selectedAccount.is_library_member && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px]">
                      Belum ditempatkan
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* Tombol Aksi Penempatan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={submitting || !selectedAccount || selectedAccount.is_student}
              onClick={async () => {
                if (!selectedAccount) return;
                if (selectedAccount.full_name.trim().length < 2) {
                  showToast('error', 'Nama akun minimal 2 karakter.');
                  return;
                }
                const ok = await submitEntity(
                  {
                    type: 'STUDENT',
                    profile_id: selectedAccount.id,
                    full_name: selectedAccount.full_name.trim(),
                    gender: placementGender,
                  },
                  `Akun "${selectedAccount.full_name}" berhasil dimasukkan ke Buku Induk Siswa.`
                );
                if (ok) setSelectedAccountId('');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition disabled:opacity-40"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Masukkan ke Siswa</span>
            </button>

            <button
              type="button"
              disabled={submitting || !selectedAccount || selectedAccount.is_teacher}
              onClick={async () => {
                if (!selectedAccount) return;
                if (selectedAccount.full_name.trim().length < 2) {
                  showToast('error', 'Nama akun minimal 2 karakter.');
                  return;
                }
                const ok = await submitEntity(
                  {
                    type: 'TEACHER',
                    profile_id: selectedAccount.id,
                    full_name: selectedAccount.full_name.trim(),
                    staff_type: placementStaffType,
                    gender: placementGender,
                    employment_status: 'GTY',
                    initial_position:
                      placementStaffType === 'TATA_USAHA'
                        ? 'Staf Tata Usaha'
                        : placementStaffType === 'LAINNYA'
                        ? 'Tenaga Kependidikan'
                        : 'Guru Mata Pelajaran',
                    email: selectedAccount.email || '',
                  },
                  `Akun "${selectedAccount.full_name}" berhasil dimasukkan ke Buku Induk GTK.`
                );
                if (ok) setSelectedAccountId('');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-40"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Masukkan ke Guru / GTK</span>
            </button>

            <button
              type="button"
              disabled={submitting || !selectedAccount || selectedAccount.is_library_member}
              onClick={async () => {
                if (!selectedAccount) return;
                const ok = await submitEntity(
                  {
                    type: 'LIBRARY_ONLY',
                    profile_id: selectedAccount.id,
                    phone: selectedAccount.phone,
                  },
                  `Akun "${selectedAccount.full_name}" berhasil didaftarkan sebagai Anggota Perpustakaan Digital.`
                );
                if (ok) setSelectedAccountId('');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Hanya Anggota E-Library</span>
            </button>
          </div>
        </div>

        {/* Pencarian & Filter Daftar Akun */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAccountPage(1);
              }}
              placeholder="Cari nama, email, atau role akun aktif..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAccountPage(1);
                }}
                aria-label="Hapus pencarian"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter status penempatan akun"
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(
                e.target.value as 'ALL' | 'UNASSIGNED' | 'STUDENT' | 'TEACHER' | 'LIBRARY'
              );
              setAccountPage(1);
            }}
            className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="ALL">Semua Akun ({activeAccounts.length})</option>
            <option value="UNASSIGNED">Belum Ditempatkan ({accountStats.unassigned})</option>
            <option value="STUDENT">Sudah Siswa ({accountStats.studentCount})</option>
            <option value="TEACHER">Sudah GTK ({accountStats.teacherCount})</option>
            <option value="LIBRARY">Sudah E-Library ({accountStats.libraryCount})</option>
          </select>
        </div>

        {/* Daftar Akun Aktif */}
        {filteredAccounts.length === 0 ? (
          <AkademikEmptyState
            icon={<UserPlus className="w-6 h-6" />}
            message={
              searchQuery.trim() || accountFilter !== 'ALL'
                ? 'Tidak ada akun aktif yang sesuai dengan filter atau pencarian.'
                : 'Belum ada akun aktif yang tersedia untuk ditempatkan.'
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {paginatedAccounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <div
                    key={acc.id}
                    className={`modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                      isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 break-words">{acc.full_name}</p>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {acc.primary_role}
                        </span>
                      </div>
                      <p className="text-slate-500 break-words">
                        {acc.email || 'Tanpa email'} • Telp: {acc.phone || '-'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {acc.is_student && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-semibold">
                            Sudah Siswa
                          </span>
                        )}
                        {acc.is_teacher && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            Sudah GTK
                          </span>
                        )}
                        {acc.is_library_member && (
                          <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold">
                            Sudah E-Library
                          </span>
                        )}
                        {!acc.is_student && !acc.is_teacher && !acc.is_library_member && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                            Belum ditempatkan
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(isSelected ? '' : acc.id)}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-[11px] shrink-0 transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                      }`}
                    >
                      {isSelected ? 'Dipilih' : 'Pilih Akun'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Menampilkan{' '}
                <strong className="text-slate-800">
                  {(safeAccountPage - 1) * STUDENT_PAGE_SIZE + 1}–
                  {Math.min(safeAccountPage * STUDENT_PAGE_SIZE, filteredAccounts.length)}
                </strong>{' '}
                dari <strong className="text-slate-800">{filteredAccounts.length}</strong> akun
              </span>
              {totalAccountPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeAccountPage <= 1}
                    onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    {safeAccountPage} / {totalAccountPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeAccountPage >= totalAccountPages}
                    onClick={() => setAccountPage((p) => Math.min(totalAccountPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                  >
                    Berikutnya <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
