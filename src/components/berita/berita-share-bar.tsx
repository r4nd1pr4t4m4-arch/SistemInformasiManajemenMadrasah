'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

export function BeritaShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (typeof window === 'undefined') return;
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleWhatsAppShare() {
    if (typeof window === 'undefined') return;
    const text = encodeURIComponent(`${title}\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleWhatsAppShare}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Bagikan ke WhatsApp</span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 text-xs font-semibold transition"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? 'Tautan Tersalin' : 'Salin Tautan'}</span>
      </button>
    </div>
  );
}
