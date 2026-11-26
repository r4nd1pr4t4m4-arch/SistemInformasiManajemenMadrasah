'use client';

import { useState } from 'react';

function isSafeImageSrc(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

interface HeadmasterAvatarProps {
  photoUrl?: string | null;
  name: string;
  initials: string;
}

export function HeadmasterAvatar({
  photoUrl,
  name,
  initials,
}: HeadmasterAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = isSafeImageSrc(photoUrl);

  if (!safeSrc || failedSrc === safeSrc) {
    return (
      <div
        aria-hidden="true"
        className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs"
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(safeSrc)}
      className="w-11 h-11 rounded-full object-cover border border-emerald-200 shrink-0 bg-emerald-50"
    />
  );
}

interface PostCoverImageProps {
  coverUrl?: string | null;
  alt: string;
}

export function PostCoverImage({ coverUrl, alt }: PostCoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = isSafeImageSrc(coverUrl);

  if (!safeSrc || failedSrc === safeSrc) {
    return null;
  }

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200/70">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safeSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(safeSrc)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}
