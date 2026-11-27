'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
} from 'lucide-react';

interface GateLogRow {
  id: string;
  person_type: 'SISWA' | 'GTK';
  scan_type: 'MASUK' | 'PULANG';
  scanned_at: string;
  student?: { full_name: string; nis: string | null } | null;
  teacher?: { full_name: string; nip: string | null } | null;
}

function formatSafeTimeWib(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export default function QrGerbangPage() {
  const [scanType, setScanType] = useState<'MASUK' | 'PULANG'>('MASUK');
  const [manualCode, setManualCode] = useState('');
  const [logs, setLogs] = useState<GateLogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastScannedRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const logsAbortRef = useRef<AbortController | null>(null);

  const loadLogs = useCallback(async () => {
    logsAbortRef.current?.abort();
    const controller = new AbortController();
    logsAbortRef.current = controller;

    setLoadingLogs(true);
    setLogsError(null);
    try {
      const res = await fetch('/api/akademik/presensi/qr-gerbang', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (res.ok) {
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } else {
        setLogsError(data.error || 'Gagal memuat log presensi gerbang.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLogsError('Tidak dapat terhubung ke server untuk memuat log gerbang.');
      }
    } finally {
      if (!controller.signal.aborted) setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      logsAbortRef.current?.abort();
    };
  }, [loadLogs]);

  const submitScan = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;
      const now = Date.now();
      if (lastScannedRef.current.code === trimmed && now - lastScannedRef.current.at < 4000) {
        return;
      }
      lastScannedRef.current = { code: trimmed, at: now };

      setSubmitting(true);
      try {
        const res = await fetch('/api/akademik/presensi/qr-gerbang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawCode: trimmed, scanType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatusMsg({ type: 'err', text: data.error || 'Scan QR gagal.' });
        } else {
          setStatusMsg({
            type: 'ok',
            text: `${data.personName} (${data.personType}) tercatat ${data.scanType} pukul ${data.timeWib} WIB.`,
          });
          setManualCode('');
          await loadLogs();
        }
      } catch {
        setStatusMsg({ type: 'err', text: 'Gagal terhubung ke server saat mencatat presensi.' });
      } finally {
        setSubmitting(false);
      }
    },
    [scanType, loadLogs]
  );

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastDecodeAt = 0;

    const handleVisibility = () => {
      if (document.hidden) {
        setCameraOn(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    async function startCam() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatusMsg({
          type: 'err',
          text: 'Browser tidak mendukung akses kamera. Gunakan input manual/USB scanner.',
        });
        setCameraOn(false);
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = (ts: number) => {
          if (cancelled) return;
          if (ts - lastDecodeAt >= 150) {
            lastDecodeAt = ts;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
              const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
              const w = Math.max(1, Math.round(video.videoWidth * scale));
              const h = Math.max(1, Math.round(video.videoHeight * scale));
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: 'attemptBoth',
                });
                if (decoded?.data) {
                  void submitScan(decoded.data);
                }
              }
            }
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setStatusMsg({
            type: 'err',
            text: 'Kamera tidak dapat diakses. Gunakan input manual/USB scanner.',
          });
          setCameraOn(false);
        }
      }
    }

    void startCam();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, submitScan]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Mode Kios Scanner Presensi QR Gerbang</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pindai Kartu Pelajar Digital atau ID Card GTK untuk mencatat kehadiran &amp; mengirim notifikasi kedatangan ke Orang Tua secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['MASUK', 'PULANG'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={scanType === mode}
                onClick={() => setScanType(mode)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  scanType === mode
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Mode {mode}
              </button>
            ))}
          </div>
        </div>

        {statusMsg && (
          <div
            role={statusMsg.type === 'err' ? 'alert' : 'status'}
            aria-live="polite"
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {statusMsg.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="[overflow-wrap:anywhere]">{statusMsg.text}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5 items-start">
          <div className="space-y-3 min-w-0">
            <button
              type="button"
              onClick={() => setCameraOn((v) => !v)}
              className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition ${
                cameraOn
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-900 hover:bg-emerald-700 text-white'
              }`}
            >
              {cameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              <span>{cameraOn ? 'Matikan Kamera Scanner' : 'Aktifkan Kamera QR Scanner'}</span>
            </button>

            {cameraOn && (
              <div className="rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void submitScan(manualCode);
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                aria-label="Kode QR atau NIS/NISN/NIP manual"
                placeholder="Scan USB barcode atau ketik NIS / NISN / NIP..."
                className="flex-1 min-w-0 min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={submitting || !manualCode.trim()}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition shrink-0"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Catat</span>
              </button>
            </form>
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Log Gerbang Hari Ini ({logs.length})
              </h2>
              <button
                type="button"
                disabled={loadingLogs}
                onClick={() => void loadLogs()}
                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} /> Segarkan
              </button>
            </div>

            {logsError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2"
              >
                <span>{logsError}</span>
                <button
                  type="button"
                  onClick={() => void loadLogs()}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 font-semibold shrink-0"
                >
                  Ulangi
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
              {loadingLogs && logs.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Memuat log gerbang...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-slate-500">
                  Belum ada pemindaian QR gerbang hari ini.
                </div>
              ) : (
                logs.map((l) => (
                  <div
                    key={l.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 border border-slate-200/80 min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {l.student?.full_name || l.teacher?.full_name || '-'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {l.person_type} • {formatSafeTimeWib(l.scanned_at)} WIB
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        l.scan_type === 'MASUK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {l.scan_type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
