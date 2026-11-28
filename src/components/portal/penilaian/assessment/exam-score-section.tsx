'use client';

import { computeExamEffectiveScore, type AssessmentMenuType } from '@/lib/domain/penilaian';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  EMPTY_EXAM_ROW,
  parseNumericInput,
  type ExamConfig,
  type ExamScoreState,
  type StudentRow,
} from './types';

interface ExamColumnTogglesProps {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  examConfig: ExamConfig;
  onChange: (updater: (prev: ExamConfig) => ExamConfig) => void;
}

export function ExamColumnToggles({ type, examConfig, onChange }: ExamColumnTogglesProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center gap-4">
      <span className="text-xs font-bold text-slate-700">Kolom Opsional {type}:</span>
      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={examConfig.enable_remedial}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, enable_remedial: e.target.checked }))
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
            onChange((prev) => ({ ...prev, enable_enrichment: e.target.checked }))
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
            onChange((prev) => ({ ...prev, enable_notes: e.target.checked }))
          }
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>Tampilkan Kolom Catatan</span>
      </label>
    </div>
  );
}

interface ExamRowFlags {
  examRow: ExamScoreState;
  scoreNum: number | null;
  remNum: number | null;
  enrNum: number | null;
  isScoreInvalid: boolean;
  needsRemedial: boolean;
  missingRequiredRemedial: boolean;
  effectiveExamScore: number | null;
  isRemInvalid: boolean;
  isEnrInvalid: boolean;
  disableScoreInput: boolean;
  disableRemedialInput: boolean;
  disableEnrichmentInput: boolean;
}

function getExamRowFlags(
  examRow: ExamScoreState,
  kkmMinScore: number,
  canEdit: boolean
): ExamRowFlags {
  const scoreNum = parseNumericInput(examRow.score);
  const remNum = parseNumericInput(examRow.remedial_score);
  const enrNum = parseNumericInput(examRow.enrichment_score);
  const isScoreInvalid =
    (examRow.score.trim() !== '' && scoreNum === null) ||
    (scoreNum !== null && (scoreNum < 0 || scoreNum > 100));
  const needsRemedial = scoreNum !== null && scoreNum < kkmMinScore;
  const missingRequiredRemedial = needsRemedial && remNum === null;
  const effectiveExamScore = computeExamEffectiveScore(scoreNum, remNum, enrNum);
  const isRemBelowKkm =
    remNum !== null && effectiveExamScore !== null && effectiveExamScore < kkmMinScore;
  const isRemInvalid =
    (examRow.remedial_score.trim() !== '' && remNum === null) ||
    (remNum !== null && (remNum < 0 || remNum > 100)) ||
    isRemBelowKkm;
  const isEnrInvalid =
    (examRow.enrichment_score.trim() !== '' && enrNum === null) ||
    (enrNum !== null && (enrNum < 0 || enrNum > 100));
  const disableScoreInput = !canEdit || remNum !== null || enrNum !== null;
  const disableRemedialInput =
    !canEdit || scoreNum === null || scoreNum >= kkmMinScore || enrNum !== null;
  const disableEnrichmentInput =
    !canEdit || scoreNum === null || needsRemedial || remNum !== null;

  return {
    examRow,
    scoreNum,
    remNum,
    enrNum,
    isScoreInvalid,
    needsRemedial,
    missingRequiredRemedial,
    effectiveExamScore,
    isRemInvalid,
    isEnrInvalid,
    disableScoreInput,
    disableRemedialInput,
    disableEnrichmentInput,
  };
}

interface ExamScoreSectionProps {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  studentsCount: number;
  filteredStudents: StudentRow[];
  studentSearch: string;
  examConfig: ExamConfig;
  examScoresMap: Record<string, ExamScoreState>;
  showAnyRemedial: boolean;
  kkmMinScore: number;
  canEdit: boolean;
  onExamRowChange: (studentId: string, nextRow: ExamScoreState) => void;
}

