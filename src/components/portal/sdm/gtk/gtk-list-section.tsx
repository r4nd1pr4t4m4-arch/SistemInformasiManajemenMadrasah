'use client';

import Link from 'next/link';
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Link2,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PAGE_SIZE, STAFF_TYPE_LABELS, type GtkItem, type GtkStats } from './types';

type GtkListSectionProps = {
  stats: GtkStats;
  loading: boolean;
  totalItemsCount: number;
  filteredCount: number;
  pagedItems: GtkItem[];
  pageStart: number;
  currentPage: number;
  totalPages: number;
  search: string;
  filterType: string;
  filterActive: string;
  hasCustomFilter: boolean;
  canManage: boolean;
  confirmDeleteId: string | null;
  deletingId: string | null;
  togglingId: string | null;
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: string) => void;
  onFilterActiveChange: (value: string) => void;
  onResetFilters: () => void;
  onPageChange: (nextPage: number) => void;
  onToggleStatus: (item: GtkItem) => void;
  onOpenEdit: (item: GtkItem) => void;
  onConfirmDeleteChange: (id: string | null) => void;
  onDelete: (item: GtkItem) => void;
};

export function GtkListSection({
  stats,
  loading,
  totalItemsCount,
  filteredCount,
  pagedItems,
  pageStart,
  currentPage,
  totalPages,
  search,
  filterType,
  filterActive,
  hasCustomFilter,
  canManage,
  confirmDeleteId,
  deletingId,
  togglingId,
  onSearchChange,
  onFilterTypeChange,
  onFilterActiveChange,
  onResetFilters,
  onPageChange,
  onToggleStatus,
  onOpenEdit,
  onConfirmDeleteChange,
  onDelete,
}: GtkListSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total GTK</span>
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tenaga Pendidik</span>
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.guru}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tata Usaha</span>
            <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.tu}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>GTK Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.active}
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
              placeholder="Cari nama, NIP, NUPTK, atau email..."
              aria-label="Cari data GTK"
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
            aria-label="Filter jenis GTK"
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="w-full md:w-44 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="ALL">Semua Jenis GTK</option>
            <option value="GURU">Guru</option>
            <option value="TATA_USAHA">Tata Usaha</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
          <select
            aria-label="Filter status aktif GTK"
            value={filterActive}
            onChange={(e) => onFilterActiveChange(e.target.value)}
            className="w-full md:w-40 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
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
            Memuat data GTK...
          </div>
        ) : pagedItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {totalItemsCount === 0
              ? 'Belum ada data GTK terdaftar.'
              : 'Belum ada data GTK yang sesuai filter.'}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {pagedItems.map((item) => {
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;
                const isToggling = togglingId === item.id;
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
                        <p className="text-slate-500 break-all mt-0.5">
                          {item.email || '-'} · {item.phone || '-'}
                        </p>
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          aria-busy={isToggling || undefined}
                          disabled={isToggling}
                          onClick={() => onToggleStatus(item)}
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold disabled:opacity-50 transition ${
                            item.is_active
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                          }`}
                        >
                          {isToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      ) : (
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            item.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {item.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700">
                        {STAFF_TYPE_LABELS[item.staff_type]}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                        {item.employment_status || '-'} · {item.education_level || '-'}
                      </span>
                      {item.profile && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                          <Link2 className="w-3 h-3 shrink-0" />
                          {item.profile.full_name}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white rounded-xl p-2 border border-slate-100">
                      <div className="truncate">NIP: {item.nip || '-'}</div>
                      <div className="truncate">NUPTK: {item.nuptk || '-'}</div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                      <Link
                        href={`/portal/sdm/gtk/${item.id}`}
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
                              onClick={() => onDelete(item)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                            >
                              {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                              Hapus
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => onConfirmDeleteChange(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenEdit(item)}
                              className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                              aria-label={`Edit ${item.full_name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onConfirmDeleteChange(item.id)}
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
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama &amp; Kontak</th>
                    <th className="py-3 px-3">Jenis &amp; Status Pegawai</th>
                    <th className="py-3 px-3">NIP / NUPTK</th>
                    <th className="py-3 px-3">Akun Portal</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedItems.map((item) => {
                    const isConfirming = confirmDeleteId === item.id;
                    const isDeleting = deletingId === item.id;
                    const isToggling = togglingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.email || '-'} · {item.phone || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                            {STAFF_TYPE_LABELS[item.staff_type]}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.employment_status || '-'} · {item.education_level || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>NIP: {item.nip || '-'}</div>
                          <div>NUPTK: {item.nuptk || '-'}</div>
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
                          {canManage ? (
                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => onToggleStatus(item)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-50 transition ${
                                item.is_active
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200/70'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300/70'
                              }`}
                            >
                              {isToggling ? '...' : item.is_active ? 'Aktif' : 'Nonaktif'}
                            </button>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                item.is_active
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {item.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/portal/sdm/gtk/${item.id}`}
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
                                    onClick={() => onDelete(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                                  >
                                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => onConfirmDeleteChange(null)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onOpenEdit(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                                    title="Edit"
                                    aria-label={`Edit ${item.full_name}`}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onConfirmDeleteChange(item.id)}
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
                  {filteredCount} GTK
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
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
