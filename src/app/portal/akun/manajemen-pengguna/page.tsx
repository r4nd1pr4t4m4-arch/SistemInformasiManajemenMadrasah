'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  MailCheck,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from 'lucide-react';
import type { AppRole } from '@/types/database';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

type AccountStatus = 'PENDING' | 'AKTIF' | 'NONAKTIF' | 'DITOLAK';

interface ManagedUser {
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

interface Summary {
  total: number;
  pending: number;
  active: number;
  inactive: number;
  rejected: number;
}

const ASSIGNABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'UMUM', label: 'UMUM (Pendaftar Baru / Publik)' },
  { value: 'GURU', label: 'GURU' },
  { value: 'WALI_KELAS', label: 'WALI_KELAS' },
  { value: 'GURU_WALI', label: 'GURU_WALI' },
  { value: 'GURU_BK', label: 'GURU_BK' },
  { value: 'SISWA', label: 'SISWA' },
  { value: 'ORANG_TUA', label: 'ORANG_TUA' },
  { value: 'ALUMNI', label: 'ALUMNI' },
  { value: 'PUSTAKAWAN', label: 'PUSTAKAWAN' },
  { value: 'STAF_TU', label: 'STAF_TU' },
  { value: 'KEPALA_TU', label: 'KEPALA_TU' },
  { value: 'BENDAHARA', label: 'BENDAHARA' },
  { value: 'BENDAHARA_KOMITE', label: 'BENDAHARA_KOMITE' },
  { value: 'PENGELOLA_TABUNGAN', label: 'PENGELOLA_TABUNGAN' },
  { value: 'WAKA_KURIKULUM', label: 'WAKA_KURIKULUM' },
  { value: 'WAKA_KESISWAAN', label: 'WAKA_KESISWAAN' },
  { value: 'WAKA_HUMAS', label: 'WAKA_HUMAS' },
  { value: 'WAKA_SARPRAS', label: 'WAKA_SARPRAS' },
  { value: 'KEPALA_LEMBAGA', label: 'KEPALA_LEMBAGA' },
  { value: 'OPERATOR', label: 'OPERATOR' },
  { value: 'SUPERADMIN', label: 'SUPERADMIN' },
];

