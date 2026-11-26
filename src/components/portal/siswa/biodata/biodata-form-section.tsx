'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import Link from 'next/link';
import { Loader2, Save } from 'lucide-react';
import { StructuredAddressFields } from '@/components/sdm/structured-address-fields';
import {
  COUNT_OPTIONS_1_TO_12,
  digitsOnly,
  NIK_MAX,
  PHONE_MAX,
  RELIGION_OPTIONS,
} from '@/lib/validation/identity';
import type { BiodataFormState } from './types';

interface BiodataFormSectionProps {
  studentId: string | null;
  biodata: BiodataFormState;
  setBiodata: Dispatch<SetStateAction<BiodataFormState>>;
  canManage: boolean;
  isOfficialEditor: boolean;
  savingBiodata: boolean;
  refreshing: boolean;
  isCustomChildOrder: boolean;
  setIsCustomChildOrder: Dispatch<SetStateAction<boolean>>;
  isCustomSiblingsCount: boolean;
  setIsCustomSiblingsCount: Dispatch<SetStateAction<boolean>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const INPUT_CLASS =
  'w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';
const LOCKED_INPUT_CLASS =
  'w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 text-xs cursor-not-allowed';

export function BiodataFormSection({
  studentId,
  biodata,
  setBiodata,
  canManage,
  isOfficialEditor,
  savingBiodata,
  refreshing,
  isCustomChildOrder,
  setIsCustomChildOrder,
  isCustomSiblingsCount,
  setIsCustomSiblingsCount,
  onSubmit,
}: BiodataFormSectionProps) {
  const updateField = <K extends keyof BiodataFormState>(
    field: K,
    value: BiodataFormState[K]
  ) => {
    setBiodata((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
      {/* Navigasi Lompat Bagian Form (Membantu di Layar Mobile & Desktop) */}
      <nav
        aria-label="Bagian formulir biodata"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
      >
        {[
          { href: '#sec-identitas', label: '1. Identitas Pribadi' },
          { href: '#sec-alamat', label: '2. Alamat & Asal Sekolah' },
          { href: '#sec-bansos', label: '3. Kartu Bantuan' },
          { href: '#sec-ortu', label: '4. Orang Tua & Wali' },
        ].map((navItem) => (
          <a
            key={navItem.href}
            href={navItem.href}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition"
          >
            {navItem.label}
          </a>
        ))}
      </nav>

      <fieldset disabled={!canManage} className="space-y-5 sm:space-y-6">
        {/* Bagian 1: Identitas Pribadi Siswa */}
        <section
          id="sec-identitas"
          className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 scroll-mt-24"
        >
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            1. Identitas Pribadi Siswa
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2 lg:col-span-1 min-w-0">
              <label
                htmlFor="bio-full-name"
                className="block font-semibold text-slate-600 mb-1"
              >
                Nama Lengkap *{' '}
                {!isOfficialEditor && (
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                )}
              </label>
              <input
                id="bio-full-name"
                required
                value={biodata.full_name}
                disabled={!isOfficialEditor}
                onChange={(e) => updateField('full_name', e.target.value)}
                title={
                  !isOfficialEditor
                    ? 'Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin'
                    : undefined
                }
                className={!isOfficialEditor ? LOCKED_INPUT_CLASS : INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-nis" className="block font-semibold text-slate-600 mb-1">
                NIS{' '}
                {!isOfficialEditor && (
                  <span className="text-[10px] text-slate-400">(Terkunci)</span>
                )}
              </label>
              <input
                id="bio-nis"
                value={biodata.nis}
                disabled={!isOfficialEditor}
                onChange={(e) => updateField('nis', e.target.value)}
                title={!isOfficialEditor ? 'NIS hanya dapat diubah oleh Admin/TU' : undefined}
                className={!isOfficialEditor ? LOCKED_INPUT_CLASS : INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-nisn" className="block font-semibold text-slate-600 mb-1">
                NISN{' '}
                {!isOfficialEditor && (
                  <span className="text-[10px] text-slate-400">(Terkunci)</span>
                )}
              </label>
              <input
                id="bio-nisn"
                value={biodata.nisn}
                disabled={!isOfficialEditor}
                onChange={(e) => updateField('nisn', e.target.value)}
                title={!isOfficialEditor ? 'NISN hanya dapat diubah oleh Admin/TU' : undefined}
                className={!isOfficialEditor ? LOCKED_INPUT_CLASS : INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-nik" className="block font-semibold text-slate-600 mb-1">
                NIK Siswa
              </label>
              <input
                id="bio-nik"
                inputMode="numeric"
                value={biodata.nik}
                maxLength={NIK_MAX}
                onChange={(e) => updateField('nik', digitsOnly(e.target.value, NIK_MAX))}
                placeholder="16 digit angka"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-kk" className="block font-semibold text-slate-600 mb-1">
                Nomor KK
              </label>
              <input
                id="bio-kk"
                inputMode="numeric"
                value={biodata.kk_number}
                maxLength={NIK_MAX}
                onChange={(e) => updateField('kk_number', digitsOnly(e.target.value, NIK_MAX))}
                placeholder="16 digit angka"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-akta" className="block font-semibold text-slate-600 mb-1">
                No. Akta Kelahiran
              </label>
              <input
                id="bio-akta"
                value={biodata.birth_certificate_number}
                onChange={(e) => updateField('birth_certificate_number', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-gender" className="block font-semibold text-slate-600 mb-1">
                Jenis Kelamin
              </label>
              <select
                id="bio-gender"
                value={biodata.gender}
                onChange={(e) => updateField('gender', e.target.value as 'L' | 'P')}
                className={INPUT_CLASS}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-birth-place" className="block font-semibold text-slate-600 mb-1">
                Tempat Lahir
              </label>
              <input
                id="bio-birth-place"
                value={biodata.birth_place}
                onChange={(e) => updateField('birth_place', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-birth-date" className="block font-semibold text-slate-600 mb-1">
                Tanggal Lahir
              </label>
              <input
                id="bio-birth-date"
                type="date"
                value={biodata.birth_date}
                onChange={(e) => updateField('birth_date', e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-religion" className="block font-semibold text-slate-600 mb-1">
                Agama
              </label>
              <select
                id="bio-religion"
                value={biodata.religion || 'Islam'}
                onChange={(e) => updateField('religion', e.target.value)}
                className={INPUT_CLASS}
              >
                {RELIGION_OPTIONS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-child-order" className="block font-semibold text-slate-600 mb-1">
                Anak Ke-
              </label>
              <select
                id="bio-child-order"
                value={isCustomChildOrder ? 'OTHER' : biodata.child_order || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'OTHER') {
                    setIsCustomChildOrder(true);
                    if (COUNT_OPTIONS_1_TO_12.includes(biodata.child_order)) {
                      updateField('child_order', '');
                    }
                  } else {
                    setIsCustomChildOrder(false);
                    updateField('child_order', v);
                  }
                }}
                className={INPUT_CLASS}
              >
                <option value="">-- Pilih --</option>
                {COUNT_OPTIONS_1_TO_12.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="OTHER">Lainnya...</option>
              </select>
              {isCustomChildOrder && (
                <div className="mt-1.5">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    aria-label="Urutan anak kustom"
                    placeholder="Masukkan urutan anak..."
                    value={biodata.child_order}
                    onChange={(e) => updateField('child_order', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label
                htmlFor="bio-siblings-count"
                className="block font-semibold text-slate-600 mb-1"
              >
                Jumlah Saudara
              </label>
              <select
                id="bio-siblings-count"
                value={isCustomSiblingsCount ? 'OTHER' : biodata.siblings_count || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'OTHER') {
                    setIsCustomSiblingsCount(true);
                    if (COUNT_OPTIONS_1_TO_12.includes(biodata.siblings_count)) {
                      updateField('siblings_count', '');
                    }
                  } else {
                    setIsCustomSiblingsCount(false);
                    updateField('siblings_count', v);
                  }
                }}
                className={INPUT_CLASS}
              >
                <option value="">-- Pilih --</option>
                {COUNT_OPTIONS_1_TO_12.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="OTHER">Lainnya...</option>
              </select>
              {isCustomSiblingsCount && (
                <div className="mt-1.5">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    aria-label="Jumlah saudara kustom"
                    placeholder="Masukkan jumlah saudara..."
                    value={biodata.siblings_count}
                    onChange={(e) => updateField('siblings_count', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Jumlah Saudara tersebut juga termasuk anda.
              </p>
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-phone" className="block font-semibold text-slate-600 mb-1">
                No. HP / WhatsApp{' '}
                {!isOfficialEditor && (
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                )}
              </label>
              <input
                id="bio-phone"
                inputMode="tel"
                value={biodata.phone}
                disabled={!isOfficialEditor}
                maxLength={PHONE_MAX}
                onChange={(e) => updateField('phone', digitsOnly(e.target.value, PHONE_MAX))}
                title={
                  !isOfficialEditor
                    ? 'No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil'
                    : undefined
                }
                className={!isOfficialEditor ? LOCKED_INPUT_CLASS : INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-email" className="block font-semibold text-slate-600 mb-1">
                Email{' '}
                {!isOfficialEditor && (
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                )}
              </label>
              <input
                id="bio-email"
                type="email"
                value={biodata.email}
                disabled={!isOfficialEditor}
                onChange={(e) => updateField('email', e.target.value)}
                title={
                  !isOfficialEditor
                    ? 'Email hanya dapat diubah melalui Halaman Profil'
                    : undefined
                }
                className={!isOfficialEditor ? LOCKED_INPUT_CLASS : INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Bagian 2: Alamat Tempat Tinggal & Asal Sekolah */}
        <section
          id="sec-alamat"
          className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 scroll-mt-24"
        >
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            2. Alamat Tempat Tinggal &amp; Asal Sekolah
          </h2>
          <StructuredAddressFields
            key={studentId || 'no-student'}
            title="Alamat Domisili Siswa"
            value={{
              province: biodata.province,
              city: biodata.city,
              district: biodata.district,
              village: biodata.village,
              rt_rw: biodata.rt_rw,
              address: biodata.address,
            }}
            onChange={(addr) =>
              setBiodata((prev) => ({
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="min-w-0">
              <label htmlFor="bio-postal" className="block font-semibold text-slate-600 mb-1">
                Kode Pos
              </label>
              <input
                id="bio-postal"
                inputMode="numeric"
                maxLength={5}
                placeholder="5 digit angka"
                value={biodata.postal_code}
                onChange={(e) => updateField('postal_code', digitsOnly(e.target.value, 5))}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label htmlFor="bio-prev-school" className="block font-semibold text-slate-600 mb-1">
                Asal Sekolah (MI / SD / RA / TK)
              </label>
              <input
                id="bio-prev-school"
                value={biodata.previous_school}
                onChange={(e) => updateField('previous_school', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-prev-npsn" className="block font-semibold text-slate-600 mb-1">
                NPSN Asal Sekolah
              </label>
              <input
                id="bio-prev-npsn"
                inputMode="numeric"
                maxLength={8}
                placeholder="8 digit angka"
                value={biodata.previous_school_npsn}
                onChange={(e) =>
                  updateField('previous_school_npsn', digitsOnly(e.target.value, 8))
                }
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        </section>

        {/* Bagian 3: Nomor Kartu Bantuan Sosial / Kesehatan */}
        <section
          id="sec-bansos"
          className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 scroll-mt-24"
        >
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            3. Nomor Kartu Bantuan Sosial / Kesehatan (Opsional)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="min-w-0">
              <label htmlFor="bio-kip" className="block font-semibold text-slate-600 mb-1">
                Nomor KIP
              </label>
              <input
                id="bio-kip"
                value={biodata.kip_number}
                onChange={(e) => updateField('kip_number', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-kis" className="block font-semibold text-slate-600 mb-1">
                Nomor BPJS / KIS
              </label>
              <input
                id="bio-kis"
                value={biodata.kis_number}
                onChange={(e) => updateField('kis_number', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-kks" className="block font-semibold text-slate-600 mb-1">
                Nomor KKS
              </label>
              <input
                id="bio-kks"
                value={biodata.kks_number}
                onChange={(e) => updateField('kks_number', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-pkh" className="block font-semibold text-slate-600 mb-1">
                Nomor PKH
              </label>
              <input
                id="bio-pkh"
                value={biodata.pkh_number}
                onChange={(e) => updateField('pkh_number', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Bagian 4: Data Orang Tua & Wali */}
        <section
          id="sec-ortu"
          className="glass-card rounded-3xl p-4 sm:p-6 space-y-4 scroll-mt-24"
        >
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            4. Data Orang Tua &amp; Wali
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="min-w-0">
              <label htmlFor="bio-father-name" className="block font-semibold text-slate-600 mb-1">
                Nama Ayah
              </label>
              <input
                id="bio-father-name"
                value={biodata.father_name}
                onChange={(e) => updateField('father_name', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-father-nik" className="block font-semibold text-slate-600 mb-1">
                NIK Ayah
              </label>
              <input
                id="bio-father-nik"
                inputMode="numeric"
                value={biodata.father_nik}
                maxLength={NIK_MAX}
                onChange={(e) => updateField('father_nik', digitsOnly(e.target.value, NIK_MAX))}
                placeholder="16 digit angka"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-father-job" className="block font-semibold text-slate-600 mb-1">
                Pekerjaan Ayah
              </label>
              <input
                id="bio-father-job"
                value={biodata.father_job}
                onChange={(e) => updateField('father_job', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-father-phone" className="block font-semibold text-slate-600 mb-1">
                No. HP Ayah
              </label>
              <input
                id="bio-father-phone"
                inputMode="tel"
                value={biodata.father_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  updateField('father_phone', digitsOnly(e.target.value, PHONE_MAX))
                }
                placeholder="Maks. 12 digit"
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-mother-name" className="block font-semibold text-slate-600 mb-1">
                Nama Ibu
              </label>
              <input
                id="bio-mother-name"
                value={biodata.mother_name}
                onChange={(e) => updateField('mother_name', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-mother-nik" className="block font-semibold text-slate-600 mb-1">
                NIK Ibu
              </label>
              <input
                id="bio-mother-nik"
                inputMode="numeric"
                value={biodata.mother_nik}
                maxLength={NIK_MAX}
                onChange={(e) => updateField('mother_nik', digitsOnly(e.target.value, NIK_MAX))}
                placeholder="16 digit angka"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-mother-job" className="block font-semibold text-slate-600 mb-1">
                Pekerjaan Ibu
              </label>
              <input
                id="bio-mother-job"
                value={biodata.mother_job}
                onChange={(e) => updateField('mother_job', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-mother-phone" className="block font-semibold text-slate-600 mb-1">
                No. HP Ibu
              </label>
              <input
                id="bio-mother-phone"
                inputMode="tel"
                value={biodata.mother_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  updateField('mother_phone', digitsOnly(e.target.value, PHONE_MAX))
                }
                placeholder="Maks. 12 digit"
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="bio-guardian-name" className="block font-semibold text-slate-600 mb-1">
                Nama Wali
              </label>
              <input
                id="bio-guardian-name"
                value={biodata.guardian_name}
                onChange={(e) => updateField('guardian_name', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-guardian-nik" className="block font-semibold text-slate-600 mb-1">
                NIK Wali
              </label>
              <input
                id="bio-guardian-nik"
                inputMode="numeric"
                value={biodata.guardian_nik}
                maxLength={NIK_MAX}
                onChange={(e) => updateField('guardian_nik', digitsOnly(e.target.value, NIK_MAX))}
                placeholder="16 digit angka"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="bio-guardian-job" className="block font-semibold text-slate-600 mb-1">
                Pekerjaan Wali
              </label>
              <input
                id="bio-guardian-job"
                value={biodata.guardian_job}
                onChange={(e) => updateField('guardian_job', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="bio-guardian-phone"
                className="block font-semibold text-slate-600 mb-1"
              >
                No. HP Wali
              </label>
              <input
                id="bio-guardian-phone"
                inputMode="tel"
                value={biodata.guardian_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  updateField('guardian_phone', digitsOnly(e.target.value, PHONE_MAX))
                }
                placeholder="Maks. 12 digit"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>
      </fieldset>

      {canManage && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingBiodata || refreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
          >
            {savingBiodata ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{savingBiodata ? 'Menyimpan Biodata...' : 'Simpan Biodata Lengkap'}</span>
          </button>
        </div>
      )}
    </form>
  );
}
