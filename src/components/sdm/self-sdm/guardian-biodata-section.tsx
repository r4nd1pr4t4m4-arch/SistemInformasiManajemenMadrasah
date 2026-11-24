'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import Link from 'next/link';
import { Loader2, Save, Users } from 'lucide-react';
import { StructuredAddressFields } from '@/components/sdm/structured-address-fields';
import { digitsOnly, NIK_MAX } from '@/lib/validation/identity';
import type { GuardianFormState, GuardianSelfPayload } from './types';

interface GuardianBiodataSectionProps {
  guardians: GuardianSelfPayload[];
  guardianForms: Record<string, GuardianFormState>;
  setGuardianForms: Dispatch<SetStateAction<Record<string, GuardianFormState>>>;
  savingGuardianId: string | null;
  onSubmit: (e: FormEvent, guardianId: string) => void;
}

export function GuardianBiodataSection({
  guardians,
  guardianForms,
  setGuardianForms,
  savingGuardianId,
  onSubmit,
}: GuardianBiodataSectionProps) {
  return (
    <>
      {guardians.map((g) => {
        const gForm = guardianForms[g.id];
        if (!gForm) return null;
        const nikInvalid = gForm.nik.length > 0 && gForm.nik.length !== NIK_MAX;

        return (
          <div
            key={g.id}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Biodata Orang Tua / Wali</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words">
                  Siswa Terkait:{' '}
                  <strong className="text-slate-800">{g.student?.full_name || '-'}</strong>{' '}
                  {g.student?.nis ? `(NIS: ${g.student.nis})` : ''}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                {g.relationship || 'WALI'} {g.is_primary ? '• Wali Utama' : ''}
              </span>
            </div>

            <form onSubmit={(e) => onSubmit(e, g.id)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="min-w-0">
                  <label
                    htmlFor={`guardian-name-${g.id}`}
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
                    id={`guardian-name-${g.id}`}
                    disabled
                    value={gForm.full_name}
                    title="Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`guardian-rel-${g.id}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Hubungan <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
                  </label>
                  <select
                    id={`guardian-rel-${g.id}`}
                    value={gForm.relationship}
                    disabled
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  >
                    <option value="AYAH">AYAH</option>
                    <option value="IBU">IBU</option>
                    <option value="WALI">WALI</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor={`guardian-nik-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600"
                    >
                      NIK
                    </label>
                    <span
                      className={`text-[10px] font-mono ${
                        nikInvalid
                          ? 'text-rose-600 font-semibold'
                          : gForm.nik.length === NIK_MAX
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                      }`}
                    >
                      {gForm.nik.length}/{NIK_MAX} digit
                    </span>
                  </div>
                  <input
                    id={`guardian-nik-${g.id}`}
                    inputMode="numeric"
                    value={gForm.nik}
                    maxLength={NIK_MAX}
                    onChange={(e) => {
                      const cleanNik = digitsOnly(e.target.value, NIK_MAX);
                      setGuardianForms((prev) => ({
                        ...prev,
                        [g.id]: {
                          ...(prev[g.id] || gForm),
                          nik: cleanNik,
                        },
                      }));
                    }}
                    placeholder="16 digit angka"
                    aria-invalid={nikInvalid}
                    className={`w-full min-h-[40px] rounded-xl border px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 ${
                      nikInvalid
                        ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500'
                        : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-600'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`guardian-job-${g.id}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Pekerjaan
                  </label>
                  <input
                    id={`guardian-job-${g.id}`}
                    value={gForm.occupation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGuardianForms((prev) => ({
                        ...prev,
                        [g.id]: { ...(prev[g.id] || gForm), occupation: val },
                      }));
                    }}
                    placeholder="cth: Wiraswasta / Guru / PNS"
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`guardian-phone-${g.id}`}
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
                    id={`guardian-phone-${g.id}`}
                    value={gForm.phone}
                    disabled
                    title="No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`guardian-email-${g.id}`}
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
                    id={`guardian-email-${g.id}`}
                    type="email"
                    value={gForm.email}
                    disabled
                    title="Email hanya dapat diubah melalui Halaman Profil"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 min-w-0">
                  <StructuredAddressFields
                    title="Alamat Domisili Orang Tua / Wali"
                    value={{
                      province: gForm.province,
                      city: gForm.city,
                      district: gForm.district,
                      village: gForm.village,
                      rt_rw: gForm.rt_rw,
                      address: gForm.address,
                    }}
                    onChange={(addr) =>
                      setGuardianForms((prev) => ({
                        ...prev,
                        [g.id]: {
                          ...(prev[g.id] || gForm),
                          province: addr.province,
                          city: addr.city,
                          district: addr.district,
                          village: addr.village,
                          rt_rw: addr.rt_rw,
                          address: addr.address,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingGuardianId === g.id || nikInvalid}
                  className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition shadow-xs"
                >
                  {savingGuardianId === g.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Biodata Orang Tua/Wali
                </button>
              </div>
            </form>
          </div>
        );
      })}
    </>
  );
}
