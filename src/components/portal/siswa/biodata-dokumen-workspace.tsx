'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  RefreshCw,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
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
import { ReviewSummaryBanner } from '@/components/sdm/biodata-reviews/review-summary-banner';
import {
  UnsentReviewLeaveModal,
  useUnsentReviewSession,
} from '@/components/sdm/biodata-reviews/unsent-review-guard';
import type { BiodataReviewItem } from '@/components/sdm/biodata-reviews/types';

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
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<StudentDocument | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [isOfficialEditor, setIsOfficialEditor] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviews, setReviews] = useState<BiodataReviewItem[]>([]);
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

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(deleteModalRef, Boolean(deleteTargetDoc));

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setMessage({ type, text });
    toastTimerRef.current = setTimeout(() => {
      setMessage(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!deleteTargetDoc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deletingDocId) {
        setDeleteTargetDoc(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTargetDoc, deletingDocId]);

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
      setCanReview(Boolean(data.canReview));
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
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
      setOtherTitle('');
      setLoadError(null);
    },
    []
  );

  const loadData = useCallback(
    async (targetStudentId?: string, mode: 'initial' | 'refresh' = 'refresh') => {
      const seq = ++requestSeqRef.current;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchBiodataPayload(targetStudentId);
        if (seq !== requestSeqRef.current) return;
        applyBiodataPayload(data);
      } catch (e) {
        if (seq !== requestSeqRef.current) return;
        const errMsg = e instanceof Error ? e.message : 'Gagal memuat biodata & dokumen.';
        if (mode === 'initial' || loadError) {
          setLoadError(errMsg);
        } else {
          showToast('err', errMsg);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyBiodataPayload, fetchBiodataPayload, loadError, showToast]
  );

  const unsentSession = useUnsentReviewSession({
    entityType: 'SISWA',
    entityId: studentId,
    entityLabel: biodata.full_name || null,
    canReview,
    allowedBasePath: '/portal/siswa/biodata-dokumen',
    reviews,
    onAfterCancel: () => loadData(studentId || undefined, 'refresh'),
    onNotifyToast: showToast,
  });

  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeqRef.current;
    const initialStudentId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('studentId') || undefined
        : undefined;
    (async () => {
      try {
        const data = await fetchBiodataPayload(initialStudentId);
        if (!cancelled && seq === requestSeqRef.current) {
          applyBiodataPayload(data);
        }
      } catch (e) {
        if (!cancelled && seq === requestSeqRef.current) {
          setLoadError(e instanceof Error ? e.message : 'Gagal memuat biodata & dokumen.');
        }
      } finally {
        if (!cancelled && seq === requestSeqRef.current) {
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

  const verifiedCount = useMemo(
    () => documents.filter((d) => d.verification_status === 'TERVERIFIKASI').length,
    [documents]
  );

  const biodataProgress = useMemo(() => {
    const keys: Array<keyof BiodataFormState> = [
      'full_name',
      'nik',
      'kk_number',
      'gender',
      'birth_place',
      'birth_date',
      'province',
      'city',
      'district',
      'village',
      'address',
      'father_name',
      'mother_name',
    ];
    const filled = keys.filter((k) => Boolean(String(biodata[k] || '').trim())).length;
    return Math.round((filled / keys.length) * 100);
  }, [biodata]);

  async function handleSaveBiodata(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingBiodata) return;

    if (isOfficialEditor && biodata.full_name.trim().length < 2) {
      showToast('err', 'Nama lengkap siswa minimal 2 karakter.');
      return;
    }
    if (biodata.nik && biodata.nik.length !== 16) {
      showToast('err', 'NIK Siswa harus terdiri dari tepat 16 digit angka.');
      return;
    }
    if (biodata.kk_number && biodata.kk_number.length !== 16) {
      showToast('err', 'Nomor Kartu Keluarga (KK) harus terdiri dari tepat 16 digit angka.');
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
      showToast('ok', 'Biodata lengkap siswa berhasil disimpan.');
      await loadData(data.student?.id || studentId || undefined, 'refresh');
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setSavingBiodata(false);
    }
  }

  async function handleUploadDocument(docType: DocumentType, file: File) {
    if (uploadingType !== null) return;
    if (!studentId) {
      showToast(
        'err',
        'Silakan simpan Biodata Siswa terlebih dahulu sebelum mengunggah scan dokumen.'
      );
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
      showToast('err', 'Format file harus JPG, PNG, WEBP, atau PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('err', 'Ukuran file maksimal 5 MB.');
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
      showToast('ok', `Scan dokumen ${docType.replace(/_/g, ' ')} berhasil diunggah.`);
      await loadData(studentId, 'refresh');
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setUploadingType(null);
    }
  }

  async function confirmDeleteDocument() {
    if (!deleteTargetDoc || deletingDocId !== null) return;
    const doc = deleteTargetDoc;
    setDeletingDocId(doc.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/siswa/biodata-dokumen?id=${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'Gagal menghapus dokumen.');
      setDeleteTargetDoc(null);
      showToast('ok', `Dokumen "${doc.document_title || doc.file_name}" berhasil dihapus.`);
      await loadData(studentId || undefined, 'refresh');
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setDeletingDocId(null);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="max-w-6xl mx-auto glass-card rounded-3xl p-8 sm:p-12 text-center space-y-3 border border-slate-200/80"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-bold text-slate-900">
            Memuat Biodata &amp; Dokumen Siswa
          </p>
          <p className="text-xs text-slate-500">
            Menyiapkan data induk peserta didik, arsip scan dokumen, dan kartu pelajar digital...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="max-w-2xl mx-auto glass-card rounded-3xl p-7 sm:p-10 text-center space-y-4 border border-rose-200/80"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Gagal Memuat Biodata &amp; Dokumen
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 break-words">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(selectedStudentId || undefined, 'refresh')}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memuat Ulang...' : 'Coba Muat Ulang'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-8">
      {/* Header & Navigasi Workspace */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Biodata &amp; Dokumen Siswa
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Lengkapi biodata pribadi, keluarga, dan unggah scan dokumen resmi peserta didik.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
            {isStaff && studentsList.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0 w-full sm:w-auto">
                <label
                  htmlFor="biodata-student-select"
                  className="text-xs font-semibold text-slate-600 shrink-0"
                >
                  Pilih Siswa:
                </label>
                <select
                  id="biodata-student-select"
                  value={selectedStudentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (nextId === selectedStudentId) return;
                    unsentSession.guardAction(() => {
                      setSelectedStudentId(nextId);
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        if (nextId) url.searchParams.set('studentId', nextId);
                        else url.searchParams.delete('studentId');
                        window.history.replaceState({}, '', url.toString());
                      }
                      if (nextId) void loadData(nextId, 'refresh');
                    });
                  }}
                  className="w-full sm:w-64 min-w-0 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
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
              disabled={refreshing || savingBiodata}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
              title="Segarkan data biodata & dokumen"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigasi */}
        <div
          role="tablist"
          aria-label="Navigasi biodata dan dokumen siswa"
          className="grid grid-cols-2 sm:flex sm:items-center gap-2 border-t border-slate-200/70 pt-3.5"
        >
          <Link
            href={
              isStaff && selectedStudentId
                ? `/portal/siswa/biodata-dokumen/biodata?studentId=${encodeURIComponent(selectedStudentId)}`
                : '/portal/siswa/biodata-dokumen/biodata'
            }
            role="tab"
            aria-selected={tab === 'biodata'}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
              tab === 'biodata'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Biodata Lengkap</span>
          </Link>
          <Link
            href={
              isStaff && selectedStudentId
                ? `/portal/siswa/biodata-dokumen/dokumen?studentId=${encodeURIComponent(selectedStudentId)}`
                : '/portal/siswa/biodata-dokumen/dokumen'
            }
            role="tab"
            aria-selected={tab === 'dokumen'}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
              tab === 'dokumen'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Scan Dokumen ({uploadedStandardCount}/{STANDARD_DOCUMENTS.length})
            </span>
          </Link>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl text-xs font-medium border flex items-start justify-between gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            message.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {message.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="min-w-0 break-words leading-relaxed">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Ringkasan Status Siswa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="modular-card rounded-2xl p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Nama Siswa</p>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
              Biodata {biodataProgress}%
            </span>
          </div>
          <p className="font-bold text-slate-900 mt-1 truncate">
            {biodata.full_name || 'Belum diisi'}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
            NISN: {biodata.nisn || '-'} {biodata.nis ? `• NIS: ${biodata.nis}` : ''}
          </p>
        </div>

        <div className="modular-card rounded-2xl p-4 min-w-0">
          <p className="text-xs text-slate-500">Kelengkapan Scan Dokumen</p>
          <p className="font-bold text-emerald-700 text-lg mt-1 tabular-nums">
            {uploadedStandardCount} / {STANDARD_DOCUMENTS.length} Dokumen
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${Math.round((uploadedStandardCount / STANDARD_DOCUMENTS.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="modular-card rounded-2xl p-4 min-w-0">
          <p className="text-xs text-slate-500">Dokumen Terverifikasi</p>
          <p className="font-bold text-blue-700 text-lg mt-1 tabular-nums">
            {verifiedCount} Dokumen
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Total unggahan tersimpan: {documents.length} berkas
          </p>
        </div>
      </div>

      <ReviewSummaryBanner
        entityType="SISWA"
        entityId={studentId}
        activeSection={tab}
        otherSectionHref={
          tab === 'biodata'
            ? isStaff && selectedStudentId
              ? `/portal/siswa/biodata-dokumen/dokumen?studentId=${encodeURIComponent(selectedStudentId)}`
              : '/portal/siswa/biodata-dokumen/dokumen'
            : isStaff && selectedStudentId
              ? `/portal/siswa/biodata-dokumen/biodata?studentId=${encodeURIComponent(selectedStudentId)}`
              : '/portal/siswa/biodata-dokumen/biodata'
        }
        reviews={reviews}
        canReview={canReview}
        unsentCount={unsentSession.unsentCount}
        onNotified={unsentSession.clearUnsent}
        onNotifyToast={showToast}
      />

      {tab === 'biodata' ? (
        <div className="space-y-6">
          <BiodataFormSection
            key={studentId || 'no-student'}
            studentId={studentId}
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
            reviews={reviews}
            canReview={canReview}
            onRefreshReviews={() => loadData(studentId || undefined, 'refresh')}
            onReviewSaved={unsentSession.markReviewSaved}
            onNotifyToast={showToast}
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
          onDeleteDocument={(doc) => setDeleteTargetDoc(doc)}
          reviews={reviews}
          canReview={canReview}
          onRefreshReviews={() => loadData(studentId || undefined, 'refresh')}
          onReviewSaved={unsentSession.markReviewSaved}
          onNotifyToast={showToast}
        />
      )}

      <UnsentReviewLeaveModal {...unsentSession.modalProps} />

      {/* Modal Konfirmasi Hapus Dokumen */}
      {deleteTargetDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-doc-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingDocId) {
              setDeleteTargetDoc(null);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            ref={deleteModalRef}
            className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 id="modal-delete-doc-title" className="text-base font-bold text-slate-900">
                  Hapus Scan Dokumen?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  Anda akan menghapus dokumen{' '}
                  <strong className="text-slate-900">
                    {deleteTargetDoc.document_title || deleteTargetDoc.file_name}
                  </strong>
                  . Anda dapat mengunggah ulang berkas pengganti kapan saja.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={Boolean(deletingDocId)}
                onClick={() => setDeleteTargetDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingDocId)}
                onClick={() => void confirmDeleteDocument()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingDocId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Ya, Hapus Dokumen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
