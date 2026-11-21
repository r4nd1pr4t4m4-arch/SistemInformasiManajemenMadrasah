'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  User,
} from 'lucide-react';
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

const STAFF_TYPE_LABELS: Record<string, string> = {
  GURU: 'Guru',
  TATA_USAHA: 'Tata Usaha',
  LAINNYA: 'Lainnya',
};

export default function DetailGtkPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<Record<string, unknown> | null>(null);
  const [histories, setHistories] = useState<Record<string, unknown>[]>([]);
  const [duties, setDuties] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadDetail = useCallback(
    async (isBackgroundRefresh = false, signal?: AbortSignal) => {
      if (!id) {
        setError('ID GTK tidak valid.');
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
        const res = await fetch(`/api/sdm/detail?scope=gtk&id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail GTK.');
        hasLoadedOnceRef.current = true;
        setTeacher(data.teacher);
        setHistories(data.employmentHistories || []);
        setDuties(data.additionalDuties || []);
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
        Memuat detail GTK...
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          href="/portal/sdm/gtk"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen GTK
        </Link>
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{error || 'Data GTK tidak ditemukan.'}</span>
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

  const profile = teacher.profile as {
    full_name?: string;
    email?: string;
    primary_role?: string;
  } | null;
  const staffTypeKey = String(teacher.staff_type || '');
  const staffTypeLabel = STAFF_TYPE_LABELS[staffTypeKey] || staffTypeKey || '-';

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            href="/portal/sdm/gtk"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen GTK
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Detail GTK: {String(teacher.full_name || '-')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              teacher.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {teacher.is_active ? 'Aktif' : 'Nonaktif'} • {staffTypeLabel}
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

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Tugas Tambahan</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {duties.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Riwayat Jabatan</p>
          <p className="text-lg sm:text-xl font-bold text-blue-700 mt-1 tabular-nums">
            {histories.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
            Dokumen Terkait
          </p>
          <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {documents.length}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <User className="w-4 h-4 text-emerald-600 shrink-0" />
            Biodata Pribadi &amp; Kepegawaian
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[148px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900 min-w-0 break-words">
              {String(teacher.full_name || '-')}
            </dd>

            <dt className="text-slate-500">NIP / NUPTK</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(teacher.nip || '-')} / {String(teacher.nuptk || '-')}
            </dd>

            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(teacher.nik || '-')}
            </dd>

            <dt className="text-slate-500">Jenis Kelamin</dt>
            <dd className="text-slate-800">
              {teacher.gender === 'P' ? 'Perempuan' : teacher.gender === 'L' ? 'Laki-laki' : '-'}
            </dd>

            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(teacher.birth_place || '-')}, {String(teacher.birth_date || '-')}
            </dd>

            <dt className="text-slate-500">Status Kepegawaian</dt>
            <dd className="font-semibold text-slate-800">
              {String(teacher.employment_status || '-')}
            </dd>

            <dt className="text-slate-500">Tanggal Bergabung</dt>
            <dd className="text-slate-800 tabular-nums">
              {String(teacher.join_date || '-')}
            </dd>

            <dt className="text-slate-500">Pendidikan</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(teacher.education_level || '-')}{' '}
              {teacher.major ? `(${String(teacher.major)})` : ''}
            </dd>

            <dt className="text-slate-500">No. HP / Email</dt>
            <dd className="text-slate-800 min-w-0 break-all">
              {String(teacher.phone || '-')} / {String(teacher.email || '-')}
            </dd>

            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800 min-w-0 break-words leading-relaxed">
              {String(teacher.address || '-')}
            </dd>

            <dt className="text-slate-500">Akun Portal</dt>
            <dd className="min-w-0">
              {profile ? (
                <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold break-words">
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span>
                    {profile.full_name} ({profile.primary_role || '-'})
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">Belum ditautkan</span>
              )}
            </dd>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
            Tugas Tambahan &amp; Riwayat Jabatan
          </h2>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Tugas Tambahan ({duties.length})
            </p>
            {duties.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Belum ada tugas tambahan tercatat.</p>
            ) : (
              duties.map((d) => {
                const dt = d.duty_type as { name?: string } | null;
                const ay = d.academic_year as { name?: string } | null;
                return (
                  <div
                    key={String(d.id)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-0.5"
                  >
                    <p className="font-semibold text-slate-900 break-words">
                      {dt?.name || '-'}
                      {ay?.name ? ` • ${ay.name}` : ''}
                    </p>
                    <p className="text-slate-500 break-words">
                      SK: {String(d.decree_number || '-')} • Mulai: {String(d.start_date || '-')}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">
              Riwayat Jabatan ({histories.length})
            </p>
            {histories.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Belum ada riwayat jabatan tercatat.</p>
            ) : (
              histories.map((h) => (
                <div
                  key={String(h.id)}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-0.5"
                >
                  <p className="font-semibold text-slate-900 break-words">
                    {String(h.position_title || '-')}
                  </p>
                  <p className="text-slate-500 break-words">
                    {String(h.unit_or_institution || '-')} • SK:{' '}
                    {String(h.decree_number || '-')}
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
        onRefresh={() => loadDetail(true)}
      />
    </div>
  );
}
