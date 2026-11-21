'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  GraduationCap,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

type ActiveAccount = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AlumniStudent = {
  id: string;
  profile_id: string | null;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  graduation_year: number | null;
  profile?: ActiveAccount | null;
};

type ActiveStudent = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
};

type AlumniTracer = {
  id: string;
  student_id: string | null;
  full_name: string;
  graduation_year: number;
  phone: string | null;
  email: string | null;
  current_activity: 'KULIAH' | 'BEKERJA' | 'WIRAUSAHA' | 'PESANTREN' | 'MENCARI_KERJA' | 'LAINNYA';
  institution_or_company: string | null;
  major_or_position: string | null;
  city: string | null;
  testimonial: string | null;
};

const EMPTY_TRACER_FORM = {
  student_id: '',
  full_name: '',
  graduation_year: String(new Date().getFullYear()),
  phone: '',
  email: '',
  current_activity: 'KULIAH' as AlumniTracer['current_activity'],
  institution_or_company: '',
  major_or_position: '',
  city: '',
  testimonial: '',
};

const ACTIVITY_LABELS: Record<AlumniTracer['current_activity'], string> = {
  KULIAH: 'Kuliah',
  BEKERJA: 'Bekerja',
  WIRAUSAHA: 'Wirausaha',
  PESANTREN: 'Pesantren',
  MENCARI_KERJA: 'Mencari Kerja',
  LAINNYA: 'Lainnya',
};

const PAGE_SIZE = 12;

export type SdmAlumniSection = 'lulusan' | 'tracer';

