'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarCheck, RefreshCw, Search, UserPlus } from 'lucide-react';
import type { RegistrationCardData } from '@/components/ppdb/registration-card';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';
import { MutasiFinalGradeModal } from './mutasi/mutasi-documents-section';
import { MutasiFormSection } from './mutasi/mutasi-form-section';
import { MutasiStatusSection } from './mutasi/mutasi-status-section';
import {
  ActivePeriod,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DocType,
  formatFileSize,
  formatPeriodDate,
  INITIAL_MUTASI_FORM,
  isFinalGradeLevel,
  MAX_FILE_SIZE_BYTES,
  MUTATION_DOCS,
  MutasiDocItem,
  MutasiFormValues,
} from './mutasi/types';

export function MutasiContent() {
  const captcha = useSmartCaptcha(true);
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
  const [gradeLevels, setGradeLevels] = useState<string[]>(['VII', 'VIII', 'IX']);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [periodRetryTick, setPeriodRetryTick] = useState(0);

  const [form, setForm] = useState<MutasiFormValues>(INITIAL_MUTASI_FORM);
  const [fullAddress, setFullAddress] = useState('');
  const [addressComplete, setAddressComplete] = useState(false);
  const [addressResetKey, setAddressResetKey] = useState(0);

  const [docFiles, setDocFiles] = useState<Record<string, MutasiDocItem>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalGradeModalOpen, setFinalGradeModalOpen] = useState(false);
  const [submittedCard, setSubmittedCard] = useState<RegistrationCardData | null>(null);
  const [checkCode, setCheckCode] = useState('');

  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/ppdb?info=active', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Gagal memuat informasi periode & tingkat kelas.');
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setActivePeriod(data.period ?? null);
        setPeriodError(null);
        if (Array.isArray(data.gradeLevels) && data.gradeLevels.length > 0) {
          setGradeLevels(data.gradeLevels);
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setPeriodError(err?.message || 'Gagal terhubung ke server untuk memuat info periode.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPeriod(false);
      });

    return () => controller.abort();
  }, [periodRetryTick]);

  const handleFieldChange = useCallback(
    <K extends keyof MutasiFormValues>(field: K, value: MutasiFormValues[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleTargetGradeChange = useCallback(
    (value: string) => {
      setForm((prev) => ({ ...prev, targetGrade: value }));
      if (isFinalGradeLevel(value, gradeLevels)) {
        setFinalGradeModalOpen(true);
      }
    },
    [gradeLevels]
  );

  const handleAddressChange = useCallback((addr: string, complete: boolean) => {
    setFullAddress(addr);
    setAddressComplete(complete);
  }, []);

  const handleCloseFinalGradeModal = useCallback(() => {
    setFinalGradeModalOpen(false);
  }, []);

  function showFormError(message: string) {
    setErrorMsg(message);
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function handleFileChange(
    key: string,
    documentType: DocType,
    label: string,
    file: File | null
  ) {
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
      if (!isMountedRef.current) return;
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
      if (!isMountedRef.current) return;
      showFormError(`Gagal membaca berkas "${label}". Pastikan file tidak rusak.`);
    };
    reader.readAsDataURL(file);
  }

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
    setForm(INITIAL_MUTASI_FORM);
    setFullAddress('');
    setAddressComplete(false);
    setAddressResetKey((k) => k + 1);
    setDocFiles({});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    const trimmedFullName = form.fullName.trim();
    const trimmedBirthPlace = form.birthPlace.trim();
    const trimmedPreviousSchool = form.previousSchool.trim();
    const trimmedParentName = form.parentName.trim();

    if (!form.targetGrade) {
      showFormError('Silakan pilih Kelas / Tingkat Tujuan terlebih dahulu.');
      return;
    }

    if (isFinalGradeLevel(form.targetGrade, gradeLevels)) {
      setFinalGradeModalOpen(true);
      return;
    }

    if (trimmedFullName.length < 2) {
      showFormError('Nama lengkap siswa minimal 2 karakter.');
      return;
    }
    if (!/^\d{10}$/.test(form.nisn)) {
      showFormError('NISN harus terdiri dari tepat 10 digit angka.');
      return;
    }
    if (!/^\d{16}$/.test(form.nik)) {
      showFormError('NIK harus terdiri dari tepat 16 digit angka.');
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
      showFormError('Sekolah / Madrasah asal minimal 2 karakter.');
      return;
    }
    if (trimmedParentName.length < 2) {
      showFormError('Nama orang tua / wali minimal 2 karakter.');
      return;
    }
    if (!/^\d{12}$/.test(form.parentPhone)) {
      showFormError('No. WhatsApp Orang Tua / Wali harus terdiri dari tepat 12 digit angka.');
      return;
    }
    if (!addressComplete || !fullAddress.trim()) {
      showFormError(
        'Mohon lengkapi seluruh field alamat (Provinsi, Kab/Kota, Kecamatan, Kelurahan/Desa, RT, RW, dan Alamat).'
      );
      return;
    }
    if (!form.mutationReason) {
      showFormError('Silakan pilih Alasan Mutasi / Pindah Sekolah.');
      return;
    }
    if (form.mutationReason === 'Lainnya' && !form.otherReason.trim()) {
      showFormError('Mohon isi penjelasan alasan mutasi lainnya.');
      return;
    }

    const missingDocs = MUTATION_DOCS.filter((d) => d.required && !docFiles[d.key]);
    if (missingDocs.length > 0) {
      showFormError(`Mohon unggah dokumen wajib: ${missingDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    const finalReason =
      form.mutationReason === 'Lainnya'
        ? `Lainnya: ${form.otherReason.trim()}`
        : form.mutationReason;

    setSubmitting(true);
    try {
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: trimmedFullName,
          nisn: form.nisn,
          nik: form.nik,
          gender: form.gender,
          birthPlace: trimmedBirthPlace,
          birthDate: form.birthDate,
          previousSchool: trimmedPreviousSchool,
          address: fullAddress,
          parentName: trimmedParentName,
          parentPhone: form.parentPhone,
          pathway: 'MUTASI',
          targetGrade: form.targetGrade,
          mutationReason: finalReason,
          documents: Object.values(docFiles).map((d) => ({
            documentType: d.documentType,
            fileUrl: d.fileData,
            fileName: d.fileName,
          })),
          captcha: captchaPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.turnstileUnavailable) {
          captcha.forceLocalFallback();
        }
        showFormError(data.error || 'Gagal mengirim pengajuan mutasi masuk.');
        return;
      }

      setSubmittedCard({
        registrationNumber: data.registrationNumber,
        fullName: trimmedFullName,
        nisn: form.nisn,
        pathway: 'MUTASI',
        previousSchool: trimmedPreviousSchool,
        parentName: trimmedParentName,
        parentPhone: form.parentPhone,
        status: data.registration?.status || 'MENUNGGU_VERIFIKASI',
        createdAt: data.registration?.created_at || new Date().toISOString(),
        notes: `Kelas Tujuan: ${form.targetGrade} | Alasan: ${finalReason}`,
        documents: Object.values(docFiles).map((d) => ({ label: d.label, verified: false })),
      });
      setCheckCode(data.registrationNumber);
    } catch {
      showFormError('Terjadi kesalahan jaringan saat mengirim pengajuan.');
    } finally {
      setSubmitting(false);
    }
  }

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
        {!loadingPeriod && periodError && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
            <span className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{periodError}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setLoadingPeriod(true);
                setPeriodError(null);
                setPeriodRetryTick((t) => t + 1);
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 font-semibold hover:bg-amber-100/60 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
            </button>
          </div>
        )}

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
          <MutasiFormSection
            form={form}
            gradeLevels={gradeLevels}
            todayIso={todayIso}
            addressResetKey={addressResetKey}
            docFiles={docFiles}
            submitting={submitting}
            errorMsg={errorMsg}
            errorBannerRef={errorBannerRef}
            submittedCard={submittedCard}
            onFieldChange={handleFieldChange}
            onTargetGradeChange={handleTargetGradeChange}
            onAddressChange={handleAddressChange}
            onFileChange={handleFileChange}
            onRemoveFile={handleRemoveFile}
            onResetForm={handleResetForm}
            onSubmit={handleSubmit}
          />
        ) : (
          <MutasiStatusSection checkCode={checkCode} onCheckCodeChange={setCheckCode} />
        )}
      </div>

      <MutasiFinalGradeModal
        open={finalGradeModalOpen}
        targetGrade={form.targetGrade}
        onClose={handleCloseFinalGradeModal}
      />
      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </>
  );
}
