'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, Link2, Loader2, User } from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const GTK_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'IJAZAH_TERAKHIR', label: 'Ijazah Pendidikan Terakhir' },
  { value: 'SK_PENGANGKATAN', label: 'SK Pengangkatan (PNS/PPPK/GTY/GTT)' },
  { value: 'SK_PEMBAGIAN_TUGAS', label: 'SK Pembagian Tugas Mengajar' },
  { value: 'SERTIFIKAT_PENDIDIK', label: 'Sertifikat Pendidik / NRG' },
  { value: 'NPWP', label: 'NPWP' },
  { value: 'BUKU_REKENING', label: 'Buku Rekening Honorarium' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

export default function DetailGtkPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<Record<string, unknown> | null>(null);
  const [histories, setHistories] = useState<Record<string, unknown>[]>([]);
  const [duties, setDuties] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sdm/detail?scope=gtk&id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail GTK.');
      setTeacher(data.teacher);
      setHistories(data.employmentHistories || []);
      setDuties(data.additionalDuties || []);
      setDocuments(data.documents || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat detail GTK...
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/sdm/gtk"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen GTK
        </Link>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || 'Data GTK tidak ditemukan.'}
        </div>
      </div>
    );
  }

  const profile = teacher.profile as { full_name?: string; email?: string; primary_role?: string } | null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/portal/sdm/gtk"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen GTK
          </Link>
          <h1 className="text-xl font-bold text-slate-900">
            Detail GTK: {String(teacher.full_name || '-')}
          </h1>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            teacher.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {teacher.is_active ? 'Aktif' : 'Nonaktif'} • {String(teacher.staff_type || '-')}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-emerald-600" /> Biodata Pribadi &amp; Kepegawaian
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900">{String(teacher.full_name || '-')}</dd>
            <dt className="text-slate-500">NIP / NUPTK</dt>
            <dd className="text-slate-800">
              {String(teacher.nip || '-')} / {String(teacher.nuptk || '-')}
            </dd>
            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800">{String(teacher.nik || '-')}</dd>
            <dt className="text-slate-500">Jenis Kelamin</dt>
            <dd className="text-slate-800">
              {teacher.gender === 'P' ? 'Perempuan' : teacher.gender === 'L' ? 'Laki-laki' : '-'}
            </dd>
            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800">
              {String(teacher.birth_place || '-')}, {String(teacher.birth_date || '-')}
            </dd>
            <dt className="text-slate-500">Status Kepegawaian</dt>
            <dd className="font-semibold text-slate-800">{String(teacher.employment_status || '-')}</dd>
            <dt className="text-slate-500">Pendidikan</dt>
            <dd className="text-slate-800">
              {String(teacher.education_level || '-')} {teacher.major ? `(${teacher.major})` : ''}
            </dd>
            <dt className="text-slate-500">No. HP / Email</dt>
            <dd className="text-slate-800">
              {String(teacher.phone || '-')} / {String(teacher.email || '-')}
            </dd>
            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800">{String(teacher.address || '-')}</dd>
            <dt className="text-slate-500">Akun Portal</dt>
            <dd>
              {profile ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                  <Link2 className="w-3 h-3" /> {profile.full_name} ({profile.primary_role})
                </span>
              ) : (
                <span className="text-slate-400">Belum ditautkan</span>
              )}
            </dd>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Briefcase className="w-4 h-4 text-blue-600" /> Tugas Tambahan &amp; Riwayat Jabatan
          </h2>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Tugas Tambahan ({duties.length})</p>
            {duties.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada tugas tambahan tercatat.</p>
            ) : (
              duties.map((d) => {
                const dt = d.duty_type as { name?: string } | null;
                return (
                  <div key={String(d.id)} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <p className="font-semibold text-slate-900">{dt?.name || '-'}</p>
                    <p className="text-slate-500">
                      SK: {String(d.decree_number || '-')} • Mulai: {String(d.start_date || '-')}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">Riwayat Jabatan ({histories.length})</p>
            {histories.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada riwayat jabatan tercatat.</p>
            ) : (
              histories.map((h) => (
                <div key={String(h.id)} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-semibold text-slate-900">{String(h.position_title || '-')}</p>
                  <p className="text-slate-500">
                    {String(h.unit_or_institution || '-')} • SK: {String(h.decree_number || '-')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SdmDocumentSection
        entityType="GTK"
        entityId={id}
        documentOptions={GTK_DOC_OPTIONS}
        documents={documents}
        onRefresh={loadDetail}
      />
    </div>
  );
}
