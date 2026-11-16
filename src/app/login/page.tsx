'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage({
        type: 'error',
        text: 'Layanan autentikasi sedang tidak tersedia.',
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          const params = new URLSearchParams(window.location.search);
          const nextUrl = params.get('next') || '/portal';
          router.push(nextUrl.startsWith('/') ? nextUrl : '/portal');
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({
            type: 'success',
            text: 'Akun berhasil dibuat! Silakan cek email untuk verifikasi atau langsung masuk.',
          });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen simms-ambient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Website Resmi
        </Link>

        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' ? 'Masuk Portal SIMMS' : 'Daftar Akun Baru'}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === 'login'
                ? 'Akses CMS Website, Portal Akademik, Keuangan & Layanan.'
                : 'Registrasi akun untuk anggota perpustakaan umum atau warga lembaga.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium ${
                message.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/90 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@lembaga.sch.id"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/90 pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/90 pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition shadow-sm"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Memproses...' : 'Masuk ke Portal'}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Mendaftarkan...' : 'Buat Akun'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
