'use client';

import type { FormEvent } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { ActiveAccount, GtkFormState } from './types';

type GtkFormModalProps = {
  open: boolean;
  editingId: string | null;
  form: GtkFormState;
  accounts: ActiveAccount[];
  saving: boolean;
  modalError: string | null;
  onClose: () => void;
  onFormChange: (nextForm: GtkFormState) => void;
  onSubmit: (e: FormEvent) => void;
};

export function GtkFormModal({
  open,
  editingId,
  form,
  accounts,
  saving,
  modalError,
  onClose,
  onFormChange,
  onSubmit,
}: GtkFormModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gtk-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 id="gtk-modal-title" className="text-lg font-bold text-slate-900">
            {editingId ? 'Edit Data GTK' : 'Tambah Data GTK'}
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
              htmlFor="gtk-full-name"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Lengkap *
            </label>
            <input
              id="gtk-full-name"
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
              htmlFor="gtk-staff-type"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Jenis GTK
            </label>
            <select
              id="gtk-staff-type"
              value={form.staff_type}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  staff_type: e.target.value as 'GURU' | 'TATA_USAHA' | 'LAINNYA',
                })
              }
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="GURU">Guru</option>
              <option value="TATA_USAHA">Tata Usaha</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="gtk-employment-status"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Status Kepegawaian
            </label>
            <select
              id="gtk-employment-status"
              value={form.employment_status}
              onChange={(e) => onFormChange({ ...form, employment_status: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
              <option value="GTY">GTY</option>
              <option value="GTT">GTT</option>
              <option value="PTY">PTY</option>
              <option value="PTT">PTT</option>
            </select>
          </div>

          <div>
            <label htmlFor="gtk-nip" className="block text-xs font-semibold text-slate-600 mb-1">
              NIP
            </label>
            <input
              id="gtk-nip"
              type="text"
              value={form.nip}
              onChange={(e) => onFormChange({ ...form, nip: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-nuptk" className="block text-xs font-semibold text-slate-600 mb-1">
              NUPTK
            </label>
            <input
              id="gtk-nuptk"
              type="text"
              value={form.nuptk}
              onChange={(e) => onFormChange({ ...form, nuptk: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-nik" className="block text-xs font-semibold text-slate-600 mb-1">
              NIK
            </label>
            <input
              id="gtk-nik"
              type="text"
              value={form.nik}
              onChange={(e) => onFormChange({ ...form, nik: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-gender" className="block text-xs font-semibold text-slate-600 mb-1">
              Jenis Kelamin
            </label>
            <select
              id="gtk-gender"
              value={form.gender}
              onChange={(e) => onFormChange({ ...form, gender: e.target.value as 'L' | 'P' })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="gtk-birth-place"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tempat Lahir
            </label>
            <input
              id="gtk-birth-place"
              type="text"
              value={form.birth_place}
              onChange={(e) => onFormChange({ ...form, birth_place: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="gtk-birth-date"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tanggal Lahir
            </label>
            <input
              id="gtk-birth-date"
              type="date"
              value={form.birth_date}
              onChange={(e) => onFormChange({ ...form, birth_date: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-phone" className="block text-xs font-semibold text-slate-600 mb-1">
              No. HP / WA
            </label>
            <input
              id="gtk-phone"
              type="text"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-email" className="block text-xs font-semibold text-slate-600 mb-1">
              Email
            </label>
            <input
              id="gtk-email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="gtk-education"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Pendidikan Terakhir
            </label>
            <input
              id="gtk-education"
              type="text"
              value={form.education_level}
              onChange={(e) => onFormChange({ ...form, education_level: e.target.value })}
              placeholder="Contoh: S1 / S2"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="gtk-major" className="block text-xs font-semibold text-slate-600 mb-1">
              Jurusan
            </label>
            <input
              id="gtk-major"
              type="text"
              value={form.major}
              onChange={(e) => onFormChange({ ...form, major: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="gtk-last-campus"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Nama Kampus Terakhir
            </label>
            <input
              id="gtk-last-campus"
              type="text"
              value={form.last_campus}
              onChange={(e) => onFormChange({ ...form, last_campus: e.target.value })}
              placeholder="Contoh: Universitas Negeri Malang"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="gtk-graduation-year"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tahun Lulus
            </label>
            <input
              id="gtk-graduation-year"
              type="number"
              min={1950}
              max={2100}
              value={form.graduation_year}
              onChange={(e) => onFormChange({ ...form, graduation_year: e.target.value })}
              placeholder="Contoh: 2012"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700">
              Karya Ilmiah / Skripsi (Sinkron ke Direktori Publik GTK)
            </p>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="gtk-thesis-title"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Judul Skripsi / Karya Ilmiah
            </label>
            <input
              id="gtk-thesis-title"
              type="text"
              value={form.thesis_title}
              onChange={(e) => onFormChange({ ...form, thesis_title: e.target.value })}
              placeholder="Contoh: Pengembangan Media Simulasi Interaktif Berbasis Inkuiri Terbimbing..."
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="gtk-thesis-abstract"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Abstrak Skripsi
            </label>
            <textarea
              id="gtk-thesis-abstract"
              rows={4}
              value={form.thesis_abstract}
              onChange={(e) => onFormChange({ ...form, thesis_abstract: e.target.value })}
              placeholder="Ringkasan abstrak penelitian atau skripsi..."
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="gtk-thesis-keywords"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Kata Kunci Abstrak
            </label>
            <input
              id="gtk-thesis-keywords"
              type="text"
              value={form.thesis_keywords}
              onChange={(e) => onFormChange({ ...form, thesis_keywords: e.target.value })}
              placeholder="Pisahkan dengan koma, contoh: Simulasi Interaktif, Inkuiri Terbimbing, Fisika SMA"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Setiap kata kunci akan ditampilkan sebagai tag #KataKunci pada modal abstrak di
              halaman Direktori.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="gtk-thesis-article-url"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tautan Artikel Ilmiah / Skripsi (URL)
            </label>
            <input
              id="gtk-thesis-article-url"
              type="url"
              value={form.thesis_article_url}
              onChange={(e) => onFormChange({ ...form, thesis_article_url: e.target.value })}
              placeholder="https://repository.kampus.ac.id/..."
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Opsional. Jika diisi, tombol &ldquo;Buka Artikel Ilmiah&rdquo; pada modal abstrak di
              halaman Direktori akan membuka tautan ini.
            </p>
          </div>

          <div>
            <label
              htmlFor="gtk-join-date"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tanggal Bergabung
            </label>
            <input
              id="gtk-join-date"
              type="date"
              value={form.join_date}
              onChange={(e) => onFormChange({ ...form, join_date: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="gtk-profile"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Tautkan Akun Portal Aktif
            </label>
            <select
              id="gtk-profile"
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
              htmlFor="gtk-address"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Alamat
            </label>
            <textarea
              id="gtk-address"
              rows={2}
              value={form.address}
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-slate-700 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => onFormChange({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Status GTK Aktif</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.show_in_public_directory}
                onChange={(e) =>
                  onFormChange({ ...form, show_in_public_directory: e.target.checked })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Tampilkan di Direktori Publik</span>
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
