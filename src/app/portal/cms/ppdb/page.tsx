'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface PpdbRow {
  id: string;
  registration_number: string;
  full_name: string;
  previous_school: string;
  pathway: string;
  parent_phone: string;
  status: string;
  admin_notes: string | null;
}

export default function CmsPpdbPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [ppdbList, setPpdbList] = useState<PpdbRow[]>([]);

  useEffect(() => {
    fetch('/api/cms/ppdb')
      .then((res) => res.json())
      .then((data) => {
        if (data.registrations) setPpdbList(data.registrations);
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleUpdatePpdbStatus(id: string, status: string) {
    const res = await fetch('/api/cms/ppdb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (res.ok && data.registration) {
      setPpdbList((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: data.registration.status } : row))
      );
      showToast(`Status pendaftar diperbarui menjadi ${status}.`);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data pendaftar PPDB...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900">
          Daftar Pendaftar PPDB Online ({ppdbList.length})
        </h1>
        {ppdbList.length === 0 ? (
          <p className="text-sm text-slate-600">
            Belum ada pendaftar masuk. Formulir pendaftaran publik tersedia di{' '}
            <Link href="/ppdb" className="text-emerald-700 font-semibold underline">
              /ppdb
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {ppdbList.map((row) => (
              <div
                key={row.id}
                className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono text-xs font-bold text-emerald-700">
                    {row.registration_number}
                  </p>
                  <p className="font-bold text-slate-900 text-sm">{row.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.previous_school} • Jalur {row.pathway} • WA: {row.parent_phone}
                  </p>
                </div>
                <select
                  value={row.status}
                  onChange={(e) => handleUpdatePpdbStatus(row.id, e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
                  <option value="TERVERIFIKASI">Terverifikasi</option>
                  <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
                  <option value="LULUS">Lulus</option>
                  <option value="CADANGAN">Cadangan</option>
                  <option value="TIDAK_LULUS">Tidak Lulus</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
