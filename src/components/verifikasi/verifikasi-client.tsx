'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  ImageUp,
  Loader2,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { extractVerificationParams } from '@/lib/verification/document-verify';
import {
  encodeCaptchaHeader,
  SmartCaptchaMount,
  useSmartCaptcha,
} from '@/components/security/smart-captcha';

interface VerificationResult {
  valid: boolean;
  documentType?: string;
  reference?: string;
  title?: string;
  statusLabel?: string;
  issuedAt?: string | null;
  details?: Array<{ label: string; value: string }>;
  error?: string;
}

const MAX_UPLOAD_SCAN_DIMENSION = 1200;
const MAX_CAMERA_SCAN_DIMENSION = 720;
const CAMERA_SCAN_INTERVAL_MS = 120;
const MAX_IMAGE_FILE_BYTES = 15 * 1024 * 1024;

const SUPPORTED_DOCUMENT_TYPES = [
  { prefix: 'TRX-...', label: 'Slip Tabungan Digital' },
  { prefix: 'MUT-...', label: 'Mutasi Rekening Tabungan' },
  { prefix: 'SPP-...', label: 'Slip SPP / Iuran Komite' },
  { prefix: 'HON-...', label: 'Slip Honorarium GTK' },
  { prefix: 'LIB-...', label: 'Kartu Anggota E-Library' },
  { prefix: 'NIS / NISN', label: 'Kartu Pelajar Digital' },
  { prefix: 'AGD-... / No. Surat', label: 'Surat & Buku Agenda' },
  { prefix: 'RKP-... / PNL-...', label: 'Rekap Absensi & Penilaian' },
] as const;

