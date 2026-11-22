'use client';

import { useState, type ReactNode } from 'react';

interface InstitutionLogoProps {
  logoUrl?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
}

export function InstitutionLogo({
  logoUrl,
  alt,
  className = 'w-9 h-9 rounded-xl object-contain bg-white border border-slate-200/80 p-0.5 shadow-sm shrink-0',
  fallback,
}: InstitutionLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = logoUrl?.trim() || '';

  if (!src || failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
