'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from '@/components/portal/akademik/akademik-ui';
import { PenilaianConfirmModal } from '@/components/portal/penilaian/confirm-modal';
import {
  computeAverageScore,
  computeExamEffectiveScore,
  formatChapterLabel,
  sortClassroomsAsc,
  type AssessmentCategory,
  type AssessmentExamType,
  type AssessmentMenuType,
  type ColumnNamingMode,
  type TaughtClassroomSummary,
} from '@/lib/domain/penilaian';
import {
  exportAssessmentToPdf,
  exportAssessmentToXlsx,
} from '@/lib/domain/penilaian-export';

interface StudentRow {
  id: string;
  nis: string | null;
  nisn: string | null;
  full_name: string;
  gender: string | null;
}

interface ChapterRow {
  id: string;
  chapter_number: number;
  title: string | null;
  sort_order: number;
}

interface ColumnRow {
  id: string;
  category: AssessmentCategory;
  chapter_id: string | null;
  naming_mode: ColumnNamingMode;
  label: string;
  sort_order: number;
}

interface ExamScoreState {
  score: string;
  remedial_score: string;
  enrichment_score: string;
  notes: string;
}

interface AssessmentWorkspaceProps {
  subjectId: string;
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  initialChapterId?: string | null;
  initialClassroomId?: string | null;
  classrooms: TaughtClassroomSummary[];
  onChaptersChanged?: () => void;
}

