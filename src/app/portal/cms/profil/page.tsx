'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { InstitutionSettings, InstitutionType } from '@/types/database';
import { invalidateInstitutionSettingsCache } from '@/lib/hooks/use-institution-settings';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

export default function CmsProfilPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.CMS_MANAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);

  useEffect(() => {
    fetch('/api/cms/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cms/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_type: settings.institution_type,
          name: settings.name,
          short_name: settings.short_name,
          npsn: settings.npsn,
          nsm: settings.nsm,
          accreditation: settings.accreditation,
          student_org_label: settings.student_org_label,
          head_title_label: settings.head_title_label,
          headmaster_name: settings.headmaster_name,
          headmaster_greeting: settings.headmaster_greeting,
          history: settings.history,
          vision: settings.vision,
          mission: (settings.mission || []).map((m) => m.trim()).filter(Boolean),
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          geofence_enabled: settings.geofence_enabled ?? true,
          geofence_lat: settings.geofence_lat,
          geofence_lng: settings.geofence_lng,
          geofence_radius_meters: settings.geofence_radius_meters,
          social_links: settings.social_links || {},
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated?.settings) setSettings(updated.settings);
        invalidateInstitutionSettingsCache();
        showToast('Pengaturan lembaga berhasil disimpan.');
      } else {
        const d = await res.json();
        showToast(d.error || 'Gagal menyimpan pengaturan.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat pengaturan lembaga...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {settings && (
        <form onSubmit={handleSaveSettings} className="glass-card rounded-3xl p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              Pengaturan Identitas Lembaga &amp; Geofencing
            </h1>
            {!canManage && (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                Mode Baca Saja (Read-Only)
              </span>
            )}
          </div>
          <fieldset disabled={!canManage} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
              >
                <option value="MADRASAH">Madrasah</option>
                <option value="SEKOLAH">Sekolah Umum</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Resmi Lembaga
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Singkat / Akronim
              </label>
              <input
                type="text"
                value={settings.short_name || ''}
                onChange={(e) => setSettings({ ...settings, short_name: e.target.value })}
                placeholder="Contoh: MTs Nurul Falah"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NPSN
              </label>
              <input
                type="text"
                value={settings.npsn || ''}
                onChange={(e) => setSettings({ ...settings, npsn: e.target.value })}
                placeholder="Nomor Pokok Sekolah Nasional"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono"
              />
            </div>
            {settings.institution_type === 'MADRASAH' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NSM (Nomor Statistik Madrasah)
                </label>
                <input
                  type="text"
                  value={settings.nsm || ''}
                  onChange={(e) => setSettings({ ...settings, nsm: e.target.value })}
                  placeholder="Nomor Statistik Madrasah"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama {settings.head_title_label}
              </label>
              <input
                type="text"
                value={settings.headmaster_name || ''}
                onChange={(e) => setSettings({ ...settings, headmaster_name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Akreditasi
              </label>
              <input
                type="text"
                list="accreditation-options"
                value={settings.accreditation || ''}
                onChange={(e) => setSettings({ ...settings, accreditation: e.target.value })}
                placeholder="Contoh: A (Unggul)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
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
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Aktifkan Presensi Geofencing (GPS)
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Radius Geofencing (Meter)
              </label>
              <input
                type="number"
                value={settings.geofence_radius_meters}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    geofence_radius_meters: Number(e.target.value) || 100,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Latitude Sekolah
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.geofence_lat ?? -6.2}
                onChange={(e) =>
                  setSettings({ ...settings, geofence_lat: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Longitude Sekolah
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.geofence_lng ?? 106.816666}
                onChange={(e) =>
                  setSettings({ ...settings, geofence_lng: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sambutan {settings.head_title_label}
            </label>
            <textarea
              rows={3}
              value={settings.headmaster_greeting || ''}
              onChange={(e) =>
                setSettings({ ...settings, headmaster_greeting: e.target.value })
              }
              placeholder={`Tuliskan kata sambutan resmi ${settings.head_title_label}...`}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Profil &amp; Sejarah Lembaga
            </label>
            <textarea
              rows={4}
              value={settings.history || ''}
              onChange={(e) => setSettings({ ...settings, history: e.target.value })}
              placeholder="Tuliskan profil singkat dan sejarah berdirinya lembaga..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Visi</label>
            <textarea
              rows={2}
              value={settings.vision || ''}
              onChange={(e) => setSettings({ ...settings, vision: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Misi Lembaga
              </label>
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
                  <div key={idx} className="flex items-center gap-2">
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
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = (settings.mission || []).filter((_, i) => i !== idx);
                          setSettings({ ...settings, mission: next });
                        }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition"
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
            <h2 className="text-sm font-bold text-slate-900">
              Kontak Resmi Institusi
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Telepon / WhatsApp Resmi
                </label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="Contoh: (021) 8241-xxxx / 0812-xxxx-xxxx"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Resmi
                </label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="Contoh: info@madrasah.sch.id"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Lembaga
                </label>
                <textarea
                  rows={2}
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Jl. ..., Kecamatan, Kabupaten/Kota, Provinsi, Kode Pos"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Media Sosial Resmi</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
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
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
