'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface AlumniRow {
  id: string;
  full_name: string;
  graduation_year: number;
  current_activity: string;
  institution_or_company: string | null;
  major_or_position: string | null;
}

export default function AlumniPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [alumni, setAlumni] = useState<AlumniRow[]>([]);

  const [alumniForm, setAlumniForm] = useState({
    full_name: '',
    graduation_year: 2025,
    current_activity: 'KULIAH' as 'KULIAH' | 'BEKERJA' | 'WIRAUSAHA' | 'PESANTREN',
    institution_or_company: '',
    major_or_position: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/layanan/alumni');
      const data = await res.json();
      setAlumni(data.alumni || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/layanan/alumni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alumniForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Gagal menyimpan data alumni.');
      return;
    }
    showToast('Data alumni tersimpan.');
    setAlumniForm({
      ...alumniForm,
      full_name: '',
      institution_or_company: '',
      major_or_position: '',
    });
    await loadData();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat Tracer Study Alumni...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit"
        >
          <h1 className="text-base font-bold text-slate-900">Input Tracer Study Alumni</h1>
          <input
            required
            placeholder="Nama Lengkap Alumni"
            value={alumniForm.full_name}
            onChange={(e) => setAlumniForm({ ...alumniForm, full_name: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={alumniForm.graduation_year}
              onChange={(e) =>
                setAlumniForm({ ...alumniForm, graduation_year: Number(e.target.value) })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <select
              value={alumniForm.current_activity}
              onChange={(e) =>
                setAlumniForm({
                  ...alumniForm,
                  current_activity: e.target.value as typeof alumniForm.current_activity,
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="KULIAH">Kuliah</option>
              <option value="BEKERJA">Bekerja</option>
              <option value="WIRAUSAHA">Wirausaha</option>
              <option value="PESANTREN">Pesantren</option>
            </select>
          </div>
          <input
            placeholder="Kampus / Perusahaan / Instansi"
            value={alumniForm.institution_or_company}
            onChange={(e) =>
              setAlumniForm({ ...alumniForm, institution_or_company: e.target.value })
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          />
          <input
            placeholder="Jurusan / Jabatan"
            value={alumniForm.major_or_position}
            onChange={(e) => setAlumniForm({ ...alumniForm, major_or_position: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs"
          >
            Simpan Data Alumni
          </button>
        </form>

        <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Sebaran Alumni ({alumni.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alumni.map((a) => (
              <div
                key={a.id}
                className="modular-card rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {a.full_name} (Angkatan {a.graduation_year})
                  </p>
                  <p className="text-slate-500">
                    {a.institution_or_company || '-'} • {a.major_or_position || '-'}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  {a.current_activity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
