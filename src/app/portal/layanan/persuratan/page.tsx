'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalStudentCard } from '@/components/portal/cards/digital-card-viewer';

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  gender?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  address?: string | null;
  entry_year?: number | null;
  status?: string | null;
  photo_url?: string | null;
  qr_token?: string | null;
}

interface LetterRow {
  id: string;
  direction: string;
  category: string;
  letter_number: string;
  letter_date: string;
  subject: string;
  counterparty: string | null;
}

export default function PersuratanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERSURATAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [selectedCardStudentId, setSelectedCardStudentId] = useState('');

  const [letterForm, setLetterForm] = useState({
    direction: 'KELUAR' as 'MASUK' | 'KELUAR',
    category: 'SURAT_KETERANGAN_AKTIF' as
      | 'SURAT_KETERANGAN_AKTIF'
      | 'SURAT_MUTASI'
      | 'SURAT_TUGAS'
      | 'LAINNYA',
    letter_number: '',
    letter_date: '',
    subject: '',
    counterparty: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [biRes, surRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/layanan/persuratan'),
      ]);
      const bi = await biRes.json();
      const sur = await surRes.json();
      setStudents(bi.students || []);
      setLetters(sur.letters || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLetterForm((prev) =>
      prev.letter_date ? prev : { ...prev, letter_date: new Date().toISOString().slice(0, 10) }
    );
    loadData();
  }, []);

  async function postLetter(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/layanan/persuratan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(letterForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Gagal menyimpan surat.');
      return;
    }
    showToast('Arsip surat tersimpan.');
    setLetterForm({ ...letterForm, letter_number: '', subject: '', counterparty: '' });
    await loadData();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat persuratan &amp; kartu pelajar...
      </div>
    );
  }

  const cardStudent = students.find((s) => s.id === selectedCardStudentId) || students[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          {canManage && (
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h1 className="text-sm font-bold text-slate-900">Catat Surat Masuk / Keluar</h1>
              <form onSubmit={postLetter} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={letterForm.direction}
                    onChange={(e) =>
                      setLetterForm({
                        ...letterForm,
                        direction: e.target.value as 'MASUK' | 'KELUAR',
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="KELUAR">Surat Keluar</option>
                    <option value="MASUK">Surat Masuk</option>
                  </select>
                  <select
                    value={letterForm.category}
                    onChange={(e) =>
                      setLetterForm({
                        ...letterForm,
                        category: e.target.value as typeof letterForm.category,
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="SURAT_KETERANGAN_AKTIF">Ket. Siswa Aktif</option>
                    <option value="SURAT_MUTASI">Surat Mutasi</option>
                    <option value="SURAT_TUGAS">Surat Tugas Guru</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <input
                  required
                  placeholder="Nomor Surat (cth: 045/MA-N/XI/2026)"
                  value={letterForm.letter_number}
                  onChange={(e) => setLetterForm({ ...letterForm, letter_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Perihal / Subjek Surat"
                  value={letterForm.subject}
                  onChange={(e) => setLetterForm({ ...letterForm, subject: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  placeholder="Tujuan / Pengirim"
                  value={letterForm.counterparty}
                  onChange={(e) => setLetterForm({ ...letterForm, counterparty: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Simpan Arsip Surat
                </button>
              </form>
            </div>
          )}

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700" /> Kartu Pelajar Digital
            </h2>
            <select
              value={selectedCardStudentId}
              onChange={(e) => setSelectedCardStudentId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            {cardStudent && <DigitalStudentCard student={cardStudent} />}
          </div>
        </div>

        <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Arsip Surat Digital ({letters.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {letters.map((l) => (
              <div
                key={l.id}
                className="modular-card rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-mono font-bold text-emerald-700">
                    {l.letter_number} • {l.direction}
                  </p>
                  <p className="font-bold text-slate-900 text-sm">{l.subject}</p>
                  <p className="text-slate-500">
                    {l.category.replace(/_/g, ' ')} • {l.counterparty || '-'}
                  </p>
                </div>
                <span className="text-slate-500">{l.letter_date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
