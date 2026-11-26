'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

async function copyTextSafely(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Lanjut ke fallback execCommand di bawah
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

export function BeritaShareBar({ title, url }: { title: string; url?: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function getTargetUrl(): string {
    if (url) {
      if (typeof window !== 'undefined' && url.startsWith('/')) {
        return `${window.location.origin}${url}`;
      }
      return url;
    }
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  async function handleCopy() {
    const targetUrl = getTargetUrl();
    if (!targetUrl) return;

    const ok = await copyTextSafely(targetUrl);
    setCopyStatus(ok ? 'copied' : 'failed');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopyStatus('idle');
    }, 2500);
  }

  function handleWhatsAppShare() {
    const targetUrl = getTargetUrl();
    if (!targetUrl || typeof window === 'undefined') return;
    const text = encodeURIComponent(`${title}\n${targetUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <button
        type="button"
        onClick={handleWhatsAppShare}
        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
      >
        <Share2 className="w-3.5 h-3.5 shrink-0" />
        <span>Bagikan ke WhatsApp</span>
      </button>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-live="polite"
        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 text-xs font-semibold transition"
      >
        {copyStatus === 'copied' ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <Copy className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {copyStatus === 'copied'
            ? 'Tautan Tersalin'
            : copyStatus === 'failed'
              ? 'Gagal Menyalin'
              : 'Salin Tautan'}
        </span>
      </button>
    </div>
  );
}
