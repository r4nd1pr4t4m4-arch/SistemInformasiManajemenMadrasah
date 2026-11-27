'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { NoSearchResultState } from '@/components/ui/state-views';

export interface CommandPaletteItem {
  href: string;
  label: string;
  group: string;
  keywords?: string;
}

export interface PortalCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
}

export function PortalCommandPalette({ open, onClose, items }: PortalCommandPaletteProps) {
  if (!open) return null;
  return <PortalCommandPaletteContent open={open} onClose={onClose} items={items} />;
}

function PortalCommandPaletteContent({ open, onClose, items }: PortalCommandPaletteProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useFocusTrap(dialogRef, open);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.group.toLowerCase().includes(q) ||
          (it.keywords && it.keywords.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [items, query]);

  const activeIndex = filtered.length > 0 ? Math.min(selectedIndex, filtered.length - 1) : 0;

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered.length]);

  function navigateTo(href: string) {
    onClose();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      navigateTo(filtered[activeIndex].href);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Cepat Menu Portal"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-[8dvh] sm:pt-[10dvh] px-3 sm:px-4"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-200/80">
          <Search className="w-4 h-4 text-emerald-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Ketik nama menu, modul, atau halaman portal..."
            aria-label="Cari menu portal cepat"
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              aria-label="Bersihkan kata kunci"
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-[55dvh] overflow-y-auto p-2.5 space-y-1">
          {filtered.length === 0 ? (
            <NoSearchResultState
              compact
              query={query}
              title="Menu Tidak Ditemukan"
              description="Coba kata kunci lain sesuai modul yang tersedia untuk peran akun Anda."
              onReset={() => setQuery('')}
              resetLabel="Hapus Pencarian"
              className="border-0 shadow-none bg-transparent"
            />
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={`${item.href}-${item.label}`}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => navigateTo(item.href)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.group}</p>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 shrink-0">
                      <CornerDownLeft className="w-3 h-3" /> Buka
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Gunakan ↑ ↓ untuk memilih, Enter untuk membuka</span>
          <span className="font-semibold text-slate-600">{filtered.length} menu</span>
        </div>
      </div>
    </div>
  );
}
