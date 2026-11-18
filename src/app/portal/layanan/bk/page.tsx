'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';

interface StudentOpt {
  id: string;
  full_name: string;
}

interface BkRecordRow {
  id: string;
  record_type: string;
  title: string;
  points: number;
  incident_date: string;
  student?: { full_name: string } | null;
}

export default function BkPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BK_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [records, setRecords] = useState<BkRecordRow[]>([]);

  const [bkForm, setBkForm] = useState({
    student_id: '',
    record_type: 'KONSULTASI' as 'PELANGGARAN' | 'PRESTASI' | 'KONSULTASI',
    title: '',
    points: 0,
    description: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, bkRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/layanan/bk'),
      ]);
      const bi = await biRes.json();
      const bk = await bkRes.json();
      setStudents(bi.students || []);
      setRecords(bk.records || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/layanan/bk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bkForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Gagal menyimpan catatan BK.');
      return;
    }
    showToast('Catatan BK tersimpan.');
    setBkForm({ ...bkForm, title: '', description: '', points: 0 });
    await loadData();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data Bimbingan Konseling...
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
        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit"
          >
            <h1 className="text-base font-bold text-slate-900">Catat Konsultasi / Poin BK</h1>
            <select
              required
              value={bkForm.student_id}
              onChange={(e) => setBkForm({ ...bkForm, student_id: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={bkForm.record_type}
                onChange={(e) =>
                  setBkForm({ ...bkForm, record_type: e.target.value as typeof bkForm.record_type })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="KONSULTASI">Konsultasi BK</option>
                <option value="PELANGGARAN">Pelanggaran</option>
                <option value="PRESTASI">Poin Prestasi</option>
              </select>
              <input
                type="number"
                placeholder="Poin"
                value={bkForm.points}
                onChange={(e) => setBkForm({ ...bkForm, points: Number(e.target.value) })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <input
              required
              placeholder="Judul Kasus / Prestasi / Konsultasi"
              value={bkForm.title}
              onChange={(e) => setBkForm({ ...bkForm, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <textarea
              required
              rows={3}
              placeholder="Deskripsi & tindak lanjut"
              value={bkForm.description}
              onChange={(e) => setBkForm({ ...bkForm, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs"
            >
              Simpan Catatan BK
            </button>
          </form>
        )}

        <div
          className={`${
            canManage ? 'lg:col-span-7' : 'lg:col-span-12'
          } glass-card rounded-3xl p-6 space-y-3`}
        >
          <h2 className="text-base font-bold text-slate-900">
            Riwayat BK &amp; Poin Siswa ({records.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {records.map((r) => (
              <div
                key={r.id}
                className="modular-card rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {r.student?.full_name} — {r.title}
                  </p>
                  <p className="text-slate-500">
                    {r.record_type} • {r.incident_date}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold">
                  {r.points} Poin
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
