'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import type { InstitutionSettings, InstitutionType } from '@/types/database';

export default function CmsProfilPage() {
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
          mission: settings.mission,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          geofence_lat: settings.geofence_lat,
          geofence_lng: settings.geofence_lng,
          geofence_radius_meters: settings.geofence_radius_meters,
        }),
      });
      if (res.ok) {
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
          <h1 className="text-lg font-bold text-slate-900">
            Pengaturan Identitas Lembaga &amp; Geofencing
          </h1>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Visi</label>
            <textarea
              rows={2}
              value={settings.vision || ''}
              onChange={(e) => setSettings({ ...settings, vision: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      )}
    </div>
  );
}
