'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  FileCheck2,
  ImageUp,
  Loader2,
  QrCode,
  Search,
  ShieldCheck,
  XCircle,
  CameraOff,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { extractVerificationParams } from '@/lib/verification/document-verify';

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

function VerifikasiContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const initialType = searchParams.get('type') || '';

  const [inputRef, setInputRef] = useState(initialRef);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [scanningCamera, setScanningCamera] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const runVerification = useCallback(async (rawValue: string, explicitType?: string) => {
    const extracted = extractVerificationParams(rawValue);
    if (!extracted.ref) {
      setResult({
        valid: false,
        error: 'Masukkan nomor referensi dokumen atau scan QR Code terlebih dahulu.',
      });
      return;
    }

    setInputRef(extracted.ref);
    setLoading(true);
    setScanError(null);
    try {
      const qs = new URLSearchParams({ ref: extracted.ref });
      const finalType = explicitType || extracted.type;
      if (finalType) qs.set('type', finalType);
      const res = await fetch(`/api/public/verifikasi?${qs.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as VerificationResult;
      setResult(json);
    } catch {
      setResult({
        valid: false,
        error: 'Gagal menghubungi server verifikasi dokumen.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef) {
      void runVerification(initialRef, initialType || undefined);
    }
  }, [initialRef, initialType, runVerification]);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanningCamera(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function startCameraScan() {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanningCamera(true);

      const jsQR = (await import('jsqr')).default;

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
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
        'Tidak dapat mengakses kamera perangkat. Pastikan izin kamera aktif atau gunakan unggah gambar PNG.'
      );
      stopCamera();
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    try {
      const jsQR = (await import('jsqr')).default;
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal membaca gambar.'));
        img.src = imgUrl;
      });
      URL.revokeObjectURL(imgUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia.');
      ctx.drawImage(img, 0, 0);
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
      setScanError('Gagal memindai QR Code dari gambar.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white p-6 sm:p-10 shadow-xl space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          Validasi Keaslian Dokumen Resmi
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Verifikasi Dokumen &amp; QR Code
        </h1>
        <p className="text-sm text-slate-200/90 max-w-2xl leading-relaxed">
          Periksa keaslian Slip Tabungan, Slip SPP/Komite, Slip Honorarium, Kartu Pelajar, Kartu E-Library, Rekap Absensi, maupun Surat Resmi yang diterbitkan lembaga melalui scan QR Code atau input nomor referensi.
        </p>
      </section>

      {/* Input & Scanner Panel */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 border border-slate-200/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runVerification(inputRef);
          }}
          className="space-y-2"
        >
          <label className="block text-xs font-bold text-slate-700">
            Masukkan Nomor Referensi / Kode Dokumen
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputRef}
                onChange={(e) => setInputRef(e.target.value)}
                placeholder="Contoh: TRX-12345678, HON-202611-..., SPP-..., LIB-..., atau Nomor Surat"
                className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
              Verifikasi Dokumen
            </button>
          </div>
        </form>

        {/* QR Scanner Controls */}
        <div className="pt-4 border-t border-slate-200/70 flex flex-wrap items-center gap-3">
          {!scanningCamera ? (
            <button
              type="button"
              onClick={startCameraScan}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Camera className="w-4 h-4" /> Scan QR via Kamera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
            >
              <CameraOff className="w-4 h-4" /> Hentikan Kamera
            </button>
          )}

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition">
            <ImageUp className="w-4 h-4 text-emerald-700" />
            Scan QR dari File Gambar (PNG/JPG)
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        {scanError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            {scanError}
          </div>
        )}

        {scanningCamera && (
          <div className="rounded-3xl overflow-hidden border border-slate-300 bg-slate-950 relative max-w-md mx-auto">
            <video ref={videoRef} playsInline muted className="w-full h-auto block" />
            <div className="p-2.5 text-center text-[11px] text-emerald-300 bg-slate-900/90 flex items-center justify-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> Arahkan kamera ke QR Code pada dokumen...
            </div>
          </div>
        )}
      </div>

      {/* Verification Result */}
      {result && (
        <div
          className={`rounded-3xl border p-6 sm:p-8 shadow-sm space-y-4 ${
            result.valid
              ? 'border-emerald-300 bg-emerald-50/70'
              : 'border-rose-300 bg-rose-50/70'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.valid ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  result.valid
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {result.valid ? result.statusLabel || 'TERVERIFIKASI SAH' : 'TIDAK TERVERIFIKASI'}
              </span>
              <h2 className="text-lg font-black text-slate-900">
                {result.valid ? result.title : 'Dokumen Tidak Ditemukan'}
              </h2>
              {result.reference && (
                <p className="text-xs font-mono text-slate-600">Referensi: {result.reference}</p>
              )}
              {result.error && <p className="text-xs text-rose-700 mt-1">{result.error}</p>}
            </div>
          </div>

          {result.valid && result.details && result.details.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-200/80 divide-y divide-slate-100 overflow-hidden">
              {result.details.map((d) => (
                <div
                  key={d.label}
                  className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                >
                  <span className="text-slate-500 font-medium">{d.label}</span>
                  <span className="font-bold text-slate-900">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifikasiPage() {
  return (
    <PublicShell>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat halaman verifikasi...
          </div>
        }
      >
        <VerifikasiContent />
      </Suspense>
    </PublicShell>
  );
}
