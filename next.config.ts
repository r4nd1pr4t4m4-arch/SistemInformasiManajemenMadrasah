import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

const isDev = process.env.NODE_ENV === "development";

const SCRIPT_SRC = [
  "script-src 'self' 'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://challenges.cloudflare.com",
].join(" ");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  SCRIPT_SRC,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

function extractHostname(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const normalized = /^https?:\/\//i.test(rawUrl.trim())
      ? rawUrl.trim()
      : `https://${rawUrl.trim()}`;
    return new URL(normalized).hostname || null;
  } catch {
    return null;
  }
}

function buildAllowedImageRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    { protocol: "https", hostname: "**.supabase.co" },
    { protocol: "https", hostname: "**.supabase.in" },
    { protocol: "https", hostname: "**.r2.dev" },
    { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    { protocol: "https", hostname: "**.googleusercontent.com" },
    { protocol: "https", hostname: "avatars.githubusercontent.com" },
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "http", hostname: "localhost" },
    { protocol: "http", hostname: "127.0.0.1" },
  ];

  const envUrls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.R2_PUBLIC_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  const seenHostnames = new Set(patterns.map((p) => p.hostname));
  for (const raw of envUrls) {
    const host = extractHostname(raw);
    if (host && !seenHostnames.has(host)) {
      seenHostnames.add(host);
      patterns.push({ protocol: "https", hostname: host });
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  distDir: isDev ? ".next-cache" : ".next",
  transpilePackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: buildAllowedImageRemotePatterns(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
