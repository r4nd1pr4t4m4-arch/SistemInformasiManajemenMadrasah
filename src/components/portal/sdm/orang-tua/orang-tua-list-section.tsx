'use client';

import Link from 'next/link';
import {
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
import {
  GuardianItem,
  GuardianStats,
  PAGE_SIZE,
  RELATIONSHIP_LABELS,
} from './types';

type OrangTuaListSectionProps = {
  stats: GuardianStats;
  search: string;
  onSearchChange: (value: string) => void;
  filterRel: string;
  onFilterRelChange: (value: string) => void;
  hasCustomFilter: boolean;
  onResetFilters: () => void;
  loading: boolean;
  totalItemsCount: number;
  filteredCount: number;
  pagedItems: GuardianItem[];
  currentPage: number;
  totalPages: number;
  pageStart: number;
  onPageChange: (page: number) => void;
  canManage: boolean;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onOpenEdit: (item: GuardianItem) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (item: GuardianItem) => void;
};

export function OrangTuaListSection({
  stats,
  search,
  onSearchChange,
  filterRel,
  onFilterRelChange,
  hasCustomFilter,
  onResetFilters,
  loading,
  totalItemsCount,
  filteredCount,
  pagedItems,
  currentPage,
  totalPages,
  pageStart,
  onPageChange,
  canManage,
  confirmDeleteId,
  deletingId,
  onOpenEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: OrangTuaListSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Orang Tua/Wali</span>
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Terhubung Akun Portal</span>
            <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.linked}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Wali Utama</span>
            <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.primary}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Status Aktif</span>
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
              placeholder="Cari nama wali, nomor HP, atau nama/NIS siswa..."
              aria-label="Cari data orang tua atau wali"
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
            aria-label="Filter hubungan keluarga"
            value={filterRel}
            onChange={(e) => onFilterRelChange(e.target.value)}
            className="w-full md:w-44 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="ALL">Semua Hubungan</option>
            <option value="AYAH">Ayah</option>
            <option value="IBU">Ibu</option>
            <option value="WALI">Wali</option>
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
            Memuat data orang tua/wali...
          </div>
        ) : pagedItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {totalItemsCount === 0
              ? 'Belum ada data orang tua/wali terdaftar.'
              : 'Belum ada data orang tua/wali yang sesuai filter.'}
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
                        <p className="text-slate-500 mt-0.5 break-words">
                          {item.phone || '-'} · {item.occupation || 'Pekerjaan belum diisi'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700">
                        {RELATIONSHIP_LABELS[item.relationship]}
                      </span>
                      {item.is_primary && (
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800">
                          Wali Utama
                        </span>
                      )}
                      {item.profile && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                          <Link2 className="w-3 h-3 shrink-0" />
                          {item.profile.full_name}
                        </span>
                      )}
                    </div>

                    <div className="bg-white rounded-xl p-2 border border-slate-100 text-[11px] text-slate-600">
                      <span className="text-slate-400">Siswa: </span>
                      <span className="font-semibold text-slate-800">
                        {item.student?.full_name || '-'}
                      </span>
                      {item.student?.nis ? ` (NIS: ${item.student.nis})` : ''}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                      <Link
                        href={`/portal/sdm/orang-tua/${item.id}`}
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
                              onClick={onCancelDelete}
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
                    <th className="py-3 px-3">Nama Orang Tua / Wali</th>
                    <th className="py-3 px-3">Hubungan</th>
                    <th className="py-3 px-3">Siswa Terkait</th>
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
                            {item.phone || '-'} · {item.occupation || 'Pekerjaan belum diisi'}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                            {RELATIONSHIP_LABELS[item.relationship]}
                          </span>
                          {item.is_primary && (
                            <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                              Utama
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700">
                          <p className="font-medium">{item.student?.full_name || '-'}</p>
                          <p className="text-slate-400">NIS: {item.student?.nis || '-'}</p>
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
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              item.is_active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/portal/sdm/orang-tua/${item.id}`}
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
                                    onClick={onCancelDelete}
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
                  Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCount)}{' '}
                  dari {filteredCount} wali
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
