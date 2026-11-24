'use client';

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  AlertCircle,
  Briefcase,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { AdditionalDutyType } from '@/types/database';
import type {
  AcademicYearOption,
  CallHonorApiFn,
  ShowToastFn,
  TeacherDutyAssignment,
  TeacherOption,
} from './types';

interface TugasTambahanSectionProps {
  canManage: boolean;
  teachers: TeacherOption[];
  dutyTypes: AdditionalDutyType[];
  teacherDuties: TeacherDutyAssignment[];
  academicYears: AcademicYearOption[];
  dutyAllowanceDrafts: Record<string, string>;
  setDutyAllowanceDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  callHonorApi: CallHonorApiFn;
  showToast: ShowToastFn;
}

export function TugasTambahanSection({
  canManage,
  teachers,
  dutyTypes,
  teacherDuties,
  academicYears,
  dutyAllowanceDrafts,
  setDutyAllowanceDrafts,
  refreshing,
  submittingAction,
  onRefresh,
  callHonorApi,
  showToast,
}: TugasTambahanSectionProps) {
  const [dutyTypeSearch, setDutyTypeSearch] = useState('');
  const [teacherDutySearch, setTeacherDutySearch] = useState('');
  const [dutyToDelete, setDutyToDelete] = useState<TeacherDutyAssignment | null>(null);
  const [selectedDutyIds, setSelectedDutyIds] = useState<string[]>([]);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const [assignDutyForm, setAssignDutyForm] = useState<{
    teacher_id: string;
    duty_type_id: string;
    academic_year_id: string | null;
    decree_number: string;
  }>({
    teacher_id: '',
    duty_type_id: '',
    academic_year_id: null,
    decree_number: '',
  });

  const defaultAcademicYearId = useMemo(
    () => academicYears.find((ay) => ay.is_active)?.id || academicYears[0]?.id || '',
    [academicYears]
  );

  const effectiveAcademicYearId = assignDutyForm.academic_year_id ?? defaultAcademicYearId;

  const filteredDutyTypes = useMemo(() => {
    const q = dutyTypeSearch.trim().toLowerCase();
    if (!q) return dutyTypes;
    return dutyTypes.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [dutyTypeSearch, dutyTypes]);

  const filteredTeacherDuties = useMemo(() => {
    const q = teacherDutySearch.trim().toLowerCase();
    if (!q) return teacherDuties;
    return teacherDuties.filter(
      (td) =>
        (td.teacher?.full_name || '').toLowerCase().includes(q) ||
        (td.duty_type?.name || '').toLowerCase().includes(q) ||
        (td.decree_number || '').toLowerCase().includes(q) ||
        (td.academic_year?.name || '').toLowerCase().includes(q) ||
        (td.academic_year?.semester || '').toLowerCase().includes(q)
    );
  }, [teacherDuties, teacherDutySearch]);

  const isDuplicateDutyAssignment = useMemo(() => {
    if (!assignDutyForm.teacher_id || !assignDutyForm.duty_type_id || !effectiveAcademicYearId) {
      return false;
    }
    return teacherDuties.some(
      (td) =>
        td.teacher_id === assignDutyForm.teacher_id &&
        td.duty_type_id === assignDutyForm.duty_type_id &&
        td.academic_year_id === effectiveAcademicYearId
    );
  }, [
    assignDutyForm.duty_type_id,
    assignDutyForm.teacher_id,
    effectiveAcademicYearId,
    teacherDuties,
  ]);

  const selectedDutiesList = useMemo(() => {
    if (selectedDutyIds.length === 0) return [];
    const selectedSet = new Set(selectedDutyIds);
    return teacherDuties.filter((td) => selectedSet.has(td.id));
  }, [selectedDutyIds, teacherDuties]);

  const allFilteredSelected = useMemo(() => {
    if (filteredTeacherDuties.length === 0) return false;
    const selectedSet = new Set(selectedDutyIds);
    return filteredTeacherDuties.every((td) => selectedSet.has(td.id));
  }, [filteredTeacherDuties, selectedDutyIds]);

  function toggleDutySelection(id: string) {
    setSelectedDutyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleToggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredTeacherDuties.map((td) => td.id));
      setSelectedDutyIds((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }
    setSelectedDutyIds((prev) => {
      const merged = new Set(prev);
      for (const td of filteredTeacherDuties) {
        merged.add(td.id);
      }
      return Array.from(merged);
    });
  }

  async function handleAssignDuty(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!assignDutyForm.teacher_id || !assignDutyForm.duty_type_id || !effectiveAcademicYearId) {
      showToast('Pilih guru, jenis tugas tambahan, serta semester & tahun ajaran.', 'error');
      return;
    }
    if (isDuplicateDutyAssignment) {
      showToast(
        'Guru tersebut sudah memiliki tugas tambahan yang sama pada semester dan tahun ajaran ini.',
        'error'
      );
      return;
    }
    const ok = await callHonorApi(
      'POST',
      {
        action: 'ASSIGN_DUTY',
        teacher_id: assignDutyForm.teacher_id,
        duty_type_id: assignDutyForm.duty_type_id,
        academic_year_id: effectiveAcademicYearId,
        decree_number: assignDutyForm.decree_number.trim() || null,
      },
      'Tugas tambahan guru berhasil disimpan.'
    );
    if (ok) {
      setAssignDutyForm((prev) => ({
        ...prev,
        teacher_id: '',
        duty_type_id: '',
        decree_number: '',
      }));
    }
  }

  async function handleConfirmDeleteDuty() {
    if (!canManage || !dutyToDelete || submittingAction) return;
    const ok = await callHonorApi(
      'DELETE',
      {
        action: 'DELETE_DUTY_ASSIGNMENT',
        id: dutyToDelete.id,
      },
      'Penugasan tugas tambahan guru berhasil dihapus.'
    );
    if (ok) {
      setSelectedDutyIds((prev) => prev.filter((id) => id !== dutyToDelete.id));
      setDutyToDelete(null);
    }
  }

  async function handleConfirmBatchDeleteDuty() {
    if (!canManage || selectedDutiesList.length === 0 || submittingAction) return;
    const ids = selectedDutiesList.map((td) => td.id);
    const ok = await callHonorApi(
      'DELETE',
      {
        action: 'DELETE_DUTY_ASSIGNMENT_BATCH',
        ids,
      },
      `${ids.length} penugasan tugas tambahan guru berhasil dihapus.`
    );
    if (ok) {
      setSelectedDutyIds([]);
      setBatchDeleteOpen(false);
    }
  }

  async function handleSaveDutyAllowance(duty: AdditionalDutyType) {
    if (!canManage || !duty.receives_allowance || submittingAction) return;
    const raw = dutyAllowanceDrafts[duty.id] ?? String(Number(duty.monthly_allowance ?? 0));
    const parsed = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast(`Nominal tunjangan ${duty.name} tidak boleh negatif.`, 'error');
      return;
    }
    const rounded = Math.round(parsed);
    await callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_DUTY_ALLOWANCE',
        duty_type_id: duty.id,
        monthly_allowance: rounded,
      },
      `Tunjangan ${duty.name} diperbarui.`
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Tugas Tambahan &amp; Tunjangan Guru</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Kelola nominal tunjangan bulanan per jenis tugas tambahan dan tugaskan peran tambahan
            ke guru beserta nomor SK.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Penugasan Aktif: </span>
            <span className="font-bold text-emerald-800">{teacherDuties.length} tugas</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang data tugas tambahan dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {canManage && (
          <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900">
                Tugaskan Tugas Tambahan ke Guru
              </h2>
              <p className="text-[11px] text-slate-500">
                Penugasan aktif otomatis diperhitungkan pada slip honorarium bulanan guru.
              </p>
            </div>

            <form onSubmit={handleAssignDuty} className="space-y-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="honor-duty-teacher"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Nama Guru
                </label>
                <select
                  id="honor-duty-teacher"
                  required
                  disabled={submittingAction === 'ASSIGN_DUTY'}
                  value={assignDutyForm.teacher_id}
                  onChange={(e) =>
                    setAssignDutyForm({ ...assignDutyForm, teacher_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="honor-duty-type"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Jenis Tugas Tambahan
                </label>
                <select
                  id="honor-duty-type"
                  required
                  disabled={submittingAction === 'ASSIGN_DUTY'}
                  value={assignDutyForm.duty_type_id}
                  onChange={(e) =>
                    setAssignDutyForm({ ...assignDutyForm, duty_type_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Tugas Tambahan --</option>
                  {dutyTypes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}{' '}
                      {d.receives_allowance
                        ? `(${formatRupiah(Number(d.monthly_allowance))}/bln)`
                        : '(Tanpa Tunjangan)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="honor-duty-academic-year"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Semester &amp; Tahun Ajaran
                </label>
                <select
                  id="honor-duty-academic-year"
                  required
                  disabled={submittingAction === 'ASSIGN_DUTY'}
                  value={effectiveAcademicYearId}
                  onChange={(e) =>
                    setAssignDutyForm({ ...assignDutyForm, academic_year_id: e.target.value })
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Semester &amp; Tahun Ajaran --</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} - Semester {ay.semester}
                      {ay.is_active ? ' (Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="honor-duty-decree"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Nomor SK (Opsional)
                </label>
                <input
                  id="honor-duty-decree"
                  type="text"
                  disabled={submittingAction === 'ASSIGN_DUTY'}
                  value={assignDutyForm.decree_number}
                  onChange={(e) =>
                    setAssignDutyForm({ ...assignDutyForm, decree_number: e.target.value })
                  }
                  placeholder="mis. SK/012/XI/2026"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>

              {isDuplicateDutyAssignment && (
                <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Guru ini sudah aktif pada tugas tambahan tersebut di semester dan tahun ajaran
                    yang dipilih.
                  </span>
                </p>
              )}

              <button
                type="submit"
                disabled={
                  Boolean(submittingAction) ||
                  !assignDutyForm.teacher_id ||
                  !assignDutyForm.duty_type_id ||
                  !effectiveAcademicYearId ||
                  isDuplicateDutyAssignment
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
              >
                {submittingAction === 'ASSIGN_DUTY' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Tugaskan</span>
              </button>
            </form>
          </div>
        )}

        <div
          className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Master Tunjangan Tugas Tambahan ({filteredDutyTypes.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Ubah nominal tunjangan bulanan lalu klik Simpan pada baris terkait.
              </p>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="honor-duty-type-search" className="sr-only">
              Cari jenis tugas tambahan
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="honor-duty-type-search"
              type="search"
              value={dutyTypeSearch}
              onChange={(e) => setDutyTypeSearch(e.target.value)}
              placeholder="Cari nama atau kode tugas tambahan..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredDutyTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              {dutyTypes.length === 0
                ? 'Belum ada master jenis tugas tambahan.'
                : 'Tidak ada jenis tugas tambahan yang cocok dengan pencarian.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto pr-0.5">
              {filteredDutyTypes.map((d) => {
                const currentVal = Number(d.monthly_allowance ?? 0);
                const draftRaw = dutyAllowanceDrafts[d.id] ?? String(currentVal);
                const draftNum = draftRaw.trim() === '' ? NaN : Number(draftRaw);
                const isInvalidDraft =
                  d.receives_allowance && (!Number.isFinite(draftNum) || draftNum < 0);
                const isDirty =
                  d.receives_allowance && !isInvalidDraft && Math.round(draftNum) !== currentVal;

                return (
                  <div
                    key={d.id}
                    className={`modular-card rounded-xl p-3 flex flex-col justify-between gap-2.5 text-xs ${
                      isDirty ? 'border-amber-300 bg-amber-50/30' : ''
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">{d.name}</p>
                      {!d.receives_allowance ? (
                        <span className="inline-block text-[10px] font-semibold text-rose-600">
                          Tanpa tunjangan honorarium
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-mono text-emerald-700 font-medium">
                          Aktif: {formatRupiah(currentVal)}/bln
                        </span>
                      )}
                    </div>

                    {canManage ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="number"
                          min={0}
                          step={5000}
                          aria-label={`Tunjangan bulanan ${d.name}`}
                          disabled={!d.receives_allowance || Boolean(submittingAction)}
                          value={draftRaw}
                          onChange={(e) =>
                            setDutyAllowanceDrafts((prev) => ({
                              ...prev,
                              [d.id]: e.target.value,
                            }))
                          }
                          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        {d.receives_allowance && isDirty && (
                          <button
                            type="button"
                            aria-busy={Boolean(submittingAction) || undefined}
                            disabled={Boolean(submittingAction) || isInvalidDraft}
                            onClick={() => void handleSaveDutyAllowance(d)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition disabled:opacity-60"
                          >
                            {Boolean(submittingAction) && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            <span>Simpan</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-right font-mono font-bold text-emerald-700">
                        {d.receives_allowance ? formatRupiah(currentVal) : '-'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Daftar Penugasan Aktif Guru ({filteredTeacherDuties.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Menampilkan guru yang sedang memegang tugas tambahan aktif.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            {canManage && filteredTeacherDuties.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleSelectAllFiltered}
                  disabled={Boolean(submittingAction)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
                >
                  {allFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
                {selectedDutiesList.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedDutyIds([])}
                      disabled={Boolean(submittingAction)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-600 transition disabled:opacity-50"
                    >
                      Reset ({selectedDutiesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchDeleteOpen(true)}
                      disabled={Boolean(submittingAction)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Terpilih ({selectedDutiesList.length})</span>
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="relative w-full sm:w-72">
              <label htmlFor="honor-assigned-duty-search" className="sr-only">
                Cari penugasan guru
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="honor-assigned-duty-search"
                type="search"
                value={teacherDutySearch}
                onChange={(e) => setTeacherDutySearch(e.target.value)}
                placeholder="Cari guru, tugas, atau SK..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {filteredTeacherDuties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            {teacherDuties.length === 0
              ? 'Belum ada guru yang ditugaskan pada tugas tambahan aktif.'
              : 'Tidak ada penugasan aktif yang sesuai dengan pencarian.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-0.5">
            {filteredTeacherDuties.map((td) => {
              const isSelected = selectedDutyIds.includes(td.id);
              return (
                <div
                  key={td.id}
                  className={`modular-card rounded-xl p-3.5 flex items-start justify-between gap-2.5 text-xs transition ${
                    isSelected ? 'ring-2 ring-rose-500/60 bg-rose-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {canManage && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDutySelection(td.id)}
                        disabled={Boolean(submittingAction)}
                        aria-label={`Pilih penugasan ${td.duty_type?.name || 'tugas tambahan'} untuk ${td.teacher?.full_name || 'guru'}`}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                      />
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 break-words">
                        {td.teacher?.full_name || 'Guru'}
                      </p>
                      <p className="text-[11px] font-medium text-emerald-700 break-words">
                        {td.duty_type?.name || 'Tugas Tambahan'}
                      </p>
                      {td.academic_year && (
                        <p className="text-[10px] text-slate-600 font-medium">
                          TA {td.academic_year.name} · Smt {td.academic_year.semester}
                        </p>
                      )}
                      {td.decree_number && (
                        <p className="text-[10px] text-slate-500 font-mono break-words">
                          SK: {td.decree_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {td.duty_type?.receives_allowance
                        ? formatRupiah(Number(td.duty_type.monthly_allowance ?? 0))
                        : 'Non-tunj.'}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDutyToDelete(td)}
                        disabled={Boolean(submittingAction)}
                        title="Hapus penugasan tugas tambahan"
                        aria-label={`Hapus penugasan ${td.duty_type?.name || 'tugas tambahan'} untuk ${td.teacher?.full_name || 'guru'}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dutyToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-duty-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="delete-duty-modal-title" className="text-sm font-bold text-slate-900">
                    Hapus Penugasan Tugas Tambahan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tindakan ini akan mencabut penugasan aktif guru.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDutyToDelete(null)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {dutyToDelete.teacher?.full_name || 'Guru'}
              </p>
              <p className="font-medium text-emerald-700">
                {dutyToDelete.duty_type?.name || 'Tugas Tambahan'}
              </p>
              {dutyToDelete.decree_number && (
                <p className="text-[11px] text-slate-500 font-mono">
                  SK: {dutyToDelete.decree_number}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDutyToDelete(null)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDuty}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs font-semibold text-white transition"
              >
                {submittingAction === 'DELETE_DUTY_ASSIGNMENT' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus Penugasan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {batchDeleteOpen && selectedDutiesList.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-duty-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="batch-delete-duty-modal-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Hapus {selectedDutiesList.length} Penugasan Tugas Tambahan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Seluruh penugasan aktif terpilih akan dicabut secara permanen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(false)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 max-h-56 overflow-y-auto space-y-2 text-xs">
              {selectedDutiesList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.teacher?.full_name || 'Guru'}
                    </p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      {item.duty_type?.name || 'Tugas Tambahan'}
                      {item.academic_year
                        ? ` · TA ${item.academic_year.name} (${item.academic_year.semester})`
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(false)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDeleteDuty}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs font-semibold text-white transition"
              >
                {submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus {selectedDutiesList.length} Penugasan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
