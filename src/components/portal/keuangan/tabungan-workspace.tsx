'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface SavingsAccountRow {
  id: string;
  account_number: string;
  owner_type: string;
  student_id?: string | null;
  teacher_id?: string | null;
  owner_name: string;
  owner_phone: string | null;
  balance: number;
}

interface StudentCandidate {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  phone: string | null;
}

interface GtkCandidate {
  id: string;
  full_name: string;
  nip: string | null;
  phone: string | null;
  staff_type: string;
}

interface PublicCandidate {
  id: string;
  full_name: string;
  phone: string | null;
  label: string;
}

export type TabunganSection = 'buka-rekening' | 'transaksi' | 'rekap';

export function TabunganWorkspace({ section }: { section: TabunganSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.TABUNGAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SavingsAccountRow[]>([]);
  const [students, setStudents] = useState<StudentCandidate[]>([]);
  const [teachers, setTeachers] = useState<GtkCandidate[]>([]);
  const [tuStaff, setTuStaff] = useState<GtkCandidate[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  const [openAccForm, setOpenAccForm] = useState({
    owner_type: 'SISWA' as 'SISWA' | 'GURU' | 'TU' | 'UMUM',
    student_id: null as string | null,
    teacher_id: null as string | null,
    owner_name: '',
    owner_phone: '',
    initial_deposit: 50000,
  });
  const [trxForm, setTrxForm] = useState({
    account_id: '',
    transaction_type: 'SETOR' as 'SETOR' | 'TARIK',
    amount: 50000,
    notes: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/keuangan/tabungan');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setTuStaff(data.tuStaff || []);
      setPublicUsers(data.publicUsers || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postTabungan(body: unknown, msg: string) {
    const res = await fetch('/api/keuangan/tabungan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return;
    }
    showToast(msg);
    await loadData();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku tabungan digital...
      </div>
    );
  }

  const totalTabungan = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Pengelola Modul</p>
          <p className="font-bold text-slate-900 mt-1">Pengelola Tabungan</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tanpa tambahan tunjangan honorarium</p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Jumlah Rekening Aktif</p>
          <p className="font-bold text-slate-900 text-lg mt-1">
            {accounts.length} Rekening (Siswa/Guru/TU/Umum)
          </p>
        </div>
        <div className="modular-card rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Saldo Terkumpul</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">{formatRupiah(totalTabungan)}</p>
        </div>
      </div>

      {section === 'buka-rekening' && canManage && (
        <div className="glass-card rounded-3xl p-6 space-y-3 max-w-2xl">
          <h1 className="text-sm font-bold text-slate-900">Buka Buku Tabungan Digital</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!openAccForm.owner_name.trim()) {
                showToast('Pilih pemilik rekening terlebih dahulu.');
                return;
              }
              await postTabungan(
                { action: 'OPEN_ACCOUNT', ...openAccForm },
                'Buku tabungan baru berhasil dibuka.'
              );
              setSelectedCandidateId('');
              setOpenAccForm({
                ...openAccForm,
                student_id: null,
                teacher_id: null,
                owner_name: '',
                owner_phone: '',
              });
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Peran / Kategori Pemilik Rekening
              </label>
              <select
                value={openAccForm.owner_type}
                onChange={(e) => {
                  const nextType = e.target.value as typeof openAccForm.owner_type;
                  setSelectedCandidateId('');
                  setOpenAccForm({
                    ...openAccForm,
                    owner_type: nextType,
                    student_id: null,
                    teacher_id: null,
                    owner_name: '',
                    owner_phone: '',
                  });
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="SISWA">Siswa</option>
                <option value="GURU">Guru</option>
                <option value="TU">Tata Usaha</option>
                <option value="UMUM">Masyarakat Umum</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Nama Pemilik Rekening ({openAccForm.owner_type})
              </label>

              {openAccForm.owner_type === 'SISWA' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const s = students.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: s ? s.id : null,
                      teacher_id: null,
                      owner_name: s ? s.full_name : '',
                      owner_phone: s?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : s.nisn ? `(NISN: ${s.nisn})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'GURU' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const g = teachers.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: null,
                      teacher_id: g ? g.id : null,
                      owner_name: g ? g.full_name : '',
                      owner_phone: g?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} {g.nip ? `(NIP: ${g.nip})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'TU' && (
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCandidateId(id);
                    const t = tuStaff.find((item) => item.id === id);
                    setOpenAccForm({
                      ...openAccForm,
                      student_id: null,
                      teacher_id: t ? t.id : null,
                      owner_name: t ? t.full_name : '',
                      owner_phone: t?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- Pilih Staf Tata Usaha --</option>
                  {tuStaff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.nip ? `(NIP: ${t.nip})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {openAccForm.owner_type === 'UMUM' && (
                <div className="space-y-2">
                  <select
                    required={publicUsers.length > 0 && selectedCandidateId !== '__MANUAL__'}
                    value={selectedCandidateId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCandidateId(id);
                      if (id === '__MANUAL__') {
                        setOpenAccForm({
                          ...openAccForm,
                          student_id: null,
                          teacher_id: null,
                          owner_name: '',
                          owner_phone: '',
                        });
                        return;
                      }
                      const u = publicUsers.find((item) => item.id === id);
                      setOpenAccForm({
                        ...openAccForm,
                        student_id: null,
                        teacher_id: null,
                        owner_name: u ? u.full_name : '',
                        owner_phone: u?.phone || '',
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Pengguna / Anggota Umum --</option>
                    {publicUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                    <option value="__MANUAL__">+ Input Nama Masyarakat Umum Lainnya...</option>
                  </select>

                  {selectedCandidateId === '__MANUAL__' && (
                    <input
                      required
                      placeholder="Masukkan Nama Lengkap Masyarakat Umum"
                      value={openAccForm.owner_name}
                      onChange={(e) =>
                        setOpenAccForm({ ...openAccForm, owner_name: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">No. HP / WhatsApp</label>
                <input
                  placeholder="No. HP / WA"
                  value={openAccForm.owner_phone}
                  onChange={(e) => setOpenAccForm({ ...openAccForm, owner_phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Setoran Awal (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Setoran Awal"
                  value={openAccForm.initial_deposit}
                  onChange={(e) =>
                    setOpenAccForm({ ...openAccForm, initial_deposit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Buka Rekening Tabungan
            </button>
          </form>
        </div>
      )}

      {section === 'transaksi' && canManage && (
          <div className="glass-card rounded-3xl p-6 space-y-3 max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900">Transaksi Setor / Tarik</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postTabungan(
                  { action: 'TRANSACTION', ...trxForm },
                  'Transaksi tabungan berhasil dicatat.'
                );
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={trxForm.account_id}
                onChange={(e) => setTrxForm({ ...trxForm, account_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Rekening --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.owner_type}] {a.owner_name} — {formatRupiah(Number(a.balance))}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={trxForm.transaction_type}
                  onChange={(e) =>
                    setTrxForm({
                      ...trxForm,
                      transaction_type: e.target.value as 'SETOR' | 'TARIK',
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="SETOR">Setor Tabungan</option>
                  <option value="TARIK">Tarik Tabungan</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={trxForm.amount}
                  onChange={(e) => setTrxForm({ ...trxForm, amount: Number(e.target.value) })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Proses Transaksi
              </button>
            </form>
          </div>
      )}

      {section === 'rekap' && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Rekapitulasi Buku Tabungan Digital</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="modular-card rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-mono text-[11px] text-emerald-700 font-bold">
                    {acc.account_number} • {acc.owner_type}
                  </p>
                  <p className="font-bold text-slate-900 text-sm">{acc.owner_name}</p>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {formatRupiah(Number(acc.balance))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
