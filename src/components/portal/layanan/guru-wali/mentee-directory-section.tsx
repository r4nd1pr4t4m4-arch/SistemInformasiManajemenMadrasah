'use client';

import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import type { AssignmentRow } from './types';

interface MenteeDirectorySectionProps {
  menteeDirectory: AssignmentRow[];
  canAssign: boolean;
}

export function MenteeDirectorySection({
  menteeDirectory,
  canAssign,
}: MenteeDirectorySectionProps) {
  const [directorySearch, setDirectorySearch] = useState('');

  const groupedMenteeDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    const map = new Map<string, { teacherName: string; students: AssignmentRow[] }>();
    for (const a of menteeDirectory) {
      const teacherName = a.teacher?.full_name || 'Guru Wali';
      const studentName = a.student?.full_name || 'Siswa';
      const nis = a.student?.nis || '';
      const cls = a.classroom_name || '';
      if (q) {
        const haystack = `${teacherName} ${studentName} ${nis} ${cls}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      const key = a.teacher_id || teacherName;
      if (!map.has(key)) {
        map.set(key, { teacherName, students: [] });
      }
      map.get(key)!.students.push(a);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        students: [...g.students].sort((x, y) =>
          (x.student?.full_name || '').localeCompare(y.student?.full_name || '')
        ),
      }))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [directorySearch, menteeDirectory]);

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Daftar Siswa Binaan per Guru Wali ({menteeDirectory.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canAssign
              ? 'Menampilkan seluruh daftar siswa binaan yang dikelompokkan per Guru Wali.'
              : 'Menampilkan daftar siswa binaan sesuai kelas perwalian atau siswa binaan Anda.'}
          </p>
        </div>

        <div className="relative w-full sm:w-72 shrink-0">
          <label htmlFor="gw-directory-search" className="sr-only">
            Cari Guru Wali, siswa, NIS, atau kelas
          </label>
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="gw-directory-search"
            type="search"
            value={directorySearch}
            onChange={(e) => setDirectorySearch(e.target.value)}
            placeholder="Cari Guru Wali, siswa, NIS, atau kelas..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          />
        </div>
      </div>

      {groupedMenteeDirectory.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            {menteeDirectory.length === 0
              ? 'Belum ada data siswa binaan Guru Wali yang tersedia.'
              : 'Tidak ada data siswa binaan yang cocok dengan pencarian.'}
          </p>
          {directorySearch && (
            <button
              type="button"
              onClick={() => setDirectorySearch('')}
              className="text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              Reset pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedMenteeDirectory.map((group) => (
            <div
              key={group.teacherName}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3 min-w-0 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Guru Wali
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 break-words">
                    {group.teacherName}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold shrink-0">
                  {group.students.length} siswa
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {group.students.map((st, idx) => (
                  <div
                    key={st.id}
                    className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {idx + 1}. {st.student?.full_name || 'Siswa'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        NIS: {st.student?.nis || '-'}
                      </p>
                    </div>
                    {st.classroom_name && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-semibold shrink-0">
                        {st.classroom_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
