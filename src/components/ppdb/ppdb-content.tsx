'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import {
  DEFAULT_PATHWAY_QUOTAS,
  PPDB_PATHWAYS,
  type PathwayDocRequirement,
  type PathwayQuotas,
  type PpdbPathwayCode,
} from '@/lib/ppdb/pathways';
import type { RegistrationCardData } from '@/components/ppdb/registration-card';
import { SmartCaptchaMount, useSmartCaptcha } from '@/components/security/smart-captcha';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  INITIAL_FORM,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  mapRegistrationRecordToCard,
  uploadFileToR2,
  validatePpdbForm,
  type ActivePeriod,
  type PpdbFormState,
  type PpdbTab,
  type UploadedDoc,
} from './ppdb/types';
import {
  PpdbPathwaySelector,
  PpdbPeriodBanner,
  PpdbSubmittedView,
} from './ppdb/ppdb-info-sections';
import { PpdbFormSection } from './ppdb/ppdb-form-section';
import { PpdbStatusSection } from './ppdb/ppdb-status-section';

export function PpdbContent() {
  const captcha = useSmartCaptcha(true);
  const [activeTab, setActiveTab] = useState<PpdbTab>('daftar');
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

  const [form, setForm] = useState<PpdbFormState>(INITIAL_FORM);
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
    setFiles((prev) => ({ ...prev, [doc.key]: file }));
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

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validation = validatePpdbForm({
      hasActivePeriod,
      activePathwayDef,
      form,
      todayIso,
      addressComplete,
      files,
    });
    if (validation.error !== null) {
      showFormError(validation.error);
      return;
    }

    const { trimmed, allReqs } = validation;
    const pathwayCode = activePathwayDef!.code;

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

      setSubmitProgress('Memverifikasi keamanan & menyimpan data pendaftaran...');
      const captchaPayload = await captcha.executeCaptcha();
      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fullName: trimmed.fullName,
          birthPlace: trimmed.birthPlace,
          previousSchool: trimmed.previousSchool,
          parentName: trimmed.parentName,
          pathway: pathwayCode,
          documents: uploadedDocs,
          captcha: captchaPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.turnstileUnavailable) {
          captcha.forceLocalFallback();
        }
        showFormError(data.error || 'Gagal menyimpan pendaftaran PPDB.');
      } else {
        setUploadWarnings(failedDocLabels);
        setSubmittedCard({
          registrationNumber: data.registrationNumber,
          fullName: trimmed.fullName,
          nisn: form.nisn,
          pathway: pathwayCode,
          previousSchool: trimmed.previousSchool,
          parentName: trimmed.parentName,
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
        setCheckCard(mapRegistrationRecordToCard(data.registration));
      }
    } catch {
      setCheckError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setChecking(false);
    }
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
        <PpdbPeriodBanner
          loadingPeriod={loadingPeriod}
          periodError={periodError}
          activePeriod={activePeriod}
          activeTab={activeTab}
          onRetry={() => {
            setLoadingPeriod(true);
            setPeriodError(null);
            setPeriodRetryTick((t) => t + 1);
          }}
        />

        {activeTab === 'daftar' ? (
          submittedCard ? (
            <PpdbSubmittedView
              submittedCard={submittedCard}
              uploadWarnings={uploadWarnings}
              onReset={handleResetRegistration}
            />
          ) : (
            <div className="space-y-6">
              <PpdbPathwaySelector
                selectedPathway={selectedPathway}
                activePathwayDef={activePathwayDef}
                quotas={quotas}
                onSelectPathway={(code) => {
                  setSelectedPathway(code);
                  setFiles({});
                  setErrorMsg(null);
                }}
              />

              {!activePathwayDef ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs sm:text-sm text-slate-500">
                  Klik salah satu kartu <strong>Jalur Pendaftaran</strong> di atas untuk membuka
                  formulir pendaftaran &amp; unggah berkas persyaratan.
                </div>
              ) : (
                <PpdbFormSection
                  activePathwayDef={activePathwayDef}
                  form={form}
                  setForm={setForm}
                  files={files}
                  addressResetKey={addressResetKey}
                  todayIso={todayIso}
                  loadingPeriod={loadingPeriod}
                  hasActivePeriod={hasActivePeriod}
                  submitting={submitting}
                  submitProgress={submitProgress}
                  errorMsg={errorMsg}
                  errorBannerRef={errorBannerRef}
                  onAddressChange={handleAddressChange}
                  onFileSelect={handleFileSelect}
                  onRemoveFile={handleRemoveFile}
                  onSubmit={handleRegisterSubmit}
                />
              )}
            </div>
          )
        ) : (
          <PpdbStatusSection
            checkCode={checkCode}
            checking={checking}
            checkError={checkError}
            checkCard={checkCard}
            onCheckCodeChange={setCheckCode}
            onSubmit={handleCheckStatus}
            onReset={() => {
              setCheckCard(null);
              setCheckCode('');
              setCheckError(null);
            }}
          />
        )}
      </div>
      <SmartCaptchaMount containerRef={captcha.containerRef} />
    </>
  );
}
