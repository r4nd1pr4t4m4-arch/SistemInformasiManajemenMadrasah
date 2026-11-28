'use client';

import { useMemo, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import Link from 'next/link';
import { Briefcase, Loader2, Save, User } from 'lucide-react';
import { StructuredAddressFields } from '@/components/sdm/structured-address-fields';
import { FieldReviewControl } from '@/components/sdm/biodata-reviews/field-review-control';
import {
  buildReviewMap,
  getReviewBorderClass,
  reviewMapKey,
  type BiodataReviewItem,
} from '@/components/sdm/biodata-reviews/types';
import { digitsOnly, NIK_MAX } from '@/lib/validation/identity';
import type { GtkFormState, GtkSelfPayload } from './types';

interface GtkBiodataSectionProps {
  gtkData: GtkSelfPayload;
  gtkForm: GtkFormState;
  setGtkForm: Dispatch<SetStateAction<GtkFormState>>;
  savingGtk: boolean;
  onSubmit: (e: FormEvent) => void;
  readOnly?: boolean;
  reviews?: BiodataReviewItem[];
  canReview?: boolean;
  onRefreshReviews?: () => Promise<void> | void;
  onReviewSaved?: (reviewId?: string) => void;
  onNotifyToast?: (type: 'ok' | 'err', text: string) => void;
}

export function GtkBiodataSection({
  gtkData,
  gtkForm,
  setGtkForm,
  savingGtk,
  onSubmit,
  readOnly = false,
  reviews = [],
  canReview = false,
  onRefreshReviews,
  onReviewSaved,
  onNotifyToast,
}: GtkBiodataSectionProps) {
  const teacherId = String(gtkData.teacher.id || '');
  const reviewMap = useMemo(() => buildReviewMap(reviews), [reviews]);
  const getFieldReview = (key: string) =>
    reviewMap.get(reviewMapKey('BIODATA_FIELD', key)) || null;
  const withReviewBorder = (key: string, base: string) =>
    `${base} ${getReviewBorderClass(getFieldReview(key))}`.trim();
  const renderReview = (key: string, currentValue?: string | null) => (
    <FieldReviewControl
      entityType="GTK"
      entityId={teacherId || null}
      targetKind="BIODATA_FIELD"
      targetKey={key}
      review={getFieldReview(key)}
      canReview={canReview}
      currentValue={currentValue ?? null}
      onChanged={() => onRefreshReviews?.()}
      onReviewSaved={onReviewSaved}
      onNotifyToast={onNotifyToast}
    />
  );

  const gtkNikInvalid = gtkForm.nik.length > 0 && gtkForm.nik.length !== NIK_MAX;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Biodata Pribadi &amp; Kepegawaian GTK</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Lengkapi atau perbarui data pribadi dan kepegawaian Anda.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
          {String(gtkData.teacher.staff_type || 'GTK')} •{' '}
          {String(gtkData.teacher.employment_status || '-')}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="min-w-0">
            <label
              htmlFor="gtk-full-name"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Nama Lengkap{' '}
              <Link
                href="/portal/akun/profil"
                className="text-[10px] text-emerald-700 hover:underline font-normal"
              >
                (Ubah di Halaman Profil)
              </Link>
            </label>
            <input
              id="gtk-full-name"
              disabled
              value={gtkForm.full_name}
              title="Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin"
              className={withReviewBorder(
                'full_name',
                'w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs'
              )}
            />
            {renderReview('full_name', gtkForm.full_name)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-nip"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              NIP <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
            </label>
            <input
              id="gtk-nip"
              value={gtkForm.nip}
              disabled
              className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
              placeholder="-"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-nuptk"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              NUPTK <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
            </label>
            <input
              id="gtk-nuptk"
              value={gtkForm.nuptk}
              disabled
              className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
              placeholder="-"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="gtk-nik" className="block text-[11px] font-semibold text-slate-600">
                NIK
              </label>
              <span
                className={`text-[10px] font-mono ${
                  gtkNikInvalid
                    ? 'text-rose-600 font-semibold'
                    : gtkForm.nik.length === NIK_MAX
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-400'
                }`}
              >
                {gtkForm.nik.length}/{NIK_MAX} digit
              </span>
            </div>
            <input
              id="gtk-nik"
              disabled={readOnly}
              inputMode="numeric"
              value={gtkForm.nik}
              maxLength={NIK_MAX}
              onChange={(e) => {
                const cleanNik = digitsOnly(e.target.value, NIK_MAX);
                setGtkForm((prev) => ({ ...prev, nik: cleanNik }));
              }}
              placeholder="16 digit angka"
              aria-invalid={gtkNikInvalid}
              className={withReviewBorder(
                'nik',
                `w-full min-h-[40px] rounded-xl border px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-600 ${
                  gtkNikInvalid
                    ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-600'
                }`
              )}
            />
            {renderReview('nik', gtkForm.nik)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-gender"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Jenis Kelamin
            </label>
            <select
              id="gtk-gender"
              disabled={readOnly}
              value={gtkForm.gender}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, gender: val }));
              }}
              className={withReviewBorder(
                'gender',
                'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
            {renderReview('gender', gtkForm.gender)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-birth-place"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tempat Lahir
            </label>
            <input
              id="gtk-birth-place"
              disabled={readOnly}
              value={gtkForm.birth_place}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, birth_place: val }));
              }}
              className={withReviewBorder(
                'birth_place',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('birth_place', gtkForm.birth_place)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-birth-date"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tanggal Lahir
            </label>
            <input
              id="gtk-birth-date"
              disabled={readOnly}
              type="date"
              value={gtkForm.birth_date}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, birth_date: val }));
              }}
              className={withReviewBorder(
                'birth_date',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('birth_date', gtkForm.birth_date)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-education-level"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Pendidikan Terakhir
            </label>
            <input
              id="gtk-education-level"
              disabled={readOnly}
              value={gtkForm.education_level}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, education_level: val }));
              }}
              placeholder="cth: S1 / S2"
              className={withReviewBorder(
                'education_level',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('education_level', gtkForm.education_level)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-major"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Jurusan / Program Studi
            </label>
            <input
              id="gtk-major"
              disabled={readOnly}
              value={gtkForm.major}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, major: val }));
              }}
              placeholder="cth: Pendidikan Matematika"
              className={withReviewBorder(
                'major',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('major', gtkForm.major)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-last-campus"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Nama Kampus Terakhir
            </label>
            <input
              id="gtk-last-campus"
              disabled={readOnly}
              value={gtkForm.last_campus}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, last_campus: val }));
              }}
              placeholder="cth: Universitas Negeri Malang"
              className={withReviewBorder(
                'last_campus',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('last_campus', gtkForm.last_campus)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-graduation-year"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tahun Lulus
            </label>
            <input
              id="gtk-graduation-year"
              disabled={readOnly}
              type="number"
              min={1950}
              max={2100}
              value={gtkForm.graduation_year}
              onChange={(e) => {
                const val = e.target.value;
                setGtkForm((prev) => ({ ...prev, graduation_year: val }));
              }}
              placeholder="cth: 2018"
              className={withReviewBorder(
                'graduation_year',
                'w-full min-h-[40px] rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
              )}
            />
            {renderReview('graduation_year', gtkForm.graduation_year)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-phone"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              No. HP / WhatsApp{' '}
              <Link
                href="/portal/akun/profil"
                className="text-[10px] text-emerald-700 hover:underline font-normal"
              >
                (Ubah di Halaman Profil)
              </Link>
            </label>
            <input
              id="gtk-phone"
              value={gtkForm.phone}
              disabled
              title="No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil"
              className={withReviewBorder(
                'phone',
                'w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs'
              )}
            />
            {renderReview('phone', gtkForm.phone)}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="gtk-email"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Email{' '}
              <Link
                href="/portal/akun/profil"
                className="text-[10px] text-emerald-700 hover:underline font-normal"
              >
                (Ubah di Halaman Profil)
              </Link>
            </label>
            <input
              id="gtk-email"
              type="email"
              value={gtkForm.email}
              disabled
              title="Email hanya dapat diubah melalui Halaman Profil"
              className={withReviewBorder(
                'email',
                'w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs'
              )}
            />
            {renderReview('email', gtkForm.email)}
          </div>
          <div className="sm:col-span-2 lg:col-span-3 min-w-0 p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Karya Ilmiah / Skripsi (Sinkron ke Direktori Publik GTK)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Data ini akan ditampilkan pada halaman{' '}
                  <Link
                    href="/direktori"
                    target="_blank"
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    /direktori
                  </Link>{' '}
                  bagian Direktori Guru &amp; Tenaga Kependidikan (GTK).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="lg:col-span-2 min-w-0">
                <label
                  htmlFor="gtk-thesis-title"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Judul Skripsi / Karya Ilmiah
                </label>
                <input
                  id="gtk-thesis-title"
                  disabled={readOnly}
                  type="text"
                  value={gtkForm.thesis_title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, thesis_title: val }));
                  }}
                  placeholder="cth: Pengembangan Media Simulasi Interaktif Berbasis Inkuiri Terbimbing..."
                  className={withReviewBorder(
                    'thesis_title',
                    'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
                  )}
                />
                {renderReview('thesis_title', gtkForm.thesis_title)}
              </div>
              <div className="lg:col-span-2 min-w-0">
                <label
                  htmlFor="gtk-thesis-abstract"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Abstrak Skripsi
                </label>
                <textarea
                  id="gtk-thesis-abstract"
                  disabled={readOnly}
                  rows={4}
                  value={gtkForm.thesis_abstract}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, thesis_abstract: val }));
                  }}
                  placeholder="Ringkasan abstrak penelitian atau skripsi..."
                  className={withReviewBorder(
                    'thesis_abstract',
                    'w-full rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
                  )}
                />
                {renderReview('thesis_abstract', gtkForm.thesis_abstract)}
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-thesis-keywords"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Kata Kunci Abstrak
                </label>
                <input
                  id="gtk-thesis-keywords"
                  disabled={readOnly}
                  type="text"
                  value={gtkForm.thesis_keywords}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, thesis_keywords: val }));
                  }}
                  placeholder="Pisahkan dengan koma, cth: Inkuiri, Literasi, Fisika"
                  className={withReviewBorder(
                    'thesis_keywords',
                    'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
                  )}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Ditampilkan sebagai tag #KataKunci pada modal abstrak di /direktori.
                </p>
                {renderReview('thesis_keywords', gtkForm.thesis_keywords)}
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-thesis-article-url"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  URL Artikel Ilmiah / Skripsi
                </label>
                <input
                  id="gtk-thesis-article-url"
                  disabled={readOnly}
                  type="url"
                  value={gtkForm.thesis_article_url}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, thesis_article_url: val }));
                  }}
                  placeholder="https://repository.kampus.ac.id/..."
                  className={withReviewBorder(
                    'thesis_article_url',
                    'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600'
                  )}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Opsional. Mengaktifkan tombol &ldquo;Buka Artikel Ilmiah&rdquo; di /direktori.
                </p>
                {renderReview('thesis_article_url', gtkForm.thesis_article_url)}
              </div>
            </div>
          </div>

          <div id="gtk-address-group" className="sm:col-span-2 lg:col-span-3 min-w-0 scroll-mt-24">
            <fieldset disabled={readOnly}>
              <StructuredAddressFields
                key={teacherId || 'gtk-addr'}
                title="Alamat Domisili GTK"
                value={{
                  province: gtkForm.province,
                  city: gtkForm.city,
                  district: gtkForm.district,
                  village: gtkForm.village,
                  rt_rw: gtkForm.rt_rw,
                  address: gtkForm.address,
                }}
                onChange={(addr) =>
                  setGtkForm((prev) => ({
                    ...prev,
                    province: addr.province,
                    city: addr.city,
                    district: addr.district,
                    village: addr.village,
                    rt_rw: addr.rt_rw,
                    address: addr.address,
                  }))
                }
              />
            </fieldset>
            {renderReview(
              'address_group',
              [gtkForm.address, gtkForm.rt_rw, gtkForm.village, gtkForm.district, gtkForm.city, gtkForm.province]
                .filter(Boolean)
                .join(', ')
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingGtk || gtkNikInvalid}
              className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition shadow-xs"
            >
              {savingGtk ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Simpan Biodata GTK
            </button>
          </div>
        )}
      </form>

      {(gtkData.additionalDuties.length > 0 || gtkData.employmentHistories.length > 0) && (
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Tugas Tambahan (
              {gtkData.additionalDuties.length})
            </p>
            <div className="space-y-1.5">
              {gtkData.additionalDuties.map((d) => {
                const dt = d.duty_type as { name?: string } | null;
                return (
                  <div
                    key={String(d.id)}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0"
                  >
                    <p className="font-semibold text-slate-900 break-words">
                      {dt?.name || '-'}
                    </p>
                    <p className="text-[11px] text-slate-500 break-words">
                      SK: {String(d.decree_number || '-')} • Mulai: {String(d.start_date || '-')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-700 mb-2">
              Riwayat Jabatan ({gtkData.employmentHistories.length})
            </p>
            <div className="space-y-1.5">
              {gtkData.employmentHistories.map((h) => (
                <div
                  key={String(h.id)}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0"
                >
                  <p className="font-semibold text-slate-900 break-words">
                    {String(h.position_title || '-')}
                  </p>
                  <p className="text-[11px] text-slate-500 break-words">
                    {String(h.unit_or_institution || '-')} • SK:{' '}
                    {String(h.decree_number || '-')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
