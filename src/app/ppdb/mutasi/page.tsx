'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarCheck,
  CheckCircle2,
  FileUp,
  Loader2,
} from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import {
  PpdbRegistrationCard,
  type RegistrationCardData,
} from '@/components/ppdb/registration-card';

interface ActivePeriod {
  name: string;
  open_date: string;
  close_date: string;
}

interface UploadedDoc {
  documentType: 'KK' | 'AKTA_KELAHIRAN' | 'LAINNYA';
  fileUrl: string;
  fileName: string;
}

export default function PpdbMutasiPage() {
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null);
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
    targetGrade: 'VIII / XI',
    mutationReason: '',
    address: '',
    parentName: '',
    parentPhone: '',
  });

  const [files, setFiles] = useState<{
    SURAT_MUTASI?: File;
    RAPOR?: File;
    KK?: File;
    AKTA?: File;
  }>({});

  useEffect(() => {
    fetch('/api/ppdb?info=active')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.period) setActivePeriod(d.period);
      })
      .catch(() => {});
  }, []);

  async function uploadToR2(
    docType: 'KK' | 'AKTA_KELAHIRAN' | 'LAINNYA',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const uploadedDocs: UploadedDoc[] = [];
      const uploads: Array<['KK' | 'AKTA_KELAHIRAN' | 'LAINNYA', string, File | undefined]> = [
        ['LAINNYA', 'SURAT_MUTASI', files.SURAT_MUTASI],
        ['LAINNYA', 'RAPOR_TERAKHIR', files.RAPOR],
        ['KK', 'KK', files.KK],
        ['AKTA_KELAHIRAN', 'AKTA_KELAHIRAN', files.AKTA],
      ];

      for (const [docType, prefix, file] of uploads) {
        if (file) {
          try {
            const uploaded = await uploadToR2(docType, prefix, file);
            if (uploaded) uploadedDocs.push(uploaded);
          } catch {
            // Lanjutkan penyimpanan pendaftaran
          }
        }
      }

      const res = await fetch('/api/ppdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pathway: 'MUTASI',
          documents: uploadedDocs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menyimpan pendaftaran mutasi masuk.');
      } else {
        setSubmittedCard({
          registrationNumber: data.registrationNumber,
          fullName: form.fullName,
          nisn: form.nisn,
          pathway: 'MUTASI',
          previousSchool: form.previousSchool,
          parentName: form.parentName,
          parentPhone: form.parentPhone,
          status: 'MENUNGGU_VERIFIKASI',
          createdAt: new Date().toISOString(),
          notes: `Kelas Tujuan: ${form.targetGrade} | Alasan: ${form.mutationReason}`,
          documents: uploadedDocs.map((d) => ({ label: d.fileName })),
        });
      }
    } catch {
      setErrorMsg('Terjadi kesalahan koneksi ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-sky-700 to-teal-700 text-white p-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full mb-2">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Jalur Pindahan
              </span>
              <h1 className="text-2xl font-bold">PPDB Khusus Siswa Mutasi Masuk</h1>
              <p className="text-sky-100 text-sm mt-1">
                Formulir pendaftaran daring untuk peserta didik pindahan dari sekolah/madrasah lain.
              </p>
            </div>
            <Link
              href="/ppdb"
              className="text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2 rounded-xl transition"
            >
              PPDB Siswa Baru →
            </Link>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {activePeriod && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                <span className="font-semibold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" />
                  Periode Aktif: {activePeriod.name}
                </span>
                <span>
                  {activePeriod.open_date} s/d {activePeriod.close_date}
                </span>
              </div>
            )}

            {submittedCard ? (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 print:hidden">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Pengajuan Mutasi Masuk Berhasil!</strong> Simpan atau cetak Kartu Bukti Pendaftaran berikut untuk verifikasi berkas.
                  </span>
                </div>
                <PpdbRegistrationCard data={submittedCard} />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap Siswa
                    </label>
                    <input
                      required
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">NISN</label>
                    <input
                      required
                      type="text"
                      value={form.nisn}
                      onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">NIK</label>
                    <input
                      required
                      type="text"
                      value={form.nik}
                      onChange={(e) => setForm({ ...form, nik: e.target.value })}
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
                      Sekolah / Madrasah Asal
                    </label>
                    <input
                      required
                      type="text"
                      value={form.previousSchool}
                      onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                      placeholder="Nama lembaga asal"
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kelas / Tingkat Tujuan
                    </label>
                    <input
                      required
                      type="text"
                      value={form.targetGrade}
                      onChange={(e) => setForm({ ...form, targetGrade: e.target.value })}
                      placeholder="Contoh: VIII atau XI IPA"
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
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
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
                      className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan Mutasi / Pindah Sekolah
                  </label>
                  <input
                    required
                    type="text"
                    value={form.mutationReason}
                    onChange={(e) => setForm({ ...form, mutationReason: e.target.value })}
                    placeholder="Contoh: Mengikuti kepindahan dinas orang tua"
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Domisili Saat Ini
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="border-t border-slate-200/80 pt-4 space-y-3">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-sky-700" /> Unggah Berkas Persyaratan Mutasi (PDF/JPG)
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'SURAT_MUTASI', label: 'Surat Keterangan Pindah / Mutasi Asal' },
                        { key: 'RAPOR', label: 'Scan Rapor Terakhir' },
                        { key: 'KK', label: 'Kartu Keluarga (KK)' },
                        { key: 'AKTA', label: 'Akta Kelahiran' },
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
                  className="w-full inline-flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition shadow-sm"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Mengirim Pengajuan Mutasi...' : 'Kirim Pengajuan Mutasi Masuk'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
