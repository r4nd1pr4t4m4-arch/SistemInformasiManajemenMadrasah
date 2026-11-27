'use client';

import { useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { isSiblingDiscountCategory } from '@/lib/domain/sibling-discount';
import {
  FEE_CATEGORY_LABELS,
  type FeeTypeRow,
  type PostSppFn,
  type ShowToastFn,
  type SiblingGroupRow,
  type StudentOption,
} from './types';

interface KelompokSaudaraSectionProps {
  canManage: boolean;
  submitting: boolean;
  students: StudentOption[];
  feeTypes: FeeTypeRow[];
  siblingGroups: SiblingGroupRow[];
  postSpp: PostSppFn;
  showToast: ShowToastFn;
}

export function KelompokSaudaraSection({
  canManage,
  submitting,
  students,
  feeTypes,
  siblingGroups,
  postSpp,
  showToast,
}: KelompokSaudaraSectionProps) {
  const [groupSearch, setGroupSearch] = useState('');
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  // Sibling Group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: '',
    notes: '',
    is_active: true,
    student_ids: [] as string[],
    exempt_student_id: '',
  });
  const [studentPickerId, setStudentPickerId] = useState('');

  // Generate bills for a sibling group modal
  const [genModalGroup, setGenModalGroup] = useState<SiblingGroupRow | null>(null);
  const [genForm, setGenForm] = useState({
    fee_type_id: '',
    billing_month: new Date().getMonth() + 1,
    billing_year: new Date().getFullYear(),
    amount: 150000,
  });

  function openCreateGroup() {
    setEditingGroupId(null);
    setGroupForm({
      name: '',
      notes: '',
      is_active: true,
      student_ids: [],
      exempt_student_id: '',
    });
    setStudentPickerId('');
    setGroupModalOpen(true);
  }

  function openEditGroup(g: SiblingGroupRow) {
    setEditingGroupId(g.id);
    setGroupForm({
      name: g.name,
      notes: g.notes || '',
      is_active: g.is_active,
      student_ids: g.members.map((m) => m.student_id),
      exempt_student_id: g.billingSummary.exemptStudentId || g.members[0]?.student_id || '',
    });
    setStudentPickerId('');
    setGroupModalOpen(true);
  }

  function addStudentToGroup() {
    if (!studentPickerId || groupForm.student_ids.includes(studentPickerId)) return;
    const nextIds = [...groupForm.student_ids, studentPickerId];
    setGroupForm({
      ...groupForm,
      student_ids: nextIds,
      exempt_student_id: groupForm.exempt_student_id || (nextIds.length >= 2 ? nextIds[0] : ''),
    });
    setStudentPickerId('');
  }

  function removeStudentFromGroup(sid: string) {
    const nextIds = groupForm.student_ids.filter((id) => id !== sid);
    setGroupForm({
      ...groupForm,
      student_ids: nextIds,
      exempt_student_id:
        groupForm.exempt_student_id === sid ? nextIds[0] || '' : groupForm.exempt_student_id,
    });
  }

  const filteredSiblingGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return siblingGroups;
    return siblingGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q) ||
        g.members.some(
          (m) =>
            (m.student?.full_name || '').toLowerCase().includes(q) ||
            (m.student?.nis || '').toLowerCase().includes(q)
        )
    );
  }, [siblingGroups, groupSearch]);

  const anySppModalOpen = groupModalOpen || Boolean(genModalGroup);
  useEffect(() => {
    if (!anySppModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        setGroupModalOpen(false);
        setGenModalGroup(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anySppModalOpen, submitting]);

  return (
    <>
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={openCreateGroup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Tambah Kelompok Saudara
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 leading-relaxed">
          <strong>Aturan Kelompok Saudara (SPP &amp; Iuran Komite):</strong> Jika terdapat{' '}
          <strong>2 saudara</strong> aktif dalam satu kelompok maka cukup membayar untuk{' '}
          <strong>1 siswa</strong> (1 siswa gratis). Jika ada <strong>3 saudara</strong> maka
          cukup membayar untuk <strong>2 siswa</strong> (1 siswa gratis), dan seterusnya mengikuti
          pola <strong>N saudara → bayar (N - 1) siswa</strong>.
        </div>

        {siblingGroups.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">
              Daftar Kelompok Saudara ({filteredSiblingGroups.length})
            </p>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Cari nama kelompok atau anggota..."
                aria-label="Cari kelompok saudara"
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {groupSearch && (
                <button
                  type="button"
                  onClick={() => setGroupSearch('')}
                  aria-label="Hapus pencarian kelompok"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {filteredSiblingGroups.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500">
            {siblingGroups.length === 0 ? (
              <>
                Belum ada Kelompok Saudara. Klik <strong>Tambah Kelompok Saudara</strong> untuk
                mengelompokkan siswa bersaudara.
              </>
            ) : (
              'Tidak ada kelompok saudara yang cocok dengan pencarian.'
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredSiblingGroups.map((g) => {
              const isConfirming = confirmDeleteGroupId === g.id;
              return (
                <div key={g.id} className="glass-card rounded-3xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm break-words">{g.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {g.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      {g.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 break-words">{g.notes}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              aria-busy={submitting || undefined}
                              disabled={submitting}
                              onClick={async () => {
                                const ok = await postSpp(
                                  { action: 'DELETE_SIBLING_GROUP', group_id: g.id },
                                  'Kelompok saudara berhasil dihapus.'
                                );
                                if (ok) setConfirmDeleteGroupId(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold disabled:opacity-50 transition"
                            >
                              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>Hapus</span>
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setConfirmDeleteGroupId(null)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] transition"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditGroup(g)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              title="Edit Kelompok"
                              aria-label={`Edit ${g.name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGroupId(g.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                              title="Hapus Kelompok"
                              aria-label={`Hapus ${g.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Saudara Aktif: <strong>{g.billingSummary.totalSiblings}</strong>
                    </span>
                    <span>
                      Bayar: <strong className="text-slate-900">{g.billingSummary.payableCount}</strong>{' '}
                      siswa
                    </span>
                    <span>
                      Gratis:{' '}
                      <strong className="text-emerald-700">{g.billingSummary.exemptCount}</strong>{' '}
                      siswa
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {g.members.map((m) => {
                      const isExempt = g.billingSummary.exemptStudentId === m.student_id;
                      return (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 break-words">
                              {m.student?.full_name || '-'}
                            </span>
                            <span className="text-slate-400 ml-2">
                              NIS: {m.student?.nis || '-'}
                            </span>
                          </div>
                          {isExempt ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] shrink-0">
                              Gratis SPP &amp; Komite
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] shrink-0">
                              Bayar Normal
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canManage && g.is_active && g.billingSummary.totalSiblings > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstFee =
                          feeTypes.find((f) => isSiblingDiscountCategory(f.category)) || feeTypes[0];
                        setGenModalGroup(g);
                        setGenForm({
                          fee_type_id: firstFee?.id || '',
                          billing_month: new Date().getMonth() + 1,
                          billing_year: new Date().getFullYear(),
                          amount: firstFee ? Number(firstFee.default_amount) : 150000,
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                    >
                      Terbitkan Tagihan Kelompok Ini
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canManage && groupModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setGroupModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="group-modal-title" className="text-base font-bold text-slate-900">
                {editingGroupId ? 'Edit Kelompok Saudara' : 'Tambah Kelompok Saudara'}
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setGroupModalOpen(false)}
                aria-label="Tutup modal kelompok saudara"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedName = groupForm.name.trim();
                if (trimmedName.length < 2) {
                  showToast('Nama kelompok saudara minimal 2 karakter.', 'err');
                  return;
                }
                if (groupForm.student_ids.length === 0) {
                  showToast('Minimal pilih 1 anggota siswa.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: editingGroupId ? 'UPDATE_SIBLING_GROUP' : 'CREATE_SIBLING_GROUP',
                    ...(editingGroupId ? { group_id: editingGroupId } : {}),
                    ...groupForm,
                    name: trimmedName,
                    notes: groupForm.notes.trim(),
                    exempt_student_id: groupForm.exempt_student_id || null,
                  },
                  editingGroupId
                    ? 'Kelompok saudara berhasil diperbarui.'
                    : 'Kelompok saudara berhasil dibuat.'
                );
                if (ok) setGroupModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label
                  htmlFor="group-name"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nama Kelompok / Keluarga *
                </label>
                <input
                  id="group-name"
                  required
                  minLength={2}
                  placeholder="Contoh: Keluarga Bpk. Ahmad"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="group-notes"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Catatan
                </label>
                <input
                  id="group-notes"
                  placeholder="Opsional"
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="group-student-picker"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tambah Anggota Siswa
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="group-student-picker"
                    value={studentPickerId}
                    onChange={(e) => setStudentPickerId(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students
                      .filter((s) => !groupForm.student_ids.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addStudentToGroup}
                    disabled={!studentPickerId}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shrink-0 transition"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-700">
                  Anggota ({groupForm.student_ids.length} siswa →{' '}
                  {groupForm.student_ids.length >= 2
                    ? `bayar ${groupForm.student_ids.length - 1}, 1 gratis`
                    : 'bayar penuh'}
                  )
                </p>
                {groupForm.student_ids.map((sid) => {
                  const st = students.find((s) => s.id === sid);
                  return (
                    <div
                      key={sid}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <span className="font-medium text-slate-900 break-words">
                        {st?.full_name || sid}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        {groupForm.student_ids.length >= 2 && (
                          <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold cursor-pointer">
                            <input
                              type="radio"
                              name="exempt_student"
                              checked={groupForm.exempt_student_id === sid}
                              onChange={() =>
                                setGroupForm({ ...groupForm, exempt_student_id: sid })
                              }
                            />
                            Slot Gratis
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => removeStudentFromGroup(sid)}
                          className="text-rose-600 hover:underline font-medium"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupForm.is_active}
                  onChange={(e) => setGroupForm({ ...groupForm, is_active: e.target.checked })}
                />
                Kelompok Aktif
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || groupForm.student_ids.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Kelompok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManage && genModalGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gen-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setGenModalGroup(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="gen-modal-title" className="text-base font-bold text-slate-900 break-words">
                Terbitkan Tagihan: {genModalGroup.name}
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setGenModalGroup(null)}
                aria-label="Tutup modal tagihan kelompok"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
              {genModalGroup.billingSummary.totalSiblings} saudara aktif → akan diterbitkan tagihan
              berbayar untuk <strong>{genModalGroup.billingSummary.payableCount} siswa</strong> dan{' '}
              <strong>{genModalGroup.billingSummary.exemptCount} siswa Gratis</strong> (Rp 0).
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!genForm.fee_type_id) {
                  showToast('Pilih jenis biaya terlebih dahulu.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(genForm.billing_month) ||
                  genForm.billing_month < 1 ||
                  genForm.billing_month > 12
                ) {
                  showToast('Bulan tagihan harus antara 1 sampai 12.', 'err');
                  return;
                }
                if (
                  !Number.isInteger(genForm.billing_year) ||
                  genForm.billing_year < 2020 ||
                  genForm.billing_year > 2100
                ) {
                  showToast('Tahun tagihan harus antara 2020 dan 2100.', 'err');
                  return;
                }
                if (!Number.isFinite(genForm.amount) || genForm.amount < 0) {
                  showToast('Nominal per siswa minimal Rp 0.', 'err');
                  return;
                }
                const ok = await postSpp(
                  {
                    action: 'GENERATE_SIBLING_GROUP_BILLS',
                    group_id: genModalGroup.id,
                    ...genForm,
                  },
                  `Tagihan kelompok "${genModalGroup.name}" berhasil diterbitkan (${genModalGroup.billingSummary.payableCount} bayar, ${genModalGroup.billingSummary.exemptCount} gratis).`
                );
                if (ok) setGenModalGroup(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label
                  htmlFor="gen-fee-type"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Jenis Biaya *
                </label>
                <select
                  id="gen-fee-type"
                  required
                  value={genForm.fee_type_id}
                  onChange={(e) => {
                    const ft = feeTypes.find((f) => f.id === e.target.value);
                    setGenForm({
                      ...genForm,
                      fee_type_id: e.target.value,
                      amount: ft ? Number(ft.default_amount) : genForm.amount,
                    });
                  }}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Jenis Biaya --</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({FEE_CATEGORY_LABELS[f.category] || f.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="gen-month"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Bulan
                  </label>
                  <input
                    id="gen-month"
                    type="number"
                    required
                    min={1}
                    max={12}
                    value={genForm.billing_month}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_month: Number(e.target.value) })
                    }
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-year"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Tahun
                  </label>
                  <input
                    id="gen-year"
                    type="number"
                    required
                    min={2020}
                    max={2100}
                    value={genForm.billing_year}
                    onChange={(e) =>
                      setGenForm({ ...genForm, billing_year: Number(e.target.value) })
                    }
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-amount"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Nominal/Siswa
                  </label>
                  <input
                    id="gen-amount"
                    type="number"
                    required
                    min={0}
                    value={genForm.amount}
                    onChange={(e) => setGenForm({ ...genForm, amount: Number(e.target.value) })}
                    className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 tabular-nums"
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700">
                Total Tagihan Kelompok:{' '}
                <strong>
                  {formatRupiah(genForm.amount * genModalGroup.billingSummary.payableCount)}
                </strong>{' '}
                ({genModalGroup.billingSummary.payableCount} × {formatRupiah(genForm.amount)})
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setGenModalGroup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Terbitkan Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
