'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';

const ALUMNI_DOC_OPTIONS = [
  { value: 'IJAZAH_MI_SD', label: 'Ijazah Kelulusan / SKL' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
  { value: 'LAINNYA', label: 'Transkrip / Sertifikat / Dokumen Alumni Lainnya' },
];

const ACTIVITY_LABELS: Record<string, string> = {
  KULIAH: 'Kuliah',
  BEKERJA: 'Bekerja',
  WIRAUSAHA: 'Wirausaha',
  PESANTREN: 'Pesantren',
  MENCARI_KERJA: 'Mencari Kerja',
  LAINNYA: 'Lainnya',
};

export default function DetailAlumniPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [tracers, setTracers] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadDetail = useCallback(
    async (isBackgroundRefresh = false, signal?: AbortSignal) => {
      if (!id) {
        setError('ID alumni tidak valid.');
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
        const res = await fetch(`/api/sdm/detail?scope=alumni&id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail alumni.');
        hasLoadedOnceRef.current = true;
        setStudent(data.student);
        setTracers(data.tracers || []);
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
        Memuat detail alumni...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          href="/portal/sdm/alumni/lulusan"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Alumni
        </Link>
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{error || 'Data alumni tidak ditemukan.'}</span>
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

  const profile = student.profile as { full_name?: string } | null;

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            href="/portal/sdm/alumni/lulusan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Alumni
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Detail Alumni: {String(student.full_name || '-')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 tabular-nums">
            Lulusan Tahun {String(student.graduation_year || '-')}
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

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Riwayat Tracer Study</p>
          <p className="text-lg sm:text-xl font-bold text-blue-700 mt-1 tabular-nums">
            {tracers.length}
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
            <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
            Biodata Pribadi Alumni
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900 min-w-0 break-words">
              {String(student.full_name || '-')}
            </dd>

            <dt className="text-slate-500">NIS / NISN</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(student.nis || '-')} / {String(student.nisn || '-')}
            </dd>

            <dt className="text-slate-500">NIK</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(student.nik || '-')}
            </dd>

            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.birth_place || '-')}, {String(student.birth_date || '-')}
            </dd>

            <dt className="text-slate-500">Tahun Masuk / Lulus</dt>
            <dd className="text-slate-800 tabular-nums">
              {String(student.entry_year || '-')} / {String(student.graduation_year || '-')}
            </dd>

            <dt className="text-slate-500">No. HP / Email</dt>
            <dd className="text-slate-800 min-w-0 break-all">
              {String(student.phone || '-')} / {String(student.email || '-')}
            </dd>

            <dt className="text-slate-500">Alamat</dt>
            <dd className="text-slate-800 min-w-0 break-words leading-relaxed">
              {String(student.address || '-')}
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
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
            Riwayat Tracer Study ({tracers.length})
          </h2>
          {tracers.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              Belum ada data tracer study yang tertaut.
            </p>
          ) : (
            <div className="space-y-2.5">
              {tracers.map((t) => {
                const activityKey = String(t.current_activity || '');
                const activityLabel = ACTIVITY_LABELS[activityKey] || activityKey || '-';
                return (
                  <div
                    key={String(t.id)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                        {activityLabel}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        Angkatan {String(t.graduation_year)}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 break-words">
                      {String(t.institution_or_company || '-')}
                    </p>
                    <p className="text-slate-600 break-words">
                      {String(t.major_or_position || '-')} • {String(t.city || '-')}
                    </p>
                    {Boolean(t.testimonial) && (
                      <p className="text-slate-500 italic break-words leading-relaxed">
                        &ldquo;{String(t.testimonial)}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SdmDocumentSection
        entityType="ALUMNI"
        entityId={id}
        documentOptions={ALUMNI_DOC_OPTIONS}
        documents={documents}
        onRefresh={() => loadDetail(true)}
        supportsVerification
      />
    </div>
  );
}
