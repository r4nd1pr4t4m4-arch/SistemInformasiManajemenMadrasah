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

export function BiodataFormSection({
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
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset disabled={!canManage} className="space-y-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            1. Identitas Pribadi Siswa
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block font-semibold text-slate-600 mb-1">
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
                required
                value={biodata.full_name}
                disabled={!isOfficialEditor}
                onChange={(e) => setBiodata({ ...biodata, full_name: e.target.value })}
                title={
                  !isOfficialEditor
                    ? 'Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin'
                    : undefined
                }
                className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                  !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                NIS {!isOfficialEditor && <span className="text-[10px] text-slate-400">(Terkunci)</span>}
              </label>
              <input
                value={biodata.nis}
                disabled={!isOfficialEditor}
                onChange={(e) => setBiodata({ ...biodata, nis: e.target.value })}
                title={!isOfficialEditor ? 'NIS hanya dapat diubah oleh Admin/TU' : undefined}
                className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                  !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                NISN {!isOfficialEditor && <span className="text-[10px] text-slate-400">(Terkunci)</span>}
              </label>
              <input
                value={biodata.nisn}
                disabled={!isOfficialEditor}
                onChange={(e) => setBiodata({ ...biodata, nisn: e.target.value })}
                title={!isOfficialEditor ? 'NISN hanya dapat diubah oleh Admin/TU' : undefined}
                className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                  !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">NIK Siswa</label>
              <input
                value={biodata.nik}
                maxLength={NIK_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, nik: digitsOnly(e.target.value, NIK_MAX) })
                }
                placeholder="16 digit angka"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor KK</label>
              <input
                value={biodata.kk_number}
                maxLength={NIK_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, kk_number: digitsOnly(e.target.value, NIK_MAX) })
                }
                placeholder="16 digit angka"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">No. Akta Kelahiran</label>
              <input
                value={biodata.birth_certificate_number}
                onChange={(e) =>
                  setBiodata({ ...biodata, birth_certificate_number: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
              <select
                value={biodata.gender}
                onChange={(e) => setBiodata({ ...biodata, gender: e.target.value as 'L' | 'P' })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Tempat Lahir</label>
              <input
                value={biodata.birth_place}
                onChange={(e) => setBiodata({ ...biodata, birth_place: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Tanggal Lahir</label>
              <input
                type="date"
                value={biodata.birth_date}
                onChange={(e) => setBiodata({ ...biodata, birth_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Agama</label>
              <select
                value={biodata.religion || 'Islam'}
                onChange={(e) => setBiodata({ ...biodata, religion: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                {RELIGION_OPTIONS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Anak Ke-</label>
              <select
                value={isCustomChildOrder ? 'OTHER' : (biodata.child_order || '')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'OTHER') {
                    setIsCustomChildOrder(true);
                    if (COUNT_OPTIONS_1_TO_12.includes(biodata.child_order)) {
                      setBiodata({ ...biodata, child_order: '' });
                    }
                  } else {
                    setIsCustomChildOrder(false);
                    setBiodata({ ...biodata, child_order: v });
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                    placeholder="Masukkan urutan anak..."
                    value={biodata.child_order}
                    onChange={(e) => setBiodata({ ...biodata, child_order: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Jumlah Saudara</label>
              <select
                value={isCustomSiblingsCount ? 'OTHER' : (biodata.siblings_count || '')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'OTHER') {
                    setIsCustomSiblingsCount(true);
                    if (COUNT_OPTIONS_1_TO_12.includes(biodata.siblings_count)) {
                      setBiodata({ ...biodata, siblings_count: '' });
                    }
                  } else {
                    setIsCustomSiblingsCount(false);
                    setBiodata({ ...biodata, siblings_count: v });
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                    placeholder="Masukkan jumlah saudara..."
                    value={biodata.siblings_count}
                    onChange={(e) => setBiodata({ ...biodata, siblings_count: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Jumlah Saudara tersebut juga termasuk anda.
              </p>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
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
                value={biodata.phone}
                disabled={!isOfficialEditor}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, phone: digitsOnly(e.target.value, PHONE_MAX) })
                }
                title={
                  !isOfficialEditor
                    ? 'No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil'
                    : undefined
                }
                className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                  !isOfficialEditor
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    : 'bg-white'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
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
                type="email"
                value={biodata.email}
                disabled={!isOfficialEditor}
                onChange={(e) => setBiodata({ ...biodata, email: e.target.value })}
                title={
                  !isOfficialEditor
                    ? 'Email hanya dapat diubah melalui Halaman Profil'
                    : undefined
                }
                className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                  !isOfficialEditor
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    : 'bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            2. Alamat Tempat Tinggal &amp; Asal Sekolah
          </h2>
          <StructuredAddressFields
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
              setBiodata({
                ...biodata,
                province: addr.province,
                city: addr.city,
                district: addr.district,
                village: addr.village,
                rt_rw: addr.rt_rw,
                address: addr.address,
              })
            }
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kode Pos</label>
              <input
                value={biodata.postal_code}
                onChange={(e) => setBiodata({ ...biodata, postal_code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-600 mb-1">
                Asal Sekolah (MI / SD / RA / TK)
              </label>
              <input
                value={biodata.previous_school}
                onChange={(e) => setBiodata({ ...biodata, previous_school: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">NPSN Asal Sekolah</label>
              <input
                value={biodata.previous_school_npsn}
                onChange={(e) =>
                  setBiodata({ ...biodata, previous_school_npsn: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            3. Nomor Kartu Bantuan Sosial / Kesehatan (Opsional)
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor KIP</label>
              <input
                value={biodata.kip_number}
                onChange={(e) => setBiodata({ ...biodata, kip_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor BPJS / KIS</label>
              <input
                value={biodata.kis_number}
                onChange={(e) => setBiodata({ ...biodata, kis_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor KKS</label>
              <input
                value={biodata.kks_number}
                onChange={(e) => setBiodata({ ...biodata, kks_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor PKH</label>
              <input
                value={biodata.pkh_number}
                onChange={(e) => setBiodata({ ...biodata, pkh_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            4. Data Orang Tua &amp; Wali
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nama Ayah</label>
              <input
                value={biodata.father_name}
                onChange={(e) => setBiodata({ ...biodata, father_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">NIK Ayah</label>
              <input
                value={biodata.father_nik}
                maxLength={NIK_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, father_nik: digitsOnly(e.target.value, NIK_MAX) })
                }
                placeholder="16 digit angka"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Ayah</label>
              <input
                value={biodata.father_job}
                onChange={(e) => setBiodata({ ...biodata, father_job: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">No. HP Ayah</label>
              <input
                value={biodata.father_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, father_phone: digitsOnly(e.target.value, PHONE_MAX) })
                }
                placeholder="Maks. 12 digit"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nama Ibu</label>
              <input
                value={biodata.mother_name}
                onChange={(e) => setBiodata({ ...biodata, mother_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">NIK Ibu</label>
              <input
                value={biodata.mother_nik}
                maxLength={NIK_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, mother_nik: digitsOnly(e.target.value, NIK_MAX) })
                }
                placeholder="16 digit angka"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Ibu</label>
              <input
                value={biodata.mother_job}
                onChange={(e) => setBiodata({ ...biodata, mother_job: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">No. HP Ibu</label>
              <input
                value={biodata.mother_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, mother_phone: digitsOnly(e.target.value, PHONE_MAX) })
                }
                placeholder="Maks. 12 digit"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nama Wali</label>
              <input
                value={biodata.guardian_name}
                onChange={(e) => setBiodata({ ...biodata, guardian_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">NIK Wali</label>
              <input
                value={biodata.guardian_nik}
                maxLength={NIK_MAX}
                onChange={(e) =>
                  setBiodata({ ...biodata, guardian_nik: digitsOnly(e.target.value, NIK_MAX) })
                }
                placeholder="16 digit angka"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Wali</label>
              <input
                value={biodata.guardian_job}
                onChange={(e) => setBiodata({ ...biodata, guardian_job: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">No. HP Wali</label>
              <input
                value={biodata.guardian_phone}
                maxLength={PHONE_MAX}
                onChange={(e) =>
                  setBiodata({
                    ...biodata,
                    guardian_phone: digitsOnly(e.target.value, PHONE_MAX),
                  })
                }
                placeholder="Maks. 12 digit"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      </fieldset>

      {canManage && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingBiodata || refreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {savingBiodata ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingBiodata ? 'Menyimpan Biodata...' : 'Simpan Biodata Lengkap'}
          </button>
        </div>
      )}
    </form>
  );
}
