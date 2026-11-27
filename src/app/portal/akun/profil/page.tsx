'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  DEFAULT_ACCOUNT_PROFILE,
  normalizeAccountProfile,
  validateAvatarFile,
  type AccountProfile,
  type ToastState,
} from '@/components/portal/akun/profil/types';
import {
  BasicContactFormCard,
  ProfileOverviewAndAvatarSection,
} from '@/components/portal/akun/profil/profile-overview-and-avatar-section';
import {
  EmailChangeFormCard,
  NameChangeAndHistorySection,
} from '@/components/portal/akun/profil/name-change-and-history-section';

export default function AkunProfilPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const [profile, setProfile] = useState<AccountProfile>(DEFAULT_ACCOUNT_PROFILE);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      profileAbortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    profileAbortRef.current?.abort();
    const controller = new AbortController();
    profileAbortRef.current = controller;
    setLoadError(null);
    try {
      const res = await fetch('/api/akun/profil', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat profil akun.');
        return;
      }
      if (data.profile) {
        setProfile(normalizeAccountProfile(data.profile));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setLoadError('Tidak dapat terhubung ke server untuk memuat profil akun.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => clearTimeout(id);
  }, [loadProfile]);

  async function handleSaveBasic(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/akun/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: profile.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ok', 'Profil akun berhasil diperbarui.');
        await loadProfile();
      } else {
        showToast('err', data.error || 'Gagal memperbarui profil.');
      }
    } catch {
      showToast('err', 'Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateAvatarFile(file, profile);
    if (validationError) {
      showToast('err', validationError);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      if (!isMountedRef.current) return;
      showToast('err', 'Gagal membaca file foto yang dipilih.');
    };
    reader.onload = async () => {
      if (!isMountedRef.current) return;
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;

      setUploadingAvatar(true);
      try {
        const res = await fetch('/api/akun/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatar_url: dataUrl,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!isMountedRef.current) return;
        if (res.ok) {
          showToast('ok', 'Foto profil berhasil diunggah dan menunggu persetujuan Admin.');
          await loadProfile();
        } else {
          showToast('err', data.error || 'Gagal mengunggah foto profil.');
        }
      } catch {
        if (isMountedRef.current) {
          showToast('err', 'Tidak dapat terhubung ke server saat mengunggah foto.');
        }
      } finally {
        if (isMountedRef.current) {
          setUploadingAvatar(false);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat profil akun...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="max-w-5xl mx-auto rounded-3xl border border-rose-200 bg-rose-50 p-6 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{loadError}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadProfile();
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="leading-relaxed break-words">{toast.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        <ProfileOverviewAndAvatarSection
          profile={profile}
          uploadingAvatar={uploadingAvatar}
          onAvatarFileSelect={handleAvatarFileSelect}
        />

        <div className="md:col-span-7 space-y-5 sm:space-y-6 min-w-0">
          <BasicContactFormCard
            fullName={profile.full_name}
            phone={profile.phone}
            saving={saving}
            onPhoneChange={(cleanPhone) => setProfile((prev) => ({ ...prev, phone: cleanPhone }))}
            onSubmit={handleSaveBasic}
          />

          <NameChangeAndHistorySection
            profile={profile}
            showToast={showToast}
            onRefresh={loadProfile}
          />

          <EmailChangeFormCard
            currentEmail={profile.email}
            mfaEnabled={Boolean(profile.mfaEnabled)}
            showToast={showToast}
            onRefresh={loadProfile}
          />
        </div>
      </div>
    </div>
  );
}
