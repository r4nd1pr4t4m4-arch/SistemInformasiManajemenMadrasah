'use client';

import type { FormEvent } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { ActiveAccount, StudentFormState, StudentGender, StudentStatus } from './types';

type SiswaFormModalProps = {
  isEditing: boolean;
  form: StudentFormState;
  accounts: ActiveAccount[];
  saving: boolean;
  modalError: string | null;
  onFormChange: (next: StudentFormState) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function SiswaFormModal({
  isEditing,
  form,
  accounts,
  saving,
  modalError,
  onFormChange,
  onClose,
  onSubmit,
}: SiswaFormModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="siswa-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 id="siswa-modal-title" className="text-lg font-bold text-slate-900">
            {isEditing ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
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
              htmlFor="siswa-full-name"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Lengkap *
            </label>
            <input
              id="siswa-full-name"
              required
              minLength={2}
              type="text"
              value={form.full_name}
              onChange={(e) => onFormChange({ ...form, full_name: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="siswa-nis" className="block text-xs font-semibold text-slate-600 mb-1">
              NIS
            </label>
            <input
              id="siswa-nis"
              type="text"
              value={form.nis}
              onChange={(e) => onFormChange({ ...form, nis: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="siswa-nisn" className="block text-xs font-semibold text-slate-600 mb-1">
              NISN
            </label>
            <input
              id="siswa-nisn"
              type="text"
              value={form.nisn}
              onChange={(e) => onFormChange({ ...form, nisn: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="siswa-nik" className="block text-xs font-semibold text-slate-600 mb-1">
              NIK
            </label>
            <input
              id="siswa-nik"
              type="text"
              value={form.nik}
              onChange={(e) => onFormChange({ ...form, nik: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-gender"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Jenis Kelamin
            </label>
            <select
              id="siswa-gender"
              value={form.gender}
              onChange={(e) => onFormChange({ ...form, gender: e.target.value as StudentGender })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="siswa-birth-place"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tempat Lahir
            </label>
            <input
              id="siswa-birth-place"
              type="text"
              value={form.birth_place}
              onChange={(e) => onFormChange({ ...form, birth_place: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-birth-date"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tanggal Lahir
            </label>
            <input
              id="siswa-birth-date"
              type="date"
              value={form.birth_date}
              onChange={(e) => onFormChange({ ...form, birth_date: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-religion"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Agama
            </label>
            <input
              id="siswa-religion"
              type="text"
              value={form.religion}
              onChange={(e) => onFormChange({ ...form, religion: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-status"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Status
            </label>
            <select
              id="siswa-status"
              value={form.status}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  status: e.target.value as StudentStatus,
                })
              }
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="AKTIF">AKTIF</option>
              <option value="LULUS">LULUS (Alumni)</option>
              <option value="MUTASI">MUTASI</option>
              <option value="NONAKTIF">NONAKTIF</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="siswa-entry-year"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tahun Masuk
            </label>
            <input
              id="siswa-entry-year"
              type="number"
              min={1980}
              max={2100}
              value={form.entry_year}
              onChange={(e) => onFormChange({ ...form, entry_year: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-grad-year"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tahun Lulus
            </label>
            <input
              id="siswa-grad-year"
              type="number"
              min={1980}
              max={2100}
              value={form.graduation_year}
              onChange={(e) => onFormChange({ ...form, graduation_year: e.target.value })}
              placeholder="Isi jika sudah lulus"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-phone"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              No. HP
            </label>
            <input
              id="siswa-phone"
              type="text"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-email"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Email
            </label>
            <input
              id="siswa-email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-father"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Ayah
            </label>
            <input
              id="siswa-father"
              type="text"
              value={form.father_name}
              onChange={(e) => onFormChange({ ...form, father_name: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-mother"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Ibu
            </label>
            <input
              id="siswa-mother"
              type="text"
              value={form.mother_name}
              onChange={(e) => onFormChange({ ...form, mother_name: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-guardian"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Wali (Opsional)
            </label>
            <input
              id="siswa-guardian"
              type="text"
              value={form.guardian_name}
              onChange={(e) => onFormChange({ ...form, guardian_name: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="siswa-profile"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tautkan Akun Portal Siswa
            </label>
            <select
              id="siswa-profile"
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
              htmlFor="siswa-address"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Alamat
            </label>
            <textarea
              id="siswa-address"
              rows={2}
              value={form.address}
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
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
