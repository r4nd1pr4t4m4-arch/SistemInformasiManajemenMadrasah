'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Loader2,
  Search,
  UserPlus,
} from 'lucide-react';

interface UploadedDoc {
  documentType: 'KK' | 'AKTA_KELAHIRAN' | 'IJAZAH_SKL';
  fileUrl: string;
  fileName: string;
}

interface PpdbCheckResult {
  registration_number: string;
  full_name: string;
  pathway: string;
  previous_school: string;
  status: string;
  admin_notes: string | null;
  ppdb_documents?: {
    document_type: string;
    file_name: string | null;
    is_verified: boolean;
  }[];
}

export default function PpdbPage() {
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    nisn: '',
    nik: '',
    gender: 'L' as 'L' | 'P',
    birthPlace: '',
    birthDate: '',
    previousSchool: '',
    address: '',
    parentName: '',
    parentPhone: '',
    pathway: 'REGULER' as 'REGULER' | 'PRESTASI' | 'AFIRMASI',
  });

  const [files, setFiles] = useState<{
    KK?: File;
    AKTA_KELAHIRAN?: File;
    IJAZAH_SKL?: File;
  }>({});

  const [checkCode, setCheckCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<PpdbCheckResult | null>(null);

  async function uploadFileToR2(
    docType: 'KK' | 'AKTA_KELAHIRAN' | 'IJAZAH_SKL',
    file: File
  ): Promise<UploadedDoc | null> {
    const presignRes = await fetch('/api/storage/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'ppdb',
        fileName: `${docType}-${file.name}`,
        contentType: file.type || 'application/octet-stream',
      }),
    });

    if (!presignRes.ok) {
      return null;
    }

    const { uploadUrl, publicUrl } = await presignRes.json();
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!putRes.ok) {
      return null;
    }

    return {
      documentType: docType,
      fileUrl: publicUrl,
      fileName: file.name,
    };
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const uploadedDocs: UploadedDoc[] = [];
      const docEntries = Object.entries(files) as [
        'KK' | 'AKTA_KELAHIRAN' | 'IJAZAH_SKL',
        File | undefined
      ][];

      for (const [docType, file] of docEntries) {
        if (file) {
          try {
            const uploaded = await uploadFileToR2(docType, file);
            if (uploaded) uploadedDocs.push(uploaded);
          } catch {
            // Jika CORS R2 belum diatur di bucket, tetap lanjutkan penyimpanan pendaftaran
          }
        }
      }

      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          documents: uploadedDocs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menyimpan pendaftaran PPDB.');
      } else {
        setSubmittedCode(data.registrationNumber);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan koneksi ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checkCode.trim()) return;

    setChecking(true);
    setCheckError(null);
    setCheckResult(null);

    try {
      const res = await fetch(
        `/api/ppdb?code=${encodeURIComponent(checkCode.trim().toUpperCase())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || 'Nomor pendaftaran tidak ditemukan.');
      } else {
        setCheckResult(data.registration);
      }
    } catch {
      setCheckError('Gagal terhubung ke server.');
    } finally {
      setChecking(false);
    }
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
              Formulir pendaftaran daring terhubung ke Supabase &amp; Cloudflare R2, serta cek kelulusan mandiri.
            </p>
          </div>

          <div className="border-b border-slate-200/80 flex bg-white/60">
            <button
              type="button"
              onClick={() => setActiveTab('daftar')}
              className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'daftar'
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50'
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
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Status &amp; Kelulusan
            </button>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === 'daftar' ? (
              submittedCode ? (
                <div className="p-7 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center space-y-3">
                  <CheckCircle2 className="w-11 h-11 text-emerald-700 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Pendaftaran Berhasil Tersimpan di Database!
                  </h2>
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
                    className="mt-2 inline-flex items-center gap-2 bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
                  >
                    Cek Status Sekarang
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  {errorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap Calon Siswa
                      </label>
                      <input
                        required
                        type="text"
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        placeholder="Sesuai Ijazah / Akta"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NISN</label>
                      <input
                        type="text"
                        value={form.nisn}
                        onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                        placeholder="10 digit NISN"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NIK</label>
                      <input
                        required
                        type="text"
                        value={form.nik}
                        onChange={(e) => setForm({ ...form, nik: e.target.value })}
                        placeholder="16 digit NIK"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jenis Kelamin
                      </label>
                      <select
                        value={form.gender}
                        onChange={(e) =>
                          setForm({ ...form, gender: e.target.value as 'L' | 'P' })
                        }
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat Lahir
                      </label>
                      <input
                        required
                        type="text"
                        value={form.birthPlace}
                        onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                        placeholder="Kota/Kabupaten"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Lahir
                      </label>
                      <input
                        required
                        type="date"
                        value={form.birthDate}
                        onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jalur Pendaftaran
                      </label>
                      <select
                        value={form.pathway}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            pathway: e.target.value as 'REGULER' | 'PRESTASI' | 'AFIRMASI',
                          })
                        }
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
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
                        value={form.previousSchool}
                        onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                        placeholder="Contoh: MTsN 1 / SMPN 2"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Orang Tua / Wali
                      </label>
                      <input
                        required
                        type="text"
                        value={form.parentName}
                        onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                        placeholder="Nama lengkap orang tua/wali"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        No. WhatsApp Orang Tua / Wali
                      </label>
                      <input
                        required
                        type="tel"
                        value={form.parentPhone}
                        onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                        placeholder="08xxxxxxxxxx"
                        className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Lengkap
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten"
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="border-t border-slate-200/80 pt-4 space-y-3">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-emerald-700" /> Unggah Berkas Persyaratan (PDF/JPG)
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {(
                        [
                          { key: 'KK', label: 'Kartu Keluarga (KK)' },
                          { key: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
                          { key: 'IJAZAH_SKL', label: 'Ijazah / SKL' },
                        ] as const
                      ).map((doc) => (
                        <label
                          key={doc.key}
                          className="modular-card rounded-2xl p-3.5 text-xs text-slate-600 cursor-pointer block"
                        >
                          <span className="font-semibold text-slate-800 block mb-1.5">
                            {doc.label}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) =>
                              setFiles((prev) => ({
                                ...prev,
                                [doc.key]: e.target.files?.[0],
                              }))
                            }
                            className="w-full text-[11px]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition shadow-sm"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Menyimpan & Mengunggah Berkas...' : 'Kirim Pendaftaran PPDB'}
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
                    placeholder="Masukkan Nomor Pendaftaran (contoh: PPDB-2026-12345)"
                    className="flex-1 rounded-xl border border-slate-300/90 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={checking}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                  >
                    {checking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Cek Status
                  </button>
                </form>

                {checkError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {checkError}
                  </div>
                )}

                {checkResult && (
                  <div className="modular-card rounded-2xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {checkResult.registration_number}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                        {checkResult.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{checkResult.full_name}</p>
                      <p className="text-xs text-slate-500">
                        Jalur {checkResult.pathway} • Asal: {checkResult.previous_school}
                      </p>
                    </div>
                    {checkResult.admin_notes && (
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        Catatan Panitia: {checkResult.admin_notes}
                      </p>
                    )}
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
