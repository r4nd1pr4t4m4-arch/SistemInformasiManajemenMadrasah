'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  DEFAULT_PATHWAY_QUOTAS,
  PPDB_PATHWAYS,
  type PathwayDocRequirement,
  type PathwayQuotas,
  type PpdbPathwayCode,
} from '@/lib/ppdb/pathways';
import {
  PpdbRegistrationCard,
  type RegistrationCardData,
} from '@/components/ppdb/registration-card';
import { IndonesianAddressFields } from '@/components/ppdb/address-fields';

interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
  pathway_quotas?: PathwayQuotas;
}

interface UploadedDoc {
  documentType:
    | 'KK'
    | 'AKTA_KELAHIRAN'
    | 'IJAZAH_SKL'
    | 'PAS_FOTO'
    | 'SERTIFIKAT_PRESTASI'
    | 'LAINNYA';
  fileUrl: string;
  fileName: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

const INITIAL_FORM = {
  fullName: '',
  nisn: '',
  nik: '',
  gender: 'L' as 'L' | 'P',
  birthPlace: '',
  birthDate: '',
  previousSchool: '',
  address: '',
  parentName: '',
  parentPhone: '',
};

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

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

export function PpdbContent() {
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [periodRetryTick, setPeriodRetryTick] = useState(0);
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
  const [selectedPathway, setSelectedPathway] = useState<PpdbPathwayCode | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [submittedCard, setSubmittedCard] = useState<RegistrationCardData | null>(null);

  const [form, setForm] = useState(INITIAL_FORM);
  const [addressComplete, setAddressComplete] = useState(false);
  const [addressResetKey, setAddressResetKey] = useState(0);

  const [files, setFiles] = useState<Record<string, File | undefined>>({});

  const [checkCode, setCheckCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkCard, setCheckCard] = useState<RegistrationCardData | null>(null);

  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/ppdb?info=active', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData?.error || 'Gagal memuat informasi periode PPDB.');
        }
        return r.json();
      })
      .then((d) => {
        setActivePeriod(d?.period ?? null);
        setPeriodError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setActivePeriod(null);
        setPeriodError(err?.message || 'Tidak dapat terhubung ke server.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPeriod(false);
      });

    return () => controller.abort();
  }, [periodRetryTick]);

  const handleAddressChange = useCallback((fullAddress: string, isComplete: boolean) => {
    setForm((prev) => ({ ...prev, address: fullAddress }));
    setAddressComplete(isComplete);
  }, []);

  const hasActivePeriod = Boolean(activePeriod);
  const quotas: PathwayQuotas = activePeriod?.pathway_quotas || DEFAULT_PATHWAY_QUOTAS;
  const activePathwayDef = PPDB_PATHWAYS.find((p) => p.code === selectedPathway) || null;

  function showFormError(message: string) {
    setErrorMsg(message);
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function handleFileSelect(doc: PathwayDocRequirement, file: File | undefined) {
    if (!file) return;

    const isValidType =
      (file.type && ALLOWED_MIME_TYPES.has(file.type)) || ALLOWED_EXTENSIONS.test(file.name);
    if (!isValidType) {
      showFormError(`Format berkas "${doc.label}" harus berupa PDF, JPG, JPEG, atau PNG.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showFormError(
        `Ukuran berkas "${doc.label}" (${formatFileSize(file.size)}) melebihi batas maksimal 5 MB.`
      );
      return;
    }

    setErrorMsg(null);
    setFiles((prev) => ({
      ...prev,
      [doc.key]: file,
    }));
  }

  function handleRemoveFile(docKey: string) {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
  }

  function handleResetRegistration() {
    setSubmittedCard(null);
    setUploadWarnings([]);
    setSelectedPathway(null);
    setForm(INITIAL_FORM);
    setAddressComplete(false);
    setAddressResetKey((k) => k + 1);
    setFiles({});
    setErrorMsg(null);
  }

  async function uploadFileToR2(
    docType: UploadedDoc['documentType'],
    prefix: string,
    file: File
  ): Promise<UploadedDoc | null> {
    const presignRes = await fetch('/api/storage/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'ppdb',
        fileName: `${prefix}-${file.name}`,
        contentType: file.type || 'application/octet-stream',
      }),
    });

    if (!presignRes.ok) return null;
    const { uploadUrl, publicUrl } = await presignRes.json();
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!putRes.ok) return null;

    return {
      documentType: docType,
      fileUrl: publicUrl,
      fileName: `${prefix}: ${file.name}`,
    };
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasActivePeriod) {
      showFormError('Pendaftaran tidak dapat dikirim karena tidak ada periode PPDB yang aktif.');
      return;
    }
    if (!activePathwayDef) {
      showFormError('Silakan pilih jalur pendaftaran terlebih dahulu.');
      return;
    }

    const trimmedFullName = form.fullName.trim();
    const trimmedBirthPlace = form.birthPlace.trim();
    const trimmedPreviousSchool = form.previousSchool.trim();
    const trimmedParentName = form.parentName.trim();

    if (trimmedFullName.length < 2) {
      showFormError('Nama lengkap calon siswa minimal 2 karakter.');
      return;
    }
    if (form.nisn.length !== 10) {
      showFormError('NISN harus tepat 10 digit angka.');
      return;
    }
    if (form.nik.length !== 16) {
      showFormError('NIK harus tepat 16 digit angka.');
      return;
    }
    if (trimmedBirthPlace.length < 2) {
      showFormError('Tempat lahir minimal 2 karakter.');
      return;
    }
    if (!form.birthDate || form.birthDate > todayIso) {
      showFormError('Tanggal lahir tidak valid atau tidak boleh melebihi hari ini.');
      return;
    }
    if (trimmedPreviousSchool.length < 2) {
      showFormError('Asal sekolah / madrasah minimal 2 karakter.');
      return;
    }
    if (trimmedParentName.length < 2) {
      showFormError('Nama orang tua / wali minimal 2 karakter.');
      return;
    }
    if (form.parentPhone.length !== 12) {
      showFormError('No. WhatsApp Orang Tua / Wali harus tepat 12 digit angka.');
      return;
    }
    if (!addressComplete) {
      showFormError(
        'Lengkapi seluruh rincian alamat (Provinsi, Kab/Kota, Kecamatan, Desa, RT, RW, dan Alamat).'
      );
      return;
    }

    const allReqs = [...activePathwayDef.generalDocs, ...activePathwayDef.specialDocs];
    const missingRequiredDocs = allReqs.filter((req) => req.required && !files[req.key]);
    if (missingRequiredDocs.length > 0) {
      showFormError(
        `Unggah berkas wajib berikut terlebih dahulu: ${missingRequiredDocs
          .map((d) => d.label)
          .join(', ')}.`
      );
      return;
    }

    setErrorMsg(null);
    setUploadWarnings([]);
    setSubmitting(true);

    try {
      const uploadedDocs: UploadedDoc[] = [];
      const failedDocLabels: string[] = [];

      for (const req of allReqs) {
        const file = files[req.key];
        if (file) {
          setSubmitProgress(`Mengunggah ${req.label}...`);
          try {
            const uploaded = await uploadFileToR2(req.documentType, req.key, file);
            if (uploaded) {
              uploadedDocs.push(uploaded);
            } else {
              failedDocLabels.push(req.label);
            }
          } catch {
            // Lanjutkan penyimpanan pendaftaran jika R2 CORS belum siap
            failedDocLabels.push(req.label);
          }
        }
      }

      setSubmitProgress('Menyimpan data pendaftaran...');
      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fullName: trimmedFullName,
          birthPlace: trimmedBirthPlace,
          previousSchool: trimmedPreviousSchool,
          parentName: trimmedParentName,
          pathway: activePathwayDef.code,
          documents: uploadedDocs,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFormError(data.error || 'Gagal menyimpan pendaftaran PPDB.');
      } else {
        setUploadWarnings(failedDocLabels);
        setSubmittedCard({
          registrationNumber: data.registrationNumber,
          fullName: trimmedFullName,
          nisn: form.nisn,
          pathway: activePathwayDef.code,
          previousSchool: trimmedPreviousSchool,
          parentName: trimmedParentName,
          parentPhone: form.parentPhone,
          status: 'MENUNGGU_VERIFIKASI',
          createdAt: new Date().toISOString(),
          documents: uploadedDocs.map((d) => ({ label: d.fileName })),
        });
      }
    } catch {
      showFormError('Terjadi kesalahan koneksi ke server. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
    }
  }

  async function handleCheckStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedCode = checkCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckError('Masukkan nomor pendaftaran PPDB Anda terlebih dahulu.');
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

  function renderDocUploadCard(doc: PathwayDocRequirement, variant: 'general' | 'special') {
    const selectedFile = files[doc.key];
    const isSpecial = variant === 'special';
    const disabled = !hasActivePeriod || submitting;

    return (
      <div
        key={doc.key}
        className={`modular-card rounded-2xl p-4 text-xs flex flex-col justify-between gap-3 min-w-0 ${
          isSpecial ? 'border-emerald-200 bg-emerald-50/30' : ''
        } ${disabled ? 'opacity-65' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <p
              className={`font-semibold text-sm leading-snug break-words ${
                isSpecial ? 'text-emerald-900' : 'text-slate-800'
              }`}
            >
              {doc.label} {doc.required && <span className="text-rose-600">*</span>}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {doc.required ? 'Wajib diunggah' : 'Opsional'} • PDF, JPG, PNG (Maks. 5 MB)
            </p>
          </div>
          {selectedFile && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              <FileCheck2 className="w-3 h-3" /> Siap
            </span>
          )}
        </div>

        {selectedFile ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
            </div>
            {!disabled && (
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
              disabled
                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                : isSpecial
                ? 'border-emerald-300 bg-white/80 text-emerald-800 hover:bg-emerald-50 cursor-pointer'
                : 'border-slate-300 bg-slate-50/70 text-slate-700 hover:bg-emerald-50/50 hover:border-emerald-400 cursor-pointer'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Pilih Berkas</span>
            <input
              type="file"
              disabled={disabled}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                handleFileSelect(doc, e.target.files?.[0]);
                e.target.value = '';
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Navigasi Halaman PPDB"
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
          <span className="truncate">Formulir Pendaftaran</span>
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
        {loadingPeriod && (
          <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600 print:hidden">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
            <span>Memeriksa jadwal periode pendaftaran PPDB aktif...</span>
          </div>
        )}

        {!loadingPeriod && periodError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{periodError}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setLoadingPeriod(true);
                setPeriodError(null);
                setPeriodRetryTick((t) => t + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
            </button>
          </div>
        )}

        {!loadingPeriod && !periodError && activePeriod && (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-emerald-900 print:hidden">
            <span className="font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Periode Aktif: {activePeriod.name}</span>
            </span>
            <span className="font-medium text-emerald-800 sm:text-right">
              {formatPeriodDate(activePeriod.open_date)} s/d{' '}
              {formatPeriodDate(activePeriod.close_date)}
            </span>
          </div>
        )}

        {!loadingPeriod && !periodError && !activePeriod && activeTab === 'daftar' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-900 text-xs flex items-start gap-3 print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-sm">
                Periode Pendaftaran PPDB Saat Ini Belum Dibuka / Sudah Ditutup
              </p>
              <p className="leading-relaxed">
                Saat ini belum ada periode PPDB yang aktif sehingga pengunggahan dokumen
                persyaratan dan pengiriman formulir dinonaktifkan sementara. Silakan hubungi panitia
                PPDB atau pantau halaman pengumuman untuk jadwal pembukaan berikutnya.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'daftar' ? (
          submittedCard ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-relaxed">
                    <strong>Pendaftaran Berhasil!</strong> Simpan atau cetak Kartu Bukti Pendaftaran
                    resmi Anda di bawah ini.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetRegistration}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100/60 transition shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Daftar Siswa Lain
                </button>
              </div>

              {uploadWarnings.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 print:hidden">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Data pendaftaran tersimpan, namun beberapa berkas gagal diunggah ke server:
                    </p>
                    <p>{uploadWarnings.join(', ')}</p>
                    <p className="text-amber-800">
                      Harap bawa fotokopi/berkas asli dokumen tersebut saat verifikasi di panitia
                      PPDB.
                    </p>
                  </div>
                </div>
              )}

              <PpdbRegistrationCard data={submittedCard} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
                    selectedPathway
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  <span>Pilih Jalur</span>
                </div>
                <div className="h-px flex-1 bg-slate-200" />
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
                    selectedPathway ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  <span>Biodata &amp; Berkas</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5" /> Langkah 1
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Pilih Jalur Pendaftaran Terlebih Dahulu
                    </h2>
                  </div>
                  {selectedPathway && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Terpilih: {activePathwayDef?.title}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PPDB_PATHWAYS.map((pw) => {
                    const isSelected = selectedPathway === pw.code;
                    const quota = quotas[pw.code];
                    return (
                      <button
                        key={pw.code}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedPathway(pw.code);
                          setFiles({});
                          setErrorMsg(null);
                        }}
                        className={`text-left rounded-3xl p-5 border-2 transition-all flex flex-col justify-between space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500/20'
                            : 'border-slate-200/80 bg-white/90 hover:border-emerald-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {pw.badge}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                              Kuota: {quota}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-slate-900 text-base">{pw.title}</h3>
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{pw.subtitle}</p>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{pw.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                          <p className="font-bold text-slate-700 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Syarat
                            Khusus:
                          </p>
                          {pw.specialDocs.length === 0 ? (
                            <p className="text-slate-500 italic">Tidak ada persyaratan khusus.</p>
                          ) : (
                            pw.specialDocs.map((d) => (
                              <p key={d.key} className="text-emerald-800 font-medium">
                                • {d.label}
                              </p>
                            ))
                          )}
                          <p className="text-slate-500 pt-1">
                            + Persyaratan Umum (KK, Akta, Ijazah/SKL)
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!activePathwayDef ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs sm:text-sm text-slate-500">
                  Klik salah satu kartu <strong>Jalur Pendaftaran</strong> di atas untuk membuka
                  formulir pendaftaran &amp; unggah berkas persyaratan.
                </div>
              ) : (
                <form
                  onSubmit={handleRegisterSubmit}
                  className="space-y-6 pt-5 border-t border-slate-200/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Langkah 2
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Lengkapi Biodata &amp; Berkas — {activePathwayDef.title}
                      </h2>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Tanda <span className="text-rose-600 font-bold">*</span> wajib diisi
                    </span>
                  </div>

                  {errorMsg && (
                    <div
                      ref={errorBannerRef}
                      role="alert"
                      className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" /> Data Diri Calon
                      Siswa
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Nama Lengkap Calon Siswa <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          placeholder="Sesuai Ijazah / Akta"
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
                              form.nisn.length === 10
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {form.nisn.length}/10
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={10}
                          maxLength={10}
                          value={form.nisn}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nisn: e.target.value.replace(/\D/g, '').slice(0, 10),
                            })
                          }
                          placeholder="10 digit angka NISN"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-semibold text-slate-700">
                            NIK (16 Digit Angka) <span className="text-rose-600">*</span>
                          </label>
                          <span
                            className={`text-[11px] font-mono ${
                              form.nik.length === 16
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {form.nik.length}/16
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={16}
                          maxLength={16}
                          value={form.nik}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nik: e.target.value.replace(/\D/g, '').slice(0, 16),
                            })
                          }
                          placeholder="16 digit angka NIK"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Jenis Kelamin <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={form.gender}
                          onChange={(e) =>
                            setForm({ ...form, gender: e.target.value as 'L' | 'P' })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Tempat Lahir <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.birthPlace}
                          onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                          placeholder="Kota / Kabupaten"
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Tanggal Lahir <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="date"
                          max={todayIso}
                          value={form.birthDate}
                          onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div className="sm:col-span-2 min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Asal Sekolah / Madrasah <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.previousSchool}
                          onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                          placeholder="Contoh: MTsN 1 / SMPN 2"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-slate-200/70">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-700 shrink-0" /> Data Orang Tua / Wali
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Nama Orang Tua / Wali <span className="text-rose-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.parentName}
                          onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                          placeholder="Nama lengkap orang tua/wali"
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-semibold text-slate-700">
                            No. WhatsApp (12 Digit) <span className="text-rose-600">*</span>
                          </label>
                          <span
                            className={`text-[11px] font-mono ${
                              form.parentPhone.length === 12
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {form.parentPhone.length}/12
                          </span>
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          minLength={12}
                          maxLength={12}
                          value={form.parentPhone}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              parentPhone: e.target.value.replace(/\D/g, '').slice(0, 12),
                            })
                          }
                          placeholder="08xxxxxxxxxx (12 digit angka)"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                    </div>
                  </div>

                  <IndonesianAddressFields
                    key={addressResetKey}
                    onAddressChange={handleAddressChange}
                  />

                  <div className="border-t border-slate-200/80 pt-5 space-y-5">
                    <div className="space-y-3">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                        <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen Persyaratan
                        Umum
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {activePathwayDef.generalDocs.map((doc) =>
                          renderDocUploadCard(doc, 'general')
                        )}
                      </div>
                    </div>

                    {activePathwayDef.specialDocs.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-2">
                          <FileUp className="w-4 h-4 text-emerald-700 shrink-0" /> Dokumen
                          Persyaratan Khusus ({activePathwayDef.title})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {activePathwayDef.specialDocs.map((doc) =>
                            renderDocUploadCard(doc, 'special')
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loadingPeriod || !hasActivePeriod || submitting}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-5 rounded-2xl transition shadow-sm text-sm"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                    <span>
                      {loadingPeriod
                        ? 'Memeriksa Periode Aktif...'
                        : !hasActivePeriod
                        ? 'Pendaftaran Ditutup (Tidak Ada Periode Aktif)'
                        : submitting
                        ? submitProgress || 'Menyimpan & Mengunggah Berkas...'
                        : 'Kirim Pendaftaran & Buat Kartu Bukti'}
                    </span>
                  </button>
                </form>
              )}
            </div>
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
                placeholder="Masukkan Nomor Pendaftaran (PPDB-2026-... atau MUTASI-2026-...)"
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
                  Cek Status Seleksi &amp; Cetak Ulang Kartu Bukti
                </p>
                <p className="text-xs text-slate-500">
                  Masukkan nomor pendaftaran yang Anda peroleh setelah mengisi formulir PPDB atau
                  Mutasi Masuk.
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
    </>
  );
}
