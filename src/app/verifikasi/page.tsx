'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Camera,
  CameraOff,
  CheckCircle2,
  FileCheck2,
  ImageUp,
  Loader2,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
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

const MAX_SCAN_DIMENSION = 1200;

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

function VerifikasiContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const initialType = searchParams.get('type') || '';

  const [inputRef, setInputRef] = useState(initialRef);
  const [loading, setLoading] = useState(() => Boolean(extractVerificationParams(initialRef).ref));
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [scanningCamera, setScanningCamera] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cameraSessionRef = useRef(0);
  const verifyAbortRef = useRef<AbortController | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const {
    containerRef: captchaContainerRef,
    executeCaptcha,
    forceLocalFallback,
  } = useSmartCaptcha(true);

  const runVerification = useCallback(async (rawValue: string, explicitType?: string) => {
    const extracted = extractVerificationParams(rawValue);
    if (!extracted.ref) {
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
    try {
      const captchaPayload = await executeCaptcha();
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
      requestAnimationFrame(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setResult({
        valid: false,
        error: 'Gagal menghubungi server verifikasi dokumen.',
      });
    } finally {
      if (verifyAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [executeCaptcha, forceLocalFallback]);

  useEffect(() => {
    const extracted = extractVerificationParams(initialRef);
    if (!extracted.ref) return;

    const controller = new AbortController();
    const qs = new URLSearchParams({ ref: extracted.ref });
    const finalType = initialType || extracted.type;
    if (finalType) qs.set('type', finalType);

    executeCaptcha()
      .then((captchaPayload) =>
        fetch(`/api/public/verifikasi?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'x-captcha-payload': encodeCaptchaHeader(captchaPayload),
          },
        })
      )
      .then((res) => res.json().catch(() => null))
      .then((json: (VerificationResult & { turnstileUnavailable?: boolean }) | null) => {
        setInputRef(extracted.ref);
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
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setResult({
          valid: false,
          error: 'Gagal menghubungi server verifikasi dokumen.',
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialRef, initialType, executeCaptcha, forceLocalFallback]);

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
    setScanningCamera(false);
  }, []);

  useEffect(() => {
    return () => {
      verifyAbortRef.current?.abort();
      stopCamera();
    };
  }, [stopCamera]);

  async function startCameraScan() {
    setScanError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScanError(
        'Kamera tidak didukung pada peramban/koneksi ini. Gunakan HTTPS atau unggah gambar QR Code (PNG/JPG).'
      );
      return;
    }

    const sessionId = ++cameraSessionRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
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

      const tick = () => {
        if (cameraSessionRef.current !== sessionId) return;
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        if (
          video.readyState === video.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          ctx
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
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

      const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(img.width, img.height));
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
        setScanError('QR Code tidak terdeteksi pada gambar tersebut.');
        return;
      }

      void runVerification(code.data);
    } catch {
      setScanError('Gagal memindai QR Code dari gambar. Pastikan file berupa gambar PNG/JPG.');
    } finally {
      URL.revokeObjectURL(imgUrl);
      e.target.value = '';
    }
  }

  function handleReset() {
    setInputRef('');
    setResult(null);
    setScanError(null);
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
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight break-words">
          Verifikasi Dokumen &amp; QR Code
        </h1>
        <p className="text-xs sm:text-sm text-slate-200/90 max-w-2xl leading-relaxed">
          Periksa keaslian Slip Tabungan, Slip SPP/Komite, Slip Honorarium, Kartu Pelajar, Kartu
          E-Library, Rekap Absensi, Dokumen Penilaian &amp; Raport, maupun Surat Resmi yang
          diterbitkan lembaga melalui scan QR Code atau input nomor referensi.
        </p>
      </section>

      {/* Input & Scanner Panel */}
      <div className="glass-card rounded-3xl p-5 sm:p-8 space-y-5 border border-slate-200/80">
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
            Masukkan Nomor Referensi / Kode Dokumen
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="verifikasi-ref-input"
                type="text"
                value={inputRef}
                onChange={(e) => setInputRef(e.target.value)}
                placeholder="Contoh: TRX-12345678, HON-202611-..., SPP-..., LIB-..."
                className="w-full min-h-[46px] rounded-2xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600"
              />
              {inputRef && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Bersihkan input referensi"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck2 className="w-4 h-4" />
              )}
              <span>Verifikasi Dokumen</span>
            </button>
          </div>
        </form>

        {/* QR Scanner Controls */}
        <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {!scanningCamera ? (
            <button
              type="button"
              onClick={startCameraScan}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Camera className="w-4 h-4 shrink-0" /> Scan QR via Kamera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
            >
              <CameraOff className="w-4 h-4 shrink-0" /> Hentikan Kamera
            </button>
          )}

          <label className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition">
            <ImageUp className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Scan QR dari File Gambar (PNG/JPG)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="sr-only"
            />
          </label>
        </div>

        {scanError && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed"
          >
            {scanError}
          </div>
        )}

        {scanningCamera && (
          <div className="rounded-3xl overflow-hidden border border-slate-300 bg-slate-950 relative max-w-md mx-auto">
            <video ref={videoRef} playsInline muted className="w-full h-auto block" />
            <div className="p-2.5 text-center text-[11px] text-emerald-300 bg-slate-900/90 flex items-center justify-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>Arahkan kamera ke QR Code pada dokumen...</span>
            </div>
          </div>
        )}
      </div>

      {/* Verification Result */}
      {result && (
        <div
          ref={resultCardRef}
          className={`rounded-3xl border p-5 sm:p-8 shadow-sm space-y-4 ${
            result.valid
              ? 'border-emerald-300 bg-emerald-50/70'
              : 'border-rose-300 bg-rose-50/70'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {result.valid ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      result.valid
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {result.valid
                      ? result.statusLabel || 'TERVERIFIKASI SAH'
                      : 'TIDAK TERVERIFIKASI'}
                  </span>
                  {result.documentType && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/80 text-slate-700 border border-slate-200">
                      {result.documentType.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 break-words">
                  {result.valid ? result.title : 'Dokumen Tidak Ditemukan'}
                </h2>
                {result.reference && (
                  <p className="text-xs font-mono text-slate-600 break-all">
                    Referensi: {result.reference}
                  </p>
                )}
                {issuedDateLabel && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Diterbitkan: {issuedDateLabel}</span>
                  </p>
                )}
                {result.error && (
                  <p className="text-xs text-rose-700 mt-1 break-words">{result.error}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-xs font-semibold text-slate-700 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cek Lainnya
            </button>
          </div>

          {result.valid && result.details && result.details.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-200/80 divide-y divide-slate-100 overflow-hidden">
              {result.details.map((d, idx) => (
                <div
                  key={`${d.label}-${idx}`}
                  className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs min-w-0"
                >
                  <span className="text-slate-500 font-medium">{d.label}</span>
                  <span className="font-bold text-slate-900 break-words sm:text-right">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <SmartCaptchaMount containerRef={captchaContainerRef} />
    </div>
  );
}

export default function VerifikasiPage() {
  return (
    <PublicShell>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
            <span>Memuat halaman verifikasi...</span>
          </div>
        }
      >
        <VerifikasiContent />
      </Suspense>
    </PublicShell>
  );
}