function formatIssuedAt(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function copyTextSafely(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback ke execCommand
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function VerifikasiClient() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const initialType = searchParams.get('type') || '';

  const [inputRef, setInputRef] = useState(initialRef);
  const [loading, setLoading] = useState(() => Boolean(extractVerificationParams(initialRef).ref));
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [startingCamera, setStartingCamera] = useState(false);
  const [scanningCamera, setScanningCamera] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const inputElRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cameraSessionRef = useRef(0);
  const verifyAbortRef = useRef<AbortController | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    containerRef: captchaContainerRef,
    executeCaptcha,
    forceLocalFallback,
  } = useSmartCaptcha(true);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStartingCamera(false);
    setScanningCamera(false);
  }, []);

  const runVerification = useCallback(
    async (rawValue: string, explicitType?: string, options?: { scrollToResult?: boolean }) => {
      const extracted = extractVerificationParams(rawValue);
      if (!extracted.ref) {
        setLoading(false);
        setResult({
          valid: false,
          error: 'Masukkan nomor referensi dokumen atau scan QR Code terlebih dahulu.',
        });
        return;
      }

      verifyAbortRef.current?.abort();
      const controller = new AbortController();
      verifyAbortRef.current = controller;

      setInputRef(extracted.ref);
      setLoading(true);
      setScanError(null);
      setCopiedRef(false);

      try {
        const captchaPayload = await executeCaptcha();
        if (controller.signal.aborted) return;

        const qs = new URLSearchParams({ ref: extracted.ref });
        const finalType = explicitType || extracted.type;
        if (finalType) qs.set('type', finalType);

        const res = await fetch(`/api/public/verifikasi?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'x-captcha-payload': encodeCaptchaHeader(captchaPayload),
          },
        });
        if (controller.signal.aborted) return;

        const json = (await res.json().catch(() => null)) as
          | (VerificationResult & { turnstileUnavailable?: boolean })
          | null;

        if (!json) {
          setResult({
            valid: false,
            error: 'Respons server verifikasi tidak valid. Silakan coba lagi.',
          });
          return;
        }
        if (json.turnstileUnavailable) {
          forceLocalFallback();
        }
        setResult(json);

        if (options?.scrollToResult !== false) {
          requestAnimationFrame(() => {
            resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setResult({
          valid: false,
          error: 'Gagal menghubungi server verifikasi dokumen. Periksa koneksi internet Anda.',
        });
      } finally {
        if (verifyAbortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [executeCaptcha, forceLocalFallback]
  );

  // Auto-verifikasi ketika URL membawa ?ref=... (terpadu dengan verifyAbortRef agar bebas race condition)
  useEffect(() => {
    const extracted = extractVerificationParams(initialRef);
    if (!extracted.ref) return;
    const timer = window.setTimeout(() => {
      void runVerification(initialRef, initialType, { scrollToResult: false });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      verifyAbortRef.current?.abort();
    };
  }, [initialRef, initialType, runVerification]);

  // Hentikan kamera otomatis saat tab disembunyikan untuk menghemat baterai & privasi
  useEffect(() => {
    if (!scanningCamera && !startingCamera) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scanningCamera, startingCamera, stopCamera]);

  // Cleanup seluruh resource saat unmount
  useEffect(() => {
    return () => {
      verifyAbortRef.current?.abort();
      stopCamera();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [stopCamera]);

  async function startCameraScan() {
    if (startingCamera || scanningCamera) return;
    setScanError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScanError(
        'Kamera tidak didukung pada peramban/koneksi ini. Gunakan HTTPS atau unggah gambar QR Code (PNG/JPG).'
      );
      return;
    }

    const sessionId = ++cameraSessionRef.current;
    setStartingCamera(true);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Fallback untuk laptop/perangkat tanpa kamera belakang
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setStartingCamera(false);
      setScanningCamera(true);

      const jsQR = (await import('jsqr')).default;
      if (cameraSessionRef.current !== sessionId) {
        stopCamera();
        return;
      }

      requestAnimationFrame(() => {
        if (cameraSessionRef.current !== sessionId) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let lastScanTime = 0;

      const tick = (now: number) => {
        if (cameraSessionRef.current !== sessionId) return;
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        if (
          now - lastScanTime >= CAMERA_SCAN_INTERVAL_MS &&
          video.readyState === video.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          ctx
        ) {
          lastScanTime = now;
          const scale = Math.min(
            1,
            MAX_CAMERA_SCAN_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
          );
          const targetW = Math.max(1, Math.round(video.videoWidth * scale));
          const targetH = Math.max(1, Math.round(video.videoHeight * scale));

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          ctx.drawImage(video, 0, 0, targetW, targetH);
          const imageData = ctx.getImageData(0, 0, targetW, targetH);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code?.data) {
            stopCamera();
            void runVerification(code.data);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setScanError(
        'Tidak dapat mengakses kamera perangkat. Pastikan izin kamera aktif atau gunakan unggah gambar PNG/JPG.'
      );
      stopCamera();
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    if (!file.type.startsWith('image/')) {
      setScanError('File yang dipilih bukan gambar. Gunakan file berformat PNG, JPG, atau WebP.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setScanError('Ukuran gambar terlalu besar (maksimal 15 MB).');
      e.target.value = '';
      return;
    }

    setScanningImage(true);
    const imgUrl = URL.createObjectURL(file);
    try {
      const jsQR = (await import('jsqr')).default;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal membaca gambar.'));
        img.src = imgUrl;
      });

      if (img.width <= 0 || img.height <= 0) {
        throw new Error('Dimensi gambar tidak valid.');
      }

      const scale = Math.min(1, MAX_UPLOAD_SCAN_DIMENSION / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia.');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!code?.data) {
        setScanError(
          'QR Code tidak terdeteksi pada gambar tersebut. Pastikan QR Code terlihat jelas dan tidak buram.'
        );
        return;
      }

      void runVerification(code.data);
    } catch {
      setScanError('Gagal memindai QR Code dari gambar. Pastikan file berupa gambar PNG/JPG.');
    } finally {
      URL.revokeObjectURL(imgUrl);
      e.target.value = '';
      setScanningImage(false);
    }
  }

  function handleReset() {
    verifyAbortRef.current?.abort();
    verifyAbortRef.current = null;
    setLoading(false);
    setInputRef('');
    setResult(null);
    setScanError(null);
    setCopiedRef(false);
    requestAnimationFrame(() => {
      inputElRef.current?.focus();
    });
  }

  async function handleCopyReference(refText: string) {
    const ok = await copyTextSafely(refText);
    if (!ok) return;
    setCopiedRef(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedRef(false), 2000);
  }

  const issuedDateLabel = formatIssuedAt(result?.issuedAt);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-5 sm:p-8 lg:p-10 shadow-xl space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          Validasi Keaslian Dokumen Resmi
        </span>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight [overflow-wrap:anywhere]">
          Verifikasi Dokumen &amp; QR Code
        </h1>
        <p className="text-xs sm:text-sm text-slate-200/90 max-w-2xl leading-relaxed">
          Periksa keaslian Slip Tabungan, Slip SPP/Komite, Slip Honorarium, Kartu Pelajar, Kartu
          E-Library, Rekap Absensi, Dokumen Penilaian &amp; Raport, maupun Surat Resmi yang
          diterbitkan lembaga melalui scan QR Code atau input nomor referensi.
        </p>
      </section>

      {/* Input & Scanner Panel */}
      <section
        aria-label="Formulir Verifikasi Dokumen"
        className="glass-card rounded-3xl p-5 sm:p-8 space-y-5 border border-slate-200/80"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runVerification(inputRef);
          }}
          className="space-y-2"
        >
          <label
            htmlFor="verifikasi-ref-input"
            className="block text-xs font-bold text-slate-700"
          >
            Masukkan Nomor Referensi / Kode Dokumen / Tautan QR
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputElRef}
                id="verifikasi-ref-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={inputRef}
                onChange={(e) => setInputRef(e.target.value)}
                placeholder="Contoh: TRX-12345678, HON-202611-..., SPP-..., LIB-..."
                className="w-full min-h-[46px] rounded-2xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600"
              />
              {inputRef && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Bersihkan input referensi"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              aria-busy={loading || undefined}
              disabled={loading || !inputRef.trim()}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <FileCheck2 className="w-4 h-4 shrink-0" />
              )}
              <span>{loading ? 'Memverifikasi...' : 'Verifikasi Dokumen'}</span>
            </button>
          </div>
        </form>

        {/* QR Scanner Controls */}
        <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {!scanningCamera ? (
            <button
              type="button"
              disabled={startingCamera}
              aria-busy={startingCamera || undefined}
              onClick={() => void startCameraScan()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              {startingCamera ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Camera className="w-4 h-4 shrink-0" />
              )}
              <span>{startingCamera ? 'Mengaktifkan Kamera...' : 'Scan QR via Kamera'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
            >
              <CameraOff className="w-4 h-4 shrink-0" />
              <span>Hentikan Kamera</span>
            </button>
          )}

          <label
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition focus-within:ring-2 focus-within:ring-emerald-500 ${
              scanningImage ? 'opacity-70 cursor-wait' : 'cursor-pointer'
            }`}
          >
            {scanningImage ? (
              <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
            ) : (
              <ImageUp className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            <span>
              {scanningImage ? 'Memindai Gambar QR...' : 'Scan QR dari File Gambar (PNG/JPG)'}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={scanningImage}
              onChange={(e) => void handleImageUpload(e)}
              className="sr-only"
            />
          </label>
        </div>

        {scanError && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed flex items-start justify-between gap-2"
          >
            <span className="[overflow-wrap:anywhere]">{scanError}</span>
            <button
              type="button"
              onClick={() => setScanError(null)}
              aria-label="Tutup peringatan"
              className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {scanningCamera && (
          <div className="rounded-3xl overflow-hidden border border-slate-300 bg-slate-950 relative max-w-md mx-auto shadow-lg">
            <div className="relative">
              <video ref={videoRef} playsInline muted className="w-full h-auto block" />
              {/* QR Viewfinder Reticle */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center p-8"
              >
                <div className="w-44 h-44 sm:w-52 sm:h-52 relative">
                  <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                  <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                </div>
              </div>
            </div>
            <div className="p-3 text-center text-xs text-emerald-300 bg-slate-900/95 flex items-center justify-center gap-1.5">
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Arahkan kamera ke QR Code pada dokumen...</span>
            </div>
          </div>
        )}
      </section>

      {/* Loading Indicator saat verifikasi sedang berlangsung */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="glass-card rounded-3xl p-6 flex items-center justify-center gap-3 text-sm text-slate-600 border border-emerald-200/70"
        >
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700 shrink-0" />
          <span className="font-medium">Memeriksa keaslian dokumen pada server lembaga...</span>
        </div>
      )}

      {/* Verification Result */}
      {result && !loading && (
        <div
          ref={resultCardRef}
          role="region"
          aria-live="polite"
          aria-label="Hasil Verifikasi Dokumen"
          className={`rounded-3xl border p-5 sm:p-8 shadow-sm space-y-4 ${
            result.valid
              ? 'border-emerald-300 bg-emerald-50/75'
              : 'border-rose-300 bg-rose-50/75'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {result.valid ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      result.valid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {result.valid
                      ? result.statusLabel || 'TERVERIFIKASI SAH'
                      : 'TIDAK TERVERIFIKASI'}
                  </span>
                  {result.documentType && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/85 text-slate-700 border border-slate-200">
                      {result.documentType.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-900 [overflow-wrap:anywhere]">
                  {result.valid ? result.title : 'Dokumen Tidak Ditemukan'}
                </h2>

                {result.reference && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-mono text-slate-600 break-all">
                      Referensi: {result.reference}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopyReference(result.reference!)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/90 hover:bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition"
                    >
                      {copiedRef ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedRef ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                )}

                {issuedDateLabel && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Diterbitkan: {issuedDateLabel}</span>
                  </p>
                )}

                {result.error && (
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed [overflow-wrap:anywhere]">
                    {result.error}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white border border-slate-200 text-xs font-semibold text-slate-700 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Cek Dokumen Lainnya</span>
            </button>
          </div>

          {result.valid && result.details && result.details.length > 0 && (
            <dl className="bg-white rounded-2xl border border-emerald-200/80 divide-y divide-slate-100 overflow-hidden">
              {result.details.map((d, idx) => (
                <div
                  key={`${d.label}-${idx}`}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs min-w-0"
                >
                  <dt className="text-slate-500 font-medium">{d.label}</dt>
                  <dd className="font-bold text-slate-900 [overflow-wrap:anywhere] sm:text-right">
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Panduan Jenis Dokumen Didukung (Idle State) */}
      {!result && !loading && (
        <section
          aria-label="Jenis Dokumen yang Didukung"
          className="glass-card rounded-3xl p-5 sm:p-7 space-y-4 border border-slate-200/80"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">
              Dokumen Resmi yang Dapat Diverifikasi
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SUPPORTED_DOCUMENT_TYPES.map((item) => (
              <div
                key={item.prefix}
                className="rounded-2xl bg-white/85 border border-slate-200/80 px-3.5 py-3 space-y-0.5 min-w-0"
              >
                <p className="text-[11px] font-mono font-bold text-emerald-700 truncate">
                  {item.prefix}
                </p>
                <p className="text-xs font-medium text-slate-600 leading-snug">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <SmartCaptchaMount containerRef={captchaContainerRef} />
    </div>
  );
}
