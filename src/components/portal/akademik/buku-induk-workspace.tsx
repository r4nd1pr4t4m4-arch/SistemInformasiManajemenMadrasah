'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  downloadStudentTemplateXlsx,
  downloadTeacherTemplateXlsx,
  exportStudentsEmisDapodikXlsx,
  exportTeachersEmisDapodikXlsx,
  parseStudentImportXlsx,
  parseTeacherImportXlsx,
} from '@/lib/domain/emis-dapodik-excel';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikModal,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

export type BukuIndukSection = 'siswa' | 'gtk' | 'penempatan-akun';

interface StudentRow {
  id: string;
  nis: string | null;
  nisn: string | null;
  nik?: string | null;
  full_name: string;
  gender: 'L' | 'P' | null;
  birth_place?: string | null;
  birth_date?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
}

interface EmploymentHistoryRow {
  id: string;
  position_title: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface TeacherRow {
  id: string;
  staff_type: string;
  full_name: string;
  nip: string | null;
  nuptk: string | null;
  nik?: string | null;
  gender?: 'L' | 'P' | null;
  employment_status: string | null;
  education_level?: string | null;
  major?: string | null;
  phone?: string | null;
  email?: string | null;
  employment_histories?: EmploymentHistoryRow[] | null;
}

interface ActiveAccountRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  is_student: boolean;
  is_teacher: boolean;
  is_library_member: boolean;
}

const STUDENT_PAGE_SIZE = 20;

