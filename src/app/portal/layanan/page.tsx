'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  qr_token?: string | null;
}

interface TeacherOpt {
  id: string;
  full_name: string;
}

export default function PortalLayananPage() {
  const [tab, setTab] = useState<'persuratan' | 'elibrary' | 'bk' | 'guru_wali' | 'alumni'>(
    'persuratan'
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [letters, setLetters] = useState<
    {
      id: string;
      direction: string;
      category: string;
      letter_number: string;
      letter_date: string;
      subject: string;
      counterparty: string | null;
    }[]
  >([]);
  const [books, setBooks] = useState<
    {
      id: string;
      title: string;
      author: string;
      book_format: string;
      available_copies: number;
      total_copies: number;
      ebook_file_url: string | null;
    }[]
  >([]);
  const [members, setMembers] = useState<
    {
      id: string;
      member_code: string;
      member_type: string;
      full_name: string;
      is_auto_registered: boolean;
    }[]
  >([]);
  const [bkRecords, setBkRecords] = useState<
    {
      id: string;
      record_type: string;
      title: string;
      points: number;
      incident_date: string;
      student?: { full_name: string } | null;
    }[]
  >([]);
  const [gwAssignments, setGwAssignments] = useState<
    {
      id: string;
      teacher?: { full_name: string } | null;
      student?: { full_name: string } | null;
    }[]
  >([]);
  const [gwLogs, setGwLogs] = useState<
    {
      id: string;
      mentoring_date: string;
      topic: string;
      aspect: string;
      notes: string;
      assignment?: {
        teacher?: { full_name: string } | null;
        student?: { full_name: string } | null;
      } | null;
    }[]
  >([]);
  const [alumni, setAlumni] = useState<
    {
      id: string;
      full_name: string;
      graduation_year: number;
      current_activity: string;
      institution_or_company: string | null;
      major_or_position: string | null;
    }[]
  >([]);

  // Form states
  const [selectedCardStudentId, setSelectedCardStudentId] = useState('');
  const [letterForm, setLetterForm] = useState({
    direction: 'KELUAR' as 'MASUK' | 'KELUAR',
    category: 'SURAT_KETERANGAN_AKTIF' as
      | 'SURAT_KETERANGAN_AKTIF'
      | 'SURAT_MUTASI'
      | 'SURAT_TUGAS'
      | 'LAINNYA',
    letter_number: '',
    letter_date: new Date().toISOString().slice(0, 10),
    subject: '',
    counterparty: '',
  });
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
  const [bkForm, setBkForm] = useState({
    student_id: '',
    counselor_id: '',
    record_type: 'KONSULTASI' as 'PELANGGARAN' | 'PRESTASI' | 'KONSULTASI',
    title: '',
    points: 0,
    description: '',
  });
  const [gwAssignForm, setGwAssignForm] = useState({ teacher_id: '', student_id: '' });
  const [gwLogForm, setGwLogForm] = useState({
    assignment_id: '',
    topic: '',
    aspect: 'AKADEMIK' as 'AKADEMIK' | 'IBADAH_KARAKTER' | 'SOSIAL' | 'KESEHATAN' | 'LAINNYA',
    notes: '',
  });
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

  async function refreshAll() {
    setLoading(true);
    try {
      const [biRes, surRes, libRes, bkRes, gwRes, alRes] = await Promise.all([
        fetch('/api/akademik/buku-induk'),
        fetch('/api/layanan/persuratan'),
        fetch('/api/layanan/perpustakaan'),
        fetch('/api/layanan/bk'),
        fetch('/api/layanan/guru-wali'),
        fetch('/api/layanan/alumni'),
      ]);
      const [bi, sur, lib, bk, gw, al] = await Promise.all([
        biRes.json(),
        surRes.json(),
        libRes.json(),
        bkRes.json(),
        gwRes.json(),
        alRes.json(),
      ]);
      setStudents(bi.students || []);
      setTeachers(bi.teachers || []);
      setLetters(sur.letters || []);
      setBooks(lib.books || []);
      setMembers(lib.members || []);
      setBkRecords(bk.records || []);
      setGwAssignments(gw.assignments || []);
      setGwLogs(gw.logs || []);
      setAlumni(al.alumni || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function postJson(url: string, body: unknown, msg: string) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return null;
    }
    showToast(msg);
    await refreshAll();
    return data;
  }

  const cardStudent = students.find((s) => s.id === selectedCardStudentId) || students[0];

  return (
    <div className="min-h-screen simms-ambient py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Portal Terpadu
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Layanan Pendukung &amp; Arsip</h1>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-white/80 p-1 rounded-2xl border border-slate-200/80">
            {[
              { id: 'persuratan', label: 'Persuratan & Kartu', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'elibrary', label: 'E-Library', icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: 'bk', label: 'BK & Poin', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
              { id: 'guru_wali', label: 'Guru Wali', icon: <HeartHandshake className="w-3.5 h-3.5" /> },
              { id: 'alumni', label: 'Tracer Alumni', icon: <GraduationCap className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                  tab === item.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat layanan pendukung dari Supabase...
          </div>
        ) : (
          <>
            {/* TAB 1: PERSURATAN & KARTU PELAJAR */}
            {tab === 'persuratan' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">Catat Surat Masuk / Keluar</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson('/api/layanan/persuratan', letterForm, 'Arsip surat tersimpan.');
                        setLetterForm({ ...letterForm, letter_number: '', subject: '', counterparty: '' });
                      }}
                      className="space-y-2.5"
                    >
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
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, letter_number: e.target.value })
                        }
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
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, counterparty: e.target.value })
                        }
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

                  {/* Kartu Pelajar Digital */}
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
                    {cardStudent && (
                      <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 space-y-2 shadow-md">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-200">
                          Kartu Pelajar Digital Resmi
                        </p>
                        <p className="font-bold text-base">{cardStudent.full_name}</p>
                        <p className="text-xs text-emerald-100">
                          NIS: {cardStudent.nis || '-'} • NISN: {cardStudent.nisn || '-'}
                        </p>
                        <p className="font-mono text-[10px] text-emerald-300 pt-1">
                          QR Token: {cardStudent.qr_token || 'AUTO'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Arsip Surat Digital ({letters.length})
                  </h2>
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
            )}

            {/* TAB 2: E-LIBRARY */}
            {tab === 'elibrary' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Tambah Koleksi Buku / E-Book
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/layanan/perpustakaan',
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
                        placeholder="URL E-Book PDF (R2 / Link)"
                        value={bookForm.ebook_file_url}
                        onChange={(e) =>
                          setBookForm({ ...bookForm, ebook_file_url: e.target.value })
                        }
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
                    <h2 className="text-sm font-bold text-slate-900">
                      Daftar Anggota Umum E-Library
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Warga madrasah/sekolah otomatis terdaftar saat masuk Buku Induk. Masyarakat umum mendaftar di sini untuk akses e-book.
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/layanan/perpustakaan',
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
            )}

            {/* TAB 3: BK & POIN */}
            {tab === 'bk' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postJson('/api/layanan/bk', bkForm, 'Catatan BK tersimpan.');
                    setBkForm({ ...bkForm, title: '', description: '', points: 0 });
                  }}
                  className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit"
                >
                  <h2 className="text-base font-bold text-slate-900">
                    Catat Konsultasi / Poin BK
                  </h2>
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
                        setBkForm({
                          ...bkForm,
                          record_type: e.target.value as typeof bkForm.record_type,
                        })
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

                <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Riwayat BK &amp; Poin Siswa ({bkRecords.length})
                  </h2>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {bkRecords.map((r) => (
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
            )}

            {/* TAB 4: GURU WALI (TERPISAH DARI BK) */}
            {tab === 'guru_wali' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-5">
                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Tetapkan Guru Wali Siswa (Terpisah dari BK)
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/layanan/guru-wali',
                          { action: 'ASSIGN_GURU_WALI', ...gwAssignForm },
                          'Guru Wali siswa berhasil ditetapkan.'
                        );
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={gwAssignForm.teacher_id}
                        onChange={(e) =>
                          setGwAssignForm({ ...gwAssignForm, teacher_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Guru Wali --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={gwAssignForm.student_id}
                        onChange={(e) =>
                          setGwAssignForm({ ...gwAssignForm, student_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Siswa --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-full bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Simpan Penugasan
                      </button>
                    </form>
                  </div>

                  <div className="glass-card rounded-3xl p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      Catat Bimbingan Guru Wali
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postJson(
                          '/api/layanan/guru-wali',
                          { action: 'ADD_MENTORING_LOG', ...gwLogForm },
                          'Rekam jejak bimbingan Guru Wali tersimpan.'
                        );
                        setGwLogForm({ ...gwLogForm, topic: '', notes: '' });
                      }}
                      className="space-y-2.5"
                    >
                      <select
                        required
                        value={gwLogForm.assignment_id}
                        onChange={(e) =>
                          setGwLogForm({ ...gwLogForm, assignment_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="">-- Pilih Siswa Bimbingan --</option>
                        {gwAssignments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.student?.full_name} (Wali: {a.teacher?.full_name})
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        placeholder="Topik Bimbingan"
                        value={gwLogForm.topic}
                        onChange={(e) => setGwLogForm({ ...gwLogForm, topic: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <textarea
                        required
                        rows={3}
                        placeholder="Catatan Perkembangan"
                        value={gwLogForm.notes}
                        onChange={(e) => setGwLogForm({ ...gwLogForm, notes: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs"
                      >
                        Simpan Log Bimbingan
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 glass-card rounded-3xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Rekam Jejak Bimbingan Guru Wali ({gwLogs.length})
                  </h2>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {gwLogs.map((l) => (
                      <div key={l.id} className="modular-card rounded-xl p-3.5 text-xs space-y-1">
                        <p className="font-bold text-slate-900">
                          {l.assignment?.student?.full_name} — {l.topic}
                        </p>
                        <p className="text-slate-600">{l.notes}</p>
                        <p className="text-[11px] text-slate-400">
                          Guru Wali: {l.assignment?.teacher?.full_name} • {l.mentoring_date}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: TRACER STUDY ALUMNI */}
            {tab === 'alumni' && (
              <div className="grid lg:grid-cols-12 gap-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postJson('/api/layanan/alumni', alumniForm, 'Data alumni tersimpan.');
                    setAlumniForm({
                      ...alumniForm,
                      full_name: '',
                      institution_or_company: '',
                      major_or_position: '',
                    });
                  }}
                  className="lg:col-span-5 glass-card rounded-3xl p-6 space-y-3 h-fit"
                >
                  <h2 className="text-base font-bold text-slate-900">
                    Input Tracer Study Alumni
                  </h2>
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
                    onChange={(e) =>
                      setAlumniForm({ ...alumniForm, major_or_position: e.target.value })
                    }
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
                  <h2 className="text-base font-bold text-slate-900">
                    Sebaran Alumni ({alumni.length})
                  </h2>
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
