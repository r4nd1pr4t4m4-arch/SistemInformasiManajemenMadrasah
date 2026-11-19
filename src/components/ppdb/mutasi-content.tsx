'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarCheck,
  CheckCircle2,
  FileCheck2,
  FileUp,
  Loader2,
  Phone,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { IndonesianAddressFields } from '@/components/ppdb/address-fields';
import { PpdbRegistrationCard, RegistrationCardData } from '@/components/ppdb/registration-card';

interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
}

type DocType =
  | 'KK'
  | 'AKTA_KELAHIRAN'
  | 'IJAZAH_SKL'
  | 'PAS_FOTO'
  | 'SERTIFIKAT_PRESTASI'
  | 'LAINNYA';

interface MutasiDocItem {
  documentType: DocType;
  label: string;
  fileName: string;
  fileSize: number;
  fileData: string;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

const MUTATION_REASON_GROUPS = [
  {
    label: '1) Perpindahan Tugas atau Domisili Orang Tua/Wali',
    options: [
      {
        value: 'Mutasi Kerja',
        label:
          'Mutasi Kerja — Orang tua/wali dipindahtugaskan instansi pemerintah, TNI/Polri, BUMN, atau swasta ke kota/kabupaten lain',
      },
      {
        value: 'Pindah Tempat Tinggal',
        label:
          'Pindah Tempat Tinggal — Keluarga berpindah domisili (ekonomi, rumah baru, atau perubahan kondisi keluarga)',
      },
    ],
  },
  {
    label: '2) Alasan Ekonomi dan Aksesibilitas',
    options: [
      {
        value: 'Keterbatasan Biaya',
        label:
          'Keterbatasan Biaya — Pindah ke sekolah dengan biaya lebih terjangkau karena kondisi finansial keluarga',
      },
      {
        value: 'Jarak dan Transportasi',
        label:
          'Jarak dan Transportasi — Lokasi sekolah asal terlalu jauh atau akses transportasi sulit',
      },
    ],
  },
  {
    label: '3) Kesesuaian Lingkungan dan Kondisi Psikologis Siswa',
    options: [
      {
        value: 'Kenyamanan dan Keamanan',
        label:
          'Kenyamanan dan Keamanan — Ketidaknyamanan, perundungan (bullying), konflik interpersonal, atau adaptasi sosial',
      },
      {
        value: 'Pertimbangan Kesehatan',
        label:
          'Pertimbangan Kesehatan — Kondisi fisik/mental mengharuskan bersekolah lebih dekat rumah atau fasilitas kesehatan',
      },
    ],
  },
  {
    label: '4) Alasan Akademik dan Minat Bakat',
    options: [
      {
        value: 'Perbedaan Kurikulum atau Program',
        label:
          'Perbedaan Kurikulum atau Program — Mengikuti program khusus (akselerasi, bilingual, peminatan/jurusan)',
      },
      {
        value: 'Pindah Jalur Pendidikan',
        label:
          'Pindah Jalur Pendidikan — Perpindahan antar-jalur sederajat (Madrasah <-> Sekolah Umum <-> Paket A/B/C)',
      },
    ],
  },
  {
    label: '5) Kepulangan dari Luar Negeri atau Pondok Pesantren',
    options: [
      {
        value: 'Kepulangan dari Luar Negeri',
        label:
          'Kepulangan dari Luar Negeri — Mengikuti orang tua selesai bertugas/studi di luar negeri (perlu penyetaraan)',
      },
      {
        value: 'Keluar dari Pendidikan Berasrama',
        label:
          'Keluar dari Pendidikan Berasrama — Berhenti dari boarding school / pondok pesantren ke sekolah reguler',
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

function formatPeriodDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MutasiContent() {
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
  const [addressResetKey, setAddressResetKey] = useState(0);

  const [docFiles, setDocFiles] = useState<Record<string, MutasiDocItem>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalGradeModalOpen, setFinalGradeModalOpen] = useState(false);
  const [submittedCard, setSubmittedCard] = useState<RegistrationCardData | null>(null);

  const [checkCode, setCheckCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkCard, setCheckCard] = useState<RegistrationCardData | null>(null);

  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const todayIso = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/ppdb?info=active', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setActivePeriod(data.period ?? null);
        if (Array.isArray(data.gradeLevels) && data.gradeLevels.length > 0) {
          setGradeLevels(data.gradeLevels);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPeriod(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!finalGradeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFinalGradeModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finalGradeModalOpen]);

  const handleAddressChange = useCallback((addr: string, complete: boolean) => {
    setFullAddress(addr);
    setAddressComplete(complete);
  }, []);

  function showFormError(message: string) {
    setErrorMsg(message);
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const handleDigitsInput = (value: string, maxLen: number, setter: (v: string) => void) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, maxLen);
    setter(digitsOnly);
  };

  const handleFileChange = (
    key: string,
    documentType: DocType,
    label: string,
    file: File | null
  ) => {
    if (!file) return;

    const isValidType =
      (file.type && ALLOWED_MIME_TYPES.has(file.type)) || ALLOWED_EXTENSIONS.test(file.name);
    if (!isValidType) {
      showFormError(`Format berkas "${label}" harus berupa PDF, JPG, JPEG, atau PNG.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showFormError(
        `Ukuran berkas "${label}" (${formatFileSize(file.size)}) melebihi batas maksimal 2 MB.`
      );
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        showFormError(`Gagal membaca berkas "${label}". Silakan pilih ulang.`);
        return;
      }
      setDocFiles((prev) => ({
        ...prev,
        [key]: {
          documentType,
          label,
          fileName: file.name,
          fileSize: file.size,
          fileData: result,
        },
      }));
    };
    reader.onerror = () => {
      showFormError(`Gagal membaca berkas "${label}". Pastikan file tidak rusak.`);
    };
    reader.readAsDataURL(file);
  };

  function handleRemoveFile(key: string) {
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleResetForm() {
    setSubmittedCard(null);
    setErrorMsg('');
    setFullName('');
    setNisn('');
    setNik('');
    setGender('L');
    setBirthPlace('');
    setBirthDate('');
    setPreviousSchool('');
    setTargetGrade('');
    setMutationReason('');
    setOtherReason('');
    setParentName('');
    setParentPhone('');
    setFullAddress('');
    setAddressComplete(false);
    setAddressResetKey((k) => k + 1);
    setDocFiles({});
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedFullName = fullName.trim();
    const trimmedBirthPlace = birthPlace.trim();
    const trimmedPreviousSchool = previousSchool.trim();
    const trimmedParentName = parentName.trim();

    if (!targetGrade) {
      showFormError('Silakan pilih Kelas / Tingkat Tujuan terlebih dahulu.');
      return;
    }

    if (isFinalGradeLevel(targetGrade, gradeLevels)) {
      setFinalGradeModalOpen(true);
      return;
    }

    if (trimmedFullName.length < 2) {
      showFormError('Nama lengkap siswa minimal 2 karakter.');
      return;
    }
    if (!/^\d{10}$/.test(nisn)) {
      showFormError('NISN harus terdiri dari tepat 10 digit angka.');
      return;
    }
    if (!/^\d{16}$/.test(nik)) {
      showFormError('NIK harus terdiri dari tepat 16 digit angka.');
      return;
    }
    if (trimmedBirthPlace.length < 2) {
      showFormError('Tempat lahir minimal 2 karakter.');
      return;
    }
    if (!birthDate || birthDate > todayIso) {
      showFormError('Tanggal lahir tidak valid atau tidak boleh melebihi hari ini.');
      return;
    }
    if (trimmedPreviousSchool.length < 2) {
      showFormError('Sekolah / Madrasah asal minimal 2 karakter.');
      return;
    }
    if (trimmedParentName.length < 2) {
      showFormError('Nama orang tua / wali minimal 2 karakter.');
      return;
    }
    if (!/^\d{12}$/.test(parentPhone)) {
      showFormError('No. WhatsApp Orang Tua / Wali harus terdiri dari tepat 12 digit angka.');
      return;
    }
    if (!addressComplete || !fullAddress.trim()) {
      showFormError(
        'Mohon lengkapi seluruh field alamat (Provinsi, Kab/Kota, Kecamatan, Kelurahan/Desa, RT, RW, dan Alamat).'
      );
      return;
    }
    if (!mutationReason) {
      showFormError('Silakan pilih Alasan Mutasi / Pindah Sekolah.');
      return;
    }
    if (mutationReason === 'Lainnya' && !otherReason.trim()) {
      showFormError('Mohon isi penjelasan alasan mutasi lainnya.');
      return;
    }

    const missingDocs = MUTATION_DOCS.filter((d) => d.required && !docFiles[d.key]);
    if (missingDocs.length > 0) {
      showFormError(`Mohon unggah dokumen wajib: ${missingDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    const finalReason =
      mutationReason === 'Lainnya' ? `Lainnya: ${otherReason.trim()}` : mutationReason;

    setSubmitting(true);
    try {
      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: trimmedFullName,
          nisn,
          nik,
          gender,
          birthPlace: trimmedBirthPlace,
          birthDate,
          previousSchool: trimmedPreviousSchool,
          address: fullAddress,
          parentName: trimmedParentName,
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFormError(data.error || 'Gagal mengirim pengajuan mutasi masuk.');
        return;
      }

      setSubmittedCard({
        registrationNumber: data.registrationNumber,
        fullName: trimmedFullName,
        nisn,
        pathway: 'MUTASI',
        previousSchool: trimmedPreviousSchool,
        parentName: trimmedParentName,
        parentPhone,
        status: data.registration?.status || 'MENUNGGU_VERIFIKASI',
        createdAt: data.registration?.created_at || new Date().toISOString(),
        notes: `Kelas Tujuan: ${targetGrade} | Alasan: ${finalReason}`,
        documents: Object.values(docFiles).map((d) => ({ label: d.label, verified: false })),
      });
      setCheckCode(data.registrationNumber);
    } catch {
      showFormError('Terjadi kesalahan jaringan saat mengirim pengajuan.');
    } finally {
      setSubmitting(false);
    }
  };

  async function handleCheckStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedCode = checkCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckError('Masukkan nomor pendaftaran mutasi Anda terlebih dahulu.');
      setCheckCard(null);
      return;
    }

    setChecking(true);
    setCheckError(null);
    setCheckCard(null);

    try {
      const res = await fetch(`/api/ppdb?code=${encodeURIComponent(normalizedCode)}`);
      const data = await res.json().catch(() => ({}));
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
      setCheckError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setChecking(false);
    }
  }

  const isTargetFinalGrade = isFinalGradeLevel(targetGrade, gradeLevels);

  return (
    <>
      <div
        role="tablist"
        aria-label="Navigasi Halaman Mutasi Masuk"
        className="border-b border-slate-200/80 grid grid-cols-2 bg-white/60 print:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'daftar'}
          onClick={() => setActiveTab('daftar')}
          className={`min-h-[48px] px-3 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
            activeTab === 'daftar'
              ? 'border-emerald-700 text-emerald-700 bg-emerald-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60'
          }`}
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span className="truncate">Formulir Mutasi Masuk</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cek'}
          onClick={() => setActiveTab('cek')}
          className={`min-h-[48px] px-3 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
            activeTab === 'cek'
              ? 'border-emerald-700 text-emerald-700 bg-emerald-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate">Cek Status &amp; Kartu</span>
        </button>
      </div>

      <div className="p-4 sm:p-6 md:p-8 space-y-6">
        {!loadingPeriod && activePeriod && (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-emerald-900 print:hidden">
            <span className="font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Periode PPDB Aktif: {activePeriod.name}</span>
            </span>
            <span className="font-medium text-emerald-800 sm:text-right">
              {formatPeriodDate(activePeriod.open_date)} s/d{' '}
              {formatPeriodDate(activePeriod.close_date)}
            </span>
          </div>
        )}

        {activeTab === 'daftar' ? (
          submittedCard ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-relaxed">
                    <strong>Pengajuan Mutasi Berhasil!</strong> Simpan atau cetak Kartu Bukti
                    Pendaftaran resmi Anda di bawah ini.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Buat Pengajuan Baru
                </button>
              </div>
              <PpdbRegistrationCard data={submittedCard} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div
                  ref={errorBannerRef}
                  role="alert"
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Bagian 1: Biodata Siswa & Orang Tua */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5" /> Bagian 1
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Biodata Calon Siswa Pindahan &amp; Orang Tua / Wali
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Tanda <span className="text-rose-600 font-bold">*</span> wajib diisi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Nama Lengkap Siswa <span className="text-rose-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sesuai Akta Kelahiran / Rapor"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        NISN (10 Digit Angka) <span className="text-rose-600">*</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          nisn.length === 10
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
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
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        NIK Siswa (16 Digit Angka) <span className="text-rose-600">*</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          nik.length === 16
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
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
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Jenis Kelamin <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                      className={INPUT_CLASS}
                    >
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Tempat Lahir <span className="text-rose-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      placeholder="Kota/Kabupaten tempat lahir"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Tanggal Lahir <span className="text-rose-600">*</span>
                    </label>
                    <input
                      required
                      type="date"
                      max={todayIso}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Sekolah / Madrasah Asal <span className="text-rose-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                      placeholder="Nama sekolah/madrasah asal"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Nama Orang Tua / Wali <span className="text-rose-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Nama ayah / ibu / wali"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="sm:col-span-2 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        No. WhatsApp Orang Tua / Wali (12 Digit Angka){' '}
                        <span className="text-rose-600">*</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          parentPhone.length === 12
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {parentPhone.length}/12
                      </span>
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        minLength={12}
                        maxLength={12}
                        value={parentPhone}
                        onChange={(e) => handleDigitsInput(e.target.value, 12, setParentPhone)}
                        placeholder="08xxxxxxxxxx (12 digit angka)"
                        className={`${INPUT_CLASS} pl-10 font-mono`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bagian 2: Informasi Kepindahan & Tujuan */}
              <div className="border-t border-slate-200/80 pt-5 space-y-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Bagian 2
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Kelas Tujuan &amp; Alasan Mutasi Masuk
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Kelas / Tingkat Tujuan <span className="text-rose-600">*</span>
                    </label>
                    <select
                      required
                      value={targetGrade}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTargetGrade(val);
                        if (isFinalGradeLevel(val, gradeLevels)) {
                          setFinalGradeModalOpen(true);
                        }
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">-- Pilih Kelas / Tingkat Tujuan --</option>
                      {gradeLevels.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          Kelas {lvl}
                        </option>
                      ))}
                    </select>
                    {isTargetFinalGrade && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        Kelas tingkat akhir tidak dapat menerima mutasi masuk.
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Alasan Mutasi / Pindah Sekolah <span className="text-rose-600">*</span>
                    </label>
                    <select
                      required
                      value={mutationReason}
                      onChange={(e) => setMutationReason(e.target.value)}
                      className={`${INPUT_CLASS} truncate`}
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
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Penjelasan Alasan Mutasi Lainnya <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Jelaskan secara singkat alasan kepindahan siswa..."
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                )}
              </div>

              {/* Bagian 3: Alamat Emsifa API */}
              <IndonesianAddressFields
                key={addressResetKey}
                onAddressChange={handleAddressChange}
              />

              {/* Bagian 4: Dokumen Persyaratan Mutasi */}
              <div className="border-t border-slate-200/80 pt-5 space-y-3">
                <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen Persyaratan
                  Mutasi Masuk
                </p>
                <p className="text-xs text-slate-500">
                  Unggah scan/foto berkas asli dalam format PDF, JPG, atau PNG (maksimal 2 MB per
                  berkas).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {MUTATION_DOCS.map((doc) => {
                    const uploaded = docFiles[doc.key];
                    return (
                      <div
                        key={doc.key}
                        className={`modular-card rounded-2xl p-4 text-xs flex flex-col justify-between gap-3 min-w-0 ${
                          uploaded ? 'border-emerald-300 bg-emerald-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-800 leading-snug break-words">
                              {doc.label} {doc.required && <span className="text-rose-600">*</span>}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Wajib diunggah • PDF, JPG, PNG (Maks. 2 MB)
                            </p>
                          </div>
                          {uploaded && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <FileCheck2 className="w-3 h-3" /> Siap
                            </span>
                          )}
                        </div>

                        {uploaded ? (
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 truncate">
                                {uploaded.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatFileSize(uploaded.fileSize)}
                              </p>
                            </div>
                            {!submitting && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(doc.key)}
                                title="Hapus berkas"
                                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <label
                            className={`flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-dashed transition text-xs font-semibold ${
                              submitting
                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'border-slate-300 bg-slate-50/70 text-slate-700 hover:bg-emerald-50/50 hover:border-emerald-400 cursor-pointer'
                            }`}
                          >
                            <Upload className="w-4 h-4 shrink-0" />
                            <span>Pilih Berkas</span>
                            <input
                              type="file"
                              disabled={submitting}
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                handleFileChange(
                                  doc.key,
                                  doc.documentType,
                                  doc.label,
                                  e.target.files?.[0] || null
                                );
                                e.target.value = '';
                              }}
                              className="sr-only"
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-5 rounded-2xl transition shadow-sm text-sm"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                <span>
                  {submitting
                    ? 'Menyimpan & Mengunggah Berkas...'
                    : 'Kirim Pengajuan Mutasi Masuk & Buat Kartu Bukti'}
                </span>
              </button>
            </form>
          )
        ) : (
          <div className="space-y-5">
            <form
              onSubmit={handleCheckStatus}
              className="flex flex-col sm:flex-row gap-2.5 print:hidden"
            >
              <input
                type="text"
                value={checkCode}
                onChange={(e) => setCheckCode(e.target.value)}
                placeholder="Masukkan Nomor Pendaftaran (contoh: MUTASI-2026-12345)"
                className={`${INPUT_CLASS} flex-1 min-w-0 font-mono uppercase placeholder:normal-case placeholder:font-sans`}
              />
              <button
                type="submit"
                disabled={checking}
                className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shrink-0"
              >
                {checking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Cek Status</span>
              </button>
            </form>

            {checkError && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{checkError}</span>
              </div>
            )}

            {!checkCard && !checkError && !checking && (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                  Cek Status Pengajuan Mutasi &amp; Cetak Ulang Kartu Bukti
                </p>
                <p className="text-xs text-slate-500">
                  Masukkan nomor pendaftaran mutasi (contoh: MUTASI-2026-xxxxx) untuk memantau
                  verifikasi berkas.
                </p>
              </div>
            )}

            {checkCard && (
              <div className="space-y-4">
                <div className="flex justify-end print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckCard(null);
                      setCheckCode('');
                      setCheckError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Cari Nomor Lain
                  </button>
                </div>
                <PpdbRegistrationCard data={checkCard} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Tolak Mutasi Masuk Kelas Tingkat Terakhir */}
      {finalGradeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-grade-modal-title"
          onClick={() => setFinalGradeModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setFinalGradeModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3
              id="final-grade-modal-title"
              className="mt-4 text-base sm:text-lg font-bold text-slate-900"
            >
              Mutasi Masuk Kelas Akhir Tidak Diperkenankan
            </h3>
            <div className="mt-2 space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                Anda memilih <strong>Kelas {targetGrade}</strong> sebagai kelas/tingkat tujuan.
              </p>
              <p>
                Berdasarkan peraturan pendidikan dan ketentuan terbaru Kementerian Agama /
                Kemendikdasmen, madrasah/sekolah{' '}
                <strong>tidak dapat menerima mutasi masuk siswa pada kelas tingkat akhir</strong>.
              </p>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
                Ketentuan ini berlaku demi menjaga validitas data Dapodik/EMIS, pemenuhan syarat
                ketuntasan belajar, serta keabsahan peserta asesmen akhir dan penerbitan ijazah.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setFinalGradeModalOpen(false)}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                Mengerti, Ubah Pilihan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
