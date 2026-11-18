'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, HeartHandshake, Link2, Loader2, User } from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const SISWA_DOC_OPTIONS = [
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
  { value: 'IJAZAH_MI_SD', label: 'Ijazah MI / SD / Sederajat' },
  { value: 'IJAZAH_RA_TK', label: 'Ijazah RA / TK' },
  { value: 'KTP_AYAH', label: 'KTP Ayah' },
  { value: 'KTP_IBU', label: 'KTP Ibu' },
  { value: 'KTP_WALI', label: 'KTP Wali' },
  { value: 'KIP', label: 'Kartu Indonesia Pintar (KIP)' },
  { value: 'BPJS_KIS', label: 'BPJS Kesehatan / KIS' },
  { value: 'KKS', label: 'Kartu Keluarga Sejahtera (KKS)' },
  { value: 'PKH', label: 'Kartu PKH' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

export default function DetailSiswaPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [guardians, setGuardians] = useState<Record<string, unknown>[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sdm/detail?scope=siswa&id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail siswa.');
      setStudent(data.student);
      setGuardians(data.guardians || []);
      setEnrollments(data.enrollments || []);
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat detail siswa...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/sdm/siswa"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Siswa
        </Link>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || 'Data siswa tidak ditemukan.'}
        </div>
      </div>
    );
  }

  const profile = student.profile as { full_name?: string; primary_role?: string } | null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/portal/sdm/siswa"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Siswa
          </Link>
          <h1 className="text-xl font-bold text-slate-900">
            Detail Siswa: {String(student.full_name || '-')}
          </h1>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
          Status: {String(student.status || '-')}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-emerald-600" /> Data Pribadi &amp; Akademik Siswa
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900">{String(student.full_name || '-')}</dd>
            <dt className="text-slate-500">NIS / NISN</dt>
            <dd className="text-slate-800">
              {String(student.nis || '-')} / {String(student.nisn || '-')}
            </dd>
            <dt className="text-slate-500">NIK / No. KK</dt>
            <dd className="text-slate-800">
              {String(student.nik || '-')} / {String(student.kk_number || '-')}
            </dd>
            <dt className="text-slate-500">No. Akta Lahir</dt>
            <dd className="text-slate-800">{String(student.birth_certificate_number || '-')}</dd>
            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800">
              {String(student.birth_place || '-')}, {String(student.birth_date || '-')}
            </dd>
            <dt className="text-slate-500">Jenis Kelamin / Agama</dt>
            <dd className="text-slate-800">
              {student.gender === 'P' ? 'Perempuan' : student.gender === 'L' ? 'Laki-laki' : '-'} •{' '}
              {String(student.religion || '-')}
            </dd>
            <dt className="text-slate-500">Asal Sekolah</dt>
            <dd className="text-slate-800">{String(student.previous_school || '-')}</dd>
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
            <dt className="text-slate-500">KIP / KIS / KKS / PKH</dt>
            <dd className="text-slate-800">
              KIP: {String(student.kip_number || '-')} • KIS: {String(student.kis_number || '-')} •
              KKS: {String(student.kks_number || '-')} • PKH: {String(student.pkh_number || '-')}
            </dd>
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

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <HeartHandshake className="w-4 h-4 text-blue-600" /> Data Orang Tua/Wali &amp; Rombel
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Ayah</dt>
            <dd className="text-slate-800">
              {String(student.father_name || '-')} ({String(student.father_phone || '-')})
            </dd>
            <dt className="text-slate-500">Ibu</dt>
            <dd className="text-slate-800">
              {String(student.mother_name || '-')} ({String(student.mother_phone || '-')})
            </dd>
            <dt className="text-slate-500">Wali</dt>
            <dd className="text-slate-800">
              {String(student.guardian_name || '-')} ({String(student.guardian_phone || '-')})
            </dd>
          </dl>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">
              Relasi Orang Tua/Wali ({guardians.length})
            </p>
            {guardians.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada relasi di Manajemen Orang Tua/Wali.</p>
            ) : (
              guardians.map((g) => (
                <Link
                  key={String(g.id)}
                  href={`/portal/sdm/orang-tua/${String(g.id)}`}
                  className="block p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100"
                >
                  <span className="font-semibold text-slate-900">{String(g.full_name)}</span> (
                  {String(g.relationship)}) • {String(g.phone || '-')}
                </Link>
              ))
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">Riwayat Kelas ({enrollments.length})</p>
            {enrollments.length === 0 ? (
              <p className="text-xs text-slate-400">Belum terdaftar di rombel kelas.</p>
            ) : (
              enrollments.map((en) => {
                const cls = en.classroom as { name?: string } | null;
                const ay = en.academic_year as { name?: string } | null;
                return (
                  <div key={String(en.id)} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    Kelas <strong>{cls?.name || '-'}</strong> • TA {ay?.name || '-'}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <SdmDocumentSection
        entityType="SISWA"
        entityId={id}
        documentOptions={SISWA_DOC_OPTIONS}
        documents={documents}
        onRefresh={loadDetail}
        supportsVerification
      />
    </div>
  );
}
