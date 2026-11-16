'use client';

import { useState, useEffect } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { IndonesianAddressFields } from '@/components/ppdb/address-fields';
import { PpdbRegistrationCard, RegistrationCardData } from '@/components/ppdb/registration-card';
import Link from 'next/link';
import {
  ArrowRightLeft,
  CalendarCheck,
  CheckCircle2,
  FileUp,
  AlertCircle,
  Loader2,
  ShieldAlert,
  X,
  Info,
  Search,
  UserPlus,
  Sparkles,
} from 'lucide-react';

interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
}

type DocType = 'KK' | 'AKTA_KELAHIRAN' | 'IJAZAH_SKL' | 'PAS_FOTO' | 'SERTIFIKAT_PRESTASI' | 'LAINNYA';

const MUTATION_REASON_GROUPS = [
  {
    label: '1) Perpindahan Tugas atau Domisili Orang Tua/Wali',
    options: [
      {
        value: 'Mutasi Kerja',
        label: 'Mutasi Kerja — Orang tua/wali dipindahtugaskan instansi pemerintah, TNI/Polri, BUMN, atau swasta ke kota/kabupaten lain',
      },
      {
        value: 'Pindah Tempat Tinggal',
        label: 'Pindah Tempat Tinggal — Keluarga berpindah domisili (ekonomi, rumah baru, atau perubahan kondisi keluarga)',
      },
    ],
  },
  {
    label: '2) Alasan Ekonomi dan Aksesibilitas',
    options: [
      {
        value: 'Keterbatasan Biaya',
        label: 'Keterbatasan Biaya — Pindah ke sekolah dengan biaya lebih terjangkau karena kondisi finansial keluarga',
      },
      {
        value: 'Jarak dan Transportasi',
        label: 'Jarak dan Transportasi — Lokasi sekolah asal terlalu jauh atau akses transportasi sulit',
      },
    ],
  },
  {
    label: '3) Kesesuaian Lingkungan dan Kondisi Psikologis Siswa',
    options: [
      {
        value: 'Kenyamanan dan Keamanan',
        label: 'Kenyamanan dan Keamanan — Ketidaknyamanan, perundungan (bullying), konflik interpersonal, atau adaptasi sosial',
      },
      {
        value: 'Pertimbangan Kesehatan',
        label: 'Pertimbangan Kesehatan — Kondisi fisik/mental mengharuskan bersekolah lebih dekat rumah atau fasilitas kesehatan',
      },
    ],
  },
  {
    label: '4) Alasan Akademik dan Minat Bakat',
    options: [
      {
        value: 'Perbedaan Kurikulum atau Program',
        label: 'Perbedaan Kurikulum atau Program — Mengikuti program khusus (akselerasi, bilingual, peminatan/jurusan)',
      },
      {
        value: 'Pindah Jalur Pendidikan',
        label: 'Pindah Jalur Pendidikan — Perpindahan antar-jalur sederajat (Madrasah <-> Sekolah Umum <-> Paket A/B/C)',
      },
    ],
  },
  {
    label: '5) Kepulangan dari Luar Negeri atau Pondok Pesantren',
    options: [
      {
        value: 'Kepulangan dari Luar Negeri',
        label: 'Kepulangan dari Luar Negeri — Mengikuti orang tua selesai bertugas/studi di luar negeri (perlu penyetaraan)',
      },
      {
        value: 'Keluar dari Pendidikan Berasrama',
        label: 'Keluar dari Pendidikan Berasrama — Berhenti dari boarding school / pondok pesantren ke sekolah reguler',
      },
    ],
  },
  {
    label: '6) Lainnya',
    options: [
      {
        value: 'Lainnya',
        label: 'Lainnya (tuliskan penjelasan alasan mutasi)',
      },
    ],
  },
];

