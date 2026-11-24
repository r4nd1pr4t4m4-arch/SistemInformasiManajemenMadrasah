'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, KeyRound, ShieldAlert, X } from 'lucide-react';
import type {
  DuplicateEmailModalState,
  LoginWarningModalState,
} from '@/components/auth/login/types';

interface DuplicateEmailModalProps {
  modal: DuplicateEmailModalState;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function DuplicateEmailModal({
  modal,
  onClose,
  onSwitchToLogin,
}: DuplicateEmailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 id="duplicate-email-title" className="text-base font-bold text-slate-900">
              Alamat Email Sudah Terdaftar
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              Email <strong>{modal.email}</strong> sudah digunakan pada akun lain, sehingga kode OTP
              pendaftaran tidak dapat dikirimkan.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
          {modal.accountStatus === 'PENDING' ? (
            <span>
              Akun dengan email ini saat ini berstatus <strong>Menunggu Persetujuan Admin</strong>
              . Silakan tunggu email notifikasi aktivasi dari Admin.
            </span>
          ) : modal.accountStatus === 'DITOLAK_PERMANEN' ? (
            <span>
              Pendaftaran akun dengan email ini telah berstatus <strong>Ditolak Permanen</strong>{' '}
              oleh Admin. Alamat email ini tidak dapat digunakan lagi untuk mendaftar akun baru.
            </span>
          ) : modal.accountStatus === 'DITOLAK' ? (
            <span>
              Pendaftaran akun dengan email ini sebelumnya berstatus <strong>Ditolak</strong>.
              Silakan hubungi Admin/Operator lembaga atau gunakan alamat email lain.
            </span>
          ) : modal.accountStatus === 'NONAKTIF' ? (
            <span>
              Akun dengan email ini saat ini berstatus <strong>Nonaktif</strong>. Silakan hubungi
              Admin/Operator lembaga untuk pengaktifan kembali.
            </span>
          ) : (
            <span>
              Akun dengan email ini sudah <strong>Aktif</strong>. Anda dapat langsung masuk melalui
              tab <strong>Masuk</strong>, atau gunakan fitur{' '}
              <Link
                href="/reset-kata-sandi"
                onClick={onClose}
                className="font-semibold text-emerald-700 hover:underline"
              >
                Lupa Kata Sandi
              </Link>{' '}
              jika tidak mengingat kata sandi Anda.
            </span>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Ganti Email
          </button>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
          >
            Pindah ke Tab Masuk
          </button>
        </div>
      </div>
    </div>
  );
}

interface LoginWarningModalProps {
  modal: LoginWarningModalState;
  onClose: () => void;
}

export function LoginWarningModal({ modal, onClose }: LoginWarningModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-warning-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-rose-50/60 border-b border-amber-200/70 px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold tracking-wide uppercase">
                Peringatan Keamanan Akun
              </span>
              <h2
                id="login-warning-modal-title"
                className="text-base font-bold text-slate-900 leading-snug"
              >
                2 Kesempatan Lagi Sebelum Dibekukan
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition"
            aria-label="Tutup peringatan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-700">
                Percobaan Gagal: {modal.failedAttempts} dari {modal.maxAttempts}
              </span>
              <span className="text-rose-600">Sisa {modal.remainingAttempts} kesempatan</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
              {Array.from({ length: modal.maxAttempts }).map((_, idx) => {
                const isFailed = idx < modal.failedAttempts;
                return (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-colors ${
                      isFailed
                        ? idx === modal.failedAttempts - 1
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                        : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-slate-700 leading-relaxed space-y-2">
            <p>
              Anda telah <strong>3 kali gagal masuk</strong> karena alamat email atau kata sandi
              tidak sesuai. Jika terjadi <strong>2 kali kegagalan lagi</strong>, akses masuk ke akun
              ini akan <strong>diblokir / dibekukan sementara selama 15 menit</strong> untuk
              mencegah penyalahgunaan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5 min-w-0">
              <span className="text-slate-500 block">Email Dicoba</span>
              <span className="font-semibold text-slate-900 truncate block">{modal.email}</span>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Waktu Deteksi
              </span>
              <span className="font-semibold text-slate-900 block">{modal.detectedAtWib} WIB</span>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
              <span className="text-slate-500 block">Batas Maksimal</span>
              <span className="font-semibold text-rose-700 block">
                {modal.maxAttempts}x gagal berturut-turut
              </span>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
              <span className="text-slate-500 block">Durasi Pembekuan</span>
              <span className="font-semibold text-slate-900 block">15 Menit</span>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Lupa atau Ragu dengan Kata Sandi Anda?</span>
            </p>
            <p className="text-[11px] text-emerald-800/90 leading-relaxed">
              Daripada akun Anda terblokir selama 15 menit, Anda dapat langsung membuat kata sandi
              baru secara aman melalui verifikasi <strong>OTP Email</strong> atau{' '}
              <strong>Authenticator (MFA)</strong>. Pastikan juga tombol <code>Caps Lock</code>{' '}
              tidak aktif sebelum mencoba kembali.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Coba Masuk Lagi
            </button>
            <Link
              href="/reset-kata-sandi"
              onClick={onClose}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>Reset Kata Sandi</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
