'use client';

import {
  BookOpen,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import {
  formatChapterLabel,
  type AssessmentMenuType,
  type ColumnNamingMode,
  type TaughtClassroomSummary,
} from '@/lib/domain/penilaian';
import type {
  AcademicYearInfo,
  ChapterRow,
  ClassroomInfo,
  KkmInfo,
  SubjectInfo,
} from './types';

interface AssessmentHeaderProps {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  isExam: boolean;
  subjectInfo: SubjectInfo | null;
  academicYear: AcademicYearInfo | null;
  kkm: KkmInfo;
  canEdit: boolean;
  hasUnsavedChanges: boolean;
  effectiveClassroomId: string;
  sortedClassrooms: TaughtClassroomSummary[];
  loading: boolean;
  saving: boolean;
  studentsCount: number;
  columnsCount: number;
  validationErrorCount: number;
  onSelectClassroom: (classroomId: string) => void;
  onExportPdf: () => void;
  onExportXlsx: () => void;
  onSaveScores: () => void;
}

export function AssessmentHeader({
  type,
  isExam,
  subjectInfo,
  academicYear,
  kkm,
  canEdit,
  hasUnsavedChanges,
  effectiveClassroomId,
  sortedClassrooms,
  loading,
  saving,
  studentsCount,
  columnsCount,
  validationErrorCount,
  onSelectClassroom,
  onExportPdf,
  onExportXlsx,
  onSaveScores,
}: AssessmentHeaderProps) {
  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-none">
              {subjectInfo?.name || 'Mata Pelajaran'}
            </span>
          </span>
          {academicYear && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
              TA {academicYear.name} ({academicYear.semester})
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            KKM: {kkm.minScore} ({kkm.mode === 'PER_SUBJECT_GRADE' ? 'Per Mapel & Tingkat' : 'Per Tingkat'})
          </span>
          {!canEdit && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
              Mode Lihat (Read-Only)
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
              Nilai belum disimpan
            </span>
          )}
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          {type === 'FORMATIF' && 'Formatif (Lingkup BAB)'}
          {type === 'SUMATIF' && 'Sumatif (Lingkup Materi)'}
          {type === 'STS' && 'STS (Sumatif Tengah Semester)'}
          {type === 'SAS' && 'SAS (Sumatif Akhir Semester)'}
          {type === 'PRAKTIK' && 'Penilaian Praktik'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {(type === 'FORMATIF' || type === 'SUMATIF') &&
            `Aturan KKM: Nilai yang diinput tidak boleh kurang dari ${kkm.minScore}.`}
          {isExam &&
            `Aturan KKM: Jika nilai di bawah ${kkm.minScore}, kolom Remedial wajib diisi.`}
          {type === 'PRAKTIK' &&
            'Skala nilai 0–100. Guru dapat menambah kolom praktik sesuai kebutuhan.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
        <select
          value={effectiveClassroomId}
          aria-label="Pilih kelas"
          onChange={(e) => onSelectClassroom(e.target.value)}
          className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {sortedClassrooms.map((c) => (
            <option key={c.id} value={c.id}>
              Kelas {c.name} (Tingkat {c.gradeLevel})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={loading || studentsCount === 0 || (!isExam && columnsCount === 0)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={onExportXlsx}
            disabled={loading || studentsCount === 0 || (!isExam && columnsCount === 0)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>XLSX</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onSaveScores}
              disabled={
                saving ||
                loading ||
                studentsCount === 0 ||
                validationErrorCount > 0 ||
                (!isExam && columnsCount === 0)
              }
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChapterManagementCardProps {
  classroomInfo: ClassroomInfo | null;
  chapters: ChapterRow[];
  selectedChapterId: string | null;
  canEdit: boolean;
  mutatingMeta: boolean;
  showChapterForm: boolean;
  newChapterTitle: string;
  editingChapterId: string | null;
  editingChapterTitle: string;
  onSelectChapter: (chapterId: string) => void;
  onToggleChapterForm: () => void;
  onCloseChapterForm: () => void;
  onNewChapterTitleChange: (value: string) => void;
  onAddChapter: () => void;
  onStartEditChapter: (ch: ChapterRow) => void;
  onCancelEditChapter: () => void;
  onEditingChapterTitleChange: (value: string) => void;
  onUpdateChapter: (id: string) => void;
  onDeleteChapter: (ch: ChapterRow) => void;
}

export function ChapterManagementCard({
  classroomInfo,
  chapters,
  selectedChapterId,
  canEdit,
  mutatingMeta,
  showChapterForm,
  newChapterTitle,
  editingChapterId,
  editingChapterTitle,
  onSelectChapter,
  onToggleChapterForm,
  onCloseChapterForm,
  onNewChapterTitleChange,
  onAddChapter,
  onStartEditChapter,
  onCancelEditChapter,
  onEditingChapterTitleChange,
  onUpdateChapter,
  onDeleteChapter,
}: ChapterManagementCardProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700">
            Lingkup BAB (Tingkat {classroomInfo?.grade_level || '-'}):
          </span>
          {chapters.map((ch) => {
            const isSelected = ch.id === selectedChapterId;
            return (
              <div key={ch.id} className="inline-flex items-center gap-1 max-w-full">
                <button
                  type="button"
                  onClick={() => onSelectChapter(ch.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition text-left break-words ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                  }`}
                >
                  {formatChapterLabel(ch.chapter_number, ch.title)}
                </button>
                {canEdit && isSelected && (
                  <>
                    <button
                      type="button"
                      disabled={mutatingMeta}
                      onClick={() => onStartEditChapter(ch)}
                      title="Edit judul BAB"
                      aria-label="Edit judul BAB"
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={mutatingMeta}
                      onClick={() => onDeleteChapter(ch)}
                      title="Hapus BAB"
                      aria-label="Hapus BAB"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {chapters.length === 0 && (
            <span className="text-xs text-slate-500 italic">Belum ada BAB.</span>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={mutatingMeta}
            onClick={onToggleChapterForm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah BAB</span>
          </button>
        )}
      </div>

      {showChapterForm && canEdit && (
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={newChapterTitle}
            onChange={(e) => onNewChapterTitleChange(e.target.value)}
            placeholder="Judul tambahan BAB (opsional, misal: Interaksi Sosial)"
            className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-busy={mutatingMeta || undefined}
              disabled={mutatingMeta}
              onClick={onAddChapter}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {mutatingMeta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan BAB</span>
            </button>
            <button
              type="button"
              onClick={onCloseChapterForm}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {editingChapterId && canEdit && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={editingChapterTitle}
            onChange={(e) => onEditingChapterTitleChange(e.target.value)}
            placeholder="Judul tambahan BAB (kosongkan jika hanya BAB X)"
            className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-busy={mutatingMeta || undefined}
              disabled={mutatingMeta}
              onClick={() => onUpdateChapter(editingChapterId)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {mutatingMeta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Perbarui Judul</span>
            </button>
            <button
              type="button"
              onClick={onCancelEditChapter}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ColumnManagementCardProps {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  columnsCount: number;
  mutatingMeta: boolean;
  showAddColumn: boolean;
  newColNamingMode: ColumnNamingMode;
  newColLabel: string;
  editingColId: string | null;
  editingColMode: ColumnNamingMode;
  editingColLabel: string;
  onToggleAddColumn: () => void;
  onCloseAddColumn: () => void;
  onNewColNamingModeChange: (mode: ColumnNamingMode) => void;
  onNewColLabelChange: (value: string) => void;
  onAddColumn: () => void;
  onEditingColModeChange: (mode: ColumnNamingMode) => void;
  onEditingColLabelChange: (value: string) => void;
  onUpdateColumn: (id: string) => void;
  onCancelEditColumn: () => void;
}

export function ColumnManagementCard({
  type,
  columnsCount,
  mutatingMeta,
  showAddColumn,
  newColNamingMode,
  newColLabel,
  editingColId,
  editingColMode,
  editingColLabel,
  onToggleAddColumn,
  onCloseAddColumn,
  onNewColNamingModeChange,
  onNewColLabelChange,
  onAddColumn,
  onEditingColModeChange,
  onEditingColLabelChange,
  onUpdateColumn,
  onCancelEditColumn,
}: ColumnManagementCardProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Settings2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Kolom Penilaian ({columnsCount} kolom aktif)</span>
        </div>
        <button
          type="button"
          disabled={mutatingMeta}
          onClick={onToggleAddColumn}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Kolom Penilaian</span>
        </button>
      </div>

      {showAddColumn && (
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={newColNamingMode}
            onChange={(e) => onNewColNamingModeChange(e.target.value as ColumnNamingMode)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
          >
            <option value="AUTO">Otomatis bernomor urut</option>
            <option value="CUSTOM">Buat nama custom</option>
          </select>
          {newColNamingMode === 'CUSTOM' && (
            <input
              type="text"
              value={newColLabel}
              onChange={(e) => onNewColLabelChange(e.target.value)}
              placeholder={
                type === 'PRAKTIK'
                  ? 'Misal: Praktik - Membaca'
                  : type === 'SUMATIF'
                    ? 'Misal: LM - Ekonomi'
                    : 'Misal: TP - Diskusi'
              }
              className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
            />
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-busy={mutatingMeta || undefined}
              disabled={mutatingMeta}
              onClick={onAddColumn}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {mutatingMeta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Tambahkan</span>
            </button>
            <button
              type="button"
              onClick={onCloseAddColumn}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {editingColId && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={editingColMode}
            onChange={(e) => onEditingColModeChange(e.target.value as ColumnNamingMode)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold"
          >
            <option value="AUTO">Otomatis bernomor urut</option>
            <option value="CUSTOM">Nama custom</option>
          </select>
          {editingColMode === 'CUSTOM' && (
            <input
              type="text"
              value={editingColLabel}
              onChange={(e) => onEditingColLabelChange(e.target.value)}
              className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs"
            />
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-busy={mutatingMeta || undefined}
              disabled={mutatingMeta}
              onClick={() => onUpdateColumn(editingColId)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              {mutatingMeta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Nama</span>
            </button>
            <button
              type="button"
              onClick={onCancelEditColumn}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StudentSearchBarProps {
  studentSearch: string;
  filteredCount: number;
  totalCount: number;
  onChange: (value: string) => void;
}

export function StudentSearchBar({
  studentSearch,
  filteredCount,
  totalCount,
  onChange,
}: StudentSearchBarProps) {
  return (
    <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={studentSearch}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cari nama atau NIS siswa..."
          aria-label="Cari siswa"
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {studentSearch && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-500 shrink-0">
        Menampilkan {filteredCount} dari {totalCount} siswa
      </span>
    </div>
  );
}
