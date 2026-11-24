'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  downloadTeacherTemplateXlsx,
  exportTeachersEmisDapodikXlsx,
  parseTeacherImportXlsx,
} from '@/lib/domain/emis-dapodik-excel';
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import {
  STUDENT_PAGE_SIZE,
  type ShowToastFn,
  type SubmitEntityFn,
  type TeacherRow,
} from './types';

interface GtkSectionProps {
  canManage: boolean;
  teachers: TeacherRow[];
  refreshing: boolean;
  submitting: boolean;
  onRefresh: () => void;
  submitEntity: SubmitEntityFn;
  showToast: ShowToastFn;
}

export function GtkSection({
  canManage,
  teachers,
  refreshing,
  submitting,
  onRefresh,
  submitEntity,
  showToast,
}: GtkSectionProps) {
  const [importingExcel, setImportingExcel] = useState(false);
  const teacherFileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<string>('ALL');
  const [teacherPage, setTeacherPage] = useState(1);
  const [showTeacherForm, setShowTeacherForm] = useState(true);
  const [detailTeacher, setDetailTeacher] = useState<TeacherRow | null>(null);

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

  async function handleTeacherExcelImport(e: ChangeEvent<HTMLInputElement>) {
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

  const hasActiveTeacherFilter = Boolean(
    searchQuery.trim() || staffTypeFilter !== 'ALL' || employmentFilter !== 'ALL'
  );

  return (
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
              onClick={onRefresh}
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
  );
}
