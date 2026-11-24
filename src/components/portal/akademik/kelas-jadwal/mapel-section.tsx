'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AkademikEmptyState, AkademikModal } from '../akademik-ui';
import type { PostActionFn, ScheduleRow, ShowToastFn, SubjectRow } from './types';

interface MapelSectionProps {
  canManage: boolean;
  refreshing: boolean;
  submitting: boolean;
  subjects: SubjectRow[];
  schedules: ScheduleRow[];
  onRefresh: () => void;
  postAction: PostActionFn;
  showToast: ShowToastFn;
}

export function MapelSection({
  canManage,
  refreshing,
  submitting,
  subjects,
  schedules,
  onRefresh,
  postAction,
  showToast,
}: MapelSectionProps) {
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<SubjectRow | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    subject_group: 'Umum',
  });
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectGroupFilter, setSubjectGroupFilter] = useState('ALL');

  const scheduleCountBySubjectId = useMemo(() => {
    const map = new Map<string, number>();
    for (const sch of schedules) {
      if (sch.subject_id) {
        map.set(sch.subject_id, (map.get(sch.subject_id) || 0) + 1);
      }
    }
    return map;
  }, [schedules]);

  const subjectStats = useMemo(() => {
    const groups = new Set<string>();
    let scheduledCount = 0;
    for (const s of subjects) {
      groups.add((s.subject_group || 'Umum').trim() || 'Umum');
      if ((scheduleCountBySubjectId.get(s.id) || 0) > 0) scheduledCount++;
    }
    return {
      total: subjects.length,
      groups: Array.from(groups).sort((a, b) => a.localeCompare(b, 'id')),
      scheduledCount,
      unscheduledCount: subjects.length - scheduledCount,
    };
  }, [subjects, scheduleCountBySubjectId]);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjects.filter((s) => {
      const grp = (s.subject_group || 'Umum').trim() || 'Umum';
      if (subjectGroupFilter !== 'ALL' && grp !== subjectGroupFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        grp.toLowerCase().includes(q)
      );
    });
  }, [subjects, subjectSearch, subjectGroupFilter]);

  return (
    <div className="space-y-5">
      {/* Ringkasan Statistik Mata Pelajaran */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Mapel</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{subjectStats.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Kelompok Mapel</p>
          <p className="text-xl font-black text-sky-700 mt-0.5">{subjectStats.groups.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Sudah Terjadwal</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">
            {subjectStats.scheduledCount}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Belum Ada Jadwal</p>
          <p className="text-xl font-black text-amber-600 mt-0.5">
            {subjectStats.unscheduledCount}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Mata Pelajaran ({subjects.length})</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola daftar kode, nama, dan kelompok mata pelajaran yang digunakan pada penyusunan
              jadwal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            {editingSubjectId && canManage && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Pencil className="w-3 h-3" /> Mode Edit Mapel
              </span>
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
          </div>
        </div>

        {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmedCode = subjectForm.code.trim().toUpperCase();
              const trimmedName = subjectForm.name.trim();
              if (trimmedCode.length < 2) {
                showToast('error', 'Kode mata pelajaran minimal 2 karakter.');
                return;
              }
              if (trimmedName.length < 2) {
                showToast('error', 'Nama mata pelajaran minimal 2 karakter.');
                return;
              }
              if (
                subjects.some(
                  (s) => s.id !== editingSubjectId && s.code.toUpperCase() === trimmedCode
                )
              ) {
                showToast('error', `Kode mapel "${trimmedCode}" sudah terdaftar.`);
                return;
              }
              if (editingSubjectId) {
                const ok = await postAction(
                  {
                    action: 'UPDATE_SUBJECT',
                    id: editingSubjectId,
                    code: trimmedCode,
                    name: trimmedName,
                    subject_group: subjectForm.subject_group.trim() || 'Umum',
                  },
                  'Mata pelajaran berhasil diperbarui.'
                );
                if (ok) {
                  setEditingSubjectId(null);
                  setSubjectForm({
                    code: '',
                    name: '',
                    subject_group: 'Umum',
                  });
                }
              } else {
                const ok = await postAction(
                  {
                    action: 'CREATE_SUBJECT',
                    code: trimmedCode,
                    name: trimmedName,
                    subject_group: subjectForm.subject_group.trim() || 'Umum',
                  },
                  'Mata pelajaran ditambahkan.'
                );
                if (ok) {
                  setSubjectForm({
                    code: '',
                    name: '',
                    subject_group: subjectForm.subject_group,
                  });
                }
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 items-end"
          >
            <div className="lg:col-span-2">
              <label
                htmlFor="mapel-code"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Kode <span className="text-rose-600">*</span>
              </label>
              <input
                id="mapel-code"
                required
                minLength={2}
                placeholder="Contoh: MTK"
                value={subjectForm.code}
                onChange={(e) =>
                  setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="lg:col-span-4">
              <label
                htmlFor="mapel-name"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Nama Mata Pelajaran <span className="text-rose-600">*</span>
              </label>
              <input
                id="mapel-name"
                required
                minLength={2}
                placeholder="Contoh: Matematika Wajib"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="mapel-group"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Kelompok Mapel
              </label>
              <select
                id="mapel-group"
                value={subjectForm.subject_group}
                onChange={(e) =>
                  setSubjectForm({ ...subjectForm, subject_group: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="Umum">Umum</option>
                <option value="Agama / Keagamaan">Agama / Keagamaan</option>
                <option value="Peminatan">Peminatan</option>
                <option value="Muatan Lokal">Muatan Lokal</option>
                <option value="Ekstrakurikuler">Ekstrakurikuler</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingSubjectId ? 'Simpan Perubahan' : 'Simpan'}
              </button>
              {editingSubjectId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSubjectId(null);
                    setSubjectForm({ code: '', name: '', subject_group: 'Umum' });
                  }}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
                  title="Batal Edit"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        )}

        {/* Pencarian & Filter Kelompok */}
        {subjects.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="Cari nama, kode, atau kelompok mata pelajaran..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {subjectSearch && (
                <button
                  type="button"
                  onClick={() => setSubjectSearch('')}
                  aria-label="Hapus pencarian mata pelajaran"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              aria-label="Filter kelompok mata pelajaran"
              value={subjectGroupFilter}
              onChange={(e) => setSubjectGroupFilter(e.target.value)}
              className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="ALL">Semua Kelompok ({subjects.length})</option>
              {subjectStats.groups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        )}

        {subjects.length === 0 ? (
          <AkademikEmptyState
            icon={<BookOpen className="w-6 h-6" />}
            message="Belum ada mata pelajaran yang terdaftar."
          />
        ) : filteredSubjects.length === 0 ? (
          <AkademikEmptyState
            icon={<BookOpen className="w-6 h-6" />}
            message="Tidak ada mata pelajaran yang sesuai dengan filter atau pencarian."
            compact
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSubjects.map((s) => {
              const grp = (s.subject_group || 'Umum').trim() || 'Umum';
              const schCount = scheduleCountBySubjectId.get(s.id) || 0;
              const isEditingThis = editingSubjectId === s.id;
              return (
                <div
                  key={s.id}
                  className={`modular-card rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 text-xs border transition ${
                    isEditingThis
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 break-words leading-snug flex-1 min-w-0">
                        {s.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold shrink-0">
                        {s.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold">
                        {grp}
                      </span>
                      <span
                        className={`font-semibold ${
                          schCount > 0 ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {schCount > 0 ? `${schCount} sesi jadwal` : 'Belum terjadwal'}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          setEditingSubjectId(s.id);
                          setSubjectForm({
                            code: s.code,
                            name: s.name,
                            subject_group: grp,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 disabled:opacity-40 text-slate-700 hover:text-emerald-700 font-semibold text-[11px] transition"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setDeleteSubjectTarget(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-semibold text-[11px] transition"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Mata Pelajaran */}
      <AkademikModal
        open={Boolean(deleteSubjectTarget)}
        onClose={() => {
          if (!submitting) setDeleteSubjectTarget(null);
        }}
        title="Konfirmasi Hapus Mata Pelajaran"
      >
        {deleteSubjectTarget && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-slate-600 leading-relaxed">
                Anda yakin ingin menghapus mata pelajaran{' '}
                <strong className="text-slate-900">{deleteSubjectTarget.name}</strong> dari daftar
                mata pelajaran?
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Kode</span>
                <span className="font-mono font-bold text-slate-900">
                  {deleteSubjectTarget.code}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Nama Mapel</span>
                <span className="font-bold text-slate-900 text-right break-words">
                  {deleteSubjectTarget.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                <span className="text-slate-500">Kelompok</span>
                <span className="font-semibold text-sky-700">
                  {(deleteSubjectTarget.subject_group || 'Umum').trim() || 'Umum'}
                </span>
              </div>
            </div>

            {(scheduleCountBySubjectId.get(deleteSubjectTarget.id) || 0) > 0 ? (
              <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-3 text-rose-900 leading-relaxed">
                <strong>Tidak dapat dihapus:</strong> Mata pelajaran ini masih digunakan pada{' '}
                <strong>{scheduleCountBySubjectId.get(deleteSubjectTarget.id)}</strong> sesi jadwal
                pelajaran. Hapus/ubah jadwal terkait terlebih dahulu sebelum menghapus mata
                pelajaran ini.
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 leading-relaxed">
                <strong>Perhatian:</strong> Tindakan ini akan menghapus data mata pelajaran secara
                permanen.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteSubjectTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  submitting || (scheduleCountBySubjectId.get(deleteSubjectTarget.id) || 0) > 0
                }
                onClick={async () => {
                  if (submitting) return;
                  const ok = await postAction(
                    { action: 'DELETE_SUBJECT', id: deleteSubjectTarget.id },
                    `Mata pelajaran "${deleteSubjectTarget.name}" berhasil dihapus.`
                  );
                  if (ok) {
                    if (editingSubjectId === deleteSubjectTarget.id) {
                      setEditingSubjectId(null);
                      setSubjectForm({ code: '', name: '', subject_group: 'Umum' });
                    }
                    setDeleteSubjectTarget(null);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold transition"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Mapel'}</span>
              </button>
            </div>
          </div>
        )}
      </AkademikModal>
    </div>
  );
}