export function BukuIndukWorkspace({ section }: { section: BukuIndukSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BUKU_INDUK_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const studentFileInputRef = useRef<HTMLInputElement | null>(null);
  const teacherFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<ActiveAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State khusus section === 'siswa'
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [studentPage, setStudentPage] = useState(1);
  const [showStudentForm, setShowStudentForm] = useState(true);
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null);

  // State khusus section === 'gtk'
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<string>('ALL');
  const [teacherPage, setTeacherPage] = useState(1);
  const [showTeacherForm, setShowTeacherForm] = useState(true);
  const [detailTeacher, setDetailTeacher] = useState<TeacherRow | null>(null);

  // State khusus section === 'penempatan-akun'
  const [placementGender, setPlacementGender] = useState<'L' | 'P'>('L');
  const [placementStaffType, setPlacementStaffType] = useState<'GURU' | 'TATA_USAHA' | 'LAINNYA'>('GURU');
  const [accountFilter, setAccountFilter] = useState<'ALL' | 'UNASSIGNED' | 'STUDENT' | 'TEACHER' | 'LIBRARY'>('ALL');
  const [accountPage, setAccountPage] = useState(1);

  const [studentForm, setStudentForm] = useState({
    profile_id: null as string | null,
    full_name: '',
    nis: '',
    nisn: '',
    nik: '',
    gender: 'L' as 'L' | 'P',
    father_name: '',
    mother_name: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    profile_id: null as string | null,
    full_name: '',
    staff_type: 'GURU' as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
    nuptk: '',
    nip: '',
    gender: 'L' as 'L' | 'P',
    employment_status: 'GTY',
    initial_position: 'Guru Mata Pelajaran',
    email: '',
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/buku-induk', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data Buku Induk Digital.');
      }
      setLoadError(null);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setActiveAccounts(data.activeAccounts || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function submitEntity(body: unknown, msg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const res = await fetch('/api/akademik/buku-induk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan saat menyimpan data.');
        return false;
      }
      showToast('success', msg);
      await loadData();
      return true;
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudentExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || importingExcel) return;

    setImportingExcel(true);
    try {
      const { records, skippedCount } = await parseStudentImportXlsx(file);
      if (records.length === 0) {
        showToast(
          'error',
          'Tidak ditemukan baris data siswa yang valid di file Excel. Pastikan kolom "Nama Lengkap" terisi.'
        );
        return;
      }

      const ok = await submitEntity(
        {
          type: 'BULK_IMPORT_STUDENTS',
          records,
        },
        `${records.length} data siswa (format EMIS/Dapodik) berhasil diimpor ke Buku Induk & E-Library${
          skippedCount > 0 ? ` (${skippedCount} baris kosong dilewati)` : ''
        }.`
      );
      if (ok) {
        setStudentPage(1);
      }
    } catch {
      showToast('error', 'Gagal membaca file Excel. Pastikan format file .xlsx atau .csv valid.');
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleTeacherExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || importingExcel) return;

    setImportingExcel(true);
    try {
      const { records, skippedCount } = await parseTeacherImportXlsx(file);
      if (records.length === 0) {
        showToast(
          'error',
          'Tidak ditemukan baris data GTK yang valid di file Excel. Pastikan kolom "Nama Lengkap & Gelar" terisi.'
        );
        return;
      }

      const ok = await submitEntity(
        {
          type: 'BULK_IMPORT_TEACHERS',
          records,
        },
        `${records.length} data GTK (format EMIS/Dapodik) berhasil diimpor ke Buku Induk & E-Library${
          skippedCount > 0 ? ` (${skippedCount} baris kosong dilewati)` : ''
        }.`
      );
      if (ok) {
        setTeacherPage(1);
      }
    } catch {
      showToast('error', 'Gagal membaca file Excel. Pastikan format file .xlsx atau .csv valid.');
    } finally {
      setImportingExcel(false);
    }
  }

  const studentStats = useMemo(() => {
    let active = 0;
    let male = 0;
    let female = 0;
    const statusSet = new Set<string>();
    for (const s of students) {
      const st = (s.status || 'AKTIF').toUpperCase();
      statusSet.add(st);
      if (st === 'AKTIF') active++;
      if (s.gender === 'L') male++;
      else if (s.gender === 'P') female++;
    }
    return {
      total: students.length,
      active,
      male,
      female,
      statuses: Array.from(statusSet),
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (genderFilter !== 'ALL' && s.gender !== genderFilter) return false;
      if (statusFilter !== 'ALL' && (s.status || 'AKTIF').toUpperCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.nisn || '').toLowerCase().includes(q) ||
        (s.nik || '').toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, genderFilter, statusFilter]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE));
  const safeStudentPage = Math.min(studentPage, totalStudentPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeStudentPage - 1) * STUDENT_PAGE_SIZE;
    return filteredStudents.slice(start, start + STUDENT_PAGE_SIZE);
  }, [filteredStudents, safeStudentPage]);

  const teacherStats = useMemo(() => {
    let guru = 0;
    let tu = 0;
    let other = 0;
    const empSet = new Set<string>();
    for (const t of teachers) {
      const st = (t.staff_type || 'GURU').toUpperCase();
      if (st === 'GURU') guru++;
      else if (st === 'TATA_USAHA') tu++;
      else other++;
      if (t.employment_status) empSet.add(t.employment_status.toUpperCase());
    }
    return {
      total: teachers.length,
      guru,
      tu,
      other,
      employmentStatuses: Array.from(empSet),
    };
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teachers.filter((t) => {
      if (staffTypeFilter !== 'ALL' && (t.staff_type || 'GURU').toUpperCase() !== staffTypeFilter) {
        return false;
      }
      if (
        employmentFilter !== 'ALL' &&
        (t.employment_status || '').toUpperCase() !== employmentFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        (t.nip || '').toLowerCase().includes(q) ||
        (t.nuptk || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
      );
    });
  }, [teachers, searchQuery, staffTypeFilter, employmentFilter]);

  const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / STUDENT_PAGE_SIZE));
  const safeTeacherPage = Math.min(teacherPage, totalTeacherPages);
  const paginatedTeachers = useMemo(() => {
    const start = (safeTeacherPage - 1) * STUDENT_PAGE_SIZE;
    return filteredTeachers.slice(start, start + STUDENT_PAGE_SIZE);
  }, [filteredTeachers, safeTeacherPage]);

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

  if (loading) {
    return <AkademikLoading label="Memuat Buku Induk Digital..." />;
  }

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId) || null;
  const hasActiveStudentFilter = Boolean(
    searchQuery.trim() || genderFilter !== 'ALL' || statusFilter !== 'ALL'
  );
  const hasActiveTeacherFilter = Boolean(
    searchQuery.trim() || staffTypeFilter !== 'ALL' || employmentFilter !== 'ALL'
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {section === 'penempatan-akun' && !canManage && (
        <div className="glass-card rounded-3xl p-6 flex items-center gap-3 text-xs text-slate-600">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Anda tidak memiliki izin untuk mengelola penempatan akun ke Buku Induk.</span>
        </div>
      )}

      {section === 'penempatan-akun' && canManage && (
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
                  onClick={handleRefresh}
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
      )}

      {section === 'siswa' && (
        <div className="space-y-5">
          {/* Ringkasan Statistik Siswa */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total Siswa</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{studentStats.total}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Status Aktif</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">{studentStats.active}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Laki-laki (L)</p>
              <p className="text-xl font-black text-sky-700 mt-0.5">{studentStats.male}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Perempuan (P)</p>
              <p className="text-xl font-black text-rose-600 mt-0.5">{studentStats.female}</p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            {/* Header & Kontrol Refresh/Form */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Buku Induk Siswa ({students.length})</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola data induk siswa terdaftar beserta integrasi otomatis ke E-Library.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={filteredStudents.length === 0}
                  onClick={() => exportStudentsEmisDapodikXlsx(filteredStudents)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 disabled:opacity-40 text-xs font-semibold text-emerald-800 transition"
                  title="Ekspor data siswa ke format Excel standar EMIS / Dapodik"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor Excel (EMIS/Dapodik)</span>
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => downloadStudentTemplateXlsx()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      title="Unduh template Excel impor siswa EMIS / Dapodik"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Template</span>
                    </button>
                    <input
                      ref={studentFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => void handleStudentExcelImport(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={importingExcel || submitting}
                      onClick={() => studentFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold transition"
                    >
                      {importingExcel ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{importingExcel ? 'Mengimpor...' : 'Impor Excel'}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowStudentForm((prev) => !prev)}
                    aria-expanded={showStudentForm}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
                  >
                    {showStudentForm ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Sembunyikan Form
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Tambah Siswa
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Form Tambah Siswa */}
            {canManage && showStudentForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmedName = studentForm.full_name.trim();
                  if (trimmedName.length < 2) {
                    showToast('error', 'Nama lengkap siswa minimal 2 karakter.');
                    return;
                  }
                  const ok = await submitEntity(
                    {
                      type: 'STUDENT',
                      profile_id: studentForm.profile_id,
                      full_name: trimmedName,
                      nis: studentForm.nis.trim() || null,
                      nisn: studentForm.nisn.trim() || null,
                      nik: studentForm.nik.trim() || null,
                      gender: studentForm.gender,
                      father_name: studentForm.father_name.trim() || null,
                      mother_name: studentForm.mother_name.trim() || null,
                    },
                    'Siswa ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                  );
                  if (ok) {
                    setStudentPage(1);
                    setStudentForm({
                      profile_id: null,
                      full_name: '',
                      nis: '',
                      nisn: '',
                      nik: '',
                      gender: 'L',
                      father_name: '',
                      mother_name: '',
                    });
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
              >
                <div className="sm:col-span-2 lg:col-span-2">
                  <label
                    htmlFor="student-full-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Lengkap Siswa <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="student-full-name"
                    required
                    minLength={2}
                    placeholder="Contoh: Ahmad Fauzi"
                    value={studentForm.full_name}
                    onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-gender"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Jenis Kelamin
                  </label>
                  <select
                    id="student-gender"
                    value={studentForm.gender}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="student-nis"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    NIS
                  </label>
                  <input
                    id="student-nis"
                    placeholder="Nomor Induk Siswa"
                    value={studentForm.nis}
                    onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-nisn"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    NISN
                  </label>
                  <input
                    id="student-nisn"
                    placeholder="Nomor Induk Siswa Nasional"
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-nik"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    NIK (Opsional)
                  </label>
                  <input
                    id="student-nik"
                    placeholder="Nomor Induk Kependudukan"
                    value={studentForm.nik}
                    onChange={(e) => setStudentForm({ ...studentForm, nik: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-father"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Ayah (Opsional)
                  </label>
                  <input
                    id="student-father"
                    placeholder="Nama lengkap ayah"
                    value={studentForm.father_name}
                    onChange={(e) => setStudentForm({ ...studentForm, father_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-mother"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Ibu (Opsional)
                  </label>
                  <input
                    id="student-mother"
                    placeholder="Nama lengkap ibu"
                    value={studentForm.mother_name}
                    onChange={(e) => setStudentForm({ ...studentForm, mother_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Siswa ke Buku Induk
                  </button>
                </div>
              </form>
            )}

            {/* Bar Pencarian & Filter */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setStudentPage(1);
                  }}
                  placeholder="Cari nama, NIS, NISN, atau NIK siswa..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStudentPage(1);
                    }}
                    aria-label="Hapus pencarian"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
                <select
                  aria-label="Filter jenis kelamin"
                  value={genderFilter}
                  onChange={(e) => {
                    setGenderFilter(e.target.value as 'ALL' | 'L' | 'P');
                    setStudentPage(1);
                  }}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="ALL">Semua Gender</option>
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>

                <select
                  aria-label="Filter status siswa"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setStudentPage(1);
                  }}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="ALL">Semua Status</option>
                  {studentStats.statuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Daftar Siswa */}
            {filteredStudents.length === 0 ? (
              <AkademikEmptyState
                icon={<GraduationCap className="w-6 h-6" />}
                message={
                  hasActiveStudentFilter
                    ? 'Tidak ada siswa yang sesuai dengan filter atau pencarian.'
                    : 'Belum ada data siswa di Buku Induk.'
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {paginatedStudents.map((s) => {
                    const statusLabel = (s.status || 'AKTIF').toUpperCase();
                    const isActive = statusLabel === 'AKTIF';
                    return (
                      <div
                        key={s.id}
                        className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900 break-words">{s.full_name}</p>
                            {s.gender && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  s.gender === 'L'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 break-words">
                            NIS: <span className="font-mono text-slate-700">{s.nis || '-'}</span> •
                            NISN: <span className="font-mono text-slate-700">{s.nisn || '-'}</span>
                            {s.father_name ? ` • Ayah: ${s.father_name}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetailStudent(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Menampilkan{' '}
                    <strong className="text-slate-800">
                      {(safeStudentPage - 1) * STUDENT_PAGE_SIZE + 1}–
                      {Math.min(safeStudentPage * STUDENT_PAGE_SIZE, filteredStudents.length)}
                    </strong>{' '}
                    dari <strong className="text-slate-800">{filteredStudents.length}</strong> siswa
                  </span>
                  {totalStudentPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeStudentPage <= 1}
                        onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                      </button>
                      <span className="px-2 font-semibold text-slate-700">
                        {safeStudentPage} / {totalStudentPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeStudentPage >= totalStudentPages}
                        onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
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

          {/* Modal Detail Biodata Siswa */}
          <AkademikModal
            open={Boolean(detailStudent)}
            onClose={() => setDetailStudent(null)}
            title="Detail Biodata Siswa"
          >
            {detailStudent && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-sm font-bold text-slate-900 break-words">
                    {detailStudent.full_name}
                  </p>
                  <p className="text-slate-500">
                    Status:{' '}
                    <strong className="text-emerald-700">
                      {(detailStudent.status || 'AKTIF').toUpperCase()}
                    </strong>
                  </p>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NIS</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailStudent.nis || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NISN</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailStudent.nisn || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NIK</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailStudent.nik || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Jenis Kelamin</dt>
                    <dd className="font-semibold text-slate-800">
                      {detailStudent.gender === 'L'
                        ? 'Laki-laki'
                        : detailStudent.gender === 'P'
                        ? 'Perempuan'
                        : '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Nama Ayah</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.father_name || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Nama Ibu</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.mother_name || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white sm:col-span-2">
                    <dt className="text-[11px] text-slate-400">Tempat, Tanggal Lahir</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.birth_place || detailStudent.birth_date
                        ? `${detailStudent.birth_place || '-'}${
                            detailStudent.birth_date ? `, ${detailStudent.birth_date}` : ''
                          }`
                        : '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Telepon</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.phone || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Email</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.email || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white sm:col-span-2">
                    <dt className="text-[11px] text-slate-400">Alamat</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailStudent.address || '-'}
                    </dd>
                  </div>
                </dl>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setDetailStudent(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </AkademikModal>
        </div>
      )}

      {section === 'gtk' && (
        <div className="space-y-5">
          {/* Ringkasan Statistik GTK */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Total GTK</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{teacherStats.total}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Guru</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">{teacherStats.guru}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Tata Usaha</p>
              <p className="text-xl font-black text-sky-700 mt-0.5">{teacherStats.tu}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-slate-500">Lainnya</p>
              <p className="text-xl font-black text-slate-700 mt-0.5">{teacherStats.other}</p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            {/* Header & Kontrol Refresh/Form */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Buku Induk GTK ({teachers.length})</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola data Guru &amp; Tenaga Kependidikan beserta riwayat jabatan dan E-Library.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={filteredTeachers.length === 0}
                  onClick={() => exportTeachersEmisDapodikXlsx(filteredTeachers)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 disabled:opacity-40 text-xs font-semibold text-emerald-800 transition"
                  title="Ekspor data GTK ke format Excel standar EMIS / Dapodik"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor Excel (EMIS/Dapodik)</span>
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => downloadTeacherTemplateXlsx()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      title="Unduh template Excel impor GTK EMIS / Dapodik"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Template</span>
                    </button>
                    <input
                      ref={teacherFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => void handleTeacherExcelImport(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={importingExcel || submitting}
                      onClick={() => teacherFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold transition"
                    >
                      {importingExcel ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{importingExcel ? 'Mengimpor...' : 'Impor Excel'}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowTeacherForm((prev) => !prev)}
                    aria-expanded={showTeacherForm}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
                  >
                    {showTeacherForm ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Sembunyikan Form
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Tambah GTK
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Form Tambah GTK */}
            {canManage && showTeacherForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmedName = teacherForm.full_name.trim();
                  if (trimmedName.length < 2) {
                    showToast('error', 'Nama lengkap GTK minimal 2 karakter.');
                    return;
                  }
                  const ok = await submitEntity(
                    {
                      type: 'TEACHER',
                      profile_id: teacherForm.profile_id,
                      full_name: trimmedName,
                      staff_type: teacherForm.staff_type,
                      nuptk: teacherForm.nuptk.trim() || null,
                      nip: teacherForm.nip.trim() || null,
                      gender: teacherForm.gender,
                      employment_status: teacherForm.employment_status.trim() || 'GTY',
                      initial_position: teacherForm.initial_position.trim() || null,
                      email: teacherForm.email.trim() || null,
                    },
                    'GTK ditambahkan ke Buku Induk & otomatis terdaftar di E-Library.'
                  );
                  if (ok) {
                    setTeacherPage(1);
                    setTeacherForm({
                      profile_id: null,
                      full_name: '',
                      staff_type: 'GURU',
                      nuptk: '',
                      nip: '',
                      gender: 'L',
                      employment_status: 'GTY',
                      initial_position: 'Guru Mata Pelajaran',
                      email: '',
                    });
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70"
              >
                <div className="sm:col-span-2 lg:col-span-2">
                  <label
                    htmlFor="gtk-full-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Nama Lengkap &amp; Gelar <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="gtk-full-name"
                    required
                    minLength={2}
                    placeholder="Contoh: Drs. Budi Santoso, M.Pd."
                    value={teacherForm.full_name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gtk-gender"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Jenis Kelamin
                  </label>
                  <select
                    id="gtk-gender"
                    value={teacherForm.gender}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gtk-staff-type"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Jenis GTK
                  </label>
                  <select
                    id="gtk-staff-type"
                    value={teacherForm.staff_type}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        staff_type: e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="GURU">Guru</option>
                    <option value="TATA_USAHA">Tata Usaha</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gtk-employment-status"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Status Kepegawaian
                  </label>
                  <select
                    id="gtk-employment-status"
                    value={teacherForm.employment_status}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, employment_status: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="GTY">GTY (Guru Tetap Yayasan)</option>
                    <option value="GTT">GTT (Guru Tidak Tetap)</option>
                    <option value="PTY">PTY (Pegawai Tetap Yayasan)</option>
                    <option value="PTT">PTT (Pegawai Tidak Tetap)</option>
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gtk-nuptk"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    NUPTK (Opsional)
                  </label>
                  <input
                    id="gtk-nuptk"
                    placeholder="Nomor Unik Pendidik"
                    value={teacherForm.nuptk}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nuptk: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gtk-nip"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    NIP (Opsional)
                  </label>
                  <input
                    id="gtk-nip"
                    placeholder="Nomor Induk Pegawai"
                    value={teacherForm.nip}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gtk-initial-position"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Riwayat Jabatan Awal
                  </label>
                  <input
                    id="gtk-initial-position"
                    placeholder="Contoh: Guru Mata Pelajaran"
                    value={teacherForm.initial_position}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, initial_position: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gtk-email"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id="gtk-email"
                    type="email"
                    placeholder="nama@madrasah.sch.id"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan GTK ke Buku Induk
                  </button>
                </div>
              </form>
            )}

            {/* Bar Pencarian & Filter */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setTeacherPage(1);
                  }}
                  placeholder="Cari nama, NIP, NUPTK, atau email GTK..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTeacherPage(1);
                    }}
                    aria-label="Hapus pencarian"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
                <select
                  aria-label="Filter jenis GTK"
                  value={staffTypeFilter}
                  onChange={(e) => {
                    setStaffTypeFilter(e.target.value);
                    setTeacherPage(1);
                  }}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="GURU">Guru</option>
                  <option value="TATA_USAHA">Tata Usaha</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>

                <select
                  aria-label="Filter status kepegawaian"
                  value={employmentFilter}
                  onChange={(e) => {
                    setEmploymentFilter(e.target.value);
                    setTeacherPage(1);
                  }}
                  className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="ALL">Semua Kepegawaian</option>
                  {teacherStats.employmentStatuses.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Daftar GTK */}
            {filteredTeachers.length === 0 ? (
              <AkademikEmptyState
                icon={<UserCheck className="w-6 h-6" />}
                message={
                  hasActiveTeacherFilter
                    ? 'Tidak ada data GTK yang sesuai dengan filter atau pencarian.'
                    : 'Belum ada data GTK di Buku Induk.'
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {paginatedTeachers.map((t) => {
                    const staffLabel =
                      t.staff_type === 'TATA_USAHA'
                        ? 'Tata Usaha'
                        : t.staff_type === 'LAINNYA'
                        ? 'Lainnya'
                        : 'Guru';
                    return (
                      <div
                        key={t.id}
                        className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900 break-words">{t.full_name}</p>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                t.staff_type === 'GURU'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {staffLabel}
                            </span>
                          </div>
                          <p className="text-slate-500 break-words">
                            NUPTK: <span className="font-mono text-slate-700">{t.nuptk || '-'}</span> •
                            NIP: <span className="font-mono text-slate-700">{t.nip || '-'}</span>
                            {t.email ? ` • ${t.email}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                            {t.employment_status || '-'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetailTeacher(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Menampilkan{' '}
                    <strong className="text-slate-800">
                      {(safeTeacherPage - 1) * STUDENT_PAGE_SIZE + 1}–
                      {Math.min(safeTeacherPage * STUDENT_PAGE_SIZE, filteredTeachers.length)}
                    </strong>{' '}
                    dari <strong className="text-slate-800">{filteredTeachers.length}</strong> GTK
                  </span>
                  {totalTeacherPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeTeacherPage <= 1}
                        onClick={() => setTeacherPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                      </button>
                      <span className="px-2 font-semibold text-slate-700">
                        {safeTeacherPage} / {totalTeacherPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeTeacherPage >= totalTeacherPages}
                        onClick={() => setTeacherPage((p) => Math.min(totalTeacherPages, p + 1))}
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

          {/* Modal Detail Biodata & Riwayat Jabatan GTK */}
          <AkademikModal
            open={Boolean(detailTeacher)}
            onClose={() => setDetailTeacher(null)}
            title="Detail Biodata GTK"
          >
            {detailTeacher && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-sm font-bold text-slate-900 break-words">
                    {detailTeacher.full_name}
                  </p>
                  <p className="text-slate-500">
                    Jenis:{' '}
                    <strong className="text-emerald-700">{detailTeacher.staff_type}</strong> • Status:{' '}
                    <strong className="text-sky-700">
                      {detailTeacher.employment_status || '-'}
                    </strong>
                  </p>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NUPTK</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailTeacher.nuptk || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NIP</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailTeacher.nip || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">NIK</dt>
                    <dd className="font-semibold text-slate-800 font-mono">
                      {detailTeacher.nik || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Jenis Kelamin</dt>
                    <dd className="font-semibold text-slate-800">
                      {detailTeacher.gender === 'L'
                        ? 'Laki-laki'
                        : detailTeacher.gender === 'P'
                        ? 'Perempuan'
                        : '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Pendidikan / Jurusan</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailTeacher.education_level || detailTeacher.major
                        ? `${detailTeacher.education_level || '-'}${
                            detailTeacher.major ? ` (${detailTeacher.major})` : ''
                          }`
                        : '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white">
                    <dt className="text-[11px] text-slate-400">Telepon</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailTeacher.phone || '-'}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-100 bg-white sm:col-span-2">
                    <dt className="text-[11px] text-slate-400">Email</dt>
                    <dd className="font-semibold text-slate-800 break-words">
                      {detailTeacher.email || '-'}
                    </dd>
                  </div>
                </dl>

                {detailTeacher.employment_histories &&
                  detailTeacher.employment_histories.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">Riwayat Jabatan</p>
                      <ul className="space-y-1.5">
                        {detailTeacher.employment_histories.map((h) => (
                          <li
                            key={h.id}
                            className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl px-2.5 py-1.5 border border-slate-100"
                          >
                            <span className="font-semibold text-slate-800 break-words">
                              {h.position_title}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {h.start_date || '-'}
                              {h.end_date ? ` s.d. ${h.end_date}` : ' – Sekarang'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setDetailTeacher(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </AkademikModal>
        </div>
      )}
    </div>
  );
}