const MUTATION_DOCS: { key: string; documentType: DocType; label: string; required: boolean }[] = [
  {
    key: 'surat_pindah',
    documentType: 'LAINNYA',
    label: 'Surat Keterangan Pindah / Mutasi dari Sekolah Asal',
    required: true,
  },
  {
    key: 'rapor',
    documentType: 'IJAZAH_SKL',
    label: 'Scan / Fotokopi Rapor Semester Terakhir yang Dilegalisir',
    required: true,
  },
  {
    key: 'kk',
    documentType: 'KK',
    label: 'Scan Kartu Keluarga (KK)',
    required: true,
  },
  {
    key: 'akta',
    documentType: 'AKTA_KELAHIRAN',
    label: 'Scan Akta Kelahiran Siswa',
    required: true,
  },
];

function isFinalGradeLevel(grade: string, allGrades: string[]): boolean {
  const normalized = grade.trim().toUpperCase();
  if (!normalized) return false;
  if (['VI', 'IX', 'XII', '6', '9', '12'].includes(normalized)) return true;
  if (/\b(VI|IX|XII|6|9|12)\b/.test(normalized)) return true;
  if (allGrades.length > 0 && allGrades[allGrades.length - 1]?.trim().toUpperCase() === normalized) {
    return true;
  }
  return false;
}

