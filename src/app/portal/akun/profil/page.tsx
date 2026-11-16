'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Phone, Save, ShieldCheck, User } from 'lucide-react';

interface AccountProfile {
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_role: string;
  roles?: string[];
}

export default function AkunProfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile>({
    full_name: '',
    email: '',
    phone: '',
    primary_role: '',
    roles: [],
  });

  useEffect(() => {
    fetch('/api/akun/profil')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile({
            full_name: data.profile.full_name || '',
            email: data.profile.email || '',
            phone: data.profile.phone || '',
            primary_role: data.profile.primary_role || '',
            roles: data.profile.roles || [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/akun/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profil akun berhasil diperbarui.');
      } else {
        showToast(data.error || 'Gagal memperbarui profil.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat profil akun...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-6">
        <div className="md:col-span-5 glass-card rounded-3xl p-6 space-y-4 h-fit">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-xl font-bold shadow-sm">
            {(profile.full_name || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{profile.full_name}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" /> {profile.email || '-'}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-200/70 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Peran Akun
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(profile.roles && profile.roles.length > 0
                ? profile.roles
                : [profile.primary_role]
              ).map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[11px] font-semibold"
                >
                  <ShieldCheck className="w-3 h-3" /> {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="md:col-span-7 glass-card rounded-3xl p-7 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">Perbarui Informasi Profil</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola nama tampilan dan nomor kontak akun Anda.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  required
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor HP / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </form>
      </div>
    </div>
  );
}
