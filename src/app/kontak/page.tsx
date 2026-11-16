'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { DEFAULT_INSTITUTION_SETTINGS } from '@/lib/data/demo-seed';

const SAMPLE_FAQS = [
  {
    q: 'Bagaimana cara mendaftar PPDB Online?',
    a: 'Buka menu PPDB Online, isi formulir biodata, unggah scan KK/Akta/SKL, lalu simpan nomor pendaftaran Anda untuk memantau status kelulusan.',
  },
  {
    q: 'Apakah masyarakat umum dapat mengakses E-Library?',
    a: 'Ya. Masyarakat umum dapat mendaftar sebagai anggota perpustakaan digital untuk membaca koleksi e-book. Warga lembaga otomatis terdaftar beserta kartu anggota.',
  },
  {
    q: 'Siapa saja yang dapat membuka tabungan di lembaga?',
    a: 'Tabungan terbuka untuk siswa, guru, staf tata usaha, serta masyarakat umum yang dikelola oleh Pengelola Tabungan.',
  },
];

export default function KontakPage() {
  const school = DEFAULT_INSTITUTION_SETTINGS;
  const [form, setForm] = useState({
    senderName: '',
    senderEmail: '',
    senderPhone: '',
    category: 'ASPIRASI' as 'ASPIRASI' | 'PENGADUAN' | 'INFORMASI',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengirim pesan.');
      } else {
        setSent(true);
        setForm({
          senderName: '',
          senderEmail: '',
          senderPhone: '',
          category: 'ASPIRASI',
          subject: '',
          message: '',
        });
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setSending(false);
    }
  }

  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 space-y-8">

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Form Pengaduan / Aspirasi */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-7 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-700" /> Pengaduan &amp; Aspirasi
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Sampaikan pertanyaan, saran, atau pengaduan layanan secara langsung ke tim Humas &amp; Tata Usaha.
              </p>
            </div>

            {sent && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Pesan Anda telah tersimpan di database dan akan segera ditindaklanjuti.</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    required
                    type="text"
                    value={form.senderName}
                    onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Layanan
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as 'ASPIRASI' | 'PENGADUAN' | 'INFORMASI',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <option value="ASPIRASI">Aspirasi / Saran</option>
                    <option value="PENGADUAN">Pengaduan Layanan</option>
                    <option value="INFORMASI">Permintaan Informasi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={form.senderEmail}
                    onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="tel"
                    value={form.senderPhone}
                    onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subjek</label>
                <input
                  required
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Isi Pesan
                </label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-2xl text-sm transition"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Mengirim...' : 'Kirim Pesan'}
              </button>
            </form>
          </div>

          {/* Kontak & FAQ */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Kontak Resmi &amp; Lokasi</h2>
              <div className="space-y-3 text-sm text-slate-600">
                <p className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{school.address}</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{school.phone}</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{school.email}</span>
                </p>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-700" /> Pertanyaan Umum (FAQ)
              </h2>
              <div className="space-y-3">
                {SAMPLE_FAQS.map((item, i) => (
                  <div key={i} className="modular-card rounded-2xl p-4 space-y-1">
                    <p className="font-bold text-slate-900 text-xs">{item.q}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
