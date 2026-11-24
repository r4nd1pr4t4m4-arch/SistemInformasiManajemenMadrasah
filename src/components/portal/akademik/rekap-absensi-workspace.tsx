'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react';
import { AkademikErrorBanner, AkademikToast, useAkademikToast } from './akademik-ui';
import {
  buildExportPayload,
  exportRecapToPdf,
  exportRecapToXlsx,
  getExportTitle,
} from './rekap-absensi/export-helpers';
import { RecapFilterBar, RecapSummaryCards } from './rekap-absensi/recap-controls';
import { RecapTables } from './rekap-absensi/recap-tables';
import {
  computeGuruRecapStats,
  computeStudentRecapStats,
  getCurrentMonthValue,
  getMonthRange,
  PAGE_SIZE,
  SECTION_META,
  type DailyStudentRecapRow,
  type FilterOption,
  type RekapAbsensiSection,
  type SubjectStudentRecapRow,
  type TeacherRecapRow,
} from './rekap-absensi/types';

export type { RekapAbsensiSection };

export function RekapAbsensiWorkspace({ section }: { section: RekapAbsensiSection }) {
  const initialMonth = useMemo(() => getCurrentMonthValue(), []);
  const initialRange = useMemo(() => getMonthRange(initialMonth), [initialMonth]);

  const tab = section;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [monthValue, setMonthValue] = useState(initialMonth);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [classroomId, setClassroomId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [teacherRecap, setTeacherRecap] = useState<TeacherRecapRow[]>([]);
  const [dailyStudentRecap, setDailyStudentRecap] = useState<DailyStudentRecapRow[]>([]);
  const [subjectStudentRecap, setSubjectStudentRecap] = useState<SubjectStudentRecapRow[]>([]);
  const [classrooms, setClassrooms] = useState<FilterOption[]>([]);
  const [subjects, setSubjects] = useState<FilterOption[]>([]);
  const [teachers, setTeachers] = useState<FilterOption[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const isMissingDate = !startDate || !endDate;
  const isInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const loadData = useCallback(
    async (isManualRefresh = false, signal?: AbortSignal) => {
      if (!startDate || !endDate || startDate > endDate) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      if (isManualRefresh || hasLoadedOnceRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ startDate, endDate });
        if (tab !== 'guru' && classroomId) params.set('classroomId', classroomId);
        if (tab === 'siswa-mapel' && subjectId) params.set('subjectId', subjectId);
        if (tab !== 'siswa-harian' && teacherId) params.set('teacherId', teacherId);

        const res = await fetch(`/api/akademik/rekap-absensi?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();
        if (currentRequestId !== requestIdRef.current) return;
        if (!res.ok) {
          throw new Error(data.error || 'Gagal memuat rekapitulasi absensi.');
        }
        hasLoadedOnceRef.current = true;
        setLoadError(null);
        setTeacherRecap(data.teacherRecap || []);
        setDailyStudentRecap(data.dailyStudentRecap || []);
        setSubjectStudentRecap(data.subjectStudentRecap || []);
        setClassrooms(data.filters?.classrooms || []);
        setSubjects(data.filters?.subjects || []);
        setTeachers(data.filters?.teachers || []);
      } catch (err) {
        if (signal?.aborted || currentRequestId !== requestIdRef.current) return;
        setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [startDate, endDate, classroomId, subjectId, teacherId, tab]
  );

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

  const filteredGuru = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherRecap;
    return teacherRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) || (r.nip || '').toLowerCase().includes(q)
    );
  }, [teacherRecap, search]);

  const filteredDailyStudent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dailyStudentRecap;
    return dailyStudentRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.nis || '').toLowerCase().includes(q) ||
        (r.nisn || '').toLowerCase().includes(q) ||
        r.classroom_name.toLowerCase().includes(q)
    );
  }, [dailyStudentRecap, search]);

  const filteredSubjectStudent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectStudentRecap;
    return subjectStudentRecap.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.nis || '').toLowerCase().includes(q) ||
        r.subject_name.toLowerCase().includes(q) ||
        r.teacher_name.toLowerCase().includes(q) ||
        r.classroom_name.toLowerCase().includes(q)
    );
  }, [subjectStudentRecap, search]);

  function handleExportXlsx() {
    const payload = buildExportPayload({
      section: tab,
      startDate,
      endDate,
      filteredGuru,
      filteredDailyStudent,
      filteredSubjectStudent,
    });
    if (payload.rows.length === 0) {
      showToast('error', 'Tidak ada data pada periode ini untuk diekspor ke Excel.');
      return;
    }
    try {
      exportRecapToXlsx(payload);
      showToast('success', 'File Excel berhasil diunduh.');
    } catch {
      showToast('error', 'Gagal mengekspor data ke Excel.');
    }
  }

  async function handleExportPdf() {
    const payload = buildExportPayload({
      section: tab,
      startDate,
      endDate,
      filteredGuru,
      filteredDailyStudent,
      filteredSubjectStudent,
    });
    if (payload.rows.length === 0) {
      showToast('error', 'Tidak ada data pada periode ini untuk diekspor ke PDF.');
      return;
    }
    setExportingPdf(true);
    try {
      await exportRecapToPdf({ payload, section, startDate, endDate });
      showToast('success', 'File PDF berhasil diunduh.');
    } catch {
      showToast('error', 'Gagal membuat file PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  const activeRowsCount =
    tab === 'guru'
      ? filteredGuru.length
      : tab === 'siswa-harian'
      ? filteredDailyStudent.length
      : filteredSubjectStudent.length;

  const totalPages = Math.max(1, Math.ceil(activeRowsCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedGuru = useMemo(
    () => filteredGuru.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredGuru, pageStart]
  );
  const pagedDailyStudent = useMemo(
    () => filteredDailyStudent.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredDailyStudent, pageStart]
  );
  const pagedSubjectStudent = useMemo(
    () => filteredSubjectStudent.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredSubjectStudent, pageStart]
  );

  const guruStats = useMemo(() => computeGuruRecapStats(filteredGuru), [filteredGuru]);
  const dailyStudentStats = useMemo(
    () => computeStudentRecapStats(filteredDailyStudent),
    [filteredDailyStudent]
  );
  const subjectStudentStats = useMemo(
    () => computeStudentRecapStats(filteredSubjectStudent),
    [filteredSubjectStudent]
  );

  const hasCustomFilter =
    monthValue !== initialMonth ||
    startDate !== initialRange.start ||
    endDate !== initialRange.end ||
    Boolean(classroomId) ||
    Boolean(subjectId) ||
    Boolean(teacherId) ||
    Boolean(search.trim());

  function handleResetFilters() {
    setMonthValue(initialMonth);
    setStartDate(initialRange.start);
    setEndDate(initialRange.end);
    setClassroomId('');
    setSubjectId('');
    setTeacherId('');
    setSearch('');
    setPage(1);
  }

  const sectionMeta = SECTION_META[tab];
  const disableActions = loading || activeRowsCount === 0 || isInvalidRange || isMissingDate;

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {sectionMeta.heading}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            {sectionMeta.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing || isInvalidRange || isMissingDate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={disableActions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export .xlsx
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={disableActions || exportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={disableActions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={() => void loadData(true)} />

      {/* Print Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          {getExportTitle(tab, startDate, endDate)}
        </h2>
        <p className="text-xs text-slate-600">
          Periode: {startDate} s.d. {endDate}
        </p>
      </div>

      <RecapSummaryCards
        tab={tab}
        guruStats={guruStats}
        dailyStudentStats={dailyStudentStats}
        subjectStudentStats={subjectStudentStats}
      />

      <RecapFilterBar
        tab={tab}
        monthValue={monthValue}
        startDate={startDate}
        endDate={endDate}
        classroomId={classroomId}
        subjectId={subjectId}
        teacherId={teacherId}
        search={search}
        classrooms={classrooms}
        subjects={subjects}
        teachers={teachers}
        isInvalidRange={isInvalidRange}
        isMissingDate={isMissingDate}
        hasCustomFilter={hasCustomFilter}
        activeRowsCount={activeRowsCount}
        onMonthChange={(month, start, end) => {
          setMonthValue(month);
          if (month) {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }
        }}
        onStartDateChange={(value) => {
          setMonthValue('');
          setStartDate(value);
          setPage(1);
        }}
        onEndDateChange={(value) => {
          setMonthValue('');
          setEndDate(value);
          setPage(1);
        }}
        onClassroomChange={(value) => {
          setClassroomId(value);
          setPage(1);
        }}
        onSubjectChange={(value) => {
          setSubjectId(value);
          setPage(1);
        }}
        onTeacherChange={(value) => {
          setTeacherId(value);
          setPage(1);
        }}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onResetFilters={handleResetFilters}
      />

      <RecapTables
        tab={tab}
        loading={loading}
        pagedGuru={pagedGuru}
        pagedDailyStudent={pagedDailyStudent}
        pagedSubjectStudent={pagedSubjectStudent}
        activeRowsCount={activeRowsCount}
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={pageStart}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}
