'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalStudentCard } from '@/components/portal/cards/digital-card-viewer';
import type { StudentCardData } from '@/lib/cards/card-png-renderer';
import { StructuredAddressFields } from '@/components/sdm/structured-address-fields';
import {
  digitsOnly,
  NIK_MAX,
  PHONE_MAX,
  RELIGION_OPTIONS,
  COUNT_OPTIONS_1_TO_12,
} from '@/lib/validation/identity';

type DocumentType =
  | 'KK'
  | 'AKTA_KELAHIRAN'
  | 'IJAZAH_MI_SD'
  | 'IJAZAH_RA_TK'
  | 'KTP_AYAH'
  | 'KTP_IBU'
  | 'KTP_WALI'
  | 'KIP'
  | 'BPJS_KIS'
  | 'KKS'
  | 'PKH'
  | 'LAINNYA';

interface StudentDocument {
  id: string;
  student_id: string;
  document_type: DocumentType;
  document_title: string | null;
  document_number: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status: 'MENUNGGU' | 'TERVERIFIKASI' | 'DITOLAK';
  verification_notes: string | null;
  updated_at: string;
}

interface StudentRef {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
}

const STANDARD_DOCUMENTS: Array<{
  type: Exclude<DocumentType, 'LAINNYA'>;
  label: string;
  description: string;
}> = [
  { type: 'KK', label: 'Kartu Keluarga (KK)', description: 'Scan/foto Kartu Keluarga terbaru yang jelas.' },
  { type: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran', description: 'Scan Akta Kelahiran asli/legalisir.' },
  { type: 'IJAZAH_MI_SD', label: 'Ijazah MI / SD / Sederajat', description: 'Scan Ijazah atau SKL jenjang MI/SD.' },
  { type: 'IJAZAH_RA_TK', label: 'Ijazah RA / TK', description: 'Scan Ijazah atau surat tamat belajar RA/TK.' },
  { type: 'KTP_AYAH', label: 'KTP Ayah', description: 'Scan/foto KTP Ayah kandung.' },
  { type: 'KTP_IBU', label: 'KTP Ibu', description: 'Scan/foto KTP Ibu kandung.' },
  { type: 'KTP_WALI', label: 'KTP Wali', description: 'Scan/foto KTP Wali (jika tinggal bersama wali).' },
  { type: 'KIP', label: 'Kartu Indonesia Pintar (KIP)', description: 'Scan Kartu KIP jika memiliki.' },
  { type: 'BPJS_KIS', label: 'BPJS Kesehatan / KIS', description: 'Scan Kartu BPJS Kesehatan atau KIS.' },
  { type: 'KKS', label: 'Kartu Keluarga Sejahtera (KKS)', description: 'Scan Kartu KKS jika keluarga memiliki.' },
  { type: 'PKH', label: 'Kartu PKH', description: 'Scan Kartu Program Keluarga Harapan (PKH) jika memiliki.' },
];

const EMPTY_BIODATA = {
  full_name: '',
  nis: '',
  nisn: '',
  nik: '',
  kk_number: '',
  birth_certificate_number: '',
  gender: 'L' as 'L' | 'P',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  child_order: '',
  siblings_count: '',
  phone: '',
  email: '',
  address: '',
  rt_rw: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postal_code: '',
  previous_school: '',
  previous_school_npsn: '',
  kip_number: '',
  kis_number: '',
  kks_number: '',
  pkh_number: '',
  father_name: '',
  father_nik: '',
  father_job: '',
  father_phone: '',
  mother_name: '',
  mother_nik: '',
  mother_job: '',
  mother_phone: '',
  guardian_name: '',
  guardian_nik: '',
  guardian_job: '',
  guardian_phone: '',
};

export type BiodataDokumenSection = 'biodata' | 'dokumen';

export function BiodataDokumenWorkspace({ section }: { section: BiodataDokumenSection }) {
  const tab = section;
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.SISWA_BIODATA_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingBiodata, setSavingBiodata] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [isOfficialEditor, setIsOfficialEditor] = useState(false);
  const [studentsList, setStudentsList] = useState<StudentRef[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentRecord, setStudentRecord] = useState<StudentCardData | null>(null);
  const [biodata, setBiodata] = useState(EMPTY_BIODATA);
  const [isCustomChildOrder, setIsCustomChildOrder] = useState(false);
  const [isCustomSiblingsCount, setIsCustomSiblingsCount] = useState(false);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({});
  const [otherTitle, setOtherTitle] = useState('');
  const [docFilter, setDocFilter] = useState<'ALL' | 'UPLOADED' | 'MISSING' | 'VERIFIED'>('ALL');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchBiodataPayload = useCallback(async (targetStudentId?: string) => {
    const qs = targetStudentId ? `?studentId=${encodeURIComponent(targetStudentId)}` : '';
    const res = await fetch(`/api/siswa/biodata-dokumen${qs}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error || 'Gagal memuat biodata & dokumen.');
    }
    return data;
  }, []);

  const applyBiodataPayload = useCallback(
    (data: Awaited<ReturnType<typeof fetchBiodataPayload>>) => {
      setIsStaff(Boolean(data.isStaff));
      setIsOfficialEditor(Boolean(data.isOfficialEditor));
      setStudentsList(data.studentsList || []);
      const s = data.student;
      if (s) {
        setStudentId(s.id);
        setStudentRecord(s);
        setSelectedStudentId(s.id);
        const coStr = s.child_order != null ? String(s.child_order) : '';
        const scStr = s.siblings_count != null ? String(s.siblings_count) : '';
        setIsCustomChildOrder(Boolean(coStr && !COUNT_OPTIONS_1_TO_12.includes(coStr)));
        setIsCustomSiblingsCount(Boolean(scStr && !COUNT_OPTIONS_1_TO_12.includes(scStr)));
        setBiodata({
          full_name: s.full_name || '',
          nis: s.nis || '',
          nisn: s.nisn || '',
          nik: s.nik || '',
          kk_number: s.kk_number || '',
          birth_certificate_number: s.birth_certificate_number || '',
          gender: (s.gender as 'L' | 'P') || 'L',
          birth_place: s.birth_place || '',
          birth_date: s.birth_date || '',
          religion: s.religion || 'Islam',
          child_order: coStr,
          siblings_count: scStr,
          phone: s.phone || '',
          email: s.email || data.profile?.email || '',
          address: s.address || '',
          rt_rw: s.rt_rw || '',
          village: s.village || '',
          district: s.district || '',
          city: s.city || '',
          province: s.province || '',
          postal_code: s.postal_code || '',
          previous_school: s.previous_school || '',
          previous_school_npsn: s.previous_school_npsn || '',
          kip_number: s.kip_number || '',
          kis_number: s.kis_number || '',
          kks_number: s.kks_number || '',
          pkh_number: s.pkh_number || '',
          father_name: s.father_name || '',
          father_nik: s.father_nik || '',
          father_job: s.father_job || '',
          father_phone: s.father_phone || '',
          mother_name: s.mother_name || '',
          mother_nik: s.mother_nik || '',
          mother_job: s.mother_job || '',
          mother_phone: s.mother_phone || '',
          guardian_name: s.guardian_name || '',
          guardian_nik: s.guardian_nik || '',
          guardian_job: s.guardian_job || '',
          guardian_phone: s.guardian_phone || '',
        });
      } else {
        setStudentId(null);
        setStudentRecord(null);
        setBiodata({
          ...EMPTY_BIODATA,
          full_name: data.profile?.full_name || '',
          email: data.profile?.email || '',
        });
      }

      const docs: StudentDocument[] = data.documents || [];
      setDocuments(docs);
      const numbersMap: Record<string, string> = {};
      for (const d of docs) {
        if (d.document_number) numbersMap[d.document_type] = d.document_number;
      }
      setDocNumbers(numbersMap);
      setLoadError(null);
    },
    []
  );

  const loadData = useCallback(
    async (targetStudentId?: string, mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchBiodataPayload(targetStudentId);
        applyBiodataPayload(data);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Gagal memuat biodata & dokumen.';
        if (mode === 'initial') {
          setLoadError(errMsg);
        } else {
          setMessage({ type: 'err', text: errMsg });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyBiodataPayload, fetchBiodataPayload]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBiodataPayload();
        if (!cancelled) {
          applyBiodataPayload(data);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Gagal memuat biodata & dokumen.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBiodataPayload, fetchBiodataPayload]);

  const docByType = useMemo(() => {
    const map = new Map<string, StudentDocument>();
    for (const d of documents) {
      if (d.document_type !== 'LAINNYA') {
        map.set(d.document_type, d);
      }
    }
    return map;
  }, [documents]);

  const otherDocs = useMemo(
    () => documents.filter((d) => d.document_type === 'LAINNYA'),
    [documents]
  );

  const uploadedStandardCount = useMemo(
    () => STANDARD_DOCUMENTS.filter((d) => docByType.has(d.type)).length,
    [docByType]
  );

  async function handleSaveBiodata(e: React.FormEvent) {
    e.preventDefault();
    if (savingBiodata) return;
    if (isOfficialEditor && biodata.full_name.trim().length < 2) {
      setMessage({ type: 'err', text: 'Nama lengkap siswa minimal 2 karakter.' });
      return;
    }
    setSavingBiodata(true);
    setMessage(null);
    try {
      const res = await fetch('/api/siswa/biodata-dokumen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          ...biodata,
          full_name: biodata.full_name.trim(),
          child_order: biodata.child_order ? Number(biodata.child_order) : null,
          siblings_count: biodata.siblings_count ? Number(biodata.siblings_count) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'Gagal menyimpan biodata.');
      setMessage({ type: 'ok', text: 'Biodata lengkap siswa berhasil disimpan.' });
      await loadData(data.student?.id || studentId || undefined, 'refresh');
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSavingBiodata(false);
    }
  }

  async function handleUploadDocument(docType: DocumentType, file: File) {
    if (uploadingType !== null) return;
    if (!studentId) {
      setMessage({
        type: 'err',
        text: 'Silakan simpan Biodata Siswa terlebih dahulu sebelum mengunggah scan dokumen.',
      });
      return;
    }

    const allowedTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      setMessage({ type: 'err', text: 'Format file harus JPG, PNG, WEBP, atau PDF.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'err', text: 'Ukuran file maksimal 5 MB.' });
      return;
    }

    setUploadingType(docType);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const uploadRes = await fetch('/api/siswa/biodata-dokumen/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadData) throw new Error(uploadData?.error || 'Gagal mengunggah file.');

      const saveRes = await fetch('/api/siswa/biodata-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          document_type: docType,
          document_title: docType === 'LAINNYA' ? otherTitle.trim() || file.name : null,
          document_number: docNumbers[docType]?.trim() || null,
          file_name: uploadData.fileName,
          file_url: uploadData.fileUrl,
          object_key: uploadData.objectKey,
          mime_type: uploadData.mimeType,
          file_size: uploadData.fileSize,
        }),
      });
      const saveData = await saveRes.json().catch(() => null);
      if (!saveRes.ok || !saveData) {
        throw new Error(saveData?.error || 'Gagal menyimpan metadata dokumen.');
      }

      if (docType === 'LAINNYA') setOtherTitle('');
      setMessage({ type: 'ok', text: `Scan dokumen ${docType.replace(/_/g, ' ')} berhasil diunggah.` });
      await loadData(studentId, 'refresh');
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDeleteDocument(doc: StudentDocument) {
    if (deletingDocId !== null) return;
    if (!confirm(`Hapus dokumen "${doc.file_name}"?`)) return;
    setDeletingDocId(doc.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/siswa/biodata-dokumen?id=${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'Gagal menghapus dokumen.');
      setMessage({ type: 'ok', text: 'Dokumen berhasil dihapus.' });
      await loadData(studentId || undefined, 'refresh');
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setDeletingDocId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat Biodata &amp; Dokumen Siswa...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Biodata &amp; Dokumen</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(selectedStudentId || undefined, 'refresh')}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Biodata &amp; Dokumen Siswa</h1>
          <p className="text-sm text-slate-500">
            Lengkapi biodata pribadi, keluarga, dan unggah scan dokumen resmi siswa.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link
              href="/portal/siswa/biodata-dokumen/biodata"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                tab === 'biodata'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
              }`}
            >
              Biodata Lengkap
            </Link>
            <Link
              href="/portal/siswa/biodata-dokumen/dokumen"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                tab === 'dokumen'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
              }`}
            >
              Scan Dokumen ({uploadedStandardCount}/{STANDARD_DOCUMENTS.length})
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isStaff && studentsList.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0 w-full sm:w-auto">
              <label htmlFor="biodata-student-select" className="text-xs font-semibold text-slate-600">
                Pilih Siswa:
              </label>
              <select
                id="biodata-student-select"
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  if (e.target.value) void loadData(e.target.value, 'refresh');
                }}
                className="w-full sm:w-64 min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium"
              >
                <option value="">-- Pilih Siswa --</option>
                {studentsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadData(selectedStudentId || undefined, 'refresh')}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Segarkan data biodata & dokumen"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span className="min-w-0 break-words">{message.text}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="modular-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Nama Siswa</p>
          <p className="font-bold text-slate-900 mt-1 truncate">
            {biodata.full_name || 'Belum diisi'}
          </p>
          <p className="text-[11px] text-slate-500">NISN: {biodata.nisn || '-'}</p>
        </div>
        <div className="modular-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Kelengkapan Scan Dokumen</p>
          <p className="font-bold text-emerald-700 text-lg mt-1">
            {uploadedStandardCount} / {STANDARD_DOCUMENTS.length} Dokumen
          </p>
        </div>
        <div className="modular-card rounded-2xl p-4">
          <p className="text-xs text-slate-500">Dokumen Terverifikasi</p>
          <p className="font-bold text-blue-700 text-lg mt-1">
            {documents.filter((d) => d.verification_status === 'TERVERIFIKASI').length} Dokumen
          </p>
        </div>
      </div>

      {tab === 'biodata' ? (
        <div className="space-y-6">
        <form onSubmit={handleSaveBiodata} className="space-y-6">
          <fieldset disabled={!canManage} className="space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              1. Identitas Pribadi Siswa
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block font-semibold text-slate-600 mb-1">
                  Nama Lengkap *{' '}
                  {!isOfficialEditor && (
                    <Link
                      href="/portal/akun/profil"
                      className="text-[10px] text-emerald-700 hover:underline font-normal"
                    >
                      (Ubah di Halaman Profil)
                    </Link>
                  )}
                </label>
                <input
                  required
                  value={biodata.full_name}
                  disabled={!isOfficialEditor}
                  onChange={(e) => setBiodata({ ...biodata, full_name: e.target.value })}
                  title={
                    !isOfficialEditor
                      ? 'Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin'
                      : undefined
                  }
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                    !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  NIS {!isOfficialEditor && <span className="text-[10px] text-slate-400">(Terkunci)</span>}
                </label>
                <input
                  value={biodata.nis}
                  disabled={!isOfficialEditor}
                  onChange={(e) => setBiodata({ ...biodata, nis: e.target.value })}
                  title={!isOfficialEditor ? 'NIS hanya dapat diubah oleh Admin/TU' : undefined}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                    !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  NISN {!isOfficialEditor && <span className="text-[10px] text-slate-400">(Terkunci)</span>}
                </label>
                <input
                  value={biodata.nisn}
                  disabled={!isOfficialEditor}
                  onChange={(e) => setBiodata({ ...biodata, nisn: e.target.value })}
                  title={!isOfficialEditor ? 'NISN hanya dapat diubah oleh Admin/TU' : undefined}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                    !isOfficialEditor ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">NIK Siswa</label>
                <input
                  value={biodata.nik}
                  maxLength={NIK_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, nik: digitsOnly(e.target.value, NIK_MAX) })
                  }
                  placeholder="16 digit angka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nomor KK</label>
                <input
                  value={biodata.kk_number}
                  maxLength={NIK_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, kk_number: digitsOnly(e.target.value, NIK_MAX) })
                  }
                  placeholder="16 digit angka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">No. Akta Kelahiran</label>
                <input
                  value={biodata.birth_certificate_number}
                  onChange={(e) =>
                    setBiodata({ ...biodata, birth_certificate_number: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
                <select
                  value={biodata.gender}
                  onChange={(e) => setBiodata({ ...biodata, gender: e.target.value as 'L' | 'P' })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tempat Lahir</label>
                <input
                  value={biodata.birth_place}
                  onChange={(e) => setBiodata({ ...biodata, birth_place: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  value={biodata.birth_date}
                  onChange={(e) => setBiodata({ ...biodata, birth_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Agama</label>
                <select
                  value={biodata.religion || 'Islam'}
                  onChange={(e) => setBiodata({ ...biodata, religion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {RELIGION_OPTIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Anak Ke-</label>
                <select
                  value={isCustomChildOrder ? 'OTHER' : (biodata.child_order || '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'OTHER') {
                      setIsCustomChildOrder(true);
                      if (COUNT_OPTIONS_1_TO_12.includes(biodata.child_order)) {
                        setBiodata({ ...biodata, child_order: '' });
                      }
                    } else {
                      setIsCustomChildOrder(false);
                      setBiodata({ ...biodata, child_order: v });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Pilih --</option>
                  {COUNT_OPTIONS_1_TO_12.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="OTHER">Lainnya...</option>
                </select>
                {isCustomChildOrder && (
                  <div className="mt-1.5">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="Masukkan urutan anak..."
                      value={biodata.child_order}
                      onChange={(e) => setBiodata({ ...biodata, child_order: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Jumlah Saudara</label>
                <select
                  value={isCustomSiblingsCount ? 'OTHER' : (biodata.siblings_count || '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'OTHER') {
                      setIsCustomSiblingsCount(true);
                      if (COUNT_OPTIONS_1_TO_12.includes(biodata.siblings_count)) {
                        setBiodata({ ...biodata, siblings_count: '' });
                      }
                    } else {
                      setIsCustomSiblingsCount(false);
                      setBiodata({ ...biodata, siblings_count: v });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Pilih --</option>
                  {COUNT_OPTIONS_1_TO_12.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="OTHER">Lainnya...</option>
                </select>
                {isCustomSiblingsCount && (
                  <div className="mt-1.5">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="Masukkan jumlah saudara..."
                      value={biodata.siblings_count}
                      onChange={(e) => setBiodata({ ...biodata, siblings_count: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Jumlah Saudara tersebut juga termasuk anda.
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  No. HP / WhatsApp{' '}
                  {!isOfficialEditor && (
                    <Link
                      href="/portal/akun/profil"
                      className="text-[10px] text-emerald-700 hover:underline font-normal"
                    >
                      (Ubah di Halaman Profil)
                    </Link>
                  )}
                </label>
                <input
                  value={biodata.phone}
                  disabled={!isOfficialEditor}
                  maxLength={PHONE_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, phone: digitsOnly(e.target.value, PHONE_MAX) })
                  }
                  title={
                    !isOfficialEditor
                      ? 'No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil'
                      : undefined
                  }
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                    !isOfficialEditor
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Email{' '}
                  {!isOfficialEditor && (
                    <Link
                      href="/portal/akun/profil"
                      className="text-[10px] text-emerald-700 hover:underline font-normal"
                    >
                      (Ubah di Halaman Profil)
                    </Link>
                  )}
                </label>
                <input
                  type="email"
                  value={biodata.email}
                  disabled={!isOfficialEditor}
                  onChange={(e) => setBiodata({ ...biodata, email: e.target.value })}
                  title={
                    !isOfficialEditor
                      ? 'Email hanya dapat diubah melalui Halaman Profil'
                      : undefined
                  }
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                    !isOfficialEditor
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'bg-white'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              2. Alamat Tempat Tinggal &amp; Asal Sekolah
            </h2>
            <StructuredAddressFields
              title="Alamat Domisili Siswa"
              value={{
                province: biodata.province,
                city: biodata.city,
                district: biodata.district,
                village: biodata.village,
                rt_rw: biodata.rt_rw,
                address: biodata.address,
              }}
              onChange={(addr) =>
                setBiodata({
                  ...biodata,
                  province: addr.province,
                  city: addr.city,
                  district: addr.district,
                  village: addr.village,
                  rt_rw: addr.rt_rw,
                  address: addr.address,
                })
              }
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Kode Pos</label>
                <input
                  value={biodata.postal_code}
                  onChange={(e) => setBiodata({ ...biodata, postal_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-600 mb-1">
                  Asal Sekolah (MI / SD / RA / TK)
                </label>
                <input
                  value={biodata.previous_school}
                  onChange={(e) => setBiodata({ ...biodata, previous_school: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">NPSN Asal Sekolah</label>
                <input
                  value={biodata.previous_school_npsn}
                  onChange={(e) =>
                    setBiodata({ ...biodata, previous_school_npsn: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              3. Nomor Kartu Bantuan Sosial / Kesehatan (Opsional)
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nomor KIP</label>
                <input
                  value={biodata.kip_number}
                  onChange={(e) => setBiodata({ ...biodata, kip_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nomor BPJS / KIS</label>
                <input
                  value={biodata.kis_number}
                  onChange={(e) => setBiodata({ ...biodata, kis_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nomor KKS</label>
                <input
                  value={biodata.kks_number}
                  onChange={(e) => setBiodata({ ...biodata, kks_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nomor PKH</label>
                <input
                  value={biodata.pkh_number}
                  onChange={(e) => setBiodata({ ...biodata, pkh_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              4. Data Orang Tua &amp; Wali
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nama Ayah</label>
                <input
                  value={biodata.father_name}
                  onChange={(e) => setBiodata({ ...biodata, father_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">NIK Ayah</label>
                <input
                  value={biodata.father_nik}
                  maxLength={NIK_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, father_nik: digitsOnly(e.target.value, NIK_MAX) })
                  }
                  placeholder="16 digit angka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Ayah</label>
                <input
                  value={biodata.father_job}
                  onChange={(e) => setBiodata({ ...biodata, father_job: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">No. HP Ayah</label>
                <input
                  value={biodata.father_phone}
                  maxLength={PHONE_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, father_phone: digitsOnly(e.target.value, PHONE_MAX) })
                  }
                  placeholder="Maks. 12 digit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nama Ibu</label>
                <input
                  value={biodata.mother_name}
                  onChange={(e) => setBiodata({ ...biodata, mother_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">NIK Ibu</label>
                <input
                  value={biodata.mother_nik}
                  maxLength={NIK_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, mother_nik: digitsOnly(e.target.value, NIK_MAX) })
                  }
                  placeholder="16 digit angka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Ibu</label>
                <input
                  value={biodata.mother_job}
                  onChange={(e) => setBiodata({ ...biodata, mother_job: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">No. HP Ibu</label>
                <input
                  value={biodata.mother_phone}
                  maxLength={PHONE_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, mother_phone: digitsOnly(e.target.value, PHONE_MAX) })
                  }
                  placeholder="Maks. 12 digit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nama Wali</label>
                <input
                  value={biodata.guardian_name}
                  onChange={(e) => setBiodata({ ...biodata, guardian_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">NIK Wali</label>
                <input
                  value={biodata.guardian_nik}
                  maxLength={NIK_MAX}
                  onChange={(e) =>
                    setBiodata({ ...biodata, guardian_nik: digitsOnly(e.target.value, NIK_MAX) })
                  }
                  placeholder="16 digit angka"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Pekerjaan Wali</label>
                <input
                  value={biodata.guardian_job}
                  onChange={(e) => setBiodata({ ...biodata, guardian_job: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">No. HP Wali</label>
                <input
                  value={biodata.guardian_phone}
                  maxLength={PHONE_MAX}
                  onChange={(e) =>
                    setBiodata({
                      ...biodata,
                      guardian_phone: digitsOnly(e.target.value, PHONE_MAX),
                    })
                  }
                  placeholder="Maks. 12 digit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>
          </fieldset>

          {canManage && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBiodata || refreshing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {savingBiodata ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingBiodata ? 'Menyimpan Biodata...' : 'Simpan Biodata Lengkap'}
              </button>
            </div>
          )}
        </form>
        {studentRecord && (
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" /> Kartu Pelajar Digital Resmi
              </h2>
              <p className="text-xs text-slate-500">
                Pratinjau sisi depan &amp; belakang kartu pelajar Anda, siap diunduh sebagai file PNG.
              </p>
            </div>
            <div className="max-w-xl">
              <DigitalStudentCard student={studentRecord} />
            </div>
          </div>
        )}
        </div>
      ) : (() => {
        const filteredStdDocs = STANDARD_DOCUMENTS.filter((docDef) => {
          const existing = docByType.get(docDef.type);
          if (docFilter === 'UPLOADED') return Boolean(existing);
          if (docFilter === 'MISSING') return !existing;
          if (docFilter === 'VERIFIED') return existing?.verification_status === 'TERVERIFIKASI';
          return true;
        });

        return (
        <div className="space-y-6">
          {!studentId && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
              Data biodata siswa belum tersimpan. Silakan lengkapi dan klik{' '}
              <strong>Simpan Biodata Lengkap</strong> pada tab Biodata Lengkap terlebih dahulu agar
              dapat mengunggah scan dokumen.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">
              Menampilkan {filteredStdDocs.length} dari {STANDARD_DOCUMENTS.length} dokumen standar
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'MISSING', label: 'Belum Upload' },
                  { key: 'UPLOADED', label: 'Sudah Upload' },
                  { key: 'VERIFIED', label: 'Terverifikasi' },
                ] as const
              ).map((tabItem) => (
                <button
                  key={tabItem.key}
                  type="button"
                  onClick={() => setDocFilter(tabItem.key)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                    docFilter === tabItem.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>
          </div>

          {filteredStdDocs.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada dokumen standar pada kategori filter ini.
              </p>
              <button
                type="button"
                onClick={() => setDocFilter('ALL')}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Tampilkan semua dokumen
              </button>
            </div>
          ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredStdDocs.map((docDef) => {
              const existing = docByType.get(docDef.type);
              const isUploading = uploadingType === docDef.type;
              return (
                <div key={docDef.type} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {existing ? (
                          <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        {docDef.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{docDef.description}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        existing
                          ? existing.verification_status === 'TERVERIFIKASI'
                            ? 'bg-emerald-100 text-emerald-700'
                            : existing.verification_status === 'DITOLAK'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {existing ? existing.verification_status : 'BELUM UPLOAD'}
                    </span>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nomor Dokumen (opsional)"
                        value={docNumbers[docDef.type] || ''}
                        onChange={(e) =>
                          setDocNumbers({ ...docNumbers, [docDef.type]: e.target.value })
                        }
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  )}

                  {existing && (
                    <div className="space-y-1.5">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0">
                        <span className="truncate font-medium text-slate-700 min-w-0">
                          {existing.file_name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={existing.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                          >
                            Lihat <ExternalLink className="w-3 h-3" />
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              disabled={deletingDocId === existing.id}
                              onClick={() => void handleDeleteDocument(existing)}
                              className="text-rose-600 hover:text-rose-700 disabled:opacity-50"
                              aria-label={`Hapus dokumen ${docDef.label}`}
                              title="Hapus Dokumen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {existing.verification_notes && (
                        <p className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1 break-words">
                          Catatan Verifikasi: {existing.verification_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {canManage && (
                    <label
                      className={`inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold transition ${
                        uploadingType !== null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Mengunggah Scan...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          {existing
                            ? 'Ganti Scan Dokumen (JPG/PNG/PDF)'
                            : 'Upload Scan (JPG/PNG/PDF)'}
                        </>
                      )}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        disabled={uploadingType !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadDocument(docDef.type, file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          )}

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Dokumen Pendukung Lainnya</h3>
            {canManage && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  disabled={uploadingType !== null}
                  placeholder="Nama Dokumen (cth: Sertifikat Prestasi / Surat Pindah)"
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs disabled:bg-slate-100"
                />
                <label
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold transition ${
                    uploadingType !== null
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:bg-slate-800'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingType === 'LAINNYA' ? 'Mengunggah...' : 'Upload Dokumen Lainnya'}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    disabled={uploadingType !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUploadDocument('LAINNYA', file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {otherDocs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Belum ada dokumen pendukung lainnya yang diunggah.
              </p>
            ) : (
              <div className="space-y-2">
                {otherDocs.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 break-words">
                        {d.document_title || d.file_name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{d.file_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                      >
                        Lihat <ExternalLink className="w-3 h-3" />
                      </a>
                      {canManage && (
                        <button
                          type="button"
                          disabled={deletingDocId === d.id}
                          onClick={() => void handleDeleteDocument(d)}
                          className="text-rose-600 hover:text-rose-700 disabled:opacity-50"
                          aria-label={`Hapus dokumen ${d.document_title || d.file_name}`}
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
