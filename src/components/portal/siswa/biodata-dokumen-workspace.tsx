'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import type { StudentCardData } from '@/lib/cards/card-png-renderer';
import { COUNT_OPTIONS_1_TO_12 } from '@/lib/validation/identity';
import {
  EMPTY_BIODATA,
  STANDARD_DOCUMENTS,
  mapStudentToBiodata,
  type BiodataDokumenSection,
  type BiodataFormState,
  type DocFilter,
  type DocumentType,
  type StudentDocument,
  type StudentRef,
} from './biodata/types';
import { BiodataFormSection } from './biodata/biodata-form-section';
import {
  DigitalStudentCardSection,
  DokumenSection,
} from './biodata/dokumen-and-card-section';

export type { BiodataDokumenSection };

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
  const [biodata, setBiodata] = useState<BiodataFormState>(EMPTY_BIODATA);
  const [isCustomChildOrder, setIsCustomChildOrder] = useState(false);
  const [isCustomSiblingsCount, setIsCustomSiblingsCount] = useState(false);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({});
  const [otherTitle, setOtherTitle] = useState('');
  const [docFilter, setDocFilter] = useState<DocFilter>('ALL');
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
        const mapped = mapStudentToBiodata(s, data.profile?.email);
        setIsCustomChildOrder(
          Boolean(mapped.child_order && !COUNT_OPTIONS_1_TO_12.includes(mapped.child_order))
        );
        setIsCustomSiblingsCount(
          Boolean(mapped.siblings_count && !COUNT_OPTIONS_1_TO_12.includes(mapped.siblings_count))
        );
        setBiodata(mapped);
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

  async function handleSaveBiodata(e: FormEvent<HTMLFormElement>) {
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
          role={message.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl text-xs font-medium border flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            message.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
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
          <BiodataFormSection
            biodata={biodata}
            setBiodata={setBiodata}
            canManage={canManage}
            isOfficialEditor={isOfficialEditor}
            savingBiodata={savingBiodata}
            refreshing={refreshing}
            isCustomChildOrder={isCustomChildOrder}
            setIsCustomChildOrder={setIsCustomChildOrder}
            isCustomSiblingsCount={isCustomSiblingsCount}
            setIsCustomSiblingsCount={setIsCustomSiblingsCount}
            onSubmit={handleSaveBiodata}
          />
          {studentRecord && <DigitalStudentCardSection studentRecord={studentRecord} />}
        </div>
      ) : (
        <DokumenSection
          studentId={studentId}
          canManage={canManage}
          docByType={docByType}
          otherDocs={otherDocs}
          docNumbers={docNumbers}
          setDocNumbers={setDocNumbers}
          otherTitle={otherTitle}
          setOtherTitle={setOtherTitle}
          docFilter={docFilter}
          setDocFilter={setDocFilter}
          uploadingType={uploadingType}
          deletingDocId={deletingDocId}
          onUploadDocument={handleUploadDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      )}
    </div>
  );
}
