'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  X,
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
  const [visibleUsersCount, setVisibleUsersCount] = useState(25);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModalUser, setRejectModalUser] = useState<ManagedUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(
    null
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'warning' | 'error', text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busyId) return;
      if (rejectModalUser) setRejectModalUser(null);
      else if (rejectNameModalReq) setRejectNameModalReq(null);
      else if (rejectAvatarModalReq) setRejectAvatarModalReq(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busyId, rejectModalUser, rejectNameModalReq, rejectAvatarModalReq]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/akun/manajemen-pengguna', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
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
      const res = await fetch('/api/akun/nama/persetujuan', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
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
      const res = await fetch('/api/akun/avatar/persetujuan', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAvatarRequests(data.requests || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadUsers();
      void loadNameRequests();
      void loadAvatarRequests();
    }, 0);
    return () => clearTimeout(id);
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
      const data = await res.json().catch(() => ({}));
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
      const data = await res.json().catch(() => ({}));
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
      const data = await res.json().catch(() => ({}));
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
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'success' ? (
              <MailCheck className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!smtpConfigured && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0 break-words">
            <strong>SMTP Email belum dikonfigurasi:</strong> Atur variabel{' '}
            <code>GMAIL_SMTP_USER</code> dan <code>GMAIL_SMTP_APP_PASSWORD</code> pada{' '}
            <code>.env.local</code> agar notifikasi persetujuan/penolakan akun otomatis terkirim ke
            email pendaftar.
          </div>
        </div>
      )}

      {/* Header & Link ke Buku Induk */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Manajemen Pengguna &amp; Persetujuan Akun</span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Kelola pendaftaran akun baru, aktifkan/nonaktifkan/tolak akun (otomatis kirim email
            notifikasi), dan atur peran pengguna sebelum ditempatkan ke Buku Induk.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              loadUsers();
              loadNameRequests();
              loadAvatarRequests();
            }}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
          <Link
            href="/portal/akademik/buku-induk"
            className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shrink-0"
          >
            <BookOpen className="w-4 h-4 shrink-0" /> Buka Buku Induk Digital
          </Link>
        </div>
      </div>

      {/* Tab Switcher: Akun Pengguna vs Perubahan Nama */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-3 sm:flex-wrap sm:overflow-visible border-b border-slate-200/80 -mx-1 px-1">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition shrink-0 whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          Manajemen Akun Pengguna
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200">
            {summary.total}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('name_changes')}
          className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition shrink-0 whitespace-nowrap ${
            activeTab === 'name_changes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <FileSignature className="w-4 h-4 shrink-0" />
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
          className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition shrink-0 whitespace-nowrap ${
            activeTab === 'avatar_changes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Camera className="w-4 h-4 shrink-0" />
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
            <div className="glass-card rounded-2xl p-4 border border-rose-200/70 bg-rose-50/40 col-span-2 md:col-span-1">
              <p className="text-[11px] font-medium text-rose-700">Ditolak</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{summary.rejected}</p>
            </div>
          </div>

      {/* Filter & Search */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible -mx-1 px-1">
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
                aria-pressed={filterStatus === tab.key}
                onClick={() => {
                  setFilterStatus(tab.key);
                  setVisibleUsersCount(25);
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 whitespace-nowrap ${
                  filterStatus === tab.key
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari pengguna"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleUsersCount(25);
              }}
              placeholder="Cari nama, email, atau role..."
              className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setVisibleUsersCount(25);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat daftar pengguna...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Tidak ada data pengguna yang sesuai filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.slice(0, visibleUsersCount).map((u) => {
              const isBusy = busyId === u.id;
              return (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 break-words">
                        {u.full_name}
                      </span>
                      {renderStatusBadge(u.account_status)}
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="break-all">{u.email || 'Tanpa email'}</span>
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
                        <p className="text-[11px] text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg inline-block break-words max-w-full">
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
                          className="w-full sm:w-auto min-h-[38px] px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm sm:text-xs font-medium text-slate-700"
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
                              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              Setujui &amp; Aktifkan
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setRejectModalUser(u);
                                setRejectionReason('');
                              }}
                              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Tolak
                            </button>
                          </>
                        )}

                        {u.account_status === 'AKTIF' && (
                          <button
                            type="button"
                            aria-busy={isBusy || undefined}
                            disabled={isBusy}
                            onClick={() =>
                              handleAction({
                                userId: u.id,
                                action: 'DEACTIVATE',
                              })
                            }
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}{' '}
                            Nonaktifkan
                          </button>
                        )}

                        {(u.account_status === 'NONAKTIF' ||
                          u.account_status === 'DITOLAK' ||
                          u.account_status === 'DITOLAK_PERMANEN') && (
                          <button
                            type="button"
                            aria-busy={isBusy || undefined}
                            disabled={isBusy}
                            onClick={() =>
                              handleAction({
                                userId: u.id,
                                action: 'APPROVE',
                              })
                            }
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}{' '}
                            Aktifkan Kembali
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

            {visibleUsersCount < filteredUsers.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleUsersCount((c) => c + 25)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition"
                >
                  Muat Lebih Banyak ({filteredUsers.length - visibleUsersCount} tersisa)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === 'name_changes' && (
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reject-name-title"
          onClick={() => {
            if (!busyId) setRejectNameModalReq(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <h2 id="modal-reject-name-title" className="text-base font-bold text-slate-900">
              Tolak Pengajuan Perubahan Nama
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              Anda akan menolak pengajuan perubahan nama dari <strong>{rejectNameModalReq.old_full_name}</strong> menjadi{' '}
              <strong>{rejectNameModalReq.new_full_name}</strong> ({rejectNameModalReq.profile?.email || '-'}).
            </p>
            <div className="space-y-1.5">
              <label htmlFor="name-reject-notes" className="text-xs font-semibold text-slate-700">
                Catatan / Alasan Penolakan (opsional)
              </label>
              <textarea
                id="name-reject-notes"
                rows={3}
                value={nameRejectNotes}
                onChange={(e) => setNameRejectNotes(e.target.value)}
                placeholder="Misal: Nama tidak sesuai dengan dokumen identitas / Silakan unggah bukti pendukung..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busyId === rejectNameModalReq.id}
                onClick={() => setRejectNameModalReq(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                aria-busy={busyId === rejectNameModalReq.id || undefined}
                disabled={busyId === rejectNameModalReq.id}
                onClick={() =>
                  handleReviewNameChange(rejectNameModalReq.id, 'REJECT', nameRejectNotes)
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectNameModalReq.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busyId === rejectNameModalReq.id ? 'Memproses...' : 'Konfirmasi Tolak'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Pendaftaran */}
      {canManage && rejectModalUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reject-user-title"
          onClick={() => {
            if (!busyId) setRejectModalUser(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <h2 id="modal-reject-user-title" className="text-base font-bold text-slate-900">
              Tolak Pendaftaran Akun
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
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
              <label htmlFor="user-reject-reason" className="text-xs font-semibold text-slate-700">
                Alasan Penolakan (opsional)
              </label>
              <textarea
                id="user-reject-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Nama lengkap belum sesuai identitas resmi / Email bukan warga lembaga..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busyId === rejectModalUser.id}
                onClick={() => setRejectModalUser(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                aria-busy={busyId === rejectModalUser.id || undefined}
                disabled={busyId === rejectModalUser.id}
                onClick={() =>
                  handleAction({
                    userId: rejectModalUser.id,
                    action: 'REJECT',
                    rejectionReason,
                  })
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectModalUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busyId === rejectModalUser.id ? 'Memproses...' : 'Tolak & Kirim Email'}</span>
              </button>
              <button
                type="button"
                aria-busy={busyId === rejectModalUser.id || undefined}
                disabled={busyId === rejectModalUser.id}
                onClick={() =>
                  handleAction({
                    userId: rejectModalUser.id,
                    action: 'REJECT_PERMANENT',
                    rejectionReason,
                  })
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectModalUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busyId === rejectModalUser.id ? 'Memproses...' : 'Tolak Permanen'}</span>
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
                    <span className="text-slate-500 font-bold">→</span>
                    <div className="text-center space-y-1">
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
                    <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                      Catatan: {req.review_notes}
                    </p>
                  )}

                  {canManage && req.status === 'MENUNGGU' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        aria-busy={busyId === req.id || undefined}
                        disabled={busyId === req.id}
                        onClick={() => handleReviewAvatarChange(req.id, 'APPROVE')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
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

      {canManage && rejectAvatarModalReq && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reject-avatar-title"
          onClick={() => {
            if (!busyId) setRejectAvatarModalReq(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <h3 id="modal-reject-avatar-title" className="text-sm font-bold text-slate-900">
              Tolak Pengajuan Foto Profil
            </h3>
            <p className="text-xs text-slate-600 break-words">
              Tolak pengajuan foto profil dari{' '}
              <strong>{rejectAvatarModalReq.profile?.full_name || 'Pengguna'}</strong>?
            </p>
            <textarea
              rows={3}
              aria-label="Alasan penolakan foto profil"
              value={avatarRejectNotes}
              onChange={(e) => setAvatarRejectNotes(e.target.value)}
              placeholder="Alasan penolakan (mis. foto buram, bukan pas foto, dll)..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                disabled={busyId === rejectAvatarModalReq.id}
                onClick={() => setRejectAvatarModalReq(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                aria-busy={busyId === rejectAvatarModalReq.id || undefined}
                disabled={busyId === rejectAvatarModalReq.id}
                onClick={() =>
                  handleReviewAvatarChange(rejectAvatarModalReq.id, 'REJECT', avatarRejectNotes)
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busyId === rejectAvatarModalReq.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busyId === rejectAvatarModalReq.id ? 'Memproses...' : 'Tolak Foto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
