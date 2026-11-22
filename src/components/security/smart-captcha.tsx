'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptchaPayload } from '@/lib/security/captcha-types';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          size?: 'normal' | 'compact' | 'invisible';
          execution?: 'render' | 'execute';
          appearance?: 'always' | 'execute' | 'interaction-only';
          callback?: (token: string) => void;
          'error-callback'?: (errorCode?: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
        }
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileLoadPromise: Promise<boolean> | null = null;

function loadTurnstileScript(timeoutMs = 5000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`
    );

    const timer = window.setTimeout(() => {
      resolve(Boolean(window.turnstile));
    }, timeoutMs);

    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      resolve(ok);
    };

    if (existing) {
      if (window.turnstile) {
        finish(true);
        return;
      }
      existing.addEventListener('load', () => finish(Boolean(window.turnstile)), { once: true });
      existing.addEventListener('error', () => finish(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => finish(Boolean(window.turnstile));
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });

  return turnstileLoadPromise;
}

function isClientBypassed(): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_CAPTCHA === 'true') {
    return false;
  }
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }
  }
  return false;
}

async function solveLocalPow(nonce: string, difficulty: number): Promise<string> {
  const prefix = '0'.repeat(Math.max(1, Math.min(6, difficulty)));
  const encoder = new TextEncoder();

  for (let counter = 0; counter < 500000; counter++) {
    const candidate = counter.toString(36);
    const data = encoder.encode(`${nonce}:${candidate}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);

    let hex = '';
    for (let i = 0; i < Math.ceil(prefix.length / 2) + 1 && i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    if (hex.startsWith(prefix)) {
      return candidate;
    }
  }

  throw new Error('Gagal menyelesaikan verifikasi lokal.');
}

async function executeLocalFallback(): Promise<CaptchaPayload> {
  const res = await fetch('/api/auth/captcha/challenge', {
    method: 'GET',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as {
    bypassed?: boolean;
    challengeToken?: string;
    nonce?: string;
    difficulty?: number;
    error?: string;
  };

  if (data.bypassed) {
    return { provider: 'bypass' };
  }
  if (!res.ok || !data.challengeToken || !data.nonce) {
    throw new Error(data.error || 'Gagal memuat verifikasi keamanan lokal.');
  }

  const solution = await solveLocalPow(data.nonce, data.difficulty || 3);
  return {
    provider: 'local',
    challengeToken: data.challengeToken,
    solution,
    honeypot: '',
  };
}

export function encodeCaptchaHeader(payload: CaptchaPayload): string {
  const json = JSON.stringify(payload);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(json)));
  }
  return json;
}

export function useSmartCaptcha(enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingResolveRef = useRef<((token: string) => void) | null>(null);
  const pendingRejectRef = useRef<((err: Error) => void) | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const bypassed = isClientBypassed();

  useEffect(() => {
    if (!enabled || bypassed || !siteKey || fallbackActive) return;

    let cancelled = false;
    loadTurnstileScript(5000).then((loaded) => {
      if (cancelled) return;
      if (!loaded || !window.turnstile || !containerRef.current) {
        setFallbackActive(true);
        return;
      }

      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token: string) => {
            const resolve = pendingResolveRef.current;
            pendingResolveRef.current = null;
            pendingRejectRef.current = null;
            resolve?.(token);
          },
          'error-callback': () => {
            setFallbackActive(true);
            const reject = pendingRejectRef.current;
            pendingResolveRef.current = null;
            pendingRejectRef.current = null;
            reject?.(new Error('TURNSTILE_ERROR'));
          },
          'timeout-callback': () => {
            setFallbackActive(true);
            const reject = pendingRejectRef.current;
            pendingResolveRef.current = null;
            pendingRejectRef.current = null;
            reject?.(new Error('TURNSTILE_TIMEOUT'));
          },
        });
        widgetIdRef.current = widgetId;
      } catch {
        setFallbackActive(true);
      }
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Abaikan error cleanup widget
        }
        widgetIdRef.current = null;
      }
    };
  }, [enabled, bypassed, siteKey, fallbackActive]);

  const executeCaptcha = useCallback(async (): Promise<CaptchaPayload> => {
    if (!enabled || bypassed) {
      return { provider: 'bypass' };
    }

    if (!siteKey || fallbackActive || !window.turnstile || !widgetIdRef.current) {
      return executeLocalFallback();
    }

    try {
      const token = await new Promise<string>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pendingResolveRef.current = null;
          pendingRejectRef.current = null;
          setFallbackActive(true);
          reject(new Error('TURNSTILE_EXECUTE_TIMEOUT'));
        }, 6000);

        pendingResolveRef.current = (t: string) => {
          window.clearTimeout(timer);
          resolve(t);
        };
        pendingRejectRef.current = (err: Error) => {
          window.clearTimeout(timer);
          reject(err);
        };

        try {
          window.turnstile!.reset(widgetIdRef.current!);
          window.turnstile!.execute(widgetIdRef.current!);
        } catch {
          window.clearTimeout(timer);
          pendingResolveRef.current = null;
          pendingRejectRef.current = null;
          setFallbackActive(true);
          reject(new Error('TURNSTILE_EXECUTE_ERROR'));
        }
      });

      return { provider: 'turnstile', token };
    } catch {
      // Auto-fallback mulus ke CAPTCHA lokal tanpa error ke pengguna
      setFallbackActive(true);
      return executeLocalFallback();
    }
  }, [enabled, bypassed, siteKey, fallbackActive]);

  const forceLocalFallback = useCallback(() => {
    setFallbackActive(true);
  }, []);

  return {
    containerRef,
    executeCaptcha,
    forceLocalFallback,
    isBypassed: bypassed,
    isFallbackActive: fallbackActive || !siteKey,
  };
}

export function SmartCaptchaMount({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed bottom-2 right-2 z-50"
    />
  );
}
