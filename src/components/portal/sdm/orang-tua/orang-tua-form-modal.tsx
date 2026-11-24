'use client';

import { useEffect, type FormEvent } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  ActiveAccount,
  GuardianFormState,
  GuardianRelationship,
  StudentRef,
} from './types';

type OrangTuaFormModalProps = {
  open: boolean;
  editingId: string | null;
  form: GuardianFormState;
  onFormChange: (next: GuardianFormState) => void;
  students: StudentRef[];
  accounts: ActiveAccount[];
  saving: boolean;
  modalError: string | null;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export function OrangTuaFormModal({
  open,
  editingId,
  form,
  onFormChange,
  students,
  accounts,
  saving,
  modalError,
  onClose,
  onSubmit,
}: OrangTuaFormModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ortu-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 id="ortu-modal-title" className="text-lg font-bold text-slate-900">
            {editingId ? 'Edit Data Orang Tua / Wali' : 'Tambah Data Orang Tua / Wali'}
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {modalError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="break-words">{modalError}</span>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm"
        >
          <div className="sm:col-span-2">
            <label
              htmlFor="ortu-student"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Siswa Terkait *
            </label>
            <select
              id="ortu-student"
              required
              value={form.student_id}
              onChange={(e) => onFormChange({ ...form, student_id: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ortu-full-name"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Lengkap *
            </label>
            <input
              id="ortu-full-name"
              required
              minLength={2}
              type="text"
              value={form.full_name}
              onChange={(e) => onFormChange({ ...form, full_name: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="ortu-relationship"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Hubungan
            </label>
            <select
              id="ortu-relationship"
              value={form.relationship}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  relationship: e.target.value as GuardianRelationship,
                })
              }
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="AYAH">Ayah</option>
              <option value="IBU">Ibu</option>
              <option value="WALI">Wali</option>
            </select>
          </div>

          <div>
            <label htmlFor="ortu-nik" className="block text-xs font-semibold text-slate-600 mb-1">
              NIK
            </label>
            <input
              id="ortu-nik"
              type="text"
              value={form.nik}
              onChange={(e) => onFormChange({ ...form, nik: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="ortu-phone"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              No. HP / WA
            </label>
            <input
              id="ortu-phone"
              type="text"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="ortu-email"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Email
            </label>
            <input
              id="ortu-email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="ortu-occupation"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Pekerjaan
            </label>
            <input
              id="ortu-occupation"
              type="text"
              value={form.occupation}
              onChange={(e) => onFormChange({ ...form, occupation: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="ortu-profile"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tautkan Akun Portal Orang Tua
            </label>
            <select
              id="ortu-profile"
              value={form.profile_id}
              onChange={(e) => onFormChange({ ...form, profile_id: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">-- Tidak Ditautkan --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="ortu-address"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Alamat
            </label>
            <textarea
              id="ortu-address"
              rows={2}
              value={form.address}
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:gap-6">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => onFormChange({ ...form, is_primary: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Jadikan Wali Utama
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => onFormChange({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Status Aktif
            </label>
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
