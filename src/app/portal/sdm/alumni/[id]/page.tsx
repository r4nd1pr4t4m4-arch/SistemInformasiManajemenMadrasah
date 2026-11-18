'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, GraduationCap, Link2, Loader2 } from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const ALUMNI_DOC_OPTIONS = [
  { value: 'IJAZAH_MI_SD', label: 'Ijazah Kelulusan / SKL' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
  { value: 'LAINNYA', label: 'Transkrip / Sertifikat / Dokumen Alumni Lainnya' },
];

export default function DetailAlumniPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [tracers, setTracers] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sdm/detail?scope=alumni&id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail alumni.');
      setStudent(data.student);
      setTracers(data.tracers || []);
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat detail alumni...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/sdm/alumni"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Alumni
        </Link>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || 'Data alumni tidak ditemukan.'}
        </div>
      </div>
    );
  }

  const profile = student.profile as { full_name?: string } | null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/portal/sdm/alumni"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Alumni
          </Link>
          <h1 className="text-xl font-bold text-slate-900">
            Detail Alumni: {String(student.full_name || '-')}
          </h1>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
          Lulusan Tahun {String(student.graduation_year || '-')}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <GraduationCap className="w-4 h-4 text-emerald-600" /> Biodata Pribadi Alumni
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900">{String(student.full_name || '-')}</dd>
            <dt className="text-slate-500">NIS / NISN</dt>
            <dd className="text-slate-800">
              {String(student.nis || '-')} / {String(student.nisn || '-')}
            </dd>
            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800">{String(student.nik || '-')}</dd>
            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800">
              {String(student.birth_place || '-')}, {String(student.birth_date || '-')}
            </dd>
            <dt className="text-slate-500">Tahun Masuk / Lulus</dt>
            <dd className="text-slate-800">
              {String(student.entry_year || '-')} / {String(student.graduation_year || '-')}
            </dd>
            <dt className="text-slate-500">No. HP / Email</dt>
            <dd className="text-slate-800">
              {String(student.phone || '-')} / {String(student.email || '-')}
            </dd>
            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800">{String(student.address || '-')}</dd>
            <dt className="text-slate-500">Akun Portal</dt>
            <dd>
              {profile ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                  <Link2 className="w-3 h-3" /> {profile.full_name}
                </span>
              ) : (
                <span className="text-slate-400">Belum ditautkan</span>
              )}
            </dd>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Briefcase className="w-4 h-4 text-blue-600" /> Riwayat Tracer Study ({tracers.length})
          </h2>
          {tracers.length === 0 ? (
            <p className="text-xs text-slate-400">Belum ada data tracer study yang tertaut.</p>
          ) : (
            <div className="space-y-2.5">
              {tracers.map((t) => (
                <div
                  key={String(t.id)}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                      {String(t.current_activity)}
                    </span>
                    <span className="text-slate-500">Angkatan {String(t.graduation_year)}</span>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {String(t.institution_or_company || '-')}
                  </p>
                  <p className="text-slate-600">
                    {String(t.major_or_position || '-')} • {String(t.city || '-')}
                  </p>
                  {Boolean(t.testimonial) && (
                    <p className="text-slate-500 italic">&ldquo;{String(t.testimonial)}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SdmDocumentSection
        entityType="ALUMNI"
        entityId={id}
        documentOptions={ALUMNI_DOC_OPTIONS}
        documents={documents}
        onRefresh={loadDetail}
        supportsVerification
      />
    </div>
  );
}
