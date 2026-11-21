'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Link2,
  Loader2,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const ORANG_TUA_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP Orang Tua / Wali' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'SURAT_KUASA_WALI', label: 'Surat Kuasa / Keterangan Perwalian' },
  { value: 'KIP_KKS_PKH', label: 'Kartu Bantuan (KIP / KKS / PKH)' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

const RELATIONSHIP_LABELS: Record<string, string> = {
  AYAH: 'Ayah',
  IBU: 'Ibu',
  WALI: 'Wali',
};

export default function DetailOrangTuaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<Record<string, unknown> | null>(null);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadDetail = useCallback(
    async (isBackgroundRefresh = false, signal?: AbortSignal) => {
      if (!id) {
        setError('ID orang tua/wali tidak valid.');
        setLoading(false);
        return;
      }

      const reqId = ++requestIdRef.current;
      if (isBackgroundRefresh || hasLoadedOnceRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetch(
          `/api/sdm/detail?scope=orang-tua&id=${encodeURIComponent(id)}`,
          { cache: 'no-store', signal }
        );
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail orang tua/wali.');
        hasLoadedOnceRef.current = true;
        setGuardian(data.guardian);
        setDocuments(data.documents || []);
      } catch (e) {
        if (signal?.aborted || reqId !== requestIdRef.current) return;
        setError((e as Error).message);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadDetail(false, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Memuat detail orang tua/wali...
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          href="/portal/sdm/orang-tua"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Orang Tua/Wali
        </Link>
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{error || 'Data orang tua/wali tidak ditemukan.'}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDetail(false)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-semibold shrink-0 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
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
    phone?: string;
    address?: string;
  } | null;
  const profile = guardian.profile as { full_name?: string; primary_role?: string } | null;
  const relKey = String(guardian.relationship || 'WALI');
  const relLabel = RELATIONSHIP_LABELS[relKey] || relKey;

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            href="/portal/sdm/orang-tua"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Orang Tua/Wali
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Detail Orang Tua/Wali: {String(guardian.full_name || '-')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              guardian.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {guardian.is_active ? 'Aktif' : 'Nonaktif'} • {relLabel}
            {guardian.is_primary ? ' • Wali Utama' : ''}
          </span>
          <button
            type="button"
            onClick={() => void loadDetail(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <User className="w-4 h-4 text-emerald-600 shrink-0" />
            Biodata Pribadi Orang Tua / Wali
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[128px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900 min-w-0 break-words">
              {String(guardian.full_name || '-')}
            </dd>

            <dt className="text-slate-500">Hubungan</dt>
            <dd className="text-slate-800">{relLabel}</dd>

            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(guardian.nik || '-')}
            </dd>

            <dt className="text-slate-500">Pekerjaan</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(guardian.occupation || '-')}
            </dd>

            <dt className="text-slate-500">No. HP / WA</dt>
            <dd className="text-slate-800 min-w-0 break-all tabular-nums">
              {String(guardian.phone || '-')}
            </dd>

            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-800 min-w-0 break-all">
              {String(guardian.email || '-')}
            </dd>

            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800 min-w-0 break-words leading-relaxed">
              {String(guardian.address || '-')}
            </dd>

            <dt className="text-slate-500">Akun Portal</dt>
            <dd className="min-w-0">
              {profile ? (
                <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold break-words">
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span>{profile.full_name}</span>
                </span>
              ) : (
                <span className="text-slate-400">Belum ditautkan</span>
              )}
            </dd>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            Data Siswa Terkait
          </h2>
          {student ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <p className="font-bold text-slate-900 text-sm break-words">{student.full_name}</p>
              <p className="text-slate-600 tabular-nums break-words">
                NIS: {student.nis || '-'} • NISN: {student.nisn || '-'} • Status:{' '}
                {student.status || '-'}
              </p>
              {(student.phone || student.address) && (
                <p className="text-slate-500 break-words">
                  {student.phone ? `HP: ${student.phone}` : ''}
                  {student.phone && student.address ? ' • ' : ''}
                  {student.address || ''}
                </p>
              )}
              <Link
                href={`/portal/sdm/siswa/${student.id}`}
                className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline pt-1"
              >
                Lihat Detail Lengkap Siswa →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2">Belum ada data siswa terkait.</p>
          )}
        </div>
      </div>

      <SdmDocumentSection
        entityType="ORANG_TUA"
        entityId={id}
        documentOptions={ORANG_TUA_DOC_OPTIONS}
        documents={documents}
        onRefresh={() => loadDetail(true)}
      />
    </div>
  );
}
