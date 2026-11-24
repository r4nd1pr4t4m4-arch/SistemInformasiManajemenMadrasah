'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from '@/components/portal/akademik/akademik-ui';
import { PenilaianConfirmModal } from '@/components/portal/penilaian/confirm-modal';
import {
  formatChapterLabel,
  sortClassroomsAsc,
  type AssessmentCategory,
  type AssessmentExamType,
  type ColumnNamingMode,
} from '@/lib/domain/penilaian';
import {
  exportAssessmentToPdf,
  exportAssessmentToXlsx,
} from '@/lib/domain/penilaian-export';
import {
  AssessmentHeader,
  ChapterManagementCard,
  ColumnManagementCard,
  StudentSearchBar,
} from './assessment/assessment-controls';
import { ColumnScoreSection } from './assessment/column-score-section';
import { ExamColumnToggles, ExamScoreSection } from './assessment/exam-score-section';
import {
  EMPTY_EXAM_ROW,
  buildAssessmentExportData,
  computeValidationErrors,
  parseNumericInput,
  type AcademicYearInfo,
  type AssessmentWorkspaceProps,
  type ChapterRow,
  type ClassroomInfo,
  type ColumnRow,
  type ConfirmModalState,
  type ExamConfig,
  type ExamScoreState,
  type KkmInfo,
  type StudentRow,
  type SubjectInfo,
} from './assessment/types';

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
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapterId);

  const effectiveClassroomId = sortedClassrooms.some((c) => c.id === selectedClassroomId)
    ? selectedClassroomId
    : sortedClassrooms[0]?.id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingMeta, setMutatingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [academicYear, setAcademicYear] = useState<AcademicYearInfo | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [classroomInfo, setClassroomInfo] = useState<ClassroomInfo | null>(null);
  const [kkm, setKkm] = useState<KkmInfo>({ mode: 'PER_GRADE', minScore: 75 });
  const [canEdit, setCanEdit] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [columnScoresMap, setColumnScoresMap] = useState<Record<string, string>>({});
  const [initialColumnScoresMap, setInitialColumnScoresMap] = useState<Record<string, string>>({});

  // STS / SAS states
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    enable_remedial: false,
    enable_enrichment: false,
    enable_notes: false,
  });
  const [initialExamConfig, setInitialExamConfig] = useState<ExamConfig>({
    enable_remedial: false,
    enable_enrichment: false,
    enable_notes: false,
  });
  const [examScoresMap, setExamScoresMap] = useState<Record<string, ExamScoreState>>({});
  const [initialExamScoresMap, setInitialExamScoresMap] = useState<Record<string, ExamScoreState>>(
    {}
  );

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

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  const isExam = type === 'STS' || type === 'SAS';

  const applyWorkspaceData = useCallback((data: Record<string, unknown>) => {
    setAcademicYear(data.academicYear as AcademicYearInfo | null);
    setSubjectInfo(data.subject as SubjectInfo | null);
    setClassroomInfo(data.classroom as ClassroomInfo | null);
    setKkm(data.kkm as KkmInfo);
    setCanEdit(Boolean(data.canEdit));
    const studentList = (data.students as StudentRow[]) || [];
    setStudents(studentList);

    if (data.type === 'STS' || data.type === 'SAS') {
      const cfg = (data.examConfig as ExamConfig) || {
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
      (s) => s.full_name.toLowerCase().includes(q) || (s.nis || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const validationErrors = useMemo(
    () =>
      computeValidationErrors({
        isExam,
        type,
        students,
        columns,
        columnScoresMap,
        examScoresMap,
        kkmMinScore: kkm.minScore,
      }),
    [isExam, students, columns, columnScoresMap, examScoresMap, type, kkm.minScore]
  );

  function runWithDirtyCheck(actionLabel: string, proceed: () => void | Promise<void>) {
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
        const scoresPayload: Array<{ column_id: string; student_id: string; score: number | null }> =
          [];
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
          const row = examScoresMap[st.id] || EMPTY_EXAM_ROW;
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

  function getExportData() {
    return buildAssessmentExportData({
      type,
      isExam,
      chapters,
      selectedChapterId,
      subjectInfo,
      classroomInfo,
      academicYear,
      kkm,
      students,
      columns,
      columnScoresMap,
      examConfig,
      examScoresMap,
    });
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

      <AssessmentHeader
        type={type}
        isExam={isExam}
        subjectInfo={subjectInfo}
        academicYear={academicYear}
        kkm={kkm}
        canEdit={canEdit}
        hasUnsavedChanges={hasUnsavedChanges}
        effectiveClassroomId={effectiveClassroomId}
        sortedClassrooms={sortedClassrooms}
        loading={loading}
        saving={saving}
        studentsCount={students.length}
        columnsCount={columns.length}
        validationErrorCount={validationErrors.length}
        onSelectClassroom={(nextClassroomId) => {
          runWithDirtyCheck('berpindah kelas', () => {
            setLoading(true);
            setSelectedChapterId(null);
            setEditingColId(null);
            setShowAddColumn(false);
            setStudentSearch('');
            setSelectedClassroomId(nextClassroomId);
          });
        }}
        onExportPdf={() => exportAssessmentToPdf(getExportData())}
        onExportXlsx={() => exportAssessmentToXlsx(getExportData())}
        onSaveScores={handleSaveScores}
      />

      {type === 'FORMATIF' && (
        <ChapterManagementCard
          classroomInfo={classroomInfo}
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          canEdit={canEdit}
          mutatingMeta={mutatingMeta}
          showChapterForm={showChapterForm}
          newChapterTitle={newChapterTitle}
          editingChapterId={editingChapterId}
          editingChapterTitle={editingChapterTitle}
          onSelectChapter={(chapterId) => {
            if (chapterId === selectedChapterId) return;
            runWithDirtyCheck('berpindah BAB', () => {
              setLoading(true);
              setSelectedChapterId(chapterId);
            });
          }}
          onToggleChapterForm={() => setShowChapterForm((v) => !v)}
          onCloseChapterForm={() => setShowChapterForm(false)}
          onNewChapterTitleChange={setNewChapterTitle}
          onAddChapter={handleAddChapter}
          onStartEditChapter={(ch) => {
            setEditingChapterId(ch.id);
            setEditingChapterTitle(ch.title || '');
          }}
          onCancelEditChapter={() => setEditingChapterId(null)}
          onEditingChapterTitleChange={setEditingChapterTitle}
          onUpdateChapter={handleUpdateChapter}
          onDeleteChapter={handleDeleteChapter}
        />
      )}

      {!isExam && canEdit && (type !== 'FORMATIF' || selectedChapterId) && (
        <ColumnManagementCard
          type={type}
          columnsCount={columns.length}
          mutatingMeta={mutatingMeta}
          showAddColumn={showAddColumn}
          newColNamingMode={newColNamingMode}
          newColLabel={newColLabel}
          editingColId={editingColId}
          editingColMode={editingColMode}
          editingColLabel={editingColLabel}
          onToggleAddColumn={() => setShowAddColumn((v) => !v)}
          onCloseAddColumn={() => setShowAddColumn(false)}
          onNewColNamingModeChange={setNewColNamingMode}
          onNewColLabelChange={setNewColLabel}
          onAddColumn={handleAddColumn}
          onEditingColModeChange={setEditingColMode}
          onEditingColLabelChange={setEditingColLabel}
          onUpdateColumn={handleUpdateColumn}
          onCancelEditColumn={() => setEditingColId(null)}
        />
      )}

      {isExam && canEdit && (
        <ExamColumnToggles type={type} examConfig={examConfig} onChange={setExamConfig} />
      )}

      {!loading && students.length > 5 && (
        <StudentSearchBar
          studentSearch={studentSearch}
          filteredCount={filteredStudents.length}
          totalCount={students.length}
          onChange={setStudentSearch}
        />
      )}

      {!loading && validationErrors.length > 0 && canEdit && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold">
              Perhatian Validasi Nilai ({validationErrors.length} item):
            </p>
            <p className="break-words">{validationErrors[0]}</p>
          </div>
        </div>
      )}

      {loading ? (
        <AkademikLoading label="Memuat tabel penilaian..." />
      ) : !isExam ? (
        <ColumnScoreSection
          type={type}
          selectedChapterId={selectedChapterId}
          studentsCount={students.length}
          filteredStudents={filteredStudents}
          studentSearch={studentSearch}
          columns={columns}
          columnScoresMap={columnScoresMap}
          kkmMinScore={kkm.minScore}
          canEdit={canEdit}
          onScoreChange={(key, value) =>
            setColumnScoresMap((prev) => ({ ...prev, [key]: value }))
          }
          onStartEditColumn={(col) => {
            setEditingColId(col.id);
            setEditingColMode(col.naming_mode);
            setEditingColLabel(col.label);
          }}
          onDeleteColumn={handleDeleteColumn}
        />
      ) : (
        <ExamScoreSection
          type={type}
          studentsCount={students.length}
          filteredStudents={filteredStudents}
          studentSearch={studentSearch}
          examConfig={examConfig}
          examScoresMap={examScoresMap}
          showAnyRemedial={showAnyRemedial}
          kkmMinScore={kkm.minScore}
          canEdit={canEdit}
          onExamRowChange={(studentId, nextRow) =>
            setExamScoresMap((prev) => ({ ...prev, [studentId]: nextRow }))
          }
        />
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
