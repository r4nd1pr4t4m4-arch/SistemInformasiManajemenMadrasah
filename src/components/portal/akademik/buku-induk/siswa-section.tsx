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
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  downloadStudentTemplateXlsx,
  exportStudentsEmisDapodikXlsx,
  parseStudentImportXlsx,
} from '@/lib/domain/emis-dapodik-excel';
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import {
  STUDENT_PAGE_SIZE,
  type ShowToastFn,
  type StudentRow,
  type SubmitEntityFn,
} from './types';

interface SiswaSectionProps {
  canManage: boolean;
  students: StudentRow[];
  refreshing: boolean;
  submitting: boolean;
  onRefresh: () => void;
  submitEntity: SubmitEntityFn;
  showToast: ShowToastFn;
}

export function SiswaSection({
  canManage,
  students,
  refreshing,
  submitting,
  onRefresh,
  submitEntity,
  showToast,
}: SiswaSectionProps) {
  const [importingExcel, setImportingExcel] = useState(false);
  const studentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [studentPage, setStudentPage] = useState(1);
  const [showStudentForm, setShowStudentForm] = useState(true);
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null);

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

  async function handleStudentExcelImport(e: ChangeEvent<HTMLInputElement>) {
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

  const hasActiveStudentFilter = Boolean(
    searchQuery.trim() || genderFilter !== 'ALL' || statusFilter !== 'ALL'
  );

  return (
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
              onClick={onRefresh}
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
  );
}