export default function ManajemenPenggunaPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.USER_MANAGEMENT_MANAGE);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending: 0,
    active: 0,
    inactive: 0,
    rejected: 0,
  });
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | AccountStatus>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModalUser, setRejectModalUser] = useState<ManagedUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(
    null
  );

  const showToast = useCallback((type: 'success' | 'warning' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/akun/manajemen-pengguna');
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal memuat daftar pengguna.');
        return;
      }
      setUsers(data.users || []);
      setSummary(
        data.summary || { total: 0, pending: 0, active: 0, inactive: 0, rejected: 0 }
      );
      setSmtpConfigured(Boolean(data.smtpConfigured));
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleAction(params: {
    userId: string;
    action: 'APPROVE' | 'REJECT' | 'DEACTIVATE' | 'UPDATE_ROLE';
    primaryRole?: AppRole;
    rejectionReason?: string;
  }) {
    setBusyId(params.userId);
    try {
      const res = await fetch('/api/akun/manajemen-pengguna', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.userId,
          action: params.action,
          primaryRole: params.primaryRole,
          rejectionReason: params.rejectionReason,
          sendEmail: params.action !== 'UPDATE_ROLE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal memperbarui akun.');
        return;
      }

      if (data.emailWarning) {
        showToast('warning', data.emailWarning);
      } else if (data.emailSent) {
        showToast(
          'success',
          params.action === 'APPROVE'
            ? 'Akun diaktifkan & email notifikasi persetujuan telah dikirim.'
            : params.action === 'REJECT'
            ? 'Pendaftaran akun ditolak & email notifikasi penolakan telah dikirim.'
            : 'Akun dinonaktifkan & email pemberitahuan telah dikirim.'
        );
      } else {
        showToast('success', 'Data pengguna berhasil diperbarui.');
      }

      setRejectModalUser(null);
      setRejectionReason('');
      await loadUsers();
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setBusyId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterStatus !== 'ALL' && u.account_status !== filterStatus) return false;
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.primary_role.toLowerCase().includes(q)
      );
    });
  }, [users, filterStatus, search]);

  function renderStatusBadge(status: AccountStatus) {
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Menunggu Persetujuan
        </span>
      );
    }
    if (status === 'AKTIF') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Aktif
        </span>
      );
    }
    if (status === 'DITOLAK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> Ditolak
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <UserX className="w-3 h-3" /> Nonaktif
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <MailCheck className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {!smtpConfigured && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>SMTP Email belum dikonfigurasi:</strong> Atur variabel{' '}
            <code>GMAIL_SMTP_USER</code> dan <code>GMAIL_SMTP_APP_PASSWORD</code> pada{' '}
            <code>.env.local</code> agar notifikasi persetujuan/penolakan akun otomatis terkirim ke
            email pendaftar.
          </div>
        </div>
      )}

      {/* Header & Link ke Buku Induk */}
      <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            Manajemen Pengguna & Persetujuan Akun
          </h1>
          <p className="text-xs text-slate-600">
            Kelola pendaftaran akun baru, aktifkan/nonaktifkan/tolak akun (otomatis kirim email
            notifikasi), dan atur peran pengguna sebelum ditempatkan ke Buku Induk.
          </p>
        </div>
        <Link
          href="/portal/akademik/buku-induk"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shrink-0"
        >
          <BookOpen className="w-4 h-4" /> Buka Buku Induk Digital
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Akun</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-amber-200/70 bg-amber-50/40">
          <p className="text-[11px] font-medium text-amber-700">Menunggu Persetujuan</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.pending}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-emerald-200/70 bg-emerald-50/40">
          <p className="text-[11px] font-medium text-emerald-700">Akun Aktif</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.active}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Nonaktif</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{summary.inactive}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-rose-200/70 bg-rose-50/40">
          <p className="text-[11px] font-medium text-rose-700">Ditolak</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{summary.rejected}</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'ALL', label: `Semua (${summary.total})` },
                { key: 'PENDING', label: `Menunggu (${summary.pending})` },
                { key: 'AKTIF', label: `Aktif (${summary.active})` },
                { key: 'NONAKTIF', label: `Nonaktif (${summary.inactive})` },
                { key: 'DITOLAK', label: `Ditolak (${summary.rejected})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filterStatus === tab.key
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, atau role..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar pengguna...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Tidak ada data pengguna yang sesuai filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const isBusy = busyId === u.id;
              return (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{u.full_name}</span>
                      {renderStatusBadge(u.account_status)}
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{u.email || 'Tanpa email'}</span>
                      <span>•</span>
                      <span>
                        Daftar:{' '}
                        {new Date(u.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {u.rejection_reason && u.account_status === 'DITOLAK' && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg inline-block">
                        Alasan ditolak: {u.rejection_reason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {u.linked_student && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                          Buku Induk: Siswa
                        </span>
                      )}
                      {u.linked_teacher && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Buku Induk: {u.linked_teacher.staff_type}
                        </span>
                      )}
                      {u.linked_library && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                          E-Library: {u.linked_library.member_code} ({u.linked_library.member_type})
                        </span>
                      )}
                      {!u.linked_student && !u.linked_teacher && !u.linked_library && u.is_active && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          Belum ditempatkan di Buku Induk / E-Library
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canManage ? (
                      <>
                        <select
                          aria-label={`Role ${u.full_name}`}
                          value={u.primary_role}
                          disabled={isBusy}
                          onChange={(e) =>
                            handleAction({
                              userId: u.id,
                              action: 'UPDATE_ROLE',
                              primaryRole: e.target.value as AppRole,
                            })
                          }
                          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>

                        {u.account_status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleAction({
                                  userId: u.id,
                                  action: 'APPROVE',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              Setujui & Aktifkan
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setRejectModalUser(u);
                                setRejectionReason('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Tolak
                            </button>
                          </>
                        )}

                        {u.account_status === 'AKTIF' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleAction({
                                userId: u.id,
                                action: 'DEACTIVATE',
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition disabled:opacity-50"
                          >
                            <UserX className="w-3.5 h-3.5" /> Nonaktifkan
                          </button>
                        )}

                        {(u.account_status === 'NONAKTIF' || u.account_status === 'DITOLAK') && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleAction({
                                userId: u.id,
                                action: 'APPROVE',
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Aktifkan Kembali
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                        Role: {u.primary_role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tolak Pendaftaran */}
      {canManage && rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Tolak Pendaftaran Akun</h2>
            <p className="text-xs text-slate-600">
              Anda akan menolak pendaftaran akun <strong>{rejectModalUser.full_name}</strong> (
              {rejectModalUser.email}). Email notifikasi penolakan akan dikirim secara otomatis.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Alasan Penolakan (opsional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Email tidak terdaftar sebagai warga lembaga..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId === rejectModalUser.id}
                onClick={() =>
                  handleAction({
                    userId: rejectModalUser.id,
                    action: 'REJECT',
                    rejectionReason,
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectModalUser.id ? 'Memproses...' : 'Tolak & Kirim Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
