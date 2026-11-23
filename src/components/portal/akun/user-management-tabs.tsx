'use client';

import Image from 'next/image';
import {
  Camera,
  CheckCircle2,
  FileSignature,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import type { AppRole } from '@/types/database';

export type AccountStatus = 'PENDING' | 'AKTIF' | 'NONAKTIF' | 'DITOLAK' | 'DITOLAK_PERMANEN';

export interface AvatarChangeRequest {
  id: string;
  profile_id: string;
  old_avatar_url: string | null;
  new_avatar_url: string;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  review_notes: string | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
    primary_role: string | null;
  } | null;
}

export interface NameChangeRequest {
  id: string;
  profile_id: string;
  old_full_name: string;
  new_full_name: string;
  reason: string | null;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  profile?: { id: string; email: string | null; primary_role: string } | null;
}

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: AppRole;
  is_active: boolean;
  account_status: AccountStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  linked_student: { id: string; nis: string | null; nisn: string | null } | null;
  linked_teacher: { id: string; staff_type: string; nip: string | null } | null;
  linked_library: { id: string; member_code: string; member_type: string } | null;
}

export interface UserSummary {
  total: number;
  pending: number;
  active: number;
  inactive: number;
  rejected: number;
}

export function NameChangeApprovalsTab({
  nameRequests,
  filteredNameRequests,
  filterNameStatus,
  setFilterNameStatus,
  search,
  setSearch,
  loadingRequests,
  canManage,
  busyId,
  onApprove,
  onOpenRejectModal,
}: {
  nameRequests: NameChangeRequest[];
  filteredNameRequests: NameChangeRequest[];
  filterNameStatus: 'ALL' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  setFilterNameStatus: (s: 'ALL' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK') => void;
  search: string;
  setSearch: (v: string) => void;
  loadingRequests: boolean;
  canManage: boolean;
  busyId: string | null;
  onApprove: (id: string) => void;
  onOpenRejectModal: (req: NameChangeRequest) => void;
}) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1">
          {(
            [
              { key: 'ALL', label: `Semua (${nameRequests.length})` },
              {
                key: 'MENUNGGU',
                label: `Menunggu (${nameRequests.filter((r) => r.status === 'MENUNGGU').length})`,
              },
              {
                key: 'DISETUJUI',
                label: `Disetujui (${nameRequests.filter((r) => r.status === 'DISETUJUI').length})`,
              },
              {
                key: 'DITOLAK',
                label: `Ditolak (${nameRequests.filter((r) => r.status === 'DITOLAK').length})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filterNameStatus === f.key}
              onClick={() => setFilterNameStatus(f.key)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                filterNameStatus === f.key
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Cari pengajuan perubahan nama"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama lama/baru atau email..."
            className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {loadingRequests ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data pengajuan perubahan nama...
        </div>
      ) : filteredNameRequests.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          <FileSignature className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          Tidak ada data pengajuan perubahan nama yang sesuai filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNameRequests.map((r) => {
            const isBusy = busyId === r.id;
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Nama Lama:{' '}
                      <span className="font-semibold text-slate-700 line-through">
                        {r.old_full_name}
                      </span>
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-sm font-bold text-slate-900 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                      {r.new_full_name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'MENUNGGU'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : r.status === 'DISETUJUI'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Email: <strong className="text-slate-800">{r.profile?.email || '-'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Role:{' '}
                      <strong className="text-slate-800">{r.profile?.primary_role || '-'}</strong>
                    </span>
                    <span>•</span>
                    <span>Diajukan: {new Date(r.created_at).toLocaleString('id-ID')}</span>
                  </div>

                  {r.reason && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      Alasan: <span className="text-slate-800">{r.reason}</span>
                    </p>
                  )}

                  {r.review_notes && (
                    <p className="text-xs text-rose-700 bg-rose-50/70 p-2 rounded-xl border border-rose-100">
                      Catatan Review: {r.review_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'MENUNGGU' && canManage ? (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onApprove(r.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Setujui
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenRejectModal(r)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {r.status === 'DISETUJUI'
                        ? `Disetujui pada ${
                            r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('id-ID') : '-'
                          }`
                        : r.status === 'DITOLAK'
                          ? `Ditolak pada ${
                              r.reviewed_at
                                ? new Date(r.reviewed_at).toLocaleDateString('id-ID')
                                : '-'
                            }`
                          : '-'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AvatarChangeApprovalsTab({
  avatarRequests,
  canManage,
  busyId,
  onApprove,
  onOpenRejectModal,
}: {
  avatarRequests: AvatarChangeRequest[];
  canManage: boolean;
  busyId: string | null;
  onApprove: (id: string) => void;
  onOpenRejectModal: (req: AvatarChangeRequest) => void;
}) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4 min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 break-words">
            Pengajuan Perubahan Foto Profil ({avatarRequests.length})
          </h2>
          <p className="text-xs text-slate-500 break-words">
            Setujui atau tolak foto profil yang diunggah pengguna sebelum tampil di profil dan kartu
            digital.
          </p>
        </div>
      </div>

      {avatarRequests.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          Belum ada pengajuan perubahan foto profil.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {avatarRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3 min-w-0 max-w-full overflow-hidden"
            >
              <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {req.profile?.full_name || 'Pengguna'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {req.profile?.email} • {req.profile?.primary_role || '-'}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    req.status === 'MENUNGGU'
                      ? 'bg-amber-100 text-amber-800'
                      : req.status === 'DISETUJUI'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {req.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100 min-w-0">
                <div className="text-center space-y-1 shrink-0">
                  <p className="text-[11px] text-slate-500 font-semibold">Foto Lama</p>
                  {req.old_avatar_url ? (
                    <Image
                      src={req.old_avatar_url}
                      alt="Foto lama"
                      width={64}
                      height={64}
                      unoptimized={req.old_avatar_url.startsWith('/api/')}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-600 text-[11px] flex items-center justify-center">
                      Kosong
                    </div>
                  )}
                </div>
                <span className="text-slate-500 font-bold shrink-0">→</span>
                <div className="text-center space-y-1 shrink-0">
                  <p className="text-[11px] text-emerald-700 font-semibold">Foto Baru</p>
                  <Image
                    src={req.new_avatar_url}
                    alt="Foto baru"
                    width={64}
                    height={64}
                    unoptimized={req.new_avatar_url.startsWith('/api/')}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400 shadow-xs"
                  />
                </div>
              </div>

              {req.review_notes && (
                <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 break-words">
                  Catatan: {req.review_notes}
                </p>
              )}

              {canManage && req.status === 'MENUNGGU' && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    aria-busy={busyId === req.id || undefined}
                    disabled={busyId === req.id}
                    onClick={() => onApprove(req.id)}
                    className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {busyId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}{' '}
                    Setujui
                  </button>
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => onOpenRejectModal(req)}
                    className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