function parseNumericInput(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

export function AssessmentWorkspace({
  subjectId,
  type,
  initialChapterId = null,
  initialClassroomId = null,
  classrooms,
  onChaptersChanged,
}: AssessmentWorkspaceProps) {
  const { toast, showToast, dismissToast } = useAkademikToast();

  const sortedClassrooms = useMemo(() => sortClassroomsAsc(classrooms), [classrooms]);

  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(
    initialClassroomId || sortedClassrooms[0]?.id || ''
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    initialChapterId
  );

  const effectiveClassroomId = sortedClassrooms.some((c) => c.id === selectedClassroomId)
    ? selectedClassroomId
    : sortedClassrooms[0]?.id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingMeta, setMutatingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [academicYear, setAcademicYear] = useState<{ name: string; semester: string } | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<{ code: string; name: string } | null>(null);
  const [classroomInfo, setClassroomInfo] = useState<{ id: string; name: string; grade_level: string } | null>(null);
  const [kkm, setKkm] = useState<{ mode: string; minScore: number }>({
    mode: 'PER_GRADE',
    minScore: 75,
  });
  const [canEdit, setCanEdit] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  // key: `${columnId}::${studentId}` -> string
  const [columnScoresMap, setColumnScoresMap] = useState<Record<string, string>>({});
  const [initialColumnScoresMap, setInitialColumnScoresMap] = useState<Record<string, string>>({});

  // STS / SAS states
  const [examConfig, setExamConfig] = useState({
    enable_remedial: false,
    enable_enrichment: false,
    enable_notes: false,
  });
  const [initialExamConfig, setInitialExamConfig] = useState({
    enable_remedial: false,
    enable_enrichment: false,
    enable_notes: false,
  });
  // key: studentId -> ExamScoreState
  const [examScoresMap, setExamScoresMap] = useState<Record<string, ExamScoreState>>({});
  const [initialExamScoresMap, setInitialExamScoresMap] = useState<Record<string, ExamScoreState>>({});

  // Chapter management form
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');

  // Column management form
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColNamingMode, setNewColNamingMode] = useState<ColumnNamingMode>('AUTO');
  const [newColLabel, setNewColLabel] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColMode, setEditingColMode] = useState<ColumnNamingMode>('AUTO');
  const [editingColLabel, setEditingColLabel] = useState('');

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    details?: string[];
    variant: 'danger' | 'warning';
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const isExam = type === 'STS' || type === 'SAS';

  const applyWorkspaceData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as { name: string; semester: string } | null);
    setSubjectInfo(data.subject as { code: string; name: string } | null);
    setClassroomInfo(
      data.classroom as { id: string; name: string; grade_level: string } | null
    );
    setKkm(data.kkm as { mode: string; minScore: number });
    setCanEdit(Boolean(data.canEdit));
    const studentList = (data.students as StudentRow[]) || [];
    setStudents(studentList);

    if (data.type === 'STS' || data.type === 'SAS') {
      const cfg = (data.examConfig as {
        enable_remedial: boolean;
        enable_enrichment: boolean;
        enable_notes: boolean;
      }) || {
        enable_remedial: false,
        enable_enrichment: false,
        enable_notes: false,
      };
      setExamConfig(cfg);
      setInitialExamConfig(cfg);
      const examRows =
        (data.examScores as Array<{
          student_id: string;
          score: number | null;
          remedial_score: number | null;
          enrichment_score: number | null;
          notes: string | null;
        }>) || [];
      const map: Record<string, ExamScoreState> = {};
      for (const st of studentList) {
        const found = examRows.find((e) => e.student_id === st.id);
        map[st.id] = {
          score: found?.score !== null && found?.score !== undefined ? String(found.score) : '',
          remedial_score:
            found?.remedial_score !== null && found?.remedial_score !== undefined
              ? String(found.remedial_score)
              : '',
          enrichment_score:
            found?.enrichment_score !== null && found?.enrichment_score !== undefined
              ? String(found.enrichment_score)
              : '',
          notes: found?.notes || '',
        };
      }
      setExamScoresMap(map);
      setInitialExamScoresMap(map);
    } else {
      setChapters((data.chapters as ChapterRow[]) || []);
      const resolvedChapterId = (data.activeChapterId as string | null) ?? null;
      setSelectedChapterId((prev) => (prev === resolvedChapterId ? prev : resolvedChapterId));
      setColumns((data.columns as ColumnRow[]) || []);
      const map: Record<string, string> = {};
      for (const sc of (data.columnScores as Array<{
        column_id: string;
        student_id: string;
        score: number | null;
      }>) || []) {
        map[`${sc.column_id}::${sc.student_id}`] =
          sc.score !== null && sc.score !== undefined ? String(sc.score) : '';
      }
      setColumnScoresMap(map);
      setInitialColumnScoresMap(map);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!effectiveClassroomId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        subjectId,
        classroomId: effectiveClassroomId,
        type,
      });
      if (type === 'FORMATIF' && selectedChapterId) {
        params.set('chapterId', selectedChapterId);
      }
      const res = await fetch(`/api/penilaian/scores?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data penilaian.');
      }
      applyWorkspaceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, effectiveClassroomId, type, selectedChapterId, applyWorkspaceData]);

  useEffect(() => {
    if (!effectiveClassroomId) return;
    let active = true;
    const params = new URLSearchParams({
      subjectId,
      classroomId: effectiveClassroomId,
      type,
    });
    if (type === 'FORMATIF' && selectedChapterId) {
      params.set('chapterId', selectedChapterId);
    }
    fetch(`/api/penilaian/scores?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data penilaian.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError(null);
        applyWorkspaceData(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [subjectId, effectiveClassroomId, type, selectedChapterId, applyWorkspaceData]);

  const hasUnsavedChanges = useMemo(() => {
    if (!canEdit) return false;
    if (!isExam) {
      for (const st of students) {
        for (const col of columns) {
          const key = `${col.id}::${st.id}`;
          if ((columnScoresMap[key] ?? '') !== (initialColumnScoresMap[key] ?? '')) {
            return true;
          }
        }
      }
      return false;
    }
    if (
      examConfig.enable_remedial !== initialExamConfig.enable_remedial ||
      examConfig.enable_enrichment !== initialExamConfig.enable_enrichment ||
      examConfig.enable_notes !== initialExamConfig.enable_notes
    ) {
      return true;
    }
    for (const st of students) {
      const cur = examScoresMap[st.id];
      const init = initialExamScoresMap[st.id];
      if (!cur && !init) continue;
      if (
        (cur?.score ?? '') !== (init?.score ?? '') ||
        (cur?.remedial_score ?? '') !== (init?.remedial_score ?? '') ||
        (cur?.enrichment_score ?? '') !== (init?.enrichment_score ?? '') ||
        (cur?.notes ?? '') !== (init?.notes ?? '')
      ) {
        return true;
      }
    }
    return false;
  }, [
    canEdit,
    isExam,
    students,
    columns,
    columnScoresMap,
    initialColumnScoresMap,
    examScoresMap,
    initialExamScoresMap,
    examConfig,
    initialExamConfig,
  ]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // Validation checks
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isExam) {
      for (const st of students) {
        for (const col of columns) {
          const raw = columnScoresMap[`${col.id}::${st.id}`] ?? '';
          const num = parseNumericInput(raw);
          if (raw.trim() !== '' && num === null) {
            errors.push(`${st.full_name} (${col.label}): nilai harus berupa angka.`);
          } else if (num !== null && (num < 0 || num > 100)) {
            errors.push(`${st.full_name} (${col.label}): nilai harus 0–100.`);
          } else if (
            num !== null &&
            (type === 'FORMATIF' || type === 'SUMATIF') &&
            num < kkm.minScore
          ) {
            errors.push(
              `${st.full_name} (${col.label}): nilai ${num} tidak boleh di bawah KKM (${kkm.minScore}).`
            );
          }
        }
      }
    } else {
      for (const st of students) {
        const row = examScoresMap[st.id];
        if (!row) continue;
        const score = parseNumericInput(row.score);
        const rem = parseNumericInput(row.remedial_score);
        const enr = parseNumericInput(row.enrichment_score);

        if (row.score.trim() !== '' && (score === null || score < 0 || score > 100)) {
          errors.push(`${st.full_name}: nilai utama harus 0–100.`);
        }
        if (
          row.remedial_score.trim() !== '' &&
          (rem === null || rem < 0 || rem > 100)
        ) {
          errors.push(`${st.full_name}: nilai remedial harus 0–100.`);
        }
        if (
          row.enrichment_score.trim() !== '' &&
          (enr === null || enr < 0 || enr > 100)
        ) {
          errors.push(`${st.full_name}: nilai pengayaan harus 0–100.`);
        }
        if (score !== null && score < kkm.minScore && rem === null) {
          errors.push(
            `${st.full_name}: nilai (${score}) di bawah KKM (${kkm.minScore}), kolom Remedial wajib diisi.`
          );
        }
        if (((score !== null && score < kkm.minScore) || rem !== null) && enr !== null) {
          errors.push(
            `${st.full_name}: tidak dapat mengisi Pengayaan jika memiliki/wajib Remedial.`
          );
        }
        if (rem !== null) {
          const finalRem = score !== null ? Math.round(((score + rem) / 2) * 100) / 100 : rem;
          if (finalRem < kkm.minScore) {
            errors.push(
              `${st.full_name}: nilai akhir (${finalRem}) masih di bawah KKM (${kkm.minScore}). Naikkan nilai Remedial agar nilai akhir >= ${kkm.minScore}.`
            );
          }
        }
      }
    }
    return errors;
  }, [isExam, students, columns, columnScoresMap, examScoresMap, type, kkm.minScore]);

  function runWithDirtyCheck(
    actionLabel: string,
    proceed: () => void | Promise<void>
  ) {
    if (!hasUnsavedChanges) {
      void proceed();
      return;
    }
    setConfirmModal({
      open: true,
      title: 'Perubahan Nilai Belum Disimpan',
      description: `Anda memiliki perubahan nilai yang belum disimpan sebelum ${actionLabel}.`,
      details: [
        'Jika melanjutkan, perubahan nilai yang baru diketik di halaman ini akan dibatalkan.',
        'Pilih "Batal" jika Anda ingin menekan "Simpan Nilai" terlebih dahulu.',
      ],
      variant: 'warning',
      confirmLabel: 'Lanjutkan Tanpa Simpan',
      onConfirm: async () => {
        setConfirmModal(null);
        await proceed();
      },
    });
  }

  async function executeAddChapter() {
    if (!classroomInfo || mutatingMeta) return;
    setMutatingMeta(true);
    try {
      const res = await fetch('/api/penilaian/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: subjectId,
          grade_level: classroomInfo.grade_level,
          title: newChapterTitle.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah BAB.');
      setNewChapterTitle('');
      setShowChapterForm(false);
      setSelectedChapterId(data.chapter.id);
      showToast(
        'success',
        `${formatChapterLabel(data.chapter.chapter_number, data.chapter.title)} ditambahkan.`
      );
      onChaptersChanged?.();
      await loadWorkspace();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah BAB.');
    } finally {
      setMutatingMeta(false);
    }
  }

  function handleAddChapter() {
    if (!classroomInfo || mutatingMeta) return;
    runWithDirtyCheck('menambah BAB baru', executeAddChapter);
  }

  async function handleUpdateChapter(id: string) {
    if (mutatingMeta) return;
    setMutatingMeta(true);
    try {
      const res = await fetch('/api/penilaian/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editingChapterTitle.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui BAB.');
      setEditingChapterId(null);
      showToast('success', 'Judul BAB berhasil diperbarui.');
      onChaptersChanged?.();
      await loadWorkspace();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui BAB.');
    } finally {
      setMutatingMeta(false);
    }
  }

  function handleDeleteChapter(ch: ChapterRow) {
    if (mutatingMeta) return;
    const label = formatChapterLabel(ch.chapter_number, ch.title);
    setConfirmModal({
      open: true,
      title: `Hapus ${label}?`,
      description:
        'Tindakan ini akan menghapus BAB beserta seluruh kolom TP dan nilai siswa di dalamnya secara permanen.',
      details: [
        `Berlaku untuk seluruh kelas pada Tingkat ${classroomInfo?.grade_level || '-'}.`,
        'Data yang sudah dihapus tidak dapat dikembalikan.',
      ],
      variant: 'danger',
      confirmLabel: 'Ya, Hapus BAB',
      onConfirm: async () => {
        setMutatingMeta(true);
        try {
          const res = await fetch(`/api/penilaian/chapters?id=${encodeURIComponent(ch.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus BAB.');
          setConfirmModal(null);
          if (selectedChapterId === ch.id) setSelectedChapterId(null);
          showToast('success', `${label} berhasil dihapus.`);
          onChaptersChanged?.();
          await loadWorkspace();
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Gagal menghapus BAB.');
        } finally {
          setMutatingMeta(false);
        }
      },
    });
  }

  async function executeAddColumn() {
    if (!classroomInfo || isExam || mutatingMeta) return;
    setMutatingMeta(true);
    try {
      const res = await fetch('/api/penilaian/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: subjectId,
          grade_level: classroomInfo.grade_level,
          category: type,
          chapter_id: type === 'FORMATIF' ? selectedChapterId : null,
          naming_mode: newColNamingMode,
          label: newColNamingMode === 'CUSTOM' ? newColLabel.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah kolom.');
      setNewColLabel('');
      setNewColNamingMode('AUTO');
      setShowAddColumn(false);
      showToast('success', `Kolom "${data.column.label}" berhasil ditambahkan.`);
      await loadWorkspace();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah kolom.');
    } finally {
      setMutatingMeta(false);
    }
  }

  function handleAddColumn() {
    if (!classroomInfo || isExam || mutatingMeta) return;
    if (type === 'FORMATIF' && !selectedChapterId) {
      showToast('error', 'Buat atau pilih BAB terlebih dahulu.');
      return;
    }
    if (newColNamingMode === 'CUSTOM' && !newColLabel.trim()) {
      showToast('error', 'Nama kolom custom wajib diisi.');
      return;
    }
    runWithDirtyCheck('menambah kolom penilaian', executeAddColumn);
  }

  async function executeUpdateColumn(id: string) {
    if (mutatingMeta) return;
    setMutatingMeta(true);
    try {
      const res = await fetch('/api/penilaian/columns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          naming_mode: editingColMode,
          label: editingColMode === 'CUSTOM' ? editingColLabel.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui kolom.');
      setEditingColId(null);
      showToast('success', 'Nama kolom diperbarui.');
      await loadWorkspace();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui kolom.');
    } finally {
      setMutatingMeta(false);
    }
  }

  function handleUpdateColumn(id: string) {
    if (mutatingMeta) return;
    if (editingColMode === 'CUSTOM' && !editingColLabel.trim()) {
      showToast('error', 'Nama kolom custom tidak boleh kosong.');
      return;
    }
    runWithDirtyCheck('memperbarui nama kolom', () => executeUpdateColumn(id));
  }

  function handleDeleteColumn(id: string, label: string) {
    if (mutatingMeta) return;
    setConfirmModal({
      open: true,
      title: `Hapus Kolom "${label}"?`,
      description:
        'Kolom penilaian beserta seluruh nilai siswa pada kolom ini akan dihapus permanen.',
      details: [
        `Berlaku untuk seluruh kelas pada Tingkat ${classroomInfo?.grade_level || '-'}.`,
        hasUnsavedChanges
          ? 'Perhatian: perubahan nilai lain yang belum disimpan akan ikut dibatalkan.'
          : 'Kolom bernomor otomatis yang tersisa akan diurutkan ulang.',
      ],
      variant: 'danger',
      confirmLabel: 'Ya, Hapus Kolom',
      onConfirm: async () => {
        setMutatingMeta(true);
        try {
          const res = await fetch(`/api/penilaian/columns?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus kolom.');
          setConfirmModal(null);
          if (editingColId === id) setEditingColId(null);
          showToast('success', `Kolom "${label}" dihapus.`);
          await loadWorkspace();
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Gagal menghapus kolom.');
        } finally {
          setMutatingMeta(false);
        }
      },
    });
  }

  async function handleSaveScores() {
    if (validationErrors.length > 0) {
      showToast('error', validationErrors[0]);
      return;
    }
    setSaving(true);
    try {
      if (!isExam) {
        const scoresPayload: Array<{ column_id: string; student_id: string; score: number | null }> = [];
        for (const st of students) {
          for (const col of columns) {
            const raw = columnScoresMap[`${col.id}::${st.id}`] ?? '';
            scoresPayload.push({
              column_id: col.id,
              student_id: st.id,
              score: parseNumericInput(raw),
            });
          }
        }
        const res = await fetch('/api/penilaian/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SAVE_COLUMN_SCORES',
            subject_id: subjectId,
            classroom_id: effectiveClassroomId,
            category: type as AssessmentCategory,
            scores: scoresPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai.');
      } else {
        const scoresPayload = students.map((st) => {
          const row = examScoresMap[st.id] || {
            score: '',
            remedial_score: '',
            enrichment_score: '',
            notes: '',
          };
          return {
            student_id: st.id,
            score: parseNumericInput(row.score),
            remedial_score: parseNumericInput(row.remedial_score),
            enrichment_score: parseNumericInput(row.enrichment_score),
            notes: row.notes.trim() || null,
          };
        });
        const res = await fetch('/api/penilaian/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SAVE_EXAM_SCORES',
            subject_id: subjectId,
            classroom_id: effectiveClassroomId,
            exam_type: type as AssessmentExamType,
            config: examConfig,
            scores: scoresPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai ujian.');
      }
      showToast('success', 'Nilai berhasil disimpan.');
      await loadWorkspace();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan nilai.');
    } finally {
      setSaving(false);
    }
  }

  function buildExportData() {
    const activeChapter = chapters.find((c) => c.id === selectedChapterId);
    const typeTitleMap: Record<Exclude<AssessmentMenuType, 'RAPORT'>, string> = {
      FORMATIF: activeChapter
        ? `Formatif (${formatChapterLabel(activeChapter.chapter_number, activeChapter.title)})`
        : 'Formatif (Lingkup BAB)',
      SUMATIF: 'Sumatif (Lingkup Materi)',
      STS: 'STS (Sumatif Tengah Semester)',
      SAS: 'SAS (Sumatif Akhir Semester)',
      PRAKTIK: 'Praktik',
    };

    const title = `Penilaian ${subjectInfo?.name || ''} — ${typeTitleMap[type]}`;
    const subtitle = `Kelas ${classroomInfo?.name || ''} | TA ${academicYear?.name || ''} (${academicYear?.semester || ''}) | KKM: ${kkm.minScore}`;
    const safeName = `nilai-${subjectInfo?.code || 'mapel'}-${classroomInfo?.name || 'kelas'}-${type.toLowerCase()}`
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    if (!isExam) {
      const headers = ['No', 'NIS', 'Nama Siswa', ...columns.map((c) => c.label), 'Rata-rata'];
      const rows = students.map((st, idx) => {
        const vals = columns.map((col) => parseNumericInput(columnScoresMap[`${col.id}::${st.id}`] ?? ''));
        const avg = computeAverageScore(vals);
        return [
          idx + 1,
          st.nis || '-',
          st.full_name,
          ...vals.map((v) => (v !== null ? v : '-')),
          avg !== null ? avg : '-',
        ];
      });
      return { fileName: safeName, title, subtitle, headers, rows };
    }

    const showRem =
      examConfig.enable_remedial ||
      students.some((st) => {
        const sc = parseNumericInput(examScoresMap[st.id]?.score ?? '');
        return sc !== null && sc < kkm.minScore;
      });
    const headers = ['No', 'NIS', 'Nama Siswa', `Nilai ${type}`];
    if (showRem) headers.push('Remedial');
    if (examConfig.enable_enrichment) headers.push('Pengayaan');
    if (examConfig.enable_notes) headers.push('Catatan');
    headers.push('Nilai Akhir');

    const rows = students.map((st, idx) => {
      const row = examScoresMap[st.id];
      const sc = parseNumericInput(row?.score ?? '');
      const rem = parseNumericInput(row?.remedial_score ?? '');
      const enr = parseNumericInput(row?.enrichment_score ?? '');
      const effective = computeExamEffectiveScore(sc, rem, enr);
      const base: Array<string | number> = [
        idx + 1,
        st.nis || '-',
        st.full_name,
        sc ?? '-',
      ];
      if (showRem) base.push(rem ?? '-');
      if (examConfig.enable_enrichment) base.push(enr ?? '-');
      if (examConfig.enable_notes) base.push(row?.notes.trim() || '-');
      base.push(effective ?? '-');
      return base;
    });

    return { fileName: safeName, title, subtitle, headers, rows };
  }

  if (sortedClassrooms.length === 0) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-8 text-center text-sm text-slate-600">
        Belum ada kelas yang diampu untuk mata pelajaran ini pada tahun ajaran/semester aktif.
      </div>
    );
  }

  const showAnyRemedial =
    examConfig.enable_remedial ||
    students.some((st) => {
      const sc = parseNumericInput(examScoresMap[st.id]?.score ?? '');
      return sc !== null && sc < kkm.minScore;
    });

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={error} onRetry={loadWorkspace} />

      {/* Header Card */}
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
            onChange={(e) => {
              const nextClassroomId = e.target.value;
              runWithDirtyCheck('berpindah kelas', () => {
                setLoading(true);
                setSelectedChapterId(null);
                setEditingColId(null);
                setShowAddColumn(false);
                setStudentSearch('');
                setSelectedClassroomId(nextClassroomId);
              });
            }}
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
              onClick={() => exportAssessmentToPdf(buildExportData())}
              disabled={loading || students.length === 0 || (!isExam && columns.length === 0)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => exportAssessmentToXlsx(buildExportData())}
              disabled={loading || students.length === 0 || (!isExam && columns.length === 0)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>XLSX</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={handleSaveScores}
                disabled={
                  saving ||
                  loading ||
                  students.length === 0 ||
                  validationErrors.length > 0 ||
                  (!isExam && columns.length === 0)
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

      {/* BAB Selector & Management for FORMATIF */}
      {type === 'FORMATIF' && (
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
                      onClick={() => {
                        if (ch.id === selectedChapterId) return;
                        runWithDirtyCheck('berpindah BAB', () => {
                          setLoading(true);
                          setSelectedChapterId(ch.id);
                        });
                      }}
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
                          onClick={() => {
                            setEditingChapterId(ch.id);
                            setEditingChapterTitle(ch.title || '');
                          }}
                          title="Edit judul BAB"
                          aria-label="Edit judul BAB"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={mutatingMeta}
                          onClick={() => handleDeleteChapter(ch)}
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
                onClick={() => setShowChapterForm((v) => !v)}
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
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Judul tambahan BAB (opsional, misal: Interaksi Sosial)"
                className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={mutatingMeta}
                  onClick={handleAddChapter}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Simpan BAB
                </button>
                <button
                  type="button"
                  onClick={() => setShowChapterForm(false)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600"
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
                onChange={(e) => setEditingChapterTitle(e.target.value)}
                placeholder="Judul tambahan BAB (kosongkan jika hanya BAB X)"
                className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={mutatingMeta}
                  onClick={() => handleUpdateChapter(editingChapterId)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  Perbarui Judul
                </button>
                <button
                  type="button"
                  onClick={() => setEditingChapterId(null)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Column Management for FORMATIF, SUMATIF, PRAKTIK */}
      {!isExam && canEdit && (type !== 'FORMATIF' || selectedChapterId) && (
        <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Settings2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kolom Penilaian ({columns.length} kolom aktif)</span>
            </div>
            <button
              type="button"
              disabled={mutatingMeta}
              onClick={() => setShowAddColumn((v) => !v)}
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
                onChange={(e) => setNewColNamingMode(e.target.value as ColumnNamingMode)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                <option value="AUTO">Otomatis bernomor urut</option>
                <option value="CUSTOM">Buat nama custom</option>
              </select>
              {newColNamingMode === 'CUSTOM' && (
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
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
                  disabled={mutatingMeta}
                  onClick={handleAddColumn}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Tambahkan
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddColumn(false)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600"
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
                onChange={(e) => setEditingColMode(e.target.value as ColumnNamingMode)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold"
              >
                <option value="AUTO">Otomatis bernomor urut</option>
                <option value="CUSTOM">Nama custom</option>
              </select>
              {editingColMode === 'CUSTOM' && (
                <input
                  type="text"
                  value={editingColLabel}
                  onChange={(e) => setEditingColLabel(e.target.value)}
                  className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs"
                />
              )}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={mutatingMeta}
                  onClick={() => handleUpdateColumn(editingColId)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Simpan Nama
                </button>
                <button
                  type="button"
                  onClick={() => setEditingColId(null)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional Column Toggles for STS & SAS */}
      {isExam && canEdit && (
        <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center gap-4">
          <span className="text-xs font-bold text-slate-700">Kolom Opsional {type}:</span>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={examConfig.enable_remedial}
              onChange={(e) =>
                setExamConfig((prev) => ({ ...prev, enable_remedial: e.target.checked }))
              }
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Tampilkan Kolom Remedial</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={examConfig.enable_enrichment}
              onChange={(e) =>
                setExamConfig((prev) => ({ ...prev, enable_enrichment: e.target.checked }))
              }
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Tampilkan Kolom Pengayaan</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={examConfig.enable_notes}
              onChange={(e) =>
                setExamConfig((prev) => ({ ...prev, enable_notes: e.target.checked }))
              }
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Tampilkan Kolom Catatan</span>
          </label>
        </div>
      )}

      {/* Student Search Bar */}
      {!loading && students.length > 5 && (
        <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              aria-label="Cari siswa"
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {studentSearch && (
              <button
                type="button"
                onClick={() => setStudentSearch('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-medium text-slate-500 shrink-0">
            Menampilkan {filteredStudents.length} dari {students.length} siswa
          </span>
        </div>
      )}

      {/* Validation Warning Banner */}
      {!loading && validationErrors.length > 0 && canEdit && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold">Perhatian Validasi Nilai ({validationErrors.length} item):</p>
            <p className="break-words">{validationErrors[0]}</p>
          </div>
        </div>
      )}

      {/* Main Content: Mobile Cards + Desktop Table */}
      {loading ? (
        <AkademikLoading label="Memuat tabel penilaian..." />
      ) : (
        <div className="glass-card rounded-3xl overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {students.length === 0
                ? 'Belum ada siswa terdaftar di kelas ini pada tahun ajaran aktif.'
                : `Tidak ada siswa yang cocok dengan pencarian "${studentSearch}".`}
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) — Zero Horizontal Overflow */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  if (!isExam) {
                    const rowNums = columns.map((c) =>
                      parseNumericInput(columnScoresMap[`${c.id}::${st.id}`] ?? '')
                    );
                    const avg = computeAverageScore(rowNums);

                    return (
                      <div key={st.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 break-words">
                              {idx + 1}. {st.full_name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              NIS: {st.nis || '-'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold shrink-0">
                            Rata: {avg ?? '-'}
                          </span>
                        </div>

                        {columns.length > 0 && (
                          <div className="grid grid-cols-2 gap-2.5">
                            {columns.map((col) => {
                              const key = `${col.id}::${st.id}`;
                              const raw = columnScoresMap[key] ?? '';
                              const num = parseNumericInput(raw);
                              const isBelowKkm =
                                num !== null &&
                                (type === 'FORMATIF' || type === 'SUMATIF') &&
                                num < kkm.minScore;
                              const isInvalidRange =
                                (raw.trim() !== '' && num === null) ||
                                (num !== null && (num < 0 || num > 100));

                              return (
                                <div key={col.id} className="space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <label className="text-[11px] font-semibold text-slate-600 truncate">
                                      {col.label}
                                    </label>
                                    {canEdit && (
                                      <span className="inline-flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingColId(col.id);
                                            setEditingColMode(col.naming_mode);
                                            setEditingColLabel(col.label);
                                          }}
                                          aria-label={`Ubah ${col.label}`}
                                          className="p-0.5 text-slate-400 hover:text-slate-600"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteColumn(col.id, col.label)}
                                          aria-label={`Hapus ${col.label}`}
                                          className="p-0.5 text-rose-400 hover:text-rose-600"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    disabled={!canEdit}
                                    value={raw}
                                    onChange={(e) =>
                                      setColumnScoresMap((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }))
                                    }
                                    placeholder="0-100"
                                    className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                      isBelowKkm || isInvalidRange
                                        ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                        : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                    } disabled:bg-slate-100`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const examRow = examScoresMap[st.id] || {
                    score: '',
                    remedial_score: '',
                    enrichment_score: '',
                    notes: '',
                  };
                  const scoreNum = parseNumericInput(examRow.score);
                  const remNum = parseNumericInput(examRow.remedial_score);
                  const enrNum = parseNumericInput(examRow.enrichment_score);
                  const isScoreInvalid =
                    (examRow.score.trim() !== '' && scoreNum === null) ||
                    (scoreNum !== null && (scoreNum < 0 || scoreNum > 100));
                  const needsRemedial = scoreNum !== null && scoreNum < kkm.minScore;
                  const missingRequiredRemedial = needsRemedial && remNum === null;
                  const effectiveExamScore = computeExamEffectiveScore(scoreNum, remNum, enrNum);
                  const isRemBelowKkm =
                    remNum !== null && effectiveExamScore !== null && effectiveExamScore < kkm.minScore;
                  const isRemInvalid =
                    (examRow.remedial_score.trim() !== '' && remNum === null) ||
                    (remNum !== null && (remNum < 0 || remNum > 100)) ||
                    isRemBelowKkm;
                  const isEnrInvalid =
                    (examRow.enrichment_score.trim() !== '' && enrNum === null) ||
                    (enrNum !== null && (enrNum < 0 || enrNum > 100));
                  const disableScoreInput = !canEdit || remNum !== null || enrNum !== null;
                  const disableRemedialInput =
                    !canEdit || scoreNum === null || scoreNum >= kkm.minScore || enrNum !== null;
                  const disableEnrichmentInput =
                    !canEdit || scoreNum === null || needsRemedial || remNum !== null;

                  return (
                    <div key={st.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 break-words">
                            {idx + 1}. {st.full_name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">NIS: {st.nis || '-'}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold shrink-0">
                          Akhir: {effectiveExamScore ?? '-'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Nilai {type}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            disabled={disableScoreInput}
                            value={examRow.score}
                            onChange={(e) =>
                              setExamScoresMap((prev) => ({
                                ...prev,
                                [st.id]: { ...examRow, score: e.target.value },
                              }))
                            }
                            placeholder="0-100"
                            className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${
                              isScoreInvalid
                                ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                : needsRemedial
                                ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500'
                                : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                            } disabled:bg-slate-100 disabled:text-slate-500`}
                          />
                        </div>

                        {showAnyRemedial && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Remedial {needsRemedial && <span className="text-rose-600">(Wajib)</span>}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              disabled={disableRemedialInput}
                              value={examRow.remedial_score}
                              onChange={(e) =>
                                setExamScoresMap((prev) => ({
                                  ...prev,
                                  [st.id]: { ...examRow, remedial_score: e.target.value },
                                }))
                              }
                              placeholder={
                                scoreNum !== null && scoreNum >= kkm.minScore
                                  ? 'Tuntas (>= KKM)'
                                  : enrNum !== null
                                  ? 'Terkunci (ada Pengayaan)'
                                  : needsRemedial
                                  ? 'Wajib'
                                  : 'Opsional'
                              }
                              className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                missingRequiredRemedial || isRemInvalid
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                              } disabled:bg-slate-100 disabled:text-slate-400`}
                            />
                          </div>
                        )}

                        {examConfig.enable_enrichment && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Pengayaan
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              disabled={disableEnrichmentInput}
                              value={examRow.enrichment_score}
                              onChange={(e) =>
                                setExamScoresMap((prev) => ({
                                  ...prev,
                                  [st.id]: { ...examRow, enrichment_score: e.target.value },
                                }))
                              }
                              placeholder={
                                needsRemedial || remNum !== null
                                  ? 'Terkunci (Remedial)'
                                  : 'Opsional'
                              }
                              className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                isEnrInvalid
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                              } disabled:bg-slate-100 disabled:text-slate-400`}
                            />
                          </div>
                        )}

                        {examConfig.enable_notes && (
                          <div className="space-y-1 col-span-2">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Catatan
                            </label>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={examRow.notes}
                              onChange={(e) =>
                                setExamScoresMap((prev) => ({
                                  ...prev,
                                  [st.id]: { ...examRow, notes: e.target.value },
                                }))
                              }
                              placeholder="Catatan guru..."
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) with sticky student name */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-bold w-10">No</th>
                      <th className="px-4 py-3 font-bold min-w-[90px]">NIS</th>
                      <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-bold min-w-[200px]">
                        Nama Siswa
                      </th>

                      {!isExam &&
                        columns.map((col) => (
                          <th key={col.id} className="px-3 py-3 font-bold min-w-[125px]">
                            <div className="flex items-center justify-between gap-1">
                              <span>{col.label}</span>
                              {canEdit && (
                                <span className="inline-flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingColId(col.id);
                                      setEditingColMode(col.naming_mode);
                                      setEditingColLabel(col.label);
                                    }}
                                    title="Ubah nama kolom"
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteColumn(col.id, col.label)}
                                    title="Hapus kolom"
                                    className="p-1 rounded hover:bg-rose-100 text-rose-500"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </th>
                        ))}

                      {!isExam && (
                        <th className="px-4 py-3 font-bold text-center min-w-[90px] bg-emerald-50/60 text-emerald-900">
                          Rata-rata
                        </th>
                      )}

                      {isExam && (
                        <>
                          <th className="px-3 py-3 font-bold min-w-[120px]">Nilai {type}</th>
                          {showAnyRemedial && (
                            <th className="px-3 py-3 font-bold min-w-[130px]">Remedial</th>
                          )}
                          {examConfig.enable_enrichment && (
                            <th className="px-3 py-3 font-bold min-w-[130px]">Pengayaan</th>
                          )}
                          {examConfig.enable_notes && (
                            <th className="px-3 py-3 font-bold min-w-[220px]">Catatan</th>
                          )}
                          <th className="px-4 py-3 font-bold text-center min-w-[100px] bg-emerald-50/60 text-emerald-900">
                            Nilai Akhir
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((st, idx) => {
                      if (!isExam) {
                        const rowNums = columns.map((c) =>
                          parseNumericInput(columnScoresMap[`${c.id}::${st.id}`] ?? '')
                        );
                        const avg = computeAverageScore(rowNums);

                        return (
                          <tr key={st.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-2.5 text-slate-600 font-mono">
                              {st.nis || '-'}
                            </td>
                            <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-slate-900">
                              {st.full_name}
                            </td>
                            {columns.map((col) => {
                              const key = `${col.id}::${st.id}`;
                              const raw = columnScoresMap[key] ?? '';
                              const num = parseNumericInput(raw);
                              const isBelowKkm =
                                num !== null &&
                                (type === 'FORMATIF' || type === 'SUMATIF') &&
                                num < kkm.minScore;
                              const isInvalidRange =
                                (raw.trim() !== '' && num === null) ||
                                (num !== null && (num < 0 || num > 100));

                              return (
                                <td key={col.id} className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    disabled={!canEdit}
                                    value={raw}
                                    onChange={(e) =>
                                      setColumnScoresMap((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }))
                                    }
                                    placeholder="0-100"
                                    className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                      isBelowKkm || isInvalidRange
                                        ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                        : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                    } disabled:bg-slate-100`}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                              {avg !== null ? avg : '-'}
                            </td>
                          </tr>
                        );
                      }

                      const examRow = examScoresMap[st.id] || {
                        score: '',
                        remedial_score: '',
                        enrichment_score: '',
                        notes: '',
                      };
                      const scoreNum = parseNumericInput(examRow.score);
                      const remNum = parseNumericInput(examRow.remedial_score);
                      const enrNum = parseNumericInput(examRow.enrichment_score);
                      const isScoreInvalid =
                        (examRow.score.trim() !== '' && scoreNum === null) ||
                        (scoreNum !== null && (scoreNum < 0 || scoreNum > 100));
                      const needsRemedial = scoreNum !== null && scoreNum < kkm.minScore;
                      const missingRequiredRemedial = needsRemedial && remNum === null;
                      const effectiveExamScore = computeExamEffectiveScore(
                        scoreNum,
                        remNum,
                        enrNum
                      );
                      const isRemBelowKkm =
                        remNum !== null &&
                        effectiveExamScore !== null &&
                        effectiveExamScore < kkm.minScore;
                      const isRemInvalid =
                        (examRow.remedial_score.trim() !== '' && remNum === null) ||
                        (remNum !== null && (remNum < 0 || remNum > 100)) ||
                        isRemBelowKkm;
                      const isEnrInvalid =
                        (examRow.enrichment_score.trim() !== '' && enrNum === null) ||
                        (enrNum !== null && (enrNum < 0 || enrNum > 100));
                      const disableScoreInput = !canEdit || remNum !== null || enrNum !== null;
                      const disableRemedialInput =
                        !canEdit ||
                        scoreNum === null ||
                        scoreNum >= kkm.minScore ||
                        enrNum !== null;
                      const disableEnrichmentInput =
                        !canEdit || scoreNum === null || needsRemedial || remNum !== null;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-slate-600 font-mono">
                            {st.nis || '-'}
                          </td>
                          <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-slate-900">
                            {st.full_name}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              disabled={disableScoreInput}
                              value={examRow.score}
                              onChange={(e) =>
                                setExamScoresMap((prev) => ({
                                  ...prev,
                                  [st.id]: { ...examRow, score: e.target.value },
                                }))
                              }
                              placeholder="0-100"
                              className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                isScoreInvalid
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                  : needsRemedial
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                              } disabled:bg-slate-100 disabled:text-slate-500`}
                            />
                          </td>
                          {showAnyRemedial && (
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  disabled={disableRemedialInput}
                                  value={examRow.remedial_score}
                                  onChange={(e) =>
                                    setExamScoresMap((prev) => ({
                                      ...prev,
                                      [st.id]: { ...examRow, remedial_score: e.target.value },
                                    }))
                                  }
                                  placeholder={
                                    scoreNum !== null && scoreNum >= kkm.minScore
                                      ? 'Tuntas'
                                      : enrNum !== null
                                      ? 'Terkunci'
                                      : needsRemedial
                                      ? 'Wajib'
                                      : 'Opsional'
                                  }
                                  className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                    missingRequiredRemedial || isRemInvalid
                                      ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                      : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                  } disabled:bg-slate-100 disabled:text-slate-400`}
                                />
                                {needsRemedial && (
                                  <span className="text-[10px] font-bold text-rose-600">
                                    Wajib
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {examConfig.enable_enrichment && (
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                disabled={disableEnrichmentInput}
                                value={examRow.enrichment_score}
                                onChange={(e) =>
                                  setExamScoresMap((prev) => ({
                                    ...prev,
                                    [st.id]: { ...examRow, enrichment_score: e.target.value },
                                  }))
                                }
                                placeholder={
                                  needsRemedial || remNum !== null ? 'Terkunci' : 'Opsional'
                                }
                                className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${
                                  isEnrInvalid
                                    ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                    : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                } disabled:bg-slate-100 disabled:text-slate-400`}
                              />
                            </td>
                          )}
                          {examConfig.enable_notes && (
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={examRow.notes}
                                onChange={(e) =>
                                  setExamScoresMap((prev) => ({
                                    ...prev,
                                    [st.id]: { ...examRow, notes: e.target.value },
                                  }))
                                }
                                placeholder="Catatan guru..."
                                className="w-full min-w-[180px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                              />
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                            {effectiveExamScore ?? '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!isExam && columns.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 border-t border-slate-100">
              {type === 'FORMATIF' && !selectedChapterId
                ? 'Silakan tambahkan BAB terlebih dahulu untuk mulai menambahkan kolom penilaian TP.'
                : 'Belum ada kolom penilaian. Klik "Tambah Kolom Penilaian" di atas untuk menambahkan.'}
            </div>
          )}
        </div>
      )}

      {confirmModal && (
        <PenilaianConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          description={confirmModal.description}
          details={confirmModal.details}
          variant={confirmModal.variant}
          confirmLabel={confirmModal.confirmLabel}
          loading={mutatingMeta}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => {
            if (!mutatingMeta) setConfirmModal(null);
          }}
        />
      )}
    </div>
  );
}
