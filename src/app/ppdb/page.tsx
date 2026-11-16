'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileUp, Search, UserPlus } from 'lucide-react';

export default function PpdbPage() {
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<null | {
    code: string;
    name: string;
    status: string;
    notes: string;
  }>(null);

  function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const randomCode = `PPDB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmittedCode(randomCode);
  }

  function handleCheckStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checkCode.trim()) return;
    setCheckResult({
      code: checkCode.trim().toUpperCase(),
      name: 'Calon Peserta Didik (Simulasi)',
      status: 'TERVERIFIKASI — MENUNGGU PENGUMUMAN',
      notes: 'Berkas KK, Akta Kelahiran, dan SKL telah diverifikasi panitia.',
    });
  }

  return (
    <div className="min-h-screen simms-ambient py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 bg-white/80 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200/80 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Website Resmi
          </Link>
          <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            PPDB Online 2026/2027
          </span>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-7">
            <h1 className="text-2xl font-bold">Penerimaan Peserta Didik Baru (PPDB)</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Formulir pendaftaran daring, unggah berkas persyaratan (Cloudflare R2), dan cek status seleksi mandiri.
            </p>
          </div>

          <div className="border-b border-slate-200 flex">
            <button
              type="button"
              onClick={() => setActiveTab('daftar')}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'daftar'
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Formulir Pendaftaran
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cek')}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'cek'
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Status &amp; Kelulusan
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'daftar' ? (
              submittedCode ? (
                <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900">Pendaftaran Berhasil Dicatat!</h2>
                  <p className="text-sm text-slate-600">
                    Simpan nomor pendaftaran berikut untuk memantau verifikasi berkas dan pengumuman kelulusan:
                  </p>
                  <p className="text-2xl font-mono font-bold text-emerald-800">{submittedCode}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckCode(submittedCode);
                      setSubmittedCode(null);
                      setActiveTab('cek');
                    }}
                    className="mt-2 inline-flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Cek Status Sekarang
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap Calon Siswa
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Sesuai Ijazah / Akta"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NISN</label>
                      <input
                        required
                        type="text"
                        placeholder="10 digit NISN"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NIK</label>
                      <input
                        required
                        type="text"
                        placeholder="16 digit NIK"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jalur Pendaftaran
                      </label>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                        <option value="REGULER">Jalur Reguler</option>
                        <option value="PRESTASI">Jalur Prestasi</option>
                        <option value="AFIRMASI">Jalur Afirmasi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Asal Sekolah / Madrasah
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Contoh: MTsN 1 / SMPN 2"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        No. WhatsApp Orang Tua / Wali
                      </label>
                      <input
                        required
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-emerald-700" /> Unggah Berkas Persyaratan (PDF/JPG)
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {['Kartu Keluarga (KK)', 'Akta Kelahiran', 'Ijazah / SKL'].map((doc) => (
                        <label
                          key={doc}
                          className="border border-dashed border-slate-300 rounded-xl p-3 text-xs text-slate-600 hover:border-emerald-600 cursor-pointer block"
                        >
                          <span className="font-semibold text-slate-800 block mb-1">{doc}</span>
                          <input type="file" className="w-full text-[11px]" />
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Kirim Pendaftaran PPDB
                  </button>
                </form>
              )
            ) : (
              <div className="space-y-5">
                <form onSubmit={handleCheckStatus} className="flex gap-2">
                  <input
                    type="text"
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value)}
                    placeholder="Masukkan Nomor Pendaftaran (contoh: PPDB-2026-1024)"
                    className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
                  >
                    Cek Status
                  </button>
                </form>

                {checkResult && (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{checkResult.code}</span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        {checkResult.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{checkResult.name}</p>
                    <p className="text-xs text-slate-600">{checkResult.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