export default function PpdbMutasiPage() {
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
  const [gradeLevels, setGradeLevels] = useState<string[]>(['VII', 'VIII', 'IX']);
  const [loadingPeriod, setLoadingPeriod] = useState(true);

  const [fullName, setFullName] = useState('');
  const [nisn, setNisn] = useState('');
  const [nik, setNik] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [previousSchool, setPreviousSchool] = useState('');
  const [targetGrade, setTargetGrade] = useState('');
  const [mutationReason, setMutationReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const [fullAddress, setFullAddress] = useState('');
  const [addressComplete, setAddressComplete] = useState(false);

  const [docFiles, setDocFiles] = useState<
    Record<string, { documentType: DocType; label: string; fileName: string; fileData: string }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalGradeModalOpen, setFinalGradeModalOpen] = useState(false);
  const [submittedCard, setSubmittedCard] = useState<RegistrationCardData | null>(null);

  // State tab Cek Status & Kartu Bukti
  const [checkCode, setCheckCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkCard, setCheckCard] = useState<RegistrationCardData | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/ppdb?info=active')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setActivePeriod(data.period ?? null);
        if (Array.isArray(data.gradeLevels) && data.gradeLevels.length > 0) {
          setGradeLevels(data.gradeLevels);
        }
        setLoadingPeriod(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadingPeriod(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDigitsInput = (value: string, maxLen: number, setter: (v: string) => void) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, maxLen);
    setter(digitsOnly);
  };

  const handleFileChange = (key: string, documentType: DocType, label: string, file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg(`Ukuran file "${label}" maksimal 2 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocFiles((prev) => ({
        ...prev,
        [key]: {
          documentType,
          label,
          fileName: file.name,
          fileData: typeof reader.result === 'string' ? reader.result : '',
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetGrade) {
      setErrorMsg('Silakan pilih Kelas / Tingkat Tujuan terlebih dahulu.');
      return;
    }

    if (isFinalGradeLevel(targetGrade, gradeLevels)) {
      setFinalGradeModalOpen(true);
      return;
    }

    if (!/^\d{10}$/.test(nisn)) {
      setErrorMsg('NISN harus terdiri dari tepat 10 digit angka.');
      return;
    }
    if (!/^\d{16}$/.test(nik)) {
      setErrorMsg('NIK harus terdiri dari tepat 16 digit angka.');
      return;
    }
    if (!/^\d{12}$/.test(parentPhone)) {
      setErrorMsg('No. WhatsApp Orang Tua / Wali harus terdiri dari tepat 12 digit angka.');
      return;
    }
    if (!addressComplete || !fullAddress.trim()) {
      setErrorMsg('Mohon lengkapi seluruh field alamat (Provinsi, Kab/Kota, Kecamatan, Kelurahan/Desa, RT, RW, dan Alamat).');
      return;
    }
    if (!mutationReason) {
      setErrorMsg('Silakan pilih Alasan Mutasi / Pindah Sekolah.');
      return;
    }
    if (mutationReason === 'Lainnya' && !otherReason.trim()) {
      setErrorMsg('Mohon isi penjelasan alasan mutasi lainnya.');
      return;
    }

    const missingDocs = MUTATION_DOCS.filter((d) => d.required && !docFiles[d.key]);
    if (missingDocs.length > 0) {
      setErrorMsg(`Mohon unggah dokumen wajib: ${missingDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    const finalReason =
      mutationReason === 'Lainnya'
        ? `Lainnya: ${otherReason.trim()}`
        : mutationReason;

    setSubmitting(true);
    try {
      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          nisn,
          nik,
          gender,
          birthPlace: birthPlace.trim(),
          birthDate,
          previousSchool: previousSchool.trim(),
          address: fullAddress,
          parentName: parentName.trim(),
          parentPhone,
          pathway: 'MUTASI',
          targetGrade,
          mutationReason: finalReason,
          documents: Object.values(docFiles).map((d) => ({
            documentType: d.documentType,
            fileUrl: d.fileData,
            fileName: d.fileName,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal mengirim pengajuan mutasi masuk.');
        return;
      }

      setSubmittedCard({
        registrationNumber: data.registrationNumber,
        fullName: fullName.trim(),
        nisn,
        pathway: 'MUTASI',
        previousSchool: previousSchool.trim(),
        parentName: parentName.trim(),
        parentPhone,
        status: data.registration?.status || 'MENUNGGU_VERIFIKASI',
        createdAt: data.registration?.created_at || new Date().toISOString(),
        notes: `Kelas Tujuan: ${targetGrade} | Alasan: ${finalReason}`,
        documents: Object.values(docFiles).map((d) => ({ label: d.label, verified: false })),
      });
      setCheckCode(data.registrationNumber);
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat mengirim pengajuan.');
    } finally {
      setSubmitting(false);
    }
  };

  async function handleCheckStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checkCode.trim()) return;

    setChecking(true);
    setCheckError(null);
    setCheckCard(null);

    try {
      const res = await fetch(
        `/api/ppdb?code=${encodeURIComponent(checkCode.trim().toUpperCase())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || 'Nomor pendaftaran tidak ditemukan.');
      } else {
        const reg = data.registration;
        setCheckCard({
          registrationNumber: reg.registration_number,
          fullName: reg.full_name,
          nisn: reg.nisn,
          pathway: reg.pathway,
          previousSchool: reg.previous_school,
          parentName: reg.parent_name,
          parentPhone: reg.parent_phone,
          status: reg.status,
          createdAt: reg.created_at,
          notes: reg.admin_notes,
          documents: (reg.ppdb_documents || []).map(
            (d: { document_type: string; file_name: string | null; is_verified: boolean }) => ({
              label: d.file_name || d.document_type,
              verified: d.is_verified,
            })
          ),
        });
      }
    } catch {
      setCheckError('Gagal terhubung ke server.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
        <div className="glass-card rounded-3xl overflow-hidden">
          {/* Header Banner - Konsisten dengan PPDB Reguler */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-7 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-emerald-50 mb-2 border border-white/20">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Layanan Mutasi Masuk Siswa Pindahan
              </div>
              <h1 className="text-2xl font-bold">
                PPDB Khusus Mutasi Masuk
              </h1>
              <p className="text-emerald-100 text-sm mt-1">
                Lengkapi biodata siswa pindahan, alasan mutasi, &amp; berkas persyaratan, serta cetak Kartu Bukti Pendaftaran.
              </p>
            </div>
            <Link
              href="/ppdb"
              className="text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2 rounded-xl transition"
            >
              ← PPDB Reguler
            </Link>
          </div>

          {/* Tab Bar - Konsisten dengan PPDB Reguler */}
          <div className="border-b border-slate-200/80 flex bg-white/60 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('daftar')}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'daftar'
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Formulir Mutasi Masuk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cek')}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'cek'
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Status &amp; Kartu Bukti
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {!loadingPeriod && activePeriod && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 print:hidden">
                <span className="font-semibold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" />
                  Periode PPDB Aktif: {activePeriod.name}
                </span>
                <span>
                  {activePeriod.open_date} s/d {activePeriod.close_date}
                </span>
              </div>
            )}

            {!loadingPeriod && !activePeriod && activeTab === 'daftar' && (
              <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/80 text-teal-950 text-xs flex items-start gap-3 print:hidden">
                <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">
                    Layanan Mutasi Masuk Tetap Dibuka Sepanjang Tahun Ajaran
                  </p>
                  <p className="leading-relaxed text-teal-900">
                    Meskipun periode PPDB reguler sedang tidak aktif, pengajuan <strong>PPDB Khusus Mutasi Masuk</strong> tetap dapat diajukan kapan saja sesuai ketersediaan kuota rombongan belajar.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'daftar' ? (
              submittedCard ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                      <span>
                        <strong>Pengajuan Mutasi Berhasil!</strong> Berikut adalah Kartu Bukti Pendaftaran resmi Anda. Silakan cetak atau simpan sebagai PDF.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedCard(null);
                        setErrorMsg('');
                      }}
                      className="rounded-xl border border-emerald-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
                    >
                      Buat Pengajuan Baru
                    </button>
                  </div>
                  <PpdbRegistrationCard data={submittedCard} />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMsg && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Langkah 1: Biodata Siswa & Orang Tua */}
                  <div className="space-y-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        <Sparkles className="w-3.5 h-3.5" /> Bagian 1
                      </span>
                      <h2 className="text-base font-bold text-slate-900">
                        Biodata Calon Siswa Pindahan &amp; Orang Tua / Wali
                      </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Nama Lengkap Siswa <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Sesuai Akta Kelahiran / Rapor"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            NISN (10 Digit Angka) <span className="text-rose-600">*</span>
                          </label>
                          <span className={`text-[11px] font-mono ${nisn.length === 10 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                            {nisn.length}/10
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={10}
                          maxLength={10}
                          value={nisn}
                          onChange={(e) => handleDigitsInput(e.target.value, 10, setNisn)}
                          placeholder="10 digit angka NISN"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            NIK Siswa (16 Digit Angka) <span className="text-rose-600">*</span>
                          </label>
                          <span className={`text-[11px] font-mono ${nik.length === 16 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                            {nik.length}/16
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={16}
                          maxLength={16}
                          value={nik}
                          onChange={(e) => handleDigitsInput(e.target.value, 16, setNik)}
                          placeholder="16 digit angka NIK"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Jenis Kelamin <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        >
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Tempat Lahir <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={birthPlace}
                          onChange={(e) => setBirthPlace(e.target.value)}
                          placeholder="Kota/Kabupaten tempat lahir"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Tanggal Lahir <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Sekolah / Madrasah Asal <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={previousSchool}
                          onChange={(e) => setPreviousSchool(e.target.value)}
                          placeholder="Nama sekolah/madrasah asal"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Nama Orang Tua / Wali <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="Nama ayah / ibu / wali"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            No. WhatsApp Orang Tua / Wali (12 Digit Angka) <span className="text-rose-600">*</span>
                          </label>
                          <span className={`text-[11px] font-mono ${parentPhone.length === 12 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                            {parentPhone.length}/12
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={12}
                          maxLength={12}
                          value={parentPhone}
                          onChange={(e) => handleDigitsInput(e.target.value, 12, setParentPhone)}
                          placeholder="08xxxxxxxxxx (12 digit angka)"
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bagian 2: Informasi Kepindahan & Tujuan */}
                  <div className="border-t border-slate-200/80 pt-5 space-y-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Bagian 2
                      </span>
                      <h2 className="text-base font-bold text-slate-900">
                        Kelas Tujuan &amp; Alasan Mutasi Masuk
                      </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Kelas / Tingkat Tujuan <span className="text-rose-600">*</span>
                        </label>
                        <select
                          required
                          value={targetGrade}
                          onChange={(e) => setTargetGrade(e.target.value)}
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        >
                          <option value="">-- Pilih Kelas / Tingkat Tujuan --</option>
                          {gradeLevels.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              Kelas {lvl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Alasan Mutasi / Pindah Sekolah <span className="text-rose-600">*</span>
                        </label>
                        <select
                          required
                          value={mutationReason}
                          onChange={(e) => setMutationReason(e.target.value)}
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        >
                          <option value="">-- Pilih Alasan Mutasi --</option>
                          {MUTATION_REASON_GROUPS.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>

                    {mutationReason === 'Lainnya' && (
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Penjelasan Alasan Mutasi Lainnya <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={otherReason}
                          onChange={(e) => setOtherReason(e.target.value)}
                          placeholder="Jelaskan secara singkat alasan kepindahan siswa..."
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bagian 3: Alamat Emsifa API */}
                  <IndonesianAddressFields
                    onAddressChange={(addr, complete) => {
                      setFullAddress(addr);
                      setAddressComplete(complete);
                    }}
                  />

                  {/* Bagian 4: Dokumen Persyaratan Mutasi */}
                  <div className="border-t border-slate-200/80 pt-5 space-y-3">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-emerald-700" /> Dokumen Persyaratan Mutasi Masuk
                    </p>
                    <p className="text-xs text-slate-500">
                      Unggah scan/foto berkas asli dalam format PDF, JPG, atau PNG (maksimal 2 MB per berkas).
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {MUTATION_DOCS.map((doc) => {
                        const uploaded = docFiles[doc.key];
                        return (
                          <label
                            key={doc.key}
                            className={`modular-card rounded-2xl p-3.5 text-xs text-slate-600 block cursor-pointer transition ${
                              uploaded ? 'border-emerald-300 bg-emerald-50/40' : ''
                            }`}
                          >
                            <span className="font-semibold text-slate-800 block mb-1.5">
                              {doc.label} {doc.required && <span className="text-rose-600">*</span>}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) =>
                                handleFileChange(doc.key, doc.documentType, doc.label, e.target.files?.[0] || null)
                              }
                              className="w-full text-[11px]"
                            />
                            {uploaded && (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {uploaded.fileName}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition shadow-sm"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting
                      ? 'Menyimpan & Mengunggah Berkas...'
                      : 'Kirim Pengajuan Mutasi Masuk & Buat Kartu Bukti'}
                  </button>
                </form>
              )
            ) : (
              <div className="space-y-5">
                <form onSubmit={handleCheckStatus} className="flex gap-2 print:hidden">
                  <input
                    type="text"
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value)}
                    placeholder="Masukkan Nomor Pendaftaran (contoh: MUTASI-2026-12345)"
                    className="flex-1 rounded-xl border border-slate-300/90 bg-white px-4 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={checking}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                  >
                    {checking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Cek Status
                  </button>
                </form>

                {checkError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {checkError}
                  </div>
                )}

                {checkCard && <PpdbRegistrationCard data={checkCard} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tolak Mutasi Masuk Kelas Tingkat Terakhir */}
      {finalGradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setFinalGradeModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Mutasi Masuk Kelas Akhir Tidak Diperkenankan
            </h3>
            <div className="mt-2 space-y-2.5 text-sm text-slate-600 leading-relaxed">
              <p>
                Anda memilih <strong>Kelas {targetGrade}</strong> sebagai kelas/tingkat tujuan.
              </p>
              <p>
                Berdasarkan peraturan pendidikan dan ketentuan terbaru Kementerian Agama / Kemendikdasmen, madrasah/sekolah{' '}
                <strong>tidak dapat menerima mutasi masuk siswa pada kelas tingkat akhir</strong>.
              </p>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
                Ketentuan ini berlaku demi menjaga validitas data Dapodik/EMIS, pemenuhan syarat ketuntasan belajar, serta keabsahan peserta asesmen akhir dan penerbitan ijazah.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setFinalGradeModalOpen(false)}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                Mengerti, Ubah Pilihan
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