export function ExamScoreSection({
  type,
  studentsCount,
  filteredStudents,
  studentSearch,
  examConfig,
  examScoresMap,
  showAnyRemedial,
  kkmMinScore,
  canEdit,
  onExamRowChange,
}: ExamScoreSectionProps) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      {filteredStudents.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          {studentsCount === 0
            ? 'Belum ada siswa terdaftar di kelas ini pada tahun ajaran aktif.'
            : `Tidak ada siswa yang cocok dengan pencarian "${studentSearch}".`}
        </div>
      ) : (
        <>
          {/* Mobile Card View (< md) — Zero Horizontal Overflow */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredStudents.map((st, idx) => {
              const flags = getExamRowFlags(
                examScoresMap[st.id] || EMPTY_EXAM_ROW,
                kkmMinScore,
                canEdit
              );
              const {
                examRow,
                scoreNum,
                remNum,
                enrNum,
                isScoreInvalid,
                needsRemedial,
                missingRequiredRemedial,
                effectiveExamScore,
                isRemInvalid,
                isEnrInvalid,
                disableScoreInput,
                disableRemedialInput,
                disableEnrichmentInput,
              } = flags;

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
                      Akhir: {effectiveExamScore ?? '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Nilai {type}
                      </label>
                      <DecimalInput
                        maxDecimals={2}
                        disabled={disableScoreInput}
                        value={examRow.score}
                        onValueChange={(val) =>
                          onExamRowChange(st.id, { ...examRow, score: val })
                        }
                        placeholder="0-100"
                        className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${isScoreInvalid
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
                        <DecimalInput
                          maxDecimals={2}
                          disabled={disableRemedialInput}
                          value={examRow.remedial_score}
                          onValueChange={(val) =>
                            onExamRowChange(st.id, { ...examRow, remedial_score: val })
                          }
                          placeholder={
                            scoreNum !== null && scoreNum >= kkmMinScore
                              ? 'Tuntas (>= KKM)'
                              : enrNum !== null
                                ? 'Terkunci (ada Pengayaan)'
                                : needsRemedial
                                  ? 'Wajib'
                                  : 'Opsional'
                          }
                          className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${missingRequiredRemedial || isRemInvalid
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
                        <DecimalInput
                          maxDecimals={2}
                          disabled={disableEnrichmentInput}
                          value={examRow.enrichment_score}
                          onValueChange={(val) =>
                            onExamRowChange(st.id, { ...examRow, enrichment_score: val })
                          }
                          placeholder={
                            needsRemedial || remNum !== null ? 'Terkunci (Remedial)' : 'Opsional'
                          }
                          className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 ${isEnrInvalid
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
                            onExamRowChange(st.id, { ...examRow, notes: e.target.value })
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const flags = getExamRowFlags(
                    examScoresMap[st.id] || EMPTY_EXAM_ROW,
                    kkmMinScore,
                    canEdit
                  );
                  const {
                    examRow,
                    scoreNum,
                    remNum,
                    enrNum,
                    isScoreInvalid,
                    needsRemedial,
                    missingRequiredRemedial,
                    effectiveExamScore,
                    isRemInvalid,
                    isEnrInvalid,
                    disableScoreInput,
                    disableRemedialInput,
                    disableEnrichmentInput,
                  } = flags;

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
                        <DecimalInput
                          maxDecimals={2}
                          disabled={disableScoreInput}
                          value={examRow.score}
                          onValueChange={(val) =>
                            onExamRowChange(st.id, { ...examRow, score: val })
                          }
                          placeholder="0-100"
                          className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${isScoreInvalid
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
                            <DecimalInput
                              maxDecimals={2}
                              disabled={disableRemedialInput}
                              value={examRow.remedial_score}
                              onValueChange={(val) =>
                                onExamRowChange(st.id, { ...examRow, remedial_score: val })
                              }
                              placeholder={
                                scoreNum !== null && scoreNum >= kkmMinScore
                                  ? 'Tuntas'
                                  : enrNum !== null
                                    ? 'Terkunci'
                                    : needsRemedial
                                      ? 'Wajib'
                                      : 'Opsional'
                              }
                              className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${missingRequiredRemedial || isRemInvalid
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                                } disabled:bg-slate-100 disabled:text-slate-400`}
                            />
                            {needsRemedial && (
                              <span className="text-[10px] font-bold text-rose-600">Wajib</span>
                            )}
                          </div>
                        </td>
                      )}
                      {examConfig.enable_enrichment && (
                        <td className="px-3 py-2">
                          <DecimalInput
                            maxDecimals={2}
                            disabled={disableEnrichmentInput}
                            value={examRow.enrichment_score}
                            onValueChange={(val) =>
                              onExamRowChange(st.id, { ...examRow, enrichment_score: val })
                            }
                            placeholder={
                              needsRemedial || remNum !== null ? 'Terkunci' : 'Opsional'
                            }
                            className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 ${isEnrInvalid
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
                              onExamRowChange(st.id, { ...examRow, notes: e.target.value })
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
    </div>
  );
}
