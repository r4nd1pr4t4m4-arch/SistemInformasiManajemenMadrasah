'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  FileSignature,
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

type AccountStatus = 'PENDING' | 'AKTIF' | 'NONAKTIF' | 'DITOLAK' | 'DITOLAK_PERMANEN';

interface AvatarChangeRequest {
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

interface NameChangeRequest {
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
  const [activeTab, setActiveTab] = useState<'users' | 'name_changes' | 'avatar_changes'>('users');
  const [nameRequests, setNameRequests] = useState<NameChangeRequest[]>([]);
  const [avatarRequests, setAvatarRequests] = useState<AvatarChangeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [filterNameStatus, setFilterNameStatus] = useState<'ALL' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK'>('ALL');
  const [rejectNameModalReq, setRejectNameModalReq] = useState<NameChangeRequest | null>(null);
  const [nameRejectNotes, setNameRejectNotes] = useState('');
  const [rejectAvatarModalReq, setRejectAvatarModalReq] = useState<AvatarChangeRequest | null>(null);
  const [avatarRejectNotes, setAvatarRejectNotes] = useState('');
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

  const loadNameRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/akun/nama/persetujuan');
      const data = await res.json();
      if (res.ok) {
        setNameRequests(data.requests || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadAvatarRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/akun/avatar/persetujuan');
      const data = await res.json();
      if (res.ok) {
        setAvatarRequests(data.requests || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadNameRequests();
    loadAvatarRequests();
  }, [loadUsers, loadNameRequests, loadAvatarRequests]);

  async function handleReviewAvatarChange(
    id: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ) {
    setBusyId(id);
    try {
      const res = await fetch('/api/akun/avatar/persetujuan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, review_notes: notes || null }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          'success',
          action === 'APPROVE'
            ? 'Foto profil disetujui dan langsung diterapkan ke profil serta kartu pengguna.'
            : 'Pengajuan foto profil ditolak.'
        );
        await Promise.all([loadAvatarRequests(), loadUsers()]);
        setRejectAvatarModalReq(null);
        setAvatarRejectNotes('');
      } else {
        showToast('error', data.error || 'Gagal memproses persetujuan foto profil.');
      }
    } catch {
      showToast('error', 'Gagal memproses persetujuan foto profil.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReviewNameChange(
    id: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ) {
    setBusyId(id);
    try {
      const res = await fetch('/api/akun/nama/persetujuan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, review_notes: notes || null }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          'success',
          action === 'APPROVE'
            ? 'Perubahan nama lengkap telah disetujui dan disinkronkan ke seluruh biodata pengguna.'
            : 'Pengajuan perubahan nama ditolak.'
        );
        await Promise.all([loadNameRequests(), loadUsers()]);
        setRejectNameModalReq(null);
        setNameRejectNotes('');
      } else {
        showToast('error', data.error || 'Gagal memproses persetujuan perubahan nama.');
      }
    } catch {
      showToast('error', 'Gagal memproses persetujuan perubahan nama.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(params: {
    userId: string;
    action: 'APPROVE' | 'REJECT' | 'REJECT_PERMANENT' | 'DEACTIVATE' | 'UPDATE_ROLE';
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
            ? 'Pendaftaran akun ditolak (pengguna masih dapat mendaftar ulang) & email notifikasi telah dikirim.'
            : params.action === 'REJECT_PERMANENT'
            ? 'Pendaftaran akun ditolak secara permanen (email tidak dapat digunakan mendaftar lagi) & email notifikasi telah dikirim.'
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
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'DITOLAK') {
          if (u.account_status !== 'DITOLAK' && u.account_status !== 'DITOLAK_PERMANEN') {
            return false;
          }
        } else if (u.account_status !== filterStatus) {
          return false;
        }
      }
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.primary_role.toLowerCase().includes(q)
      );
    });
  }, [users, filterStatus, search]);

  const filteredNameRequests = useMemo(() => {
    return nameRequests.filter((r) => {
      if (filterNameStatus !== 'ALL' && r.status !== filterNameStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          r.old_full_name.toLowerCase().includes(q) ||
          r.new_full_name.toLowerCase().includes(q) ||
          (r.profile?.email || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [nameRequests, filterNameStatus, search]);

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
    if (status === 'DITOLAK_PERMANEN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-900 text-white border border-rose-950">
          <XCircle className="w-3 h-3" /> Ditolak Permanen
        </span>
      );
    }
    if (status === 'DITOLAK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> Ditolak (Bisa Daftar Ulang)
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

      {/* Tab Switcher: Akun Pengguna vs Perubahan Nama */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Manajemen Akun Pengguna
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200">
            {summary.total}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('name_changes')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'name_changes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <FileSignature className="w-4 h-4" />
          Persetujuan Perubahan Nama
          {nameRequests.filter((r) => r.status === 'MENUNGGU').length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {nameRequests.filter((r) => r.status === 'MENUNGGU').length} Menunggu
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
              {nameRequests.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('avatar_changes')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'avatar_changes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          Persetujuan Foto Profil
          {avatarRequests.filter((r) => r.status === 'MENUNGGU').length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {avatarRequests.filter((r) => r.status === 'MENUNGGU').length} Menunggu
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
              {avatarRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'users' && (
        <>
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
                    {u.rejection_reason &&
                      (u.account_status === 'DITOLAK' ||
                        u.account_status === 'DITOLAK_PERMANEN') && (
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

                        {(u.account_status === 'NONAKTIF' ||
                          u.account_status === 'DITOLAK' ||
                          u.account_status === 'DITOLAK_PERMANEN') && (
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
      </>
      )}

      {activeTab === 'name_changes' && (
        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
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
                  onClick={() => setFilterNameStatus(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    filterNameStatus === f.key
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama lama/baru atau email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />
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
                        <span>Email: <strong className="text-slate-800">{r.profile?.email || '-'}</strong></span>
                        <span>•</span>
                        <span>Role: <strong className="text-slate-800">{r.profile?.primary_role || '-'}</strong></span>
                        <span>•</span>
                        <span>
                          Diajukan: {new Date(r.created_at).toLocaleString('id-ID')}
                        </span>
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
                            onClick={() => handleReviewNameChange(r.id, 'APPROVE')}
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
                            onClick={() => {
                              setRejectNameModalReq(r);
                              setNameRejectNotes('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {r.status === 'DISETUJUI'
                            ? `Disetujui pada ${r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('id-ID') : '-'}`
                            : r.status === 'DITOLAK'
                            ? `Ditolak pada ${r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('id-ID') : '-'}`
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
      )}

      {/* Modal Tolak Perubahan Nama */}
      {canManage && rejectNameModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Tolak Pengajuan Perubahan Nama</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menolak pengajuan perubahan nama dari <strong>{rejectNameModalReq.old_full_name}</strong> menjadi{' '}
              <strong>{rejectNameModalReq.new_full_name}</strong> ({rejectNameModalReq.profile?.email || '-'}).
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Catatan / Alasan Penolakan (opsional)
              </label>
              <textarea
                rows={3}
                value={nameRejectNotes}
                onChange={(e) => setNameRejectNotes(e.target.value)}
                placeholder="Misal: Nama tidak sesuai dengan dokumen identitas / Silakan unggah bukti pendukung..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectNameModalReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId === rejectNameModalReq.id}
                onClick={() =>
                  handleReviewNameChange(rejectNameModalReq.id, 'REJECT', nameRejectNotes)
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectNameModalReq.id ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Pendaftaran */}
      {canManage && rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Tolak Pendaftaran Akun</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menolak pendaftaran akun <strong>{rejectModalUser.full_name}</strong> (
              {rejectModalUser.email}). Email notifikasi penolakan akan dikirim secara otomatis.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
              <p>
                • <strong>Tolak &amp; Kirim Email:</strong> Pengguna masih diizinkan mendaftar ulang
                menggunakan alamat email yang sama (status kembali ke <em>Menunggu Persetujuan</em>).
              </p>
              <p>
                • <strong>Tolak Permanen:</strong> Alamat email ini diblokir dari pendaftaran ulang
                sehingga pengguna tidak dapat mendaftar lagi dengan email yang sama.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Alasan Penolakan (opsional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Nama lengkap belum sesuai identitas resmi / Email bukan warga lembaga..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
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
              <button
                type="button"
                disabled={busyId === rejectModalUser.id}
                onClick={() =>
                  handleAction({
                    userId: rejectModalUser.id,
                    action: 'REJECT_PERMANENT',
                    rejectionReason,
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectModalUser.id ? 'Memproses...' : 'Tolak Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'avatar_changes' && (
        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Pengajuan Perubahan Foto Profil ({avatarRequests.length})
              </h2>
              <p className="text-xs text-slate-500">
                Setujui atau tolak foto profil yang diunggah pengguna sebelum tampil di profil dan kartu digital.
              </p>
            </div>
          </div>

          {avatarRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Belum ada pengajuan perubahan foto profil.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {avatarRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
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

                  <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] text-slate-400 font-semibold">Foto Lama</p>
                      {req.old_avatar_url ? (
                        <img
                          src={req.old_avatar_url}
                          alt="Foto lama"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-500 text-[10px] flex items-center justify-center">
                          Kosong
                        </div>
                      )}
                    </div>
                    <span className="text-slate-400 font-bold">→</span>
                    <div className="text-center space-y-1">
                      <p className="text-[10px] text-emerald-700 font-semibold">Foto Baru</p>
                      <img
                        src={req.new_avatar_url}
                        alt="Foto baru"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400 shadow-xs"
                      />
                    </div>
                  </div>

                  {req.review_notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                      Catatan: {req.review_notes}
                    </p>
                  )}

                  {canManage && req.status === 'MENUNGGU' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => handleReviewAvatarChange(req.id, 'APPROVE')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => {
                          setRejectAvatarModalReq(req);
                          setAvatarRejectNotes('');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold disabled:opacity-50"
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
      )}

      {rejectAvatarModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Tolak Pengajuan Foto Profil</h3>
            <p className="text-xs text-slate-600">
              Tolak pengajuan foto profil dari{' '}
              <strong>{rejectAvatarModalReq.profile?.full_name || 'Pengguna'}</strong>?
            </p>
            <textarea
              rows={3}
              value={avatarRejectNotes}
              onChange={(e) => setAvatarRejectNotes(e.target.value)}
              placeholder="Alasan penolakan (mis. foto buram, bukan pas foto, dll)..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectAvatarModalReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId === rejectAvatarModalReq.id}
                onClick={() =>
                  handleReviewAvatarChange(rejectAvatarModalReq.id, 'REJECT', avatarRejectNotes)
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                Tolak Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
