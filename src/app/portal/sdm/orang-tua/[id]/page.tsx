'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Link2, Loader2, User, Users } from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const ORANG_TUA_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP Orang Tua / Wali' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'SURAT_KUASA_WALI', label: 'Surat Kuasa / Keterangan Perwalian' },
  { value: 'KIP_KKS_PKH', label: 'Kartu Bantuan (KIP / KKS / PKH)' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

export default function DetailOrangTuaPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<Record<string, unknown> | null>(null);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sdm/detail?scope=orang-tua&id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail orang tua/wali.');
      setGuardian(data.guardian);
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
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat detail orang tua/wali...
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="space-y-4">
        <Link
          href="/portal/sdm/orang-tua"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Orang Tua/Wali
        </Link>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || 'Data orang tua/wali tidak ditemukan.'}
        </div>
      </div>
    );
  }

  const student = guardian.student as {
    id?: string;
    full_name?: string;
    nis?: string;
    nisn?: string;
    status?: string;
  } | null;
  const profile = guardian.profile as { full_name?: string; primary_role?: string } | null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/portal/sdm/orang-tua"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Orang Tua/Wali
          </Link>
          <h1 className="text-xl font-bold text-slate-900">
            Detail Orang Tua/Wali: {String(guardian.full_name || '-')}
          </h1>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
          {String(guardian.relationship || 'WALI')} {guardian.is_primary ? '• Wali Utama' : ''}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-emerald-600" /> Biodata Pribadi Orang Tua / Wali
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900">{String(guardian.full_name || '-')}</dd>
            <dt className="text-slate-500">Hubungan</dt>
            <dd className="text-slate-800">{String(guardian.relationship || '-')}</dd>
            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800">{String(guardian.nik || '-')}</dd>
            <dt className="text-slate-500">Pekerjaan</dt>
            <dd className="text-slate-800">{String(guardian.occupation || '-')}</dd>
            <dt className="text-slate-500">No. HP / WA</dt>
            <dd className="text-slate-800">{String(guardian.phone || '-')}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-800">{String(guardian.email || '-')}</dd>
            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800">{String(guardian.address || '-')}</dd>
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
            <Users className="w-4 h-4 text-blue-600" /> Data Siswa Terkait
          </h2>
          {student ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-900 text-sm">{student.full_name}</p>
              <p className="text-slate-600">
                NIS: {student.nis || '-'} • NISN: {student.nisn || '-'} • Status: {student.status}
              </p>
              <Link
                href={`/portal/sdm/siswa/${student.id}`}
                className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
              >
                Lihat Detail Lengkap Siswa →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Belum ada data siswa terkait.</p>
          )}
        </div>
      </div>

      <SdmDocumentSection
        entityType="ORANG_TUA"
        entityId={id}
        documentOptions={ORANG_TUA_DOC_OPTIONS}
        documents={documents}
        onRefresh={loadDetail}
      />
    </div>
  );
}
