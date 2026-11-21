'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  HeartHandshake,
  Link2,
  Loader2,
  RefreshCw,
  User,
} from 'lucide-react';
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

const STATUS_BADGES: Record<string, string> = {
  AKTIF: 'bg-emerald-100 text-emerald-700',
  LULUS: 'bg-blue-100 text-blue-700',
  MUTASI: 'bg-amber-100 text-amber-700',
  NONAKTIF: 'bg-slate-200 text-slate-700',
};

export default function DetailSiswaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [guardians, setGuardians] = useState<Record<string, unknown>[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<SdmDocumentItem[]>([]);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadDetail = useCallback(
    async (isBackgroundRefresh = false, signal?: AbortSignal) => {
      if (!id) {
        setError('ID siswa tidak valid.');
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
        const res = await fetch(`/api/sdm/detail?scope=siswa&id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail siswa.');
        hasLoadedOnceRef.current = true;
        setStudent(data.student);
        setGuardians(data.guardians || []);
        setEnrollments(data.enrollments || []);
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
        Memuat detail siswa...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          href="/portal/sdm/siswa"
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Siswa
        </Link>
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{error || 'Data siswa tidak ditemukan.'}</span>
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

  const profile = student.profile as {
    full_name?: string;
    primary_role?: string;
  } | null;
  const statusStr = String(student.status || '-');
  const statusBadgeClass = STATUS_BADGES[statusStr] || 'bg-slate-200 text-slate-700';

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            href="/portal/sdm/siswa"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Manajemen Siswa
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Detail Siswa: {String(student.full_name || '-')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadgeClass}`}>
            Status: {statusStr}
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
          <p className="text-[11px] font-medium text-slate-500">Relasi Wali</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {guardians.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-slate-500">Riwayat Kelas</p>
          <p className="text-lg sm:text-xl font-bold text-blue-700 mt-1 tabular-nums">
            {enrollments.length}
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
            Data Pribadi &amp; Akademik Siswa
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[152px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500">Nama Lengkap</dt>
            <dd className="font-semibold text-slate-900 min-w-0 break-words">
              {String(student.full_name || '-')}
            </dd>

            <dt className="text-slate-500">NIS / NISN</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(student.nis || '-')} / {String(student.nisn || '-')}
            </dd>

            <dt className="text-slate-500">NIK / No. KK</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(student.nik || '-')} / {String(student.kk_number || '-')}
            </dd>

            <dt className="text-slate-500">No. Akta Lahir</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums">
              {String(student.birth_certificate_number || '-')}
            </dd>

            <dt className="text-slate-500">Tempat, Tgl Lahir</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.birth_place || '-')}, {String(student.birth_date || '-')}
            </dd>

            <dt className="text-slate-500">Jenis Kelamin / Agama</dt>
            <dd className="text-slate-800">
              {student.gender === 'P' ? 'Perempuan' : student.gender === 'L' ? 'Laki-laki' : '-'} •{' '}
              {String(student.religion || '-')}
            </dd>

            <dt className="text-slate-500">Asal Sekolah</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.previous_school || '-')}
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

            <dt className="text-slate-500">KIP / KIS / KKS / PKH</dt>
            <dd className="text-slate-800 min-w-0 break-words tabular-nums leading-relaxed">
              KIP: {String(student.kip_number || '-')} • KIS: {String(student.kis_number || '-')} •
              KKS: {String(student.kks_number || '-')} • PKH: {String(student.pkh_number || '-')}
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

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <HeartHandshake className="w-4 h-4 text-blue-600 shrink-0" />
            Data Orang Tua/Wali &amp; Rombel
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500">Ayah</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.father_name || '-')} ({String(student.father_phone || '-')})
            </dd>

            <dt className="text-slate-500">Ibu</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.mother_name || '-')} ({String(student.mother_phone || '-')})
            </dd>

            <dt className="text-slate-500">Wali</dt>
            <dd className="text-slate-800 min-w-0 break-words">
              {String(student.guardian_name || '-')} ({String(student.guardian_phone || '-')})
            </dd>
          </dl>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">
              Relasi Orang Tua/Wali ({guardians.length})
            </p>
            {guardians.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">
                Belum ada relasi di Manajemen Orang Tua/Wali.
              </p>
            ) : (
              guardians.map((g) => (
                <Link
                  key={String(g.id)}
                  href={`/portal/sdm/orang-tua/${String(g.id)}`}
                  className="block p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs hover:bg-slate-100 transition break-words"
                >
                  <span className="font-semibold text-slate-900">{String(g.full_name)}</span> (
                  {String(g.relationship)}) • {String(g.phone || '-')}
                </Link>
              ))
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600">
              Riwayat Kelas ({enrollments.length})
            </p>
            {enrollments.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Belum terdaftar di rombel kelas.</p>
            ) : (
              enrollments.map((en) => {
                const cls = en.classroom as { name?: string } | null;
                const ay = en.academic_year as { name?: string } | null;
                return (
                  <div
                    key={String(en.id)}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs break-words"
                  >
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
        onRefresh={() => loadDetail(true)}
        supportsVerification
      />
    </div>
  );
}
