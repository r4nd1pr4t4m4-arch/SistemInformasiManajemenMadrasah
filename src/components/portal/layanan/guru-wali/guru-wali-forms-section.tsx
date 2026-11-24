'use client';

import { type FormEvent, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  ASPECT_LABELS,
  getTodayIsoDate,
  type AssignmentRow,
  type HafalanItem,
  type MentoringAspect,
  type Opt,
} from './types';

interface GuruWaliFormsSectionProps {
  canAssign: boolean;
  canLog: boolean;
  students: Opt[];
  teachers: Opt[];
  assignments: AssignmentRow[];
  hafalanItems: HafalanItem[];
  submittingAction: string | null;
  onSubmitAction: (
    body: { action?: string; [key: string]: unknown },
    successMessage: string
  ) => Promise<boolean>;
  onToast: (message: string, type?: 'success' | 'error') => void;
}

export function GuruWaliFormsSection({
  canAssign,
  canLog,
  students,
  teachers,
  assignments,
  hafalanItems,
  submittingAction,
  onSubmitAction,
  onToast,
}: GuruWaliFormsSectionProps) {
  const [showHafalanPanel, setShowHafalanPanel] = useState(false);
  const [hafalanForm, setHafalanForm] = useState({ title: '', category: '' });
  const [editingHafalan, setEditingHafalan] = useState<HafalanItem | null>(null);
  const [editHafalanForm, setEditHafalanForm] = useState({ title: '', category: '' });

  const [assignForm, setAssignForm] = useState({ teacher_id: '', student_id: '' });
  const [logForm, setLogForm] = useState(() => ({
    assignment_id: '',
    mentoring_date: getTodayIsoDate(),
    topic: '',
    aspect: 'AKADEMIK' as MentoringAspect,
    notes: '',
    recommendation: '',
  }));

  // Guru Wali hanya dapat mencatat bimbingan untuk siswa binaannya sendiri; Admin dapat memilih semua
  const loggableAssignments = useMemo(() => {
    if (canAssign) return assignments;
    return assignments.filter((a) => a.is_my_mentee);
  }, [assignments, canAssign]);

  async function handleAssignSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canAssign || submittingAction) return;
    if (!assignForm.teacher_id || !assignForm.student_id) {
      onToast('Pilih Guru Wali dan siswa terlebih dahulu.', 'error');
      return;
    }
    const ok = await onSubmitAction(
      { action: 'ASSIGN_GURU_WALI', ...assignForm },
      'Guru Wali siswa berhasil ditetapkan.'
    );
    if (ok) {
      setAssignForm({ teacher_id: '', student_id: '' });
    }
  }

  async function handleLogSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canLog || submittingAction) return;
    const topic = logForm.topic.trim();
    const notes = logForm.notes.trim();
    const recommendation = logForm.recommendation.trim();
    if (!logForm.assignment_id) {
      onToast('Pilih siswa bimbingan terlebih dahulu.', 'error');
      return;
    }
    if (topic.length < 2) {
      onToast('Topik bimbingan minimal 2 karakter.', 'error');
      return;
    }
    if (notes.length < 3) {
      onToast('Catatan perkembangan minimal 3 karakter.', 'error');
      return;
    }
    const ok = await onSubmitAction(
      {
        action: 'ADD_MENTORING_LOG',
        assignment_id: logForm.assignment_id,
        mentoring_date: logForm.mentoring_date || undefined,
        topic,
        aspect: logForm.aspect,
        notes,
        recommendation: recommendation || null,
      },
      'Rekam jejak bimbingan Guru Wali tersimpan.'
    );
    if (ok) {
      setLogForm((prev) => ({ ...prev, topic: '', notes: '', recommendation: '' }));
    }
  }

  async function handleAddHafalan(e: FormEvent) {
    e.preventDefault();
    if (!canAssign || submittingAction) return;
    const title = hafalanForm.title.trim();
    if (title.length < 2) {
      onToast('Nama hafalan minimal 2 karakter.', 'error');
      return;
    }
    const ok = await onSubmitAction(
      {
        action: 'ADD_HAFALAN_ITEM',
        title,
        category: hafalanForm.category.trim() || null,
      },
      'Daftar hafalan berhasil ditambahkan.'
    );
    if (ok) {
      setHafalanForm({ title: '', category: '' });
    }
  }

  async function handleUpdateHafalan(e: FormEvent) {
    e.preventDefault();
    if (!canAssign || !editingHafalan || submittingAction) return;
    const title = editHafalanForm.title.trim();
    if (title.length < 2) {
      onToast('Nama hafalan minimal 2 karakter.', 'error');
      return;
    }
    const ok = await onSubmitAction(
      {
        action: 'UPDATE_HAFALAN_ITEM',
        id: editingHafalan.id,
        title,
        category: editHafalanForm.category.trim() || null,
      },
      'Daftar hafalan berhasil diperbarui.'
    );
    if (ok) {
      setEditingHafalan(null);
    }
  }

  async function handleDeleteHafalan(item: HafalanItem) {
    if (!canAssign || submittingAction) return;
    await onSubmitAction(
      { action: 'DELETE_HAFALAN_ITEM', id: item.id },
      `Hafalan "${item.title}" berhasil dihapus.`
    );
  }

  return (
    <div className="lg:col-span-5 space-y-6">
      {canAssign && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900">
              Tetapkan Guru Wali Siswa (Terpisah dari BK)
            </h2>
            <p className="text-[11px] text-slate-500">
              Penetapan baru untuk siswa pada tahun ajaran aktif otomatis memperbarui Guru Walinya.
            </p>
          </div>

          <form onSubmit={handleAssignSubmit} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="gw-assign-teacher"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Guru Wali
              </label>
              <select
                id="gw-assign-teacher"
                required
                disabled={submittingAction === 'ASSIGN_GURU_WALI'}
                value={assignForm.teacher_id}
                onChange={(e) => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              >
                <option value="">-- Pilih Guru Wali --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="gw-assign-student"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Siswa Binaan
              </label>
              <select
                id="gw-assign-student"
                required
                disabled={submittingAction === 'ASSIGN_GURU_WALI'}
                value={assignForm.student_id}
                onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nis ? `(${s.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={Boolean(submittingAction)}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submittingAction === 'ASSIGN_GURU_WALI' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan Penugasan</span>
            </button>
          </form>
        </div>
      )}

      {canLog && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900">Catat Bimbingan Guru Wali</h2>
            <p className="text-[11px] text-slate-500">
              Dokumentasikan topik bimbingan, aspek, catatan perkembangan, dan rekomendasi.
            </p>
          </div>

          <form onSubmit={handleLogSubmit} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="gw-log-assignment"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Siswa Bimbingan
              </label>
              <select
                id="gw-log-assignment"
                required
                disabled={submittingAction === 'ADD_MENTORING_LOG'}
                value={logForm.assignment_id}
                onChange={(e) => setLogForm({ ...logForm, assignment_id: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              >
                <option value="">-- Pilih Siswa Bimbingan --</option>
                {loggableAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.student?.full_name || 'Siswa'}
                    {a.classroom_name ? ` — ${a.classroom_name}` : ''} (Wali:{' '}
                    {a.teacher?.full_name || 'Guru'})
                  </option>
                ))}
              </select>
              {loggableAssignments.length === 0 && (
                <p className="text-[11px] text-amber-700">
                  Belum ada siswa binaan yang ditugaskan kepada Anda.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="gw-log-aspect"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Aspek Bimbingan
                </label>
                <select
                  id="gw-log-aspect"
                  disabled={submittingAction === 'ADD_MENTORING_LOG'}
                  value={logForm.aspect}
                  onChange={(e) => {
                    const nextAspect = e.target.value as MentoringAspect;
                    setLogForm((prev) => ({
                      ...prev,
                      aspect: nextAspect,
                      topic:
                        nextAspect === 'SETORAN_HAFALAN' || prev.aspect === 'SETORAN_HAFALAN'
                          ? ''
                          : prev.topic,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                >
                  {Object.entries(ASPECT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="gw-log-date"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Tanggal Bimbingan
                </label>
                <input
                  id="gw-log-date"
                  type="date"
                  required
                  disabled={submittingAction === 'ADD_MENTORING_LOG'}
                  value={logForm.mentoring_date}
                  onChange={(e) => setLogForm({ ...logForm, mentoring_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="gw-log-topic"
                className="block text-[11px] font-semibold text-slate-700"
              >
                {logForm.aspect === 'SETORAN_HAFALAN' ? 'Hafalan' : 'Topik Bimbingan'}
              </label>
              {logForm.aspect === 'SETORAN_HAFALAN' ? (
                <>
                  <select
                    id="gw-log-topic"
                    required
                    disabled={submittingAction === 'ADD_MENTORING_LOG'}
                    value={logForm.topic}
                    onChange={(e) => setLogForm({ ...logForm, topic: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  >
                    <option value="">-- Pilih Hafalan --</option>
                    {hafalanItems.map((item) => (
                      <option key={item.id} value={item.title}>
                        {item.title}
                        {item.category ? ` (${item.category})` : ''}
                      </option>
                    ))}
                  </select>
                  {hafalanItems.length === 0 && (
                    <p className="text-[11px] text-amber-700">
                      {canAssign
                        ? 'Belum ada daftar hafalan di database. Tambahkan opsi melalui kartu Master Daftar Hafalan.'
                        : 'Belum ada daftar hafalan di database. Hubungi Admin untuk menambahkan opsi hafalan.'}
                    </p>
                  )}
                </>
              ) : (
                <input
                  id="gw-log-topic"
                  required
                  minLength={2}
                  disabled={submittingAction === 'ADD_MENTORING_LOG'}
                  placeholder="Topik Bimbingan"
                  value={logForm.topic}
                  onChange={(e) => setLogForm({ ...logForm, topic: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                />
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="gw-log-notes"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Catatan Perkembangan
              </label>
              <textarea
                id="gw-log-notes"
                required
                minLength={3}
                rows={3}
                disabled={submittingAction === 'ADD_MENTORING_LOG'}
                placeholder="Catatan Perkembangan"
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="gw-log-rec"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Rekomendasi / Tindak Lanjut (Opsional)
              </label>
              <input
                id="gw-log-rec"
                disabled={submittingAction === 'ADD_MENTORING_LOG'}
                placeholder="Rekomendasi tindak lanjut"
                value={logForm.recommendation}
                onChange={(e) => setLogForm({ ...logForm, recommendation: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={Boolean(submittingAction) || loggableAssignments.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
            >
              {submittingAction === 'ADD_MENTORING_LOG' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan Log Bimbingan</span>
            </button>
          </form>
        </div>
      )}

      {/* Menu Input & Kelola Master Daftar Hafalan (Khusus Admin) */}
      {canAssign && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Master Daftar Hafalan ({hafalanItems.length})</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Input dan kelola opsi hafalan untuk aspek bimbingan Setoran Hafalan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHafalanPanel((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shrink-0 transition"
            >
              {showHafalanPanel ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Sembunyikan</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Kelola</span>
                </>
              )}
            </button>
          </div>

          {showHafalanPanel && (
            <div className="space-y-4">
              <form onSubmit={handleAddHafalan} className="space-y-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="gw-hafalan-title"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Nama Hafalan
                  </label>
                  <input
                    id="gw-hafalan-title"
                    required
                    minLength={2}
                    disabled={submittingAction === 'ADD_HAFALAN_ITEM'}
                    placeholder="mis. Q.S. An-Naba 1-20, Doa Sebelum Belajar"
                    value={hafalanForm.title}
                    onChange={(e) => setHafalanForm({ ...hafalanForm, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="gw-hafalan-category"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Kategori (Opsional)
                  </label>
                  <input
                    id="gw-hafalan-category"
                    disabled={submittingAction === 'ADD_HAFALAN_ITEM'}
                    placeholder="mis. Juz 30, Doa Harian, Hadits Pilihan"
                    value={hafalanForm.category}
                    onChange={(e) => setHafalanForm({ ...hafalanForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={Boolean(submittingAction)}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2 px-3.5 rounded-xl text-xs transition disabled:opacity-60"
                >
                  {submittingAction === 'ADD_HAFALAN_ITEM' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Tambah Hafalan</span>
                </button>
              </form>

              {hafalanItems.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-3">
                  Belum ada daftar hafalan tersimpan.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {hafalanItems.map((item) => {
                    const isEditing = editingHafalan?.id === item.id;
                    if (isEditing) {
                      return (
                        <form
                          key={item.id}
                          onSubmit={handleUpdateHafalan}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-2"
                        >
                          <input
                            required
                            minLength={2}
                            value={editHafalanForm.title}
                            onChange={(e) =>
                              setEditHafalanForm({
                                ...editHafalanForm,
                                title: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <input
                            placeholder="Kategori (opsional)"
                            value={editHafalanForm.category}
                            onChange={(e) =>
                              setEditHafalanForm({
                                ...editHafalanForm,
                                category: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingHafalan(null)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600"
                            >
                              <X className="w-3 h-3" /> Batal
                            </button>
                            <button
                              type="submit"
                              disabled={Boolean(submittingAction)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold disabled:opacity-60"
                            >
                              <Save className="w-3 h-3" /> Simpan
                            </button>
                          </div>
                        </form>
                      );
                    }
                    return (
                      <div
                        key={item.id}
                        className="modular-card rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{item.title}</p>
                          {item.category && (
                            <p className="text-[10px] text-slate-500 truncate">{item.category}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={Boolean(submittingAction)}
                            onClick={() => {
                              setEditingHafalan(item);
                              setEditHafalanForm({
                                title: item.title,
                                category: item.category || '',
                              });
                            }}
                            aria-label={`Edit hafalan ${item.title}`}
                            className="p-1.5 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:opacity-60"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(submittingAction)}
                            onClick={() => void handleDeleteHafalan(item)}
                            aria-label={`Hapus hafalan ${item.title}`}
                            className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
