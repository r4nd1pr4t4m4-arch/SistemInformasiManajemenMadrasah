'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import {
  DEFAULT_PATHWAY_QUOTAS,
  PPDB_PATHWAYS,
  type PathwayQuotas,
  type PpdbPathwayCode,
} from '@/lib/ppdb/pathways';
import {
  PpdbRegistrationCard,
  type RegistrationCardData,
} from '@/components/ppdb/registration-card';

interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
  pathway_quotas?: PathwayQuotas;
}

interface UploadedDoc {
  documentType:
    | 'KK'
    | 'AKTA_KELAHIRAN'
    | 'IJAZAH_SKL'
    | 'PAS_FOTO'
    | 'SERTIFIKAT_PRESTASI'
    | 'LAINNYA';
  fileUrl: string;
  fileName: string;
}

export default function PpdbPage() {
  const [activeTab, setActiveTab] = useState<'daftar' | 'cek'>('daftar');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
  const [selectedPathway, setSelectedPathway] = useState<PpdbPathwayCode | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedCard, setSubmittedCard] = useState<RegistrationCardData | null>(null);

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
  });

  const [files, setFiles] = useState<Record<string, File | undefined>>({});

  const [checkCode, setCheckCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkCard, setCheckCard] = useState<RegistrationCardData | null>(null);

  useEffect(() => {
    fetch('/api/ppdb?info=active')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.period) setActivePeriod(d.period);
      })
      .catch(() => {});
  }, []);

  const quotas: PathwayQuotas = activePeriod?.pathway_quotas || DEFAULT_PATHWAY_QUOTAS;
  const activePathwayDef = PPDB_PATHWAYS.find((p) => p.code === selectedPathway) || null;

  async function uploadFileToR2(
    docType: UploadedDoc['documentType'],
    prefix: string,
    file: File
  ): Promise<UploadedDoc | null> {
    const presignRes = await fetch('/api/storage/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'ppdb',
        fileName: `${prefix}-${file.name}`,
        contentType: file.type || 'application/octet-stream',
      }),
    });

    if (!presignRes.ok) return null;
    const { uploadUrl, publicUrl } = await presignRes.json();
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!putRes.ok) return null;

    return {
      documentType: docType,
      fileUrl: publicUrl,
      fileName: `${prefix}: ${file.name}`,
    };
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activePathwayDef) {
      setErrorMsg('Silakan pilih jalur pendaftaran terlebih dahulu.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const uploadedDocs: UploadedDoc[] = [];
      const allReqs = [...activePathwayDef.generalDocs, ...activePathwayDef.specialDocs];

      for (const req of allReqs) {
        const file = files[req.key];
        if (file) {
          try {
            const uploaded = await uploadFileToR2(req.documentType, req.key, file);
            if (uploaded) uploadedDocs.push(uploaded);
          } catch {
            // Lanjutkan penyimpanan pendaftaran jika R2 CORS belum siap
          }
        }
      }

      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pathway: activePathwayDef.code,
          documents: uploadedDocs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menyimpan pendaftaran PPDB.');
      } else {
        setSubmittedCard({
          registrationNumber: data.registrationNumber,
          fullName: form.fullName,
          nisn: form.nisn,
          pathway: activePathwayDef.code,
          previousSchool: form.previousSchool,
          parentName: form.parentName,
          parentPhone: form.parentPhone,
          status: 'MENUNGGU_VERIFIKASI',
          createdAt: new Date().toISOString(),
          documents: uploadedDocs.map((d) => ({ label: d.fileName })),
        });
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
    setCheckCard(null);

    try {
      const res = await fetch(
        `/api/ppdb?code=${encodeURIComponent(checkCode.trim().toUpperCase())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || 'Nomor pendaftaran tidak ditemukan.');
      } else {
        const reg = data.registration;
        setCheckCard({
          registrationNumber: reg.registration_number,
          fullName: reg.full_name,
          nisn: reg.nisn,
          pathway: reg.pathway,
          previousSchool: reg.previous_school,
          parentName: reg.parent_name,
          parentPhone: reg.parent_phone,
          status: reg.status,
          createdAt: reg.created_at,
          notes: reg.admin_notes,
          documents: (reg.ppdb_documents || []).map(
            (d: { document_type: string; file_name: string | null; is_verified: boolean }) => ({
              label: d.file_name || d.document_type,
              verified: d.is_verified,
            })
          ),
        });
      }
    } catch {
      setCheckError('Gagal terhubung ke server.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-7 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div>
              <h1 className="text-2xl font-bold">Penerimaan Peserta Didik Baru (PPDB)</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Pilih jalur pendaftaran, lengkapi biodata &amp; berkas, serta cetak Kartu Bukti Pendaftaran.
              </p>
            </div>
            <Link
              href="/ppdb/mutasi"
              className="text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2 rounded-xl transition"
            >
              Khusus Mutasi Masuk →
            </Link>
          </div>

          <div className="border-b border-slate-200/80 flex bg-white/60 print:hidden">
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
              <Search className="w-4 h-4" /> Cek Status &amp; Kartu Bukti
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {activePeriod && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 print:hidden">
                <span className="font-semibold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" />
                  Periode Aktif: {activePeriod.name}
                </span>
                <span>
                  {activePeriod.open_date} s/d {activePeriod.close_date}
                </span>
              </div>
            )}

            {activeTab === 'daftar' ? (
              submittedCard ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 print:hidden">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Pendaftaran Berhasil!</strong> Berikut adalah Kartu Bukti Pendaftaran resmi Anda. Silakan cetak atau simpan sebagai PDF.
                    </span>
                  </div>
                  <PpdbRegistrationCard data={submittedCard} />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* LANGKAH 1: KARTU-KARTU JALUR PENDAFTARAN */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                          <Sparkles className="w-3.5 h-3.5" /> Langkah 1
                        </span>
                        <h2 className="text-base font-bold text-slate-900">
                          Pilih Jalur Pendaftaran Terlebih Dahulu
                        </h2>
                      </div>
                      {selectedPathway && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                          Terpilih: {activePathwayDef?.title}
                        </span>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {PPDB_PATHWAYS.map((pw) => {
                        const isSelected = selectedPathway === pw.code;
                        const quota = quotas[pw.code];
                        return (
                          <button
                            key={pw.code}
                            type="button"
                            onClick={() => {
                              setSelectedPathway(pw.code);
                              setFiles({});
                              setErrorMsg(null);
                            }}
                            className={`text-left rounded-3xl p-5 border-2 transition-all flex flex-col justify-between space-y-4 ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/50 shadow-md'
                                : 'border-slate-200/80 bg-white/90 hover:border-emerald-300'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  {pw.badge}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                  Kuota: {quota}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 text-base">{pw.title}</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">{pw.subtitle}</p>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {pw.description}
                              </p>
                            </div>

                            <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                              <p className="font-bold text-slate-700 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-emerald-700" /> Syarat Khusus:
                              </p>
                              {pw.specialDocs.map((d) => (
                                <p key={d.key} className="text-emerald-800 font-medium">
                                  • {d.label}
                                </p>
                              ))}
                              <p className="text-slate-500 pt-1">
                                + Persyaratan Umum (KK, Akta, Ijazah/SKL)
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* LANGKAH 2: FORMULIR BIODATA & UPLOAD DOKUMEN */}
                  {!activePathwayDef ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                      Klik salah satu kartu <strong>Jalur Pendaftaran</strong> di atas untuk membuka formulir pendaftaran &amp; unggah berkas persyaratan.
                    </div>
                  ) : (
                    <form
                      onSubmit={handleRegisterSubmit}
                      className="space-y-5 pt-4 border-t border-slate-200/80"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Langkah 2
                          </span>
                          <h2 className="text-base font-bold text-slate-900">
                            Lengkapi Biodata &amp; Berkas — {activePathwayDef.title}
                          </h2>
                        </div>
                      </div>

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
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            NISN
                          </label>
                          <input
                            type="text"
                            value={form.nisn}
                            onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                            placeholder="10 digit NISN"
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            NIK
                          </label>
                          <input
                            required
                            type="text"
                            value={form.nik}
                            onChange={(e) => setForm({ ...form, nik: e.target.value })}
                            placeholder="16 digit NIK"
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Asal Sekolah / Madrasah
                          </label>
                          <input
                            required
                            type="text"
                            value={form.previousSchool}
                            onChange={(e) =>
                              setForm({ ...form, previousSchool: e.target.value })
                            }
                            placeholder="Contoh: MTsN 1 / SMPN 2"
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            No. WhatsApp Orang Tua / Wali
                          </label>
                          <input
                            required
                            type="tel"
                            value={form.parentPhone}
                            onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                            placeholder="08xxxxxxxxxx"
                            className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                          className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      {/* Dokumen Persyaratan Umum & Khusus */}
                      <div className="border-t border-slate-200/80 pt-4 space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <FileUp className="w-4 h-4 text-emerald-700" /> Dokumen Persyaratan Umum
                          </p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {activePathwayDef.generalDocs.map((doc) => (
                              <label
                                key={doc.key}
                                className="modular-card rounded-2xl p-3.5 text-xs text-slate-600 cursor-pointer block"
                              >
                                <span className="font-semibold text-slate-800 block mb-1.5">
                                  {doc.label}{' '}
                                  {doc.required && <span className="text-rose-600">*</span>}
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

                        <div className="space-y-2">
                          <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                            <FileUp className="w-4 h-4 text-emerald-700" /> Dokumen Persyaratan Khusus (
                            {activePathwayDef.title})
                          </p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {activePathwayDef.specialDocs.map((doc) => (
                              <label
                                key={doc.key}
                                className="modular-card rounded-2xl p-3.5 text-xs text-slate-600 cursor-pointer block border-emerald-200 bg-emerald-50/30"
                              >
                                <span className="font-semibold text-emerald-900 block mb-1.5">
                                  {doc.label} <span className="text-rose-600">*</span>
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
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition shadow-sm"
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {submitting
                          ? 'Menyimpan & Mengunggah Berkas...'
                          : 'Kirim Pendaftaran & Buat Kartu Bukti'}
                      </button>
                    </form>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-5">
                <form onSubmit={handleCheckStatus} className="flex gap-2 print:hidden">
                  <input
                    type="text"
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value)}
                    placeholder="Masukkan Nomor Pendaftaran (PPDB-2026-... atau MUTASI-2026-...)"
                    className="flex-1 rounded-xl border border-slate-300/90 bg-white px-4 py-2.5 text-sm"
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

                {checkCard && <PpdbRegistrationCard data={checkCard} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