export function SdmAlumniWorkspace({ section }: { section: SdmAlumniSection }) {
  const { hasPermission } = usePortalSession();
  const canManageLulusan = hasPermission(PERMISSIONS.SDM_MANAGE);
  const canManageTracer = hasPermission(PERMISSIONS.SDM_ALUMNI_MANAGE);
  const tab = section;

  const [alumniStudents, setAlumniStudents] = useState<AlumniStudent[]>([]);
  const [tracers, setTracers] = useState<AlumniTracer[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTracerId, setDeletingTracerId] = useState<string | null>(null);
  const [confirmDeleteTracerId, setConfirmDeleteTracerId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<
    'ALL' | AlumniTracer['current_activity']
  >('ALL');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [tracerModalOpen, setTracerModalOpen] = useState(false);
  const [editingTracerId, setEditingTracerId] = useState<string | null>(null);
  const [tracerForm, setTracerForm] = useState(EMPTY_TRACER_FORM);

  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [graduateStudentId, setGraduateStudentId] = useState('');
  const [graduateYear, setGraduateYear] = useState(String(new Date().getFullYear()));

  const [linkModalStudent, setLinkModalStudent] = useState<AlumniStudent | null>(null);
  const [linkProfileId, setLinkProfileId] = useState('');

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadData = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    const reqId = ++requestIdRef.current;
    if (isManualRefresh || hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/sdm?scope=alumni', { cache: 'no-store', signal });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data alumni.');
      hasLoadedOnceRef.current = true;
      setAlumniStudents(data.alumniStudents || []);
      setTracers(data.tracers || []);
      setActiveStudents(data.activeStudents || []);
      setAccounts(data.activeAccounts || []);
    } catch (e) {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadData(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  const anyModalOpen = graduateModalOpen || Boolean(linkModalStudent) || tracerModalOpen;
  useEffect(() => {
    if (!anyModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        setGraduateModalOpen(false);
        setLinkModalStudent(null);
        setTracerModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyModalOpen, saving]);

  const filteredLulusan = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumniStudents;
    return alumniStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.nisn || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        String(s.graduation_year || '').includes(q)
    );
  }, [alumniStudents, search]);

  const filteredTracers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tracers.filter((t) => {
      if (activityFilter !== 'ALL' && t.current_activity !== activityFilter) return false;
      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        (t.institution_or_company || '').toLowerCase().includes(q) ||
        (t.major_or_position || '').toLowerCase().includes(q) ||
        (t.city || '').toLowerCase().includes(q) ||
        String(t.graduation_year).includes(q)
      );
    });
  }, [tracers, activityFilter, search]);

  const activeCount = tab === 'lulusan' ? filteredLulusan.length : filteredTracers.length;
  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedLulusan = useMemo(
    () => filteredLulusan.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredLulusan, pageStart]
  );
  const pagedTracers = useMemo(
    () => filteredTracers.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredTracers, pageStart]
  );

  function openCreateTracer() {
    setEditingTracerId(null);
    setModalError(null);
    setTracerForm(EMPTY_TRACER_FORM);
    setTracerModalOpen(true);
  }

  function openEditTracer(item: AlumniTracer) {
    setEditingTracerId(item.id);
    setModalError(null);
    setTracerForm({
      student_id: item.student_id || '',
      full_name: item.full_name,
      graduation_year: String(item.graduation_year),
      phone: item.phone || '',
      email: item.email || '',
      current_activity: item.current_activity,
      institution_or_company: item.institution_or_company || '',
      major_or_position: item.major_or_position || '',
      city: item.city || '',
      testimonial: item.testimonial || '',
    });
    setTracerModalOpen(true);
  }

  async function handleSubmitTracer(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = tracerForm.full_name.trim();
    const gradYearNum = Number(tracerForm.graduation_year);
    if (trimmedName.length < 2) {
      setModalError('Nama lengkap alumni minimal 2 karakter.');
      return;
    }
    if (!Number.isInteger(gradYearNum) || gradYearNum < 1980 || gradYearNum > 2100) {
      setModalError('Tahun lulus harus antara 1980 dan 2100.');
      return;
    }

    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: editingTracerId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'alumni-tracer',
          ...(editingTracerId ? { id: editingTracerId } : {}),
          ...tracerForm,
          full_name: trimmedName,
          phone: tracerForm.phone.trim(),
          email: tracerForm.email.trim(),
          institution_or_company: tracerForm.institution_or_company.trim(),
          major_or_position: tracerForm.major_or_position.trim(),
          city: tracerForm.city.trim(),
          testimonial: tracerForm.testimonial.trim(),
          graduation_year: gradYearNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tracer alumni.');
      setTracerModalOpen(false);
      setMessage({
        type: 'ok',
        text: editingTracerId
          ? 'Data tracer alumni berhasil diperbarui.'
          : 'Data tracer alumni baru berhasil ditambahkan.',
      });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGraduate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const gradYearNum = Number(graduateYear);
    if (!graduateStudentId) {
      setModalError('Pilih siswa aktif terlebih dahulu.');
      return;
    }
    if (!Number.isInteger(gradYearNum) || gradYearNum < 1980 || gradYearNum > 2100) {
      setModalError('Tahun lulus harus antara 1980 dan 2100.');
      return;
    }

    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'alumni-graduate',
          student_id: graduateStudentId,
          graduation_year: gradYearNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal meluluskan siswa.');
      setGraduateModalOpen(false);
      setGraduateStudentId('');
      setMessage({ type: 'ok', text: 'Siswa berhasil ditetapkan sebagai Alumni (LULUS).' });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkModalStudent || saving) return;
    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'siswa',
          id: linkModalStudent.id,
          profile_id: linkProfileId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menautkan akun alumni.');
      setLinkModalStudent(null);
      setMessage({ type: 'ok', text: 'Penautan akun alumni berhasil disimpan.' });
      await loadData(true);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTracer(item: AlumniTracer) {
    if (deletingTracerId) return;
    setDeletingTracerId(item.id);
    try {
      const res = await fetch(`/api/sdm?scope=alumni-tracer&id=${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data tracer.');
      setConfirmDeleteTracerId(null);
      setMessage({ type: 'ok', text: `Data tracer ${item.full_name} berhasil dihapus.` });
      await loadData(true);
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setDeletingTracerId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {tab === 'lulusan' ? 'Manajemen Alumni & Lulusan' : 'Tracer Study Alumni'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            {tab === 'lulusan'
              ? 'Kelola data lulusan madrasah, penetapan kelulusan siswa, dan penautan akun alumni.'
              : 'Pantau dan kelola perkembangan studi, pekerjaan, serta testimoni alumni.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          {tab === 'lulusan' && canManageLulusan && (
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setGraduateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Luluskan Siswa
            </button>
          )}
          {tab === 'tracer' && canManageTracer && (
            <button
              type="button"
              onClick={openCreateTracer}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah Tracer Alumni
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          className={`p-3.5 rounded-2xl text-xs sm:text-sm border flex items-start sm:items-center justify-between gap-3 ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="break-words leading-relaxed">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Tutup pesan"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Alumni (Siswa Lulus)</span>
            <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {alumniStudents.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Data Tracer Study</span>
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {tracers.length}
          </p>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Akun Alumni Tertaut</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {alumniStudents.filter((a) => !!a.profile_id).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">
            {tab === 'lulusan'
              ? `Daftar Lulusan (${filteredLulusan.length})`
              : `Tracer Study (${filteredTracers.length})`}
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {tab === 'tracer' && (
              <select
                aria-label="Filter aktivitas alumni"
                value={activityFilter}
                onChange={(e) => {
                  setActivityFilter(
                    e.target.value as 'ALL' | AlumniTracer['current_activity']
                  );
                  setPage(1);
                }}
                className="w-full sm:w-44 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="ALL">Semua Aktivitas</option>
                <option value="KULIAH">Kuliah</option>
                <option value="BEKERJA">Bekerja</option>
                <option value="WIRAUSAHA">Wirausaha</option>
                <option value="PESANTREN">Pesantren</option>
                <option value="MENCARI_KERJA">Mencari Kerja</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            )}

            <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={
                tab === 'lulusan'
                  ? 'Cari nama, NIS, NISN, tahun lulus...'
                  : 'Cari nama, instansi, kota, angkatan...'
              }
              aria-label="Cari data alumni"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            {tab === 'lulusan' ? 'Memuat data alumni...' : 'Memuat tracer study...'}
          </div>
        ) : tab === 'lulusan' ? (
          pagedLulusan.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {alumniStudents.length === 0
                ? 'Belum ada siswa berstatus LULUS.'
                : 'Tidak ada data lulusan yang cocok dengan pencarian.'}
            </div>
          ) : (
            <>
              {/* Mobile Cards for Lulusan */}
              <div className="md:hidden space-y-3">
                {pagedLulusan.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 break-words">
                          {item.full_name}
                        </p>
                        <p className="text-slate-500 break-all mt-0.5">
                          {item.phone || '-'} · {item.email || '-'}
                        </p>
                      </div>
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold tabular-nums">
                        Lulus {item.graduation_year || '-'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white rounded-xl p-2 border border-slate-100 tabular-nums">
                      <div className="truncate">NIS: {item.nis || '-'}</div>
                      <div className="truncate">NISN: {item.nisn || '-'}</div>
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
                        href={`/portal/sdm/alumni/${item.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                      >
                        Detail
                      </Link>
                      {canManageLulusan && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            setLinkModalStudent(item);
                            setLinkProfileId(item.profile_id || '');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Tautkan Akun
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table for Lulusan */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                      <th className="py-3 px-3">Nama Alumni</th>
                      <th className="py-3 px-3">NIS / NISN</th>
                      <th className="py-3 px-3">Tahun Lulus</th>
                      <th className="py-3 px-3">Akun Portal</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedLulusan.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.phone || '-'} · {item.email || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                          <div>NIS: {item.nis || '-'}</div>
                          <div>NISN: {item.nisn || '-'}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700 tabular-nums">
                          {item.graduation_year || '-'}
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
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/portal/sdm/alumni/${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                            >
                              Detail
                            </Link>
                            {canManageLulusan && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalError(null);
                                  setLinkModalStudent(item);
                                  setLinkProfileId(item.profile_id || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                Tautkan Akun
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : pagedTracers.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {tracers.length === 0
              ? 'Belum ada data tracer study alumni.'
              : 'Tidak ada data tracer study yang cocok dengan pencarian.'}
          </div>
        ) : (
          <>
            {/* Mobile Cards for Tracer */}
            <div className="md:hidden space-y-3">
              {pagedTracers.map((item) => {
                const isConfirming = confirmDeleteTracerId === item.id;
                const isDeleting = deletingTracerId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 break-words">
                          {item.full_name}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          Angkatan {item.graduation_year} · {item.city || '-'}
                        </p>
                      </div>
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                        {ACTIVITY_LABELS[item.current_activity]}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-2 border border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                      <p className="font-medium text-slate-800 break-words">
                        {item.institution_or_company || '-'}
                      </p>
                      <p className="text-slate-400 break-words">{item.major_or_position || '-'}</p>
                    </div>

                    {canManageTracer && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteTracer(item)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                              Hapus
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteTracerId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditTracer(item)}
                              className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                              aria-label={`Edit ${item.full_name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTracerId(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 bg-white border border-rose-200 hover:bg-rose-50"
                              aria-label={`Hapus ${item.full_name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table for Tracer */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Alumni</th>
                    <th className="py-3 px-3">Angkatan</th>
                    <th className="py-3 px-3">Aktivitas Saat Ini</th>
                    <th className="py-3 px-3">Instansi / Kampus</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedTracers.map((item) => {
                    const isConfirming = confirmDeleteTracerId === item.id;
                    const isDeleting = deletingTracerId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-xs text-slate-500">{item.city || '-'}</p>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700 tabular-nums">
                          {item.graduation_year}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                            {ACTIVITY_LABELS[item.current_activity]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700">
                          <p className="font-medium">{item.institution_or_company || '-'}</p>
                          <p className="text-slate-400">{item.major_or_position || '-'}</p>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {canManageTracer && (
                            <div className="inline-flex items-center gap-1">
                              {isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => void handleDeleteTracer(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition"
                                  >
                                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteTracerId(null)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditTracer(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                                    title="Edit"
                                    aria-label={`Edit ${item.full_name}`}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteTracerId(item.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                    title="Hapus"
                                    aria-label={`Hapus ${item.full_name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && activeCount > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, activeCount)} dari{' '}
              {activeCount} data
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Halaman berikutnya"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {graduateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="graduate-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setGraduateModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="graduate-modal-title" className="text-lg font-bold text-slate-900">
                Tetapkan Siswa sebagai Alumni
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setGraduateModalOpen(false)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleGraduate} className="space-y-4 text-sm">
              <div>
                <label
                  htmlFor="grad-student"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Pilih Siswa Aktif *
                </label>
                <select
                  id="grad-student"
                  required
                  value={graduateStudentId}
                  onChange={(e) => setGraduateStudentId(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="grad-year"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tahun Lulus *
                </label>
                <input
                  id="grad-year"
                  required
                  min={1980}
                  max={2100}
                  type="number"
                  value={graduateYear}
                  onChange={(e) => setGraduateYear(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setGraduateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Memproses...' : 'Luluskan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkModalStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setLinkModalStudent(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="link-modal-title" className="text-lg font-bold text-slate-900">
                Tautkan Akun Alumni
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setLinkModalStudent(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLink} className="space-y-4 text-sm">
              <p className="text-xs text-slate-600">
                Alumni:{' '}
                <span className="font-semibold text-slate-900">{linkModalStudent.full_name}</span>
              </p>
              <div>
                <label
                  htmlFor="link-profile"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Akun Portal Aktif
                </label>
                <select
                  id="link-profile"
                  value={linkProfileId}
                  onChange={(e) => setLinkProfileId(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Lepas Tautan --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setLinkModalStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tracerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tracer-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setTracerModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="tracer-modal-title" className="text-lg font-bold text-slate-900">
                {editingTracerId ? 'Edit Tracer Alumni' : 'Tambah Tracer Alumni'}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setTracerModalOpen(false)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmitTracer}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm"
            >
              <div>
                <label
                  htmlFor="tracer-name"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nama Lengkap *
                </label>
                <input
                  id="tracer-name"
                  required
                  minLength={2}
                  type="text"
                  value={tracerForm.full_name}
                  onChange={(e) => setTracerForm({ ...tracerForm, full_name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-year"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tahun Lulus *
                </label>
                <input
                  id="tracer-year"
                  required
                  min={1980}
                  max={2100}
                  type="number"
                  value={tracerForm.graduation_year}
                  onChange={(e) =>
                    setTracerForm({ ...tracerForm, graduation_year: e.target.value })
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-phone"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  No. HP / WA
                </label>
                <input
                  id="tracer-phone"
                  type="text"
                  value={tracerForm.phone}
                  onChange={(e) => setTracerForm({ ...tracerForm, phone: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-email"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Email
                </label>
                <input
                  id="tracer-email"
                  type="email"
                  value={tracerForm.email}
                  onChange={(e) => setTracerForm({ ...tracerForm, email: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-activity"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Aktivitas Saat Ini
                </label>
                <select
                  id="tracer-activity"
                  value={tracerForm.current_activity}
                  onChange={(e) =>
                    setTracerForm({
                      ...tracerForm,
                      current_activity: e.target.value as AlumniTracer['current_activity'],
                    })
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="KULIAH">Kuliah</option>
                  <option value="BEKERJA">Bekerja</option>
                  <option value="WIRAUSAHA">Wirausaha</option>
                  <option value="PESANTREN">Pesantren</option>
                  <option value="MENCARI_KERJA">Mencari Kerja</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="tracer-inst"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Instansi / Kampus / Usaha
                </label>
                <input
                  id="tracer-inst"
                  type="text"
                  value={tracerForm.institution_or_company}
                  onChange={(e) =>
                    setTracerForm({ ...tracerForm, institution_or_company: e.target.value })
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-major"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Jurusan / Jabatan
                </label>
                <input
                  id="tracer-major"
                  type="text"
                  value={tracerForm.major_or_position}
                  onChange={(e) =>
                    setTracerForm({ ...tracerForm, major_or_position: e.target.value })
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="tracer-city"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Kota
                </label>
                <input
                  id="tracer-city"
                  type="text"
                  value={tracerForm.city}
                  onChange={(e) => setTracerForm({ ...tracerForm, city: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="tracer-student"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tautkan Data Siswa Lulus (Opsional)
                </label>
                <select
                  id="tracer-student"
                  value={tracerForm.student_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selected = alumniStudents.find((s) => s.id === selectedId);
                    setTracerForm((prev) => ({
                      ...prev,
                      student_id: selectedId,
                      full_name:
                        !editingTracerId && selected && !prev.full_name.trim()
                          ? selected.full_name
                          : prev.full_name,
                      graduation_year:
                        !editingTracerId && selected?.graduation_year
                          ? String(selected.graduation_year)
                          : prev.graduation_year,
                      phone:
                        !editingTracerId && selected?.phone && !prev.phone.trim()
                          ? selected.phone
                          : prev.phone,
                      email:
                        !editingTracerId && selected?.email && !prev.email.trim()
                          ? selected.email
                          : prev.email,
                    }));
                  }}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Tidak Ditautkan --</option>
                  {alumniStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} (Lulus {s.graduation_year || '-'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="tracer-testimonial"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Testimoni / Pesan
                </label>
                <textarea
                  id="tracer-testimonial"
                  rows={2}
                  value={tracerForm.testimonial}
                  onChange={(e) => setTracerForm({ ...tracerForm, testimonial: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTracerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
