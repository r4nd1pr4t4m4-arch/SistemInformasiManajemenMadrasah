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
  const [bookSize, setBookSize] = useState<{ width: number; height: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const pdfDocRef = useRef<PdfDocumentLike | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const flipBookHostRef = useRef<HTMLDivElement | null>(null);
  const pageFlipInstanceRef = useRef<PageFlip | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const currentPageRef = useRef(1);
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const renderingPagesRef = useRef<Set<number>>(new Set());
  const pageScaleRef = useRef<{ pageWidth: number; baseWidth: number }>({
    pageWidth: 400,
    baseWidth: 400,
  });

  soundEnabledRef.current = soundEnabled;
  currentPageRef.current = currentPage;

  const maxAllowedPages =
    isPublicMode && totalPages > 0 ? Math.max(1, Math.ceil(totalPages * 0.1)) : totalPages;

  const hasPublicLockPage = isPublicMode && totalPages > maxAllowedPages;
  const displayPageCount = hasPublicLockPage ? maxAllowedPages + 1 : maxAllowedPages;

  // Lock background page scroll while Flipbook is open
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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

  // Stream PDF via HTTP Range Requests + local worker (no full-file wait!)
  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy?: () => void; promise: Promise<unknown> } | null = null;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      renderedPagesRef.current.clear();
      renderingPagesRef.current.clear();
      canvasMapRef.current.clear();

      const streamUrl = `/api/layanan/perpustakaan/ebook-stream?book_id=${encodeURIComponent(bookId)}`;

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        loadingTask = pdfjsLib.getDocument({
          url: streamUrl,
          rangeChunkSize: 65536,
          disableAutoFetch: true,
          disableStream: false,
        });
        const pdf = (await loadingTask.promise) as unknown as PdfDocumentLike;
        if (!cancelled) {
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
        }
      } catch {
        if (!cancelled) {
          // Fetch exact JSON error message from stream endpoint if available
          try {
            const errRes = await fetch(streamUrl, { cache: 'no-store' });
            if (!errRes.ok) {
              const errJson = await errRes.json().catch(() => ({}));
              setError(errJson.error || 'Gagal memuat E-Book.');
            } else {
              setError('Struktur dokumen E-Book tidak dapat dibaca.');
            }
          } catch {
            setError('Gagal membuka aliran E-Book.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      if (loadingTask?.destroy) {
        try {
          loadingTask.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [bookId]);

  async function renderPageWindow(centerPage: number) {
    const pdf = pdfDocRef.current;
    if (!pdf) return;

    const minPage = Math.max(1, centerPage - 2);
    const maxPage = Math.min(maxAllowedPages, centerPage + 4);
    const targets: number[] = [];

    for (let p = minPage; p <= maxPage; p++) {
      if (!renderedPagesRef.current.has(p) && !renderingPagesRef.current.has(p)) {
        targets.push(p);
        renderingPagesRef.current.add(p);
      }
    }

    if (targets.length === 0) return;

    const { pageWidth, baseWidth } = pageScaleRef.current;
    await Promise.all(
      targets.map(async (pageNum) => {
        try {
          const canvas = canvasMapRef.current.get(pageNum);
          if (!canvas) return;
          const page = await pdf.getPage(pageNum);
          const vp = page.getViewport({ scale: (pageWidth / baseWidth) * 1.5 });
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          renderedPagesRef.current.add(pageNum);
        } finally {
          renderingPagesRef.current.delete(pageNum);
        }
      })
    );
  }

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

      setBookSize({
        width: isMobile ? pageWidth : pageWidth * 2,
        height: pageHeight,
      });
      pageScaleRef.current = { pageWidth, baseWidth: baseVp.width };
      canvasMapRef.current.clear();
      renderedPagesRef.current.clear();
      renderingPagesRef.current.clear();

      const pageElements: HTMLElement[] = [];

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
        canvasMapRef.current.set(pageNum, canvas);
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
        const nextPage = idx + 1;
        setCurrentPage(nextPage);
        playPageFlipSound();
        void renderPageWindow(nextPage);
      });
      pageFlipInstanceRef.current = instance;

      // Render only the initial visible window (±3 pages) immediately
      await renderPageWindow(startIdx + 1);
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

  // Ensure nearby pages stay rendered when currentPage updates
  useEffect(() => {
    if (!loading && !error && totalPages > 0) {
      void renderPageWindow(currentPage);
    }
  }, [currentPage, loading, error, totalPages]);

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

      {/* Flipbook Stage */}
      <div
        ref={stageRef}
        className={`flex-1 min-h-0 min-w-0 overflow-auto overscroll-contain p-4 sm:p-8 relative flex ${
          zoom > 1 ? 'flipbook-zoomed' : 'no-scrollbar'
        }`}
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {isBlurred && (
          <div
            onClick={() => setIsBlurred(false)}
            className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer"
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
          <div className="m-auto shrink-0 relative flex flex-col items-center gap-3">
            <p className="text-[11px] text-slate-400 text-center">
              {zoom > 1
                ? 'Geser area kanvas untuk menggulir halaman yang diperbesar'
                : 'Geser atau klik sudut halaman untuk membalik kertas buku'}
            </p>

            {/* Sized Zoom Wrapper ensures exact layout scrollWidth/scrollHeight when zoomed and handles mouse drag-to-pan */}
            <div
              onPointerDown={(e) => {
                if (zoom <= 1 || e.pointerType !== 'mouse' || e.button !== 0 || !stageRef.current) {
                  return;
                }
                panStateRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  scrollLeft: stageRef.current.scrollLeft,
                  scrollTop: stageRef.current.scrollTop,
                };
                setIsPanning(true);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!panStateRef.current || !stageRef.current) return;
                stageRef.current.scrollLeft =
                  panStateRef.current.scrollLeft - (e.clientX - panStateRef.current.startX);
                stageRef.current.scrollTop =
                  panStateRef.current.scrollTop - (e.clientY - panStateRef.current.startY);
              }}
              onPointerUp={(e) => {
                if (!panStateRef.current) return;
                panStateRef.current = null;
                setIsPanning(false);
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerCancel={() => {
                panStateRef.current = null;
                setIsPanning(false);
              }}
              style={{
                ...(bookSize
                  ? {
                      width: `${Math.round(bookSize.width * zoom)}px`,
                      height: `${Math.round(bookSize.height * zoom)}px`,
                    }
                  : {}),
                touchAction: 'pan-x pan-y',
              }}
              className={`relative shrink-0 shadow-2xl rounded-xl overflow-hidden transition-[width,height] duration-150 ${
                zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
              }`}
            >
              <div
                ref={flipBookHostRef}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: bookSize ? `${bookSize.width}px` : undefined,
                  height: bookSize ? `${bookSize.height}px` : undefined,
                  transition: 'transform 150ms ease',
                  pointerEvents: zoom > 1 ? 'none' : 'auto',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pinned Bottom Flipbook Page Controls */}
      {!loading && !error && totalPages > 0 && (
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 flex items-center justify-center shrink-0">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-white text-xs">
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
  );
}
