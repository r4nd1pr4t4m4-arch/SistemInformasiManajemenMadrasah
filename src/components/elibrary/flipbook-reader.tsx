'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  ShieldAlert,
  X,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Loader2,
  EyeOff,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface FlipbookReaderProps {
  bookId: string;
  bookTitle: string;
  author: string;
  isPublicMode?: boolean;
  isPremium?: boolean;
  grantExpiresAt?: string | null;
  onClose: () => void;
}

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 1.75];

export function FlipbookReader({
  bookId,
  bookTitle,
  author,
  isPublicMode = false,
  isPremium = false,
  grantExpiresAt,
  onClose,
}: FlipbookReaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentSpreadStart, setCurrentSpreadStart] = useState(1); // 1, 3, 5... (desktop) or 1, 2, 3... (mobile)
  const [zoom, setZoom] = useState(1);
  const [zoomTooltipOpen, setZoomTooltipOpen] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const pdfDocRef = useRef<unknown>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const maxAllowedPages =
    isPublicMode && totalPages > 0 ? Math.max(1, Math.ceil(totalPages * 0.1)) : totalPages;

  // Detect mobile viewport (single-page flipbook on mobile, 2-page spread on desktop)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  function playPageFlipSound() {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const duration = 0.16;
      const sampleRate = ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Synthesize crisp paper-flip rustle envelope
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const env = Math.sin(Math.PI * t) * Math.pow(1 - t, 0.7);
        data[i] = (Math.random() * 2 - 1) * env * 0.35;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + duration);
      filter.Q.value = 0.9;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch {
      // Ignore Web Audio errors if blocked
    }
  }

  // Anti-screenshot, anti-save, anti-print, anti-browser-zoom listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      // Block PrintScreen, Ctrl+S, Ctrl+P, Ctrl+U, Ctrl+Shift+I, F12
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c'].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', '3', '4', '5'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'PrintScreen') {
          setIsBlurred(true);
        }
        return;
      }

      // Block keyboard zoom (Ctrl + +/-/0)
      if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    }

    function handleBlur() {
      setIsBlurred(true);
    }

    function handleVisibility() {
      if (document.hidden) setIsBlurred(true);
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Load PDF document via protected stream endpoint (no direct URL exposure)
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/layanan/perpustakaan/ebook-stream?book_id=${encodeURIComponent(bookId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Gagal memuat E-Book.');
        }

        const buffer = await res.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        if (!cancelled) {
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
          setCurrentSpreadStart(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal membuka E-Book.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Render current 2-page spread onto canvases
  useEffect(() => {
    let cancelled = false;

    async function renderPageToCanvas(pageNum: number, canvas: HTMLCanvasElement | null) {
      if (!canvas || !pdfDocRef.current) return;
      if (pageNum < 1 || pageNum > maxAllowedPages) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const pdf = pdfDocRef.current as {
        getPage: (n: number) => Promise<{
          getViewport: (opts: { scale: number }) => { width: number; height: number };
          render: (opts: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
          }) => { promise: Promise<void> };
        }>;
      };

      const page = await pdf.getPage(pageNum);
      if (cancelled) return;

      const baseScale = 1.15 * zoom;
      const viewport = page.getViewport({ scale: baseScale });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    if (!loading && !error && totalPages > 0) {
      renderPageToCanvas(currentSpreadStart, leftCanvasRef.current);
      if (!isMobile) {
        renderPageToCanvas(currentSpreadStart + 1, rightCanvasRef.current);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [loading, error, totalPages, maxAllowedPages, currentSpreadStart, zoom, isMobile]);

  const stepSize = isMobile ? 1 : 2;

  function handlePrevSpread() {
    if (currentSpreadStart <= 1) return;
    playPageFlipSound();
    setFlipDirection('prev');
    setTimeout(() => setFlipDirection(null), 260);
    setCurrentSpreadStart((p) => Math.max(1, p - stepSize));
  }

  function handleNextSpread() {
    if (currentSpreadStart + stepSize > maxAllowedPages) return;
    playPageFlipSound();
    setFlipDirection('next');
    setTimeout(() => setFlipDirection(null), 260);
    setCurrentSpreadStart((p) => p + stepSize);
  }

  const rightPageNumber = currentSpreadStart + 1;
  const isRightPageLocked = rightPageNumber > maxAllowedPages;
  const canGoNext = currentSpreadStart + stepSize <= maxAllowedPages;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ touchAction: 'pan-x pan-y' }}
      className="flipbook-protected-root fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col select-none print:hidden"
    >
      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold truncate">{bookTitle}</h2>
              {isPremium && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold shrink-0">
                  PREMIUM
                </span>
              )}
              {isPublicMode && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-bold shrink-0">
                  PRATINJAU PUBLIK 10%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Penulis: {author}
              {grantExpiresAt
                ? ` • Izin aktif s/d ${new Date(grantExpiresAt).toLocaleString('id-ID')}`
                : ''}
            </p>
          </div>
        </div>

        {/* Sound Toggle + Tooltip-Only Zoom Control + Close */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              soundEnabled
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
            title={soundEnabled ? 'Nonaktifkan Suara Balik Halaman' : 'Aktifkan Suara Balik Halaman'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomTooltipOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 transition"
              title="Kontrol Zoom Flipbook"
            >
              <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
              Zoom: {Math.round(zoom * 100)}%
            </button>

            {zoomTooltipOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-3 z-50 space-y-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">
                  Tooltip Kontrol Zoom (Khusus)
                </p>
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = ZOOM_LEVELS.indexOf(zoom);
                      if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
                    }}
                    disabled={zoom <= ZOOM_LEVELS[0]}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1">
                    {ZOOM_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setZoom(lvl)}
                        className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${
                          zoom === lvl
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {Math.round(lvl * 100)}%
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = ZOOM_LEVELS.indexOf(zoom);
                      if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
                    }}
                    disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition"
            title="Tutup Pembaca Flipbook"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Flipbook Stage (items-start + m-auto ensures top of ebook is NEVER clipped and always scrollable) */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 relative flex">
        {isBlurred && (
          <div
            onClick={() => setIsBlurred(false)}
            className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer"
          >
            <EyeOff className="w-10 h-10 text-amber-400 mb-3" />
            <h3 className="text-base font-bold text-white">Konten E-Book Dilindungi</h3>
            <p className="text-xs text-slate-300 max-w-md mt-1">
              Tangkapan layar, unduhan, dan pembukaan di tab baru dinonaktifkan. Klik di sini untuk kembali membaca.
            </p>
          </div>
        )}

        {loading && (
          <div className="m-auto flex flex-col items-center gap-2 text-slate-300 text-sm">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Menyiapkan Flipbook E-Book...</span>
          </div>
        )}

        {error && (
          <div className="m-auto max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 text-center space-y-3 text-white">
            <ShieldAlert className="w-9 h-9 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold">
              {error.toLowerCase().includes('izin') || error.toLowerCase().includes('premium')
                ? 'Akses E-Book Dibatasi'
                : 'Gagal Memuat Dokumen E-Book'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        )}

        {!loading && !error && totalPages > 0 && (
          <div className="m-auto relative flex flex-col items-center gap-4 max-w-full">
            {/* 1-page Flipbook on Mobile, 2-page Spread on Desktop */}
            <div
              className={`relative flex items-stretch bg-slate-800/70 p-2 sm:p-3 rounded-2xl shadow-2xl border border-slate-700/80 transition-transform duration-200 ${
                flipDirection === 'next'
                  ? '-rotate-y-3 scale-[0.99]'
                  : flipDirection === 'prev'
                  ? 'rotate-y-3 scale-[0.99]'
                  : ''
              }`}
              style={{ perspective: '1400px' }}
            >
              {/* Primary / Left Page */}
              <div
                className={`relative bg-white overflow-hidden shadow-inner ${
                  isMobile ? 'rounded-lg' : 'rounded-l-lg border-r border-slate-300'
                }`}
              >
                <canvas
                  ref={leftCanvasRef}
                  className="block max-w-full h-auto pointer-events-none"
                />
                <WatermarkOverlay />
                <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-mono">
                  Hal. {currentSpreadStart}
                </div>
              </div>

              {/* Center Spine & Right Page (Desktop Only) */}
              {!isMobile && (
                <>
                  <div className="w-2 bg-gradient-to-r from-slate-400/50 via-slate-600/70 to-slate-400/50" />
                  <div className="relative bg-white rounded-r-lg overflow-hidden shadow-inner min-w-[260px] flex items-center justify-center">
                    {isRightPageLocked ? (
                      <div className="p-8 text-center max-w-xs space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-black text-slate-900">
                          Batas Pratinjau Publik (10%)
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Pengunjung publik hanya dapat membaca maksimal{' '}
                          <strong>{maxAllowedPages} halaman</strong> (10% dari {totalPages} halaman).
                          Silakan masuk ke Portal Terpadu untuk membaca buku secara penuh.
                        </p>
                      </div>
                    ) : (
                      <>
                        <canvas
                          ref={rightCanvasRef}
                          className="block max-w-full h-auto pointer-events-none"
                        />
                        <WatermarkOverlay />
                        <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-mono">
                          Hal. {rightPageNumber}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {isMobile && isPublicMode && currentSpreadStart >= maxAllowedPages && (
              <div className="rounded-2xl bg-amber-950/70 border border-amber-500/40 px-4 py-2.5 text-center text-[11px] text-amber-200 max-w-sm">
                <Lock className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                Batas pratinjau publik 10% tercapai ({maxAllowedPages} dari {totalPages} hal.). Masuk ke Portal untuk membaca penuh.
              </div>
            )}

            {/* Bottom Flipbook Page Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-slate-900/95 border border-slate-700 rounded-2xl px-3 sm:px-4 py-2 text-white text-xs">
              <button
                type="button"
                onClick={handlePrevSpread}
                disabled={currentSpreadStart <= 1}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold transition"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>

              <span className="px-2 font-mono text-[11px] text-slate-300 text-center">
                Hal. {currentSpreadStart}
                {!isMobile && !isRightPageLocked && rightPageNumber <= totalPages
                  ? `–${rightPageNumber}`
                  : ''}{' '}
                / {totalPages}
                {isPublicMode ? ` (Publik: maks ${maxAllowedPages})` : ''}
              </span>

              <button
                type="button"
                onClick={handleNextSpread}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-semibold transition"
              >
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WatermarkOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.09]"
    >
      <span className="-rotate-30 text-slate-900 font-black text-lg tracking-widest whitespace-nowrap">
        E-LIBRARY PROTECTED • NO DOWNLOAD / SCREENSHOT
      </span>
    </div>
  );
}
