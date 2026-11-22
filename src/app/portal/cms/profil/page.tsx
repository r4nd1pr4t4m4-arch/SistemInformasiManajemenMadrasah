'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ImageUp,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import type { InstitutionSettings, InstitutionType } from '@/types/database';
import { notifyInstitutionSettingsUpdated } from '@/lib/hooks/use-institution-settings';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500';

const CMS_QUICK_LINKS = [
  { href: '/portal/cms/profil', label: 'Identitas & Profil', icon: Building2, active: true },
  { href: '/portal/cms/berita', label: 'Berita & Artikel', icon: Newspaper, active: false },
  { href: '/portal/cms/ppdb', label: 'PPDB Online', icon: UserPlus, active: false },
  { href: '/portal/cms/sarana-prasarana', label: 'Sarana Prasarana', icon: Wrench, active: false },
];

export default function CmsProfilPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastBannerRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/cms/settings', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Gagal memuat pengaturan lembaga.');
        }
        return data;
      })
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings);
          setLoadError(null);
        } else {
          throw new Error('Data pengaturan lembaga tidak ditemukan.');
        }
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError((err as Error)?.message || 'Tidak dapat terhubung ke server.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [retryTick]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(type: ToastState['type'], message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
    requestAnimationFrame(() => {
      toastBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function buildSettingsPayload(override?: Partial<InstitutionSettings>) {
    if (!settings) return null;
    const merged = { ...settings, ...override };
    return {
      institution_type: merged.institution_type,
      name: (merged.name || '').trim(),
      short_name: merged.short_name?.trim() || null,
      npsn: merged.npsn?.trim() || null,
      nsm: merged.nsm?.trim() || null,
      accreditation: merged.accreditation?.trim() || null,
      logo_url: merged.logo_url?.trim() || null,
      student_org_label: merged.student_org_label,
      head_title_label: merged.head_title_label,
      headmaster_name: merged.headmaster_name?.trim() || null,
      headmaster_greeting: merged.headmaster_greeting,
      history: merged.history,
      vision: merged.vision,
      mission: (merged.mission || []).map((m) => m.trim()).filter(Boolean),
      address: merged.address,
      phone: merged.phone?.trim() || null,
      email: merged.email?.trim() || null,
      geofence_enabled: merged.geofence_enabled ?? true,
      geofence_lat:
        merged.geofence_lat !== null && merged.geofence_lat !== undefined
          ? Number(merged.geofence_lat)
          : null,
      geofence_lng:
        merged.geofence_lng !== null && merged.geofence_lng !== undefined
          ? Number(merged.geofence_lng)
          : null,
      geofence_radius_meters: Number(merged.geofence_radius_meters),
      social_links: merged.social_links || {},
    };
  }

  async function persistSettings(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch('/api/cms/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data?.settings) setSettings(data.settings);
      notifyInstitutionSettingsUpdated();
      showToast('success', successMsg);
    } else {
      showToast('error', data?.error || 'Gagal menyimpan pengaturan.');
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !settings || !canManage) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      showToast('error', 'Format logo harus PNG, JPG, WEBP, SVG, atau ICO.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Ukuran file logo maksimal 2 MB.');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/cms/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengunggah logo lembaga.');
      }

      if (data?.settings) {
        setSettings(data.settings);
      } else if (data?.logo_url) {
        setSettings((prev) => (prev ? { ...prev, logo_url: data.logo_url } : prev));
      }
      notifyInstitutionSettingsUpdated();
      showToast('success', 'Logo madrasah/sekolah berhasil diunggah dan disinkronkan.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!settings || !canManage || !settings.logo_url) return;
    setUploadingLogo(true);
    try {
      const payload = buildSettingsPayload({ logo_url: null });
      if (payload) {
        await persistSettings(payload, 'Logo lembaga dihapus dan dikembalikan ke default.');
      }
    } catch {
      showToast('error', 'Gagal menghapus logo lembaga.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !canManage) return;

    const trimmedName = (settings.name || '').trim();
    if (trimmedName.length < 3) {
      showToast('error', 'Nama resmi lembaga minimal 3 karakter.');
      return;
    }

    const radius = Number(settings.geofence_radius_meters);
    if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
      showToast('error', 'Radius geofencing harus antara 20 hingga 5.000 meter.');
      return;
    }

    const lat =
      settings.geofence_lat !== null && settings.geofence_lat !== undefined
        ? Number(settings.geofence_lat)
        : null;
    const lng =
      settings.geofence_lng !== null && settings.geofence_lng !== undefined
        ? Number(settings.geofence_lng)
        : null;

    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      showToast('error', 'Latitude sekolah tidak valid (harus antara -90 s/d 90).');
      return;
    }
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      showToast('error', 'Longitude sekolah tidak valid (harus antara -180 s/d 180).');
      return;
    }

    setSaving(true);
    try {
      const payload = buildSettingsPayload();
      if (payload) {
        await persistSettings(payload, 'Pengaturan lembaga berhasil disimpan.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat pengaturan lembaga...</span>
      </div>
    );
  }

  if (loadError && !settings) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center space-y-3 border border-rose-200">
        <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
        <h1 className="text-base sm:text-lg font-bold text-slate-900">
          Gagal Memuat Pengaturan CMS
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError(null);
            setRetryTick((t) => t + 1);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Quick CMS Sub-navigation */}
      <nav
        aria-label="Navigasi Modul CMS"
        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {CMS_QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 ${
                item.active
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white/90 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {toast && (
        <div
          ref={toastBannerRef}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2.5 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {settings && (
        <form onSubmit={handleSaveSettings} className="glass-card rounded-3xl p-5 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Pengaturan Identitas Lembaga &amp; Geofencing
            </h1>
            {!canManage && (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                Mode Baca Saja (Read-Only)
              </span>
            )}
          </div>

          <fieldset disabled={!canManage || saving} className="space-y-5">
            {/* Logo Madrasah / Sekolah Upload & Preview */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={settings.name || 'Logo Lembaga'}
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Logo Madrasah / Sekolah &amp; Favicon
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Logo ini otomatis disinkronkan ke Navbar, Footer, Sidebar Portal, Kartu Digital,
                    dan Favicon browser. Format PNG/JPG/WEBP/SVG (maks. 2 MB).
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageUp className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadingLogo ? 'Mengunggah...' : 'Upload Logo'}</span>
                  </button>
                  {settings.logo_url && (
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tipe Lembaga
                </label>
                <select
                  value={settings.institution_type}
                  onChange={(e) => {
                    const type = e.target.value as InstitutionType;
                    setSettings({
                      ...settings,
                      institution_type: type,
                      student_org_label: type === 'MADRASAH' ? 'OSIM' : 'OSIS',
                      head_title_label:
                        type === 'MADRASAH' ? 'Kepala Madrasah' : 'Kepala Sekolah',
                    });
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="MADRASAH">Madrasah</option>
                  <option value="SEKOLAH">Sekolah Umum</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Resmi Lembaga <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  minLength={3}
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Singkat / Akronim
                </label>
                <input
                  type="text"
                  value={settings.short_name || ''}
                  onChange={(e) => setSettings({ ...settings, short_name: e.target.value })}
                  placeholder="Contoh: MTs Nurul Falah"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">NPSN</label>
                <input
                  type="text"
                  value={settings.npsn || ''}
                  onChange={(e) => setSettings({ ...settings, npsn: e.target.value })}
                  placeholder="Nomor Pokok Sekolah Nasional"
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              {settings.institution_type === 'MADRASAH' && (
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    NSM (Nomor Statistik Madrasah)
                  </label>
                  <input
                    type="text"
                    value={settings.nsm || ''}
                    onChange={(e) => setSettings({ ...settings, nsm: e.target.value })}
                    placeholder="Nomor Statistik Madrasah"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>
              )}
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama {settings.head_title_label}
                </label>
                <input
                  type="text"
                  value={settings.headmaster_name || ''}
                  onChange={(e) => setSettings({ ...settings, headmaster_name: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Akreditasi
                </label>
                <input
                  type="text"
                  list="accreditation-options"
                  value={settings.accreditation || ''}
                  onChange={(e) => setSettings({ ...settings, accreditation: e.target.value })}
                  placeholder="Contoh: A (Unggul)"
                  className={INPUT_CLASS}
                />
                <datalist id="accreditation-options">
                  <option value="A" />
                  <option value="B" />
                  <option value="C" />
                  <option value="Unggul" />
                  <option value="Baik Sekali" />
                  <option value="Baik" />
                  <option value="Belum Terakreditasi" />
                </datalist>
              </div>
              <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    Aktifkan Presensi Geofencing (GPS)
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Jika dinonaktifkan, guru dapat melakukan presensi tanpa verifikasi izin lokasi
                    dan radius GPS sekolah.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.geofence_enabled ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, geofence_enabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {settings.geofence_enabled ?? true ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Radius Geofencing (20 – 5.000 Meter)
                </label>
                <input
                  type="number"
                  min={20}
                  max={5000}
                  value={
                    settings.geofence_radius_meters === 0
                      ? ''
                      : (settings.geofence_radius_meters ?? 100)
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      geofence_radius_meters:
                        e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Latitude Sekolah
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.geofence_lat ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      geofence_lat:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Longitude Sekolah
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.geofence_lng ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      geofence_lng:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sambutan {settings.head_title_label}
              </label>
              <textarea
                rows={3}
                value={settings.headmaster_greeting || ''}
                onChange={(e) =>
                  setSettings({ ...settings, headmaster_greeting: e.target.value })
                }
                placeholder={`Tuliskan kata sambutan resmi ${settings.head_title_label}...`}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Profil &amp; Sejarah Lembaga
              </label>
              <textarea
                rows={4}
                value={settings.history || ''}
                onChange={(e) => setSettings({ ...settings, history: e.target.value })}
                placeholder="Tuliskan profil singkat dan sejarah berdirinya lembaga..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Visi</label>
              <textarea
                rows={2}
                value={settings.vision || ''}
                onChange={(e) => setSettings({ ...settings, vision: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-700">Misi Lembaga</label>
                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        mission: [...(settings.mission || []), ''],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Poin Misi
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(settings.mission && settings.mission.length > 0 ? settings.mission : ['']).map(
                  (item, idx) => (
                    <div key={idx} className="flex items-center gap-2 min-w-0">
                      <span className="w-6 text-xs font-bold text-slate-400 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [
                            ...(settings.mission && settings.mission.length > 0
                              ? settings.mission
                              : ['']),
                          ];
                          next[idx] = e.target.value;
                          setSettings({ ...settings, mission: next });
                        }}
                        placeholder={`Poin misi ke-${idx + 1}...`}
                        className={`${INPUT_CLASS} flex-1 min-w-0`}
                      />
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = (settings.mission || []).filter((_, i) => i !== idx);
                            setSettings({ ...settings, mission: next });
                          }}
                          className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition shrink-0"
                          aria-label={`Hapus misi ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Kontak Resmi Institusi</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No. Telepon / WhatsApp Resmi
                  </label>
                  <input
                    type="text"
                    value={settings.phone || ''}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="Contoh: (021) 8241-xxxx / 0812-xxxx-xxxx"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Resmi
                  </label>
                  <input
                    type="email"
                    value={settings.email || ''}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="Contoh: info@madrasah.sch.id"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="sm:col-span-2 min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alamat Lengkap Lembaga
                  </label>
                  <textarea
                    rows={2}
                    value={settings.address || ''}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    placeholder="Jl. ..., Kecamatan, Kabupaten/Kota, Provinsi, Kode Pos"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Media Sosial Resmi</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Facebook
                    </label>
                    <input
                      type="url"
                      value={settings.social_links?.facebook || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          social_links: {
                            ...(settings.social_links || {}),
                            facebook: e.target.value,
                          },
                        })
                      }
                      placeholder="https://facebook.com/..."
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Instagram
                    </label>
                    <input
                      type="url"
                      value={settings.social_links?.instagram || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          social_links: {
                            ...(settings.social_links || {}),
                            instagram: e.target.value,
                          },
                        })
                      }
                      placeholder="https://instagram.com/..."
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      YouTube
                    </label>
                    <input
                      type="url"
                      value={settings.social_links?.youtube || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          social_links: {
                            ...(settings.social_links || {}),
                            youtube: e.target.value,
                          },
                        })
                      }
                      placeholder="https://youtube.com/@..."
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          {canManage && (
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          )}
        </form>
      )}
    </div>
  );
}
