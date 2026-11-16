'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface BookRow {
  id: string;
  title: string;
  author: string;
  book_format: string;
  available_copies: number;
  total_copies: number;
}

interface MemberRow {
  id: string;
  member_code: string;
  member_type: string;
  full_name: string;
  is_auto_registered: boolean;
}

export default function PerpustakaanPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    book_format: 'KEDUANYA' as 'FISIK' | 'EBOOK' | 'KEDUANYA',
    total_copies: 3,
    ebook_file_url: '',
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
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h1 className="text-sm font-bold text-slate-900">Tambah Koleksi Buku / E-Book</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postLib(
                  { action: 'ADD_BOOK', ...bookForm },
                  'Buku berhasil ditambahkan ke katalog.'
                );
                setBookForm({ ...bookForm, title: '', author: '', ebook_file_url: '' });
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
                placeholder="URL E-Book PDF"
                value={bookForm.ebook_file_url}
                onChange={(e) => setBookForm({ ...bookForm, ebook_file_url: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
              >
                Simpan Katalog
              </button>
            </form>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
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
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Katalog Buku &amp; E-Book ({books.length})
            </h2>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{b.title}</p>
                    <p className="text-slate-500">
                      {b.author} • {b.book_format}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                    Tersedia: {b.available_copies}/{b.total_copies}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Kartu Anggota Perpustakaan ({members.length})
            </h2>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{m.full_name}</p>
                    <p className="font-mono text-[11px] text-emerald-700">{m.member_code}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                    {m.member_type} {m.is_auto_registered ? '(Otomatis)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
