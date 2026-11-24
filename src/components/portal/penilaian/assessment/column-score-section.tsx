'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { computeAverageScore, type AssessmentMenuType } from '@/lib/domain/penilaian';
import { parseNumericInput, type ColumnRow, type StudentRow } from './types';

interface ColumnScoreSectionProps {
  type: Exclude<AssessmentMenuType, 'RAPORT'>;
  selectedChapterId: string | null;
  studentsCount: number;
  filteredStudents: StudentRow[];
  studentSearch: string;
  columns: ColumnRow[];
  columnScoresMap: Record<string, string>;
  kkmMinScore: number;
  canEdit: boolean;
  onScoreChange: (key: string, value: string) => void;
  onStartEditColumn: (col: ColumnRow) => void;
  onDeleteColumn: (id: string, label: string) => void;
}

export function ColumnScoreSection({
  type,
  selectedChapterId,
  studentsCount,
  filteredStudents,
  studentSearch,
  columns,
  columnScoresMap,
  kkmMinScore,
  canEdit,
  onScoreChange,
  onStartEditColumn,
  onDeleteColumn,
}: ColumnScoreSectionProps) {
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
                          num < kkmMinScore;
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
                                    onClick={() => onStartEditColumn(col)}
                                    aria-label={`Ubah ${col.label}`}
                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteColumn(col.id, col.label)}
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
                              onChange={(e) => onScoreChange(key, e.target.value)}
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

                  {columns.map((col) => (
                    <th key={col.id} className="px-3 py-3 font-bold min-w-[125px]">
                      <div className="flex items-center justify-between gap-1">
                        <span>{col.label}</span>
                        {canEdit && (
                          <span className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => onStartEditColumn(col)}
                              title="Ubah nama kolom"
                              className="p-1 rounded hover:bg-slate-200 text-slate-500"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteColumn(col.id, col.label)}
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

                  <th className="px-4 py-3 font-bold text-center min-w-[90px] bg-emerald-50/60 text-emerald-900">
                    Rata-rata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
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
                          num < kkmMinScore;
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
                              onChange={(e) => onScoreChange(key, e.target.value)}
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
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {columns.length === 0 && (
        <div className="p-6 text-center text-xs text-slate-500 border-t border-slate-100">
          {type === 'FORMATIF' && !selectedChapterId
            ? 'Silakan tambahkan BAB terlebih dahulu untuk mulai menambahkan kolom penilaian TP.'
            : 'Belum ada kolom penilaian. Klik "Tambah Kolom Penilaian" di atas untuk menambahkan.'}
        </div>
      )}
    </div>
  );
}
