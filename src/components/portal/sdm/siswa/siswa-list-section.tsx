'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  GraduationCap,
  Link2,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PAGE_SIZE, STATUS_BADGES } from './types';
import type { StudentItem, StudentStats } from './types';

type SiswaListSectionProps = {
  stats: StudentStats;
  itemsCount: number;
  filteredCount: number;
  pagedItems: StudentItem[];
  loading: boolean;
  canManage: boolean;
  search: string;
  filterStatus: string;
  hasCustomFilter: boolean;
  currentPage: number;
  totalPages: number;
  pageStart: number;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onSearchChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onResetFilters: () => void;
  onPageChange: (updater: (prev: number) => number) => void;
  onEdit: (item: StudentItem) => void;
  onRequestDelete: (id: string | null) => void;
  onConfirmDelete: (item: StudentItem) => void;
};

export function SiswaListSection({
  stats,
  itemsCount,
  filteredCount,
  pagedItems,
  loading,
  canManage,
  search,
  filterStatus,
  hasCustomFilter,
  currentPage,
  totalPages,
  pageStart,
  confirmDeleteId,
  deletingId,
  onSearchChange,
  onFilterStatusChange,
  onResetFilters,
  onPageChange,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
}: SiswaListSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Data Siswa</span>
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Siswa Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.aktif}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Lulus / Alumni</span>
            <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.lulus}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Mutasi</span>
            <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.mutasi}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama siswa, NIS, NISN, atau email..."
              aria-label="Cari data siswa"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            aria-label="Filter status siswa"
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full md:w-44 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="LULUS">Lulus (Alumni)</option>
            <option value="MUTASI">Mutasi</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
          {hasCustomFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Memuat data siswa...
          </div>
        ) : pagedItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {itemsCount === 0
              ? 'Belum ada data siswa terdaftar.'
              : 'Belum ada data siswa yang sesuai filter.'}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {pagedItems.map((item) => {
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 break-words">
                          {item.full_name}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {item.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {item.phone || '-'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGES[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white rounded-xl p-2 border border-slate-100 tabular-nums">
                      <div className="truncate">NIS: {item.nis || '-'}</div>
                      <div className="truncate">NISN: {item.nisn || '-'}</div>
                      <div className="truncate">Masuk: {item.entry_year || '-'}</div>
                      <div className="truncate">Lulus: {item.graduation_year || '-'}</div>
                    </div>

                    {item.profile && (
                      <div className="flex">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                          <Link2 className="w-3 h-3 shrink-0" />
                          {item.profile.full_name}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                      <Link
                        href={`/portal/sdm/siswa/${item.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                      >
                        Detail
                      </Link>
                      {canManage &&
                        (isConfirming ? (
                          <>
                            <button
                              type="button"
                              aria-busy={isDeleting || undefined}
                              disabled={isDeleting}
                              onClick={() => onConfirmDelete(item)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                            >
                              {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                              Hapus
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => onRequestDelete(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                              aria-label={`Edit ${item.full_name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRequestDelete(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 bg-white border border-rose-200 hover:bg-rose-50"
                              aria-label={`Hapus ${item.full_name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[740px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">NIS / NISN</th>
                    <th className="py-3 px-3">Tahun Masuk / Lulus</th>
                    <th className="py-3 px-3">Akun Portal</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedItems.map((item) => {
                    const isConfirming = confirmDeleteId === item.id;
                    const isDeleting = deletingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {item.phone || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>NIS: {item.nis || '-'}</div>
                          <div>NISN: {item.nisn || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>Masuk: {item.entry_year || '-'}</div>
                          <div>Lulus: {item.graduation_year || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {item.profile ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                              <Link2 className="w-3 h-3 shrink-0" />
                              {item.profile.full_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Belum ditautkan</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGES[item.status]}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/portal/sdm/siswa/${item.id}`}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                            >
                              Detail
                            </Link>
                            {canManage &&
                              (isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => onConfirmDelete(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                                  >
                                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => onRequestDelete(null)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onEdit(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                                    title="Edit"
                                    aria-label={`Edit ${item.full_name}`}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRequestDelete(item.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                    title="Hapus"
                                    aria-label={`Hapus ${item.full_name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredCount > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCount)} dari{' '}
                  {filteredCount} siswa
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Halaman sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Halaman berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
