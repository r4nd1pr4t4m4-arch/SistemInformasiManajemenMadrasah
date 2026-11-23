'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { FormFieldFeedback } from '@/components/ui/state-views';

interface MfaFactor {
  id: string;
  friendly_name?: string | null;
}

export interface StepUpModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function StepUpModal(props: StepUpModalProps) {
  if (!props.open) return null;
  return <StepUpModalContent {...props} />;
}

function StepUpModalContent({
  open,
  title = 'Verifikasi Identitas Tambahan',
  description = 'Aksi ini bersifat sensitif. Konfirmasikan identitas Anda terlebih dahulu untuk melanjutkan.',
  onVerified,
  onCancel,
}: StepUpModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [method, setMethod] = useState<'password' | 'mfa'>('password');
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/step-up', { cache: 'no-store' })
      .then((res) => res.json().catch(() => null))
      .then(
        (
          data: {
            verified?: boolean;
            hasMfa?: boolean;
            mfaFactors?: MfaFactor[];
          } | null
        ) => {
          if (!active || !data) return;
          if (data.verified) {
            onVerified();
            return;
          }
          const factors = Array.isArray(data.mfaFactors) ? data.mfaFactors : [];
          setMfaFactors(factors);
          if (factors.length > 0) {
            setMethod('mfa');
            setSelectedFactorId(factors[0].id);
          } else {
            setMethod('password');
          }
        }
      )
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [open, onVerified]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  const canSubmit =
    !submitting &&
    !loadingStatus &&
    (method === 'password'
      ? password.trim().length > 0
      : selectedFactorId.length > 0 && mfaCode.trim().length === 6);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    try {
      const payload =
        method === 'password'
          ? { method: 'password', password }
          : { method: 'mfa', factorId: selectedFactorId, code: mfaCode.trim() };

      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Verifikasi identitas gagal.');
        return;
      }
      onVerified();
    } catch {
      setError('Gagal terhubung ke server untuk verifikasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-modal-title"
      onClick={() => {
        if (!submitting) onCancel();
      }}
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="step-up-modal-title" className="text-base font-bold text-slate-900">
                {title}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            aria-label="Tutup dialog verifikasi"
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mfaFactors.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/70">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setMethod('mfa');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                method === 'mfa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Kode MFA</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setMethod('password');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                method === 'password'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Kata Sandi</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'mfa' ? (
            <div>
              <label
                htmlFor="step-up-mfa-code"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kode 6 Digit Aplikasi Autentikator
              </label>
              <input
                id="step-up-mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-invalid={Boolean(error) || undefined}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              <FormFieldFeedback error={error} />
            </div>
          ) : (
            <div>
              <label
                htmlFor="step-up-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kata Sandi Akun Anda
              </label>
              <input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(error) || undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi saat ini"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              <FormFieldFeedback error={error} />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              aria-busy={submitting || undefined}
              disabled={!canSubmit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Memverifikasi...' : 'Verifikasi & Lanjutkan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
