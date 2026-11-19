'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Loader2,
  EyeOff,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PageFlip } from 'page-flip';

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

interface PdfDocumentLike {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void> };
  }>;
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [zoomTooltipOpen, setZoomTooltipOpen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const pdfDocRef = useRef<PdfDocumentLike | null>(null);
  const flipBookHostRef = useRef<HTMLDivElement | null>(null);
  const pageFlipInstanceRef = useRef<PageFlip | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const currentPageRef = useRef(1);

  soundEnabledRef.current = soundEnabled;
  currentPageRef.current = currentPage;

  const maxAllowedPages =
    isPublicMode && totalPages > 0 ? Math.max(1, Math.ceil(totalPages * 0.1)) : totalPages;

  const hasPublicLockPage = isPublicMode && totalPages > maxAllowedPages;
  const displayPageCount = hasPublicLockPage ? maxAllowedPages + 1 : maxAllowedPages;

  // Detect mobile viewport (1 page on mobile, 2 pages spread on desktop)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  function playPageFlipSound() {
    if (!soundEnabledRef.current) return;
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

      const duration = 0.18;
      const sampleRate = ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Synthesize crisp paper-flip rustle envelope
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const env = Math.sin(Math.PI * t) * Math.pow(1 - t, 0.65);
        data[i] = (Math.random() * 2 - 1) * env * 0.35;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + duration);
      filter.Q.value = 0.9;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
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

  // Fetch PDF stream via protected endpoint
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/layanan/perpustakaan/ebook-stream?book_id=${encodeURIComponent(bookId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Gagal memuat E-Book.');
        }

        const buffer = await res.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = (await loadingTask.promise) as unknown as PdfDocumentLike;
        if (!cancelled) {
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
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

  // Mount PageFlip (StPageFlip) engine imperatively inside host container
  useEffect(() => {
    const host = flipBookHostRef.current;
    const pdf = pdfDocRef.current;
    if (loading || error || !host || !pdf || totalPages <= 0) return;

    let cancelled = false;
    let instance: PageFlip | null = null;

    async function initFlipbook() {
      if (!host || !pdf) return;

      // Determine page dimensions from PDF page 1 aspect ratio
      const firstPage = await pdf.getPage(1);
      if (cancelled) return;

      const baseVp = firstPage.getViewport({ scale: 1 });
      const aspect = baseVp.height / baseVp.width;

      // Clear host & create an inner stage element so PageFlip.destroy() never detaches flipBookHostRef
      host.innerHTML = '';
      const stageEl = document.createElement('div');
      host.appendChild(stageEl);

      const baseWidth = isMobile
        ? Math.min(340, Math.max(250, window.innerWidth - 40))
        : 400;
      const pageWidth = Math.round(baseWidth);
      const pageHeight = Math.round(pageWidth * aspect);

      const pageElements: HTMLElement[] = [];
      const canvases: Array<{ pageNum: number; canvas: HTMLCanvasElement }> = [];

      for (let pageNum = 1; pageNum <= maxAllowedPages; pageNum++) {
        const pageDiv = document.createElement('div');
        pageDiv.className =
          'relative bg-white overflow-hidden shadow-md border border-slate-200 select-none';
        pageDiv.style.width = `${pageWidth}px`;
        pageDiv.style.height = `${pageHeight}px`;

        const canvas = document.createElement('canvas');
        canvas.className = 'block w-full h-full pointer-events-none';
        pageDiv.appendChild(canvas);

        // Diagonal watermark overlay
        const wm = document.createElement('div');
        wm.className =
          'pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.09]';
        const wmText = document.createElement('span');
        wmText.className =
          '-rotate-30 text-slate-900 font-black text-sm tracking-widest whitespace-nowrap';
        wmText.textContent = 'E-LIBRARY PROTECTED • NO DOWNLOAD / SCREENSHOT';
        wm.appendChild(wmText);
        pageDiv.appendChild(wm);

        // Page number badge
        const badge = document.createElement('div');
        badge.className =
          'absolute bottom-2 right-3 px-2 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-mono pointer-events-none';
        badge.textContent = `Hal. ${pageNum}`;
        pageDiv.appendChild(badge);

        stageEl.appendChild(pageDiv);
        pageElements.push(pageDiv);
        canvases.push({ pageNum, canvas });
      }

      // Append 10% public lock page if applicable
      if (hasPublicLockPage) {
        const lockDiv = document.createElement('div');
        lockDiv.className =
          'relative bg-slate-50 flex flex-col items-center justify-center p-6 text-center border border-amber-200 select-none';
        lockDiv.style.width = `${pageWidth}px`;
        lockDiv.style.height = `${pageHeight}px`;
        lockDiv.innerHTML = `
          <div style="width:48px;height:48px;border-radius:16px;background:#fef3c7;color:#b45309;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:22px;">🔒</div>
          <h4 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">Batas Pratinjau Publik (10%)</h4>
          <p style="font-size:12px;color:#475569;line-height:1.6;max-width:260px;margin:0;">
            Pengunjung publik hanya dapat membaca maksimal <strong>${maxAllowedPages} halaman</strong> (10% dari ${totalPages} halaman).
            Silakan masuk ke Portal Terpadu untuk membaca buku secara penuh.
          </p>
        `;
        stageEl.appendChild(lockDiv);
        pageElements.push(lockDiv);
      }

      const { PageFlip } = await import('page-flip');
      if (cancelled) return;

      const startIdx = Math.min(
        Math.max(0, currentPageRef.current - 1),
        Math.max(0, pageElements.length - 1)
      );

      instance = new PageFlip(stageEl, {
        width: pageWidth,
        height: pageHeight,
        size: 'fixed',
        startPage: startIdx,
        usePortrait: isMobile,
        showCover: false,
        drawShadow: true,
        maxShadowOpacity: 0.45,
        flippingTime: 650,
        useMouseEvents: true,
        mobileScrollSupport: false,
        swipeDistance: 30,
      });

      instance.loadFromHTML(pageElements);
      instance.on('flip', (e) => {
        const idx = Number(e.data) || 0;
        setCurrentPage(idx + 1);
        playPageFlipSound();
      });
      pageFlipInstanceRef.current = instance;

      // Render PDF pages at high resolution (2x) so tooltip zoom stays crisp without re-mounting PageFlip
      const ordered = [...canvases].sort(
        (a, b) => Math.abs(a.pageNum - 1 - startIdx) - Math.abs(b.pageNum - 1 - startIdx)
      );

      for (const item of ordered) {
        if (cancelled) break;
        const page = await pdf.getPage(item.pageNum);
        if (cancelled) break;
        const vp = page.getViewport({ scale: (pageWidth / baseVp.width) * 2 });
        const ctx = item.canvas.getContext('2d');
        if (!ctx) continue;
        item.canvas.width = vp.width;
        item.canvas.height = vp.height;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
    }

    initFlipbook();

    return () => {
      cancelled = true;
      if (instance) {
        try {
          instance.destroy();
        } catch {
          // ignore cleanup error
        }
      }
      if (host) host.innerHTML = '';
      pageFlipInstanceRef.current = null;
    };
  }, [loading, error, totalPages, maxAllowedPages, hasPublicLockPage, isMobile]);

  function handlePrev() {
    if (!pageFlipInstanceRef.current) return;
    pageFlipInstanceRef.current.flipPrev();
  }

  function handleNext() {
    if (!pageFlipInstanceRef.current) return;
    pageFlipInstanceRef.current.flipNext();
  }

  return (
    <div
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

      {/* Flipbook Stage (m-auto ensures top of ebook is never clipped and always scrollable) */}
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
            <p className="text-[11px] text-slate-400 text-center">
              Geser atau klik sudut halaman untuk membalik kertas buku
            </p>

            {/* StPageFlip Host Container scaled via CSS zoom without destroying canvases */}
            <div
              ref={flipBookHostRef}
              style={{ zoom }}
              className="shadow-2xl rounded-xl overflow-visible transition-all duration-150"
            />

            {/* Bottom Flipbook Page Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-slate-900/95 border border-slate-700 rounded-2xl px-3 sm:px-4 py-2 text-white text-xs">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold transition"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>

              <span className="px-2 font-mono text-[11px] text-slate-300 text-center">
                Hal. {Math.min(currentPage, totalPages)} / {totalPages}
                {isPublicMode ? ` (Publik: maks ${maxAllowedPages})` : ''}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentPage >= displayPageCount}
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
