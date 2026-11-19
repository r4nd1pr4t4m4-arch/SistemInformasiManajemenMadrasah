'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalLibraryCard } from '@/components/portal/cards/digital-card-viewer';
import { FlipbookReader } from '@/components/elibrary/flipbook-reader';

interface BookRow {
  id: string;
  title: string;
  author: string;
  category?: string | null;
  cover_url?: string | null;
  description?: string | null;
  book_format: string;
  available_copies: number;
  total_copies: number;
  has_ebook?: boolean;
  is_premium?: boolean;
  has_premium_access?: boolean;
  grant_expires_at?: string | null;
}

interface GrantRow {
  id: string;
  book_id: string;
  user_id: string;
  duration_hours: number;
  starts_at: string;
  expires_at: string;
  is_revoked: boolean;
  notes?: string | null;
  book?: { id: string; title: string; is_premium: boolean } | null;
  user?: { id: string; full_name: string; email: string } | null;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

interface MemberRow {
  id: string;
  member_code: string;
  member_type: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
  joined_at?: string | null;
  is_auto_registered: boolean;
}

export type PerpustakaanSection = 'katalog' | 'anggota';

export function PerpustakaanWorkspace({ section }: { section: PerpustakaanSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERPUSTAKAAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [readingBook, setReadingBook] = useState<BookRow | null>(null);

  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    category: '',
    book_format: 'KEDUANYA' as 'FISIK' | 'EBOOK' | 'KEDUANYA',
    total_copies: 3,
    ebook_file_url: '',
    cover_url: '',
    description: '',
    is_premium: false,
  });
  const [grantForm, setGrantForm] = useState({
    book_id: '',
    user_id: '',
    duration_value: 7,
    duration_unit: 'HARI' as 'JAM' | 'HARI',
    notes: '',
  });
  const [publicMemberForm, setPublicMemberForm] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/layanan/perpustakaan');
      const data = await res.json();
      setBooks(data.books || []);
      setMembers(data.members || []);
      setGrants(data.grants || []);
      setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postLib(body: unknown, msg: string) {
    const res = await fetch('/api/layanan/perpustakaan', {
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat perpustakaan digital...
      </div>
    );
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0] || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {section === 'katalog' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
            <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
              <h1 className="text-sm font-bold text-slate-900">Tambah Koleksi Buku / E-Book</h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postLib(
                    { action: 'ADD_BOOK', ...bookForm },
                    'Buku berhasil ditambahkan ke katalog.'
                  );
                  setBookForm({
                    ...bookForm,
                    title: '',
                    author: '',
                    category: '',
                    ebook_file_url: '',
                    cover_url: '',
                    description: '',
                    is_premium: false,
                  });
                }}
                className="space-y-2.5"
              >
                <input
                  required
                  placeholder="Judul Buku / E-Book"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Penulis / Pengarang"
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={bookForm.book_format}
                    onChange={(e) =>
                      setBookForm({
                        ...bookForm,
                        book_format: e.target.value as typeof bookForm.book_format,
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="KEDUANYA">Fisik &amp; E-Book</option>
                    <option value="FISIK">Fisik Saja</option>
                    <option value="EBOOK">E-Book Saja</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={bookForm.total_copies}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, total_copies: Number(e.target.value) })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <input
                  placeholder="Kategori (mis. Pelajaran, Fiksi, Referensi)"
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  placeholder="URL Cover Buku (JPG/PNG)"
                  value={bookForm.cover_url}
                  onChange={(e) => setBookForm({ ...bookForm, cover_url: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  placeholder="URL E-Book PDF"
                  value={bookForm.ebook_file_url}
                  onChange={(e) => setBookForm({ ...bookForm, ebook_file_url: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat buku (opsional)"
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookForm.is_premium}
                    onChange={(e) => setBookForm({ ...bookForm, is_premium: e.target.checked })}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  Tandai sebagai Buku Premium (Butuh Izin Admin)
                </label>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Simpan Katalog
                </button>
              </form>
            </div>
          )}

          <div
            className={`${
              canManage ? 'lg:col-span-7' : 'lg:col-span-12'
            } glass-card rounded-3xl p-6 space-y-3`}
          >
            <h2 className="text-base font-bold text-slate-900">
              Katalog Buku &amp; E-Book ({books.length})
            </h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {books.map((b) => {
                const isEbook = b.book_format === 'EBOOK' || b.book_format === 'KEDUANYA';
                return (
                  <div
                    key={b.id}
                    className="modular-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {b.cover_url ? (
                        <img
                          src={b.cover_url}
                          alt={b.title}
                          className="w-10 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-emerald-900 text-white text-[9px] font-bold flex items-center justify-center p-1 text-center shrink-0">
                          BUKU
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900">{b.title}</p>
                          {b.is_premium && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              <Crown className="w-3 h-3" /> PREMIUM
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500">
                          {b.author} • {b.book_format}
                          {b.category ? ` • ${b.category}` : ''}
                          {b.grant_expires_at
                            ? ` • Izin s/d ${new Date(b.grant_expires_at).toLocaleString('id-ID')}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        Tersedia: {b.available_copies}/{b.total_copies}
                      </span>
                      {canManage && isEbook && (
                        <button
                          type="button"
                          onClick={() =>
                            postLib(
                              {
                                action: 'TOGGLE_BOOK_PREMIUM',
                                book_id: b.id,
                                is_premium: !b.is_premium,
                              },
                              b.is_premium
                                ? 'Status buku premium dinonaktifkan.'
                                : 'Buku ditandai sebagai Buku Premium.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition"
                        >
                          {b.is_premium ? 'Hapus Premium' : 'Set Premium'}
                        </button>
                      )}
                      {isEbook && b.has_ebook && (
                        b.has_premium_access ? (
                          <button
                            type="button"
                            onClick={() => setReadingBook(b)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                          >
                            <BookOpen className="w-3 h-3" /> Baca Buku
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <Lock className="w-3 h-3 text-amber-600" /> Butuh Izin Admin
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>

          {/* Manajemen Izin Baca Buku Premium (Khusus Admin / Pustakawan) */}
          {canManage && (
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Izin Baca Buku Premium (Berdurasi)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berikan izin membaca buku premium kepada pengguna tertentu dengan durasi waktu (Jam atau Hari) yang dapat diatur oleh Admin.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postLib(
                    {
                      action: 'GRANT_PREMIUM_ACCESS',
                      book_id: grantForm.book_id,
                      user_id: grantForm.user_id,
                      duration_value: Number(grantForm.duration_value),
                      duration_unit: grantForm.duration_unit,
                      notes: grantForm.notes,
                    },
                    'Izin baca buku premium berhasil diberikan.'
                  );
                  setGrantForm({ ...grantForm, notes: '' });
                }}
                className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Buku Premium
                  </label>
                  <select
                    required
                    value={grantForm.book_id}
                    onChange={(e) => setGrantForm({ ...grantForm, book_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Buku Premium --</option>
                    {books
                      .filter((b) => b.is_premium)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Pengguna Penerima Izin
                  </label>
                  <select
                    required
                    value={grantForm.user_id}
                    onChange={(e) => setGrantForm({ ...grantForm, user_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Pengguna --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Durasi
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={grantForm.duration_value}
                      onChange={(e) =>
                        setGrantForm({ ...grantForm, duration_value: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Satuan
                    </label>
                    <select
                      value={grantForm.duration_unit}
                      onChange={(e) =>
                        setGrantForm({
                          ...grantForm,
                          duration_unit: e.target.value as 'JAM' | 'HARI',
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="HARI">Hari</option>
                      <option value="JAM">Jam</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    placeholder="Alasan / keterangan izin"
                    value={grantForm.notes}
                    onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition"
                >
                  Berikan Izin
                </button>
              </form>

              {grants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-3">Pengguna</th>
                        <th className="py-2 px-3">Buku Premium</th>
                        <th className="py-2 px-3">Durasi</th>
                        <th className="py-2 px-3">Berlaku Hingga</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grants.map((g) => {
                        const expired = new Date(g.expires_at).getTime() <= Date.now();
                        const active = !g.is_revoked && !expired;
                        return (
                          <tr key={g.id}>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {g.user?.full_name || g.user_id}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {g.book?.title || g.book_id}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {g.duration_hours} jam
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {new Date(g.expires_at).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  active
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {g.is_revoked ? 'Dicabut' : expired ? 'Kedaluwarsa' : 'Aktif'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {active && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    postLib(
                                      { action: 'REVOKE_PREMIUM_ACCESS', grant_id: g.id },
                                      'Izin baca buku premium berhasil dicabut.'
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold text-[11px]"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Cabut
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedMember && (
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-700" /> Kartu Anggota E-Library Saya
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pratinjau sisi depan &amp; belakang kartu anggota perpustakaan Anda, siap diunduh sebagai file PNG.
                  </p>
                </div>
              </div>
              <div className="max-w-xl">
                <DigitalLibraryCard member={selectedMember} />
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'anggota' && (
        <div className="space-y-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
            <div className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit">
              <h2 className="text-sm font-bold text-slate-900">Daftar Anggota Umum E-Library</h2>
              <p className="text-[11px] text-slate-500">
                Warga madrasah/sekolah otomatis terdaftar saat masuk Buku Induk. Masyarakat umum mendaftar di sini untuk akses e-book.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await postLib(
                    { action: 'REGISTER_PUBLIC_MEMBER', ...publicMemberForm },
                    'Anggota umum E-Library berhasil didaftarkan.'
                  );
                  setPublicMemberForm({ full_name: '', phone: '', email: '' });
                }}
                className="space-y-2.5"
              >
                <input
                  required
                  placeholder="Nama Lengkap"
                  value={publicMemberForm.full_name}
                  onChange={(e) =>
                    setPublicMemberForm({ ...publicMemberForm, full_name: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="No. HP / WhatsApp"
                  value={publicMemberForm.phone}
                  onChange={(e) =>
                    setPublicMemberForm({ ...publicMemberForm, phone: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Daftar Anggota Umum
                </button>
              </form>
            </div>
          )}

          <div
            className={`${
              canManage ? 'lg:col-span-7' : 'lg:col-span-12'
            } glass-card rounded-3xl p-6 space-y-3`}
          >
            <h2 className="text-base font-bold text-slate-900">
              Kartu Anggota Perpustakaan ({members.length})
            </h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {members.map((m) => {
                const isSelected = selectedMember?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`w-full text-left modular-card rounded-xl p-3 flex items-center justify-between text-xs transition border ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-300'
                        : 'border-transparent hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{m.full_name}</p>
                      <p className="font-mono text-[11px] text-emerald-700">{m.member_code}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                      {m.member_type} {m.is_auto_registered ? '(Otomatis)' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedMember && (
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-700" /> Pratinjau &amp; Unduh Kartu Perpustakaan (PNG)
                </h2>
                <p className="text-xs text-slate-500">
                  Klik salah satu anggota di atas untuk menampilkan kartu depan &amp; belakangnya.
                </p>
              </div>
              <select
                value={selectedMember.id}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="max-w-xl">
              <DigitalLibraryCard member={selectedMember} />
            </div>
          </div>
        )}
        </div>
      )}

      {readingBook && (
        <FlipbookReader
          bookId={readingBook.id}
          bookTitle={readingBook.title}
          author={readingBook.author}
          isPublicMode={false}
          isPremium={Boolean(readingBook.is_premium)}
          grantExpiresAt={readingBook.grant_expires_at}
          onClose={() => setReadingBook(null)}
        />
      )}
    </div>
  );
}
