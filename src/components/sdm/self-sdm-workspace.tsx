'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  User,
} from 'lucide-react';
import { NIK_MAX } from '@/lib/validation/identity';
import { GtkBiodataSection } from './self-sdm/gtk-biodata-section';
import { GuardianBiodataSection } from './self-sdm/guardian-biodata-section';
import { SelfSdmDocumentsSection } from './self-sdm/documents-section';
import {
  INITIAL_GTK_FORM,
  mapGuardiansToForms,
  mapTeacherToGtkForm,
  type GtkFormState,
  type GtkSelfPayload,
  type GuardianFormState,
  type GuardianSelfPayload,
  type SelfSdmRoleScope,
  type SelfSdmSection,
  type ToastState,
} from './self-sdm/types';

export type { SelfSdmRoleScope, SelfSdmSection };

export function SelfSdmWorkspace({
  roleScope,
  section,
}: {
  roleScope: SelfSdmRoleScope;
  section: SelfSdmSection;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gtkData, setGtkData] = useState<GtkSelfPayload | null>(null);
  const [guardians, setGuardians] = useState<GuardianSelfPayload[]>([]);
  const [savingGtk, setSavingGtk] = useState(false);
  const [savingGuardianId, setSavingGuardianId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gtkForm, setGtkForm] = useState<GtkFormState>(INITIAL_GTK_FORM);
  const [guardianForms, setGuardianForms] = useState<Record<string, GuardianFormState>>({});

  function showToast(type: 'ok' | 'err', text: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadSelfData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/sdm/self', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'Gagal memuat data pribadi.';
        setLoadError(msg);
        showToast('err', msg);
        return;
      }

      const gtk: GtkSelfPayload | null = data.gtk || null;
      setGtkData(gtk);
      if (gtk?.teacher) {
        setGtkForm(mapTeacherToGtkForm(gtk.teacher));
      }

      const gList: GuardianSelfPayload[] = data.guardians || [];
      setGuardians(gList);
      setGuardianForms(mapGuardiansToForms(gList));
    } catch {
      const msg = 'Tidak dapat terhubung ke server untuk memuat data.';
      setLoadError(msg);
      showToast('err', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadSelfData();
    }, 0);
    return () => clearTimeout(id);
  }, [loadSelfData]);

  async function handleSaveGtk(e: FormEvent) {
    e.preventDefault();
    if (gtkForm.nik && gtkForm.nik.length !== NIK_MAX) {
      showToast('err', `NIK harus terdiri dari tepat ${NIK_MAX} digit angka (atau kosongkan).`);
      return;
    }
    const gradYearTrimmed = gtkForm.graduation_year.trim();
    if (gradYearTrimmed) {
      const yr = Number(gradYearTrimmed);
      if (!Number.isInteger(yr) || yr < 1950 || yr > 2100) {
        showToast('err', 'Tahun lulus harus berupa angka antara 1950 hingga 2100.');
        return;
      }
    }
    const articleUrlTrimmed = gtkForm.thesis_article_url.trim();
    if (articleUrlTrimmed && !/^https?:\/\//i.test(articleUrlTrimmed)) {
      showToast('err', 'URL artikel ilmiah harus diawali http:// atau https://');
      return;
    }
    setSavingGtk(true);
    try {
      const res = await fetch('/api/sdm/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'gtk',
          ...gtkForm,
          gender: gtkForm.gender === 'P' ? 'P' : 'L',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan biodata GTK.');
      showToast('ok', 'Biodata GTK Anda berhasil diperbarui.');
      await loadSelfData();
    } catch (err) {
      showToast('err', (err as Error).message);
    } finally {
      setSavingGtk(false);
    }
  }

  async function handleSaveGuardian(e: FormEvent, guardianId: string) {
    e.preventDefault();
    const form = guardianForms[guardianId];
    if (!form) return;
    if (form.nik && form.nik.length !== NIK_MAX) {
      showToast('err', `NIK harus terdiri dari tepat ${NIK_MAX} digit angka (atau kosongkan).`);
      return;
    }
    setSavingGuardianId(guardianId);
    try {
      const res = await fetch('/api/sdm/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'orang-tua',
          id: guardianId,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan biodata orang tua/wali.');
      showToast('ok', 'Biodata orang tua/wali Anda berhasil diperbarui.');
      await loadSelfData();
    } catch (err) {
      showToast('err', (err as Error).message);
    } finally {
      setSavingGuardianId(null);
    }
  }

  const basePath =
    roleScope === 'gtk'
      ? '/portal/gtk/biodata-dokumen'
      : '/portal/orang-tua/biodata-dokumen';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data biodata &amp; dokumen...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 break-words">
            {roleScope === 'gtk'
              ? 'Biodata & Dokumen GTK Mandiri'
              : 'Biodata & Dokumen Orang Tua / Wali Mandiri'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {roleScope === 'gtk'
              ? 'Kelola biodata pribadi, kepegawaian, dan dokumen pendukung Anda secara mandiri.'
              : 'Kelola biodata pribadi dan dokumen pendukung orang tua/wali Anda secara mandiri.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`${basePath}/biodata`}
            className={`min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              section === 'biodata'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" /> Biodata Lengkap
          </Link>
          <Link
            href={`${basePath}/dokumen`}
            className={`min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              section === 'dokumen'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" /> Scan Dokumen Pribadi
          </Link>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadSelfData();
            }}
            disabled={loading}
            aria-label="Segarkan data"
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadSelfData();
            }}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {toast && (
        <div
          role={toast.type === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
          className={`fixed top-20 right-4 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="break-words">{toast.text}</span>
        </div>
      )}

      {!loadError && roleScope === 'gtk' && !gtkData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl p-5 sm:p-6 text-xs space-y-1.5">
          <p className="font-bold text-sm">Akun Belum Tertaut ke Data GTK</p>
          <p className="leading-relaxed">
            Akun portal Anda saat ini belum ditautkan dengan data Guru/Tenaga Kependidikan oleh Admin/TU.
            Silakan hubungi Operator atau Tata Usaha untuk menautkan akun Anda di menu{' '}
            <strong>Manajemen SDM → Manajemen GTK</strong>.
          </p>
        </div>
      )}

      {!loadError && roleScope === 'orang-tua' && guardians.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl p-5 sm:p-6 text-xs space-y-1.5">
          <p className="font-bold text-sm">Akun Belum Tertaut ke Data Orang Tua / Wali</p>
          <p className="leading-relaxed">
            Akun portal Anda saat ini belum ditautkan dengan data Orang Tua/Wali Siswa oleh Admin/TU.
            Silakan hubungi Operator atau Tata Usaha untuk menautkan akun Anda di menu{' '}
            <strong>Manajemen SDM → Manajemen Orang Tua/Wali Siswa</strong>.
          </p>
        </div>
      )}

      {!loadError && gtkData && guardians.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Sinkronisasi Otomatis Aktif:</strong> Akun Anda terdaftar sebagai GTK sekaligus
            Orang Tua/Wali. Data <strong>Nama, No. HP, Email</strong> (dari Profil Akun),{' '}
            <strong>NIK, Alamat Domisili</strong>, serta dokumen <strong>KTP &amp; KK</strong>{' '}
            otomatis saling tersinkronisasi.
          </p>
        </div>
      )}

      {roleScope === 'gtk' && gtkData && section === 'biodata' && (
        <GtkBiodataSection
          gtkData={gtkData}
          gtkForm={gtkForm}
          setGtkForm={setGtkForm}
          savingGtk={savingGtk}
          onSubmit={handleSaveGtk}
        />
      )}

      {roleScope === 'orang-tua' && guardians.length > 0 && section === 'biodata' && (
        <GuardianBiodataSection
          guardians={guardians}
          guardianForms={guardianForms}
          setGuardianForms={setGuardianForms}
          savingGuardianId={savingGuardianId}
          onSubmit={handleSaveGuardian}
        />
      )}

      {section === 'dokumen' && (
        <SelfSdmDocumentsSection
          roleScope={roleScope}
          gtkData={gtkData}
          guardians={guardians}
          onRefresh={loadSelfData}
        />
      )}
    </div>
  );
}
