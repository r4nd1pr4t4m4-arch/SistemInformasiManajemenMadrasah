'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  User,
  Users,
} from 'lucide-react';
import { SdmDocumentSection, type SdmDocumentItem } from '@/components/sdm/sdm-document-section';
import { StructuredAddressFields } from '@/components/sdm/structured-address-fields';
import { digitsOnly, NIK_MAX } from '@/lib/validation/identity';

export type SelfSdmRoleScope = 'gtk' | 'orang-tua';
export type SelfSdmSection = 'biodata' | 'dokumen';

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

const ORANG_TUA_DOC_OPTIONS = [
  { value: 'KTP', label: 'KTP Orang Tua / Wali' },
  { value: 'KK', label: 'Kartu Keluarga (KK)' },
  { value: 'SURAT_KUASA_WALI', label: 'Surat Kuasa / Keterangan Perwalian' },
  { value: 'KIP_KKS_PKH', label: 'Kartu Bantuan (KIP / KKS / PKH)' },
  { value: 'LAINNYA', label: 'Dokumen Pendukung Lainnya' },
];

interface GtkSelfPayload {
  teacher: Record<string, unknown>;
  employmentHistories: Record<string, unknown>[];
  additionalDuties: Record<string, unknown>[];
  documents: SdmDocumentItem[];
  sharedStudentDocuments?: SdmDocumentItem[];
}

interface GuardianSelfPayload {
  id: string;
  full_name: string;
  relationship: string;
  nik: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  rt_rw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  is_primary?: boolean;
  student?: {
    id?: string;
    full_name?: string;
    nis?: string | null;
    nisn?: string | null;
    status?: string | null;
  } | null;
  documents: SdmDocumentItem[];
  sharedStudentDocuments?: SdmDocumentItem[];
}

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
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gtkForm, setGtkForm] = useState({
    id: '',
    full_name: '',
    nip: '',
    nuptk: '',
    nik: '',
    gender: 'L',
    birth_place: '',
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    rt_rw: '',
    village: '',
    district: '',
    city: '',
    province: '',
    education_level: '',
    major: '',
  });

  const [guardianForms, setGuardianForms] = useState<
    Record<
      string,
      {
        full_name: string;
        relationship: string;
        nik: string;
        phone: string;
        email: string;
        occupation: string;
        address: string;
        rt_rw: string;
        village: string;
        district: string;
        city: string;
        province: string;
      }
    >
  >({});

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
        const t = gtk.teacher;
        setGtkForm({
          id: String(t.id || ''),
          full_name: String(t.full_name || ''),
          nip: String(t.nip || ''),
          nuptk: String(t.nuptk || ''),
          nik: String(t.nik || ''),
          gender: t.gender === 'P' ? 'P' : 'L',
          birth_place: String(t.birth_place || ''),
          birth_date: String(t.birth_date || ''),
          phone: String(t.phone || ''),
          email: String(t.email || ''),
          address: String(t.address || ''),
          rt_rw: String(t.rt_rw || ''),
          village: String(t.village || ''),
          district: String(t.district || ''),
          city: String(t.city || ''),
          province: String(t.province || ''),
          education_level: String(t.education_level || ''),
          major: String(t.major || ''),
        });
      }

      const gList: GuardianSelfPayload[] = data.guardians || [];
      setGuardians(gList);
      const nextForms: typeof guardianForms = {};
      for (const g of gList) {
        nextForms[g.id] = {
          full_name: g.full_name || '',
          relationship: g.relationship || 'WALI',
          nik: g.nik || '',
          phone: g.phone || '',
          email: g.email || '',
          occupation: g.occupation || '',
          address: g.address || '',
          rt_rw: g.rt_rw || '',
          village: g.village || '',
          district: g.district || '',
          city: g.city || '',
          province: g.province || '',
        };
      }
      setGuardianForms(nextForms);
    } catch {
      const msg = 'Tidak dapat terhubung ke server untuk memuat data.';
      setLoadError(msg);
      showToast('err', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSelfData();
  }, [loadSelfData]);

  async function handleSaveGtk(e: React.FormEvent) {
    e.preventDefault();
    if (gtkForm.nik && gtkForm.nik.length !== NIK_MAX) {
      showToast('err', `NIK harus terdiri dari tepat ${NIK_MAX} digit angka (atau kosongkan).`);
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

  async function handleSaveGuardian(e: React.FormEvent, guardianId: string) {
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
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
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

      {roleScope === 'gtk' && gtkData && section === 'biodata' && (() => {
        const gtkNikInvalid = gtkForm.nik.length > 0 && gtkForm.nik.length !== NIK_MAX;
        return (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Biodata Pribadi &amp; Kepegawaian GTK</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Lengkapi atau perbarui data pribadi dan kepegawaian Anda.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
              {String(gtkData.teacher.staff_type || 'GTK')} •{' '}
              {String(gtkData.teacher.employment_status || '-')}
            </span>
          </div>

          <form onSubmit={handleSaveGtk} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="min-w-0">
                <label
                  htmlFor="gtk-full-name"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Nama Lengkap{' '}
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                </label>
                <input
                  id="gtk-full-name"
                  disabled
                  value={gtkForm.full_name}
                  title="Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-nip"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  NIP <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
                </label>
                <input
                  id="gtk-nip"
                  value={gtkForm.nip}
                  disabled
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  placeholder="-"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-nuptk"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  NUPTK <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
                </label>
                <input
                  id="gtk-nuptk"
                  value={gtkForm.nuptk}
                  disabled
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                  placeholder="-"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor="gtk-nik" className="block text-[11px] font-semibold text-slate-600">
                    NIK
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      gtkNikInvalid
                        ? 'text-rose-600 font-semibold'
                        : gtkForm.nik.length === NIK_MAX
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-400'
                    }`}
                  >
                    {gtkForm.nik.length}/{NIK_MAX} digit
                  </span>
                </div>
                <input
                  id="gtk-nik"
                  inputMode="numeric"
                  value={gtkForm.nik}
                  maxLength={NIK_MAX}
                  onChange={(e) => {
                    const cleanNik = digitsOnly(e.target.value, NIK_MAX);
                    setGtkForm((prev) => ({ ...prev, nik: cleanNik }));
                  }}
                  placeholder="16 digit angka"
                  aria-invalid={gtkNikInvalid}
                  className={`w-full min-h-[40px] rounded-xl border px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 ${
                    gtkNikInvalid
                      ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-600'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-gender"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Jenis Kelamin
                </label>
                <select
                  id="gtk-gender"
                  value={gtkForm.gender}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, gender: val }));
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-birth-place"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tempat Lahir
                </label>
                <input
                  id="gtk-birth-place"
                  value={gtkForm.birth_place}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, birth_place: val }));
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-birth-date"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tanggal Lahir
                </label>
                <input
                  id="gtk-birth-date"
                  type="date"
                  value={gtkForm.birth_date}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, birth_date: val }));
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-education-level"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Pendidikan Terakhir
                </label>
                <input
                  id="gtk-education-level"
                  value={gtkForm.education_level}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, education_level: val }));
                  }}
                  placeholder="cth: S1 / S2"
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-major"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Jurusan / Program Studi
                </label>
                <input
                  id="gtk-major"
                  value={gtkForm.major}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGtkForm((prev) => ({ ...prev, major: val }));
                  }}
                  placeholder="cth: Pendidikan Matematika"
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-phone"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  No. HP / WhatsApp{' '}
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                </label>
                <input
                  id="gtk-phone"
                  value={gtkForm.phone}
                  disabled
                  title="No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="gtk-email"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Email{' '}
                  <Link
                    href="/portal/akun/profil"
                    className="text-[10px] text-emerald-700 hover:underline font-normal"
                  >
                    (Ubah di Halaman Profil)
                  </Link>
                </label>
                <input
                  id="gtk-email"
                  type="email"
                  value={gtkForm.email}
                  disabled
                  title="Email hanya dapat diubah melalui Halaman Profil"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 min-w-0">
                <StructuredAddressFields
                  title="Alamat Domisili GTK"
                  value={{
                    province: gtkForm.province,
                    city: gtkForm.city,
                    district: gtkForm.district,
                    village: gtkForm.village,
                    rt_rw: gtkForm.rt_rw,
                    address: gtkForm.address,
                  }}
                  onChange={(addr) =>
                    setGtkForm((prev) => ({
                      ...prev,
                      province: addr.province,
                      city: addr.city,
                      district: addr.district,
                      village: addr.village,
                      rt_rw: addr.rt_rw,
                      address: addr.address,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingGtk || gtkNikInvalid}
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition shadow-xs"
              >
                {savingGtk ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan Biodata GTK
              </button>
            </div>
          </form>

          {(gtkData.additionalDuties.length > 0 || gtkData.employmentHistories.length > 0) && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Tugas Tambahan (
                  {gtkData.additionalDuties.length})
                </p>
                <div className="space-y-1.5">
                  {gtkData.additionalDuties.map((d) => {
                    const dt = d.duty_type as { name?: string } | null;
                    return (
                      <div
                        key={String(d.id)}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0"
                      >
                        <p className="font-semibold text-slate-900 break-words">
                          {dt?.name || '-'}
                        </p>
                        <p className="text-[11px] text-slate-500 break-words">
                          SK: {String(d.decree_number || '-')} • Mulai: {String(d.start_date || '-')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-700 mb-2">
                  Riwayat Jabatan ({gtkData.employmentHistories.length})
                </p>
                <div className="space-y-1.5">
                  {gtkData.employmentHistories.map((h) => (
                    <div
                      key={String(h.id)}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0"
                    >
                      <p className="font-semibold text-slate-900 break-words">
                        {String(h.position_title || '-')}
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {String(h.unit_or_institution || '-')} • SK:{' '}
                        {String(h.decree_number || '-')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {roleScope === 'gtk' && gtkData && section === 'dokumen' && (
        <SdmDocumentSection
          entityType="GTK"
          entityId={String(gtkData.teacher.id)}
          documentOptions={GTK_DOC_OPTIONS}
          documents={gtkData.documents}
          onRefresh={loadSelfData}
          allowSelfManage={true}
        />
      )}

      {roleScope === 'orang-tua' &&
        guardians.length > 0 &&
        section === 'biodata' &&
        guardians.map((g) => {
          const gForm = guardianForms[g.id];
          if (!gForm) return null;
          const nikInvalid = gForm.nik.length > 0 && gForm.nik.length !== NIK_MAX;
          return (
            <div
              key={g.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Biodata Orang Tua / Wali</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 break-words">
                    Siswa Terkait:{' '}
                    <strong className="text-slate-800">{g.student?.full_name || '-'}</strong>{' '}
                    {g.student?.nis ? `(NIS: ${g.student.nis})` : ''}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                  {g.relationship || 'WALI'} {g.is_primary ? '• Wali Utama' : ''}
                </span>
              </div>

              <form onSubmit={(e) => handleSaveGuardian(e, g.id)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="min-w-0">
                    <label
                      htmlFor={`guardian-name-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Nama Lengkap{' '}
                      <Link
                        href="/portal/akun/profil"
                        className="text-[10px] text-emerald-700 hover:underline font-normal"
                      >
                        (Ubah di Halaman Profil)
                      </Link>
                    </label>
                    <input
                      id={`guardian-name-${g.id}`}
                      disabled
                      value={gForm.full_name}
                      title="Nama lengkap hanya dapat diubah melalui Halaman Profil dengan persetujuan Admin"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor={`guardian-rel-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Hubungan <span className="text-[10px] text-slate-400">(Dikelola Admin/TU)</span>
                    </label>
                    <select
                      id={`guardian-rel-${g.id}`}
                      value={gForm.relationship}
                      disabled
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                    >
                      <option value="AYAH">AYAH</option>
                      <option value="IBU">IBU</option>
                      <option value="WALI">WALI</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label
                        htmlFor={`guardian-nik-${g.id}`}
                        className="block text-[11px] font-semibold text-slate-600"
                      >
                        NIK
                      </label>
                      <span
                        className={`text-[10px] font-mono ${
                          nikInvalid
                            ? 'text-rose-600 font-semibold'
                            : gForm.nik.length === NIK_MAX
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-400'
                        }`}
                      >
                        {gForm.nik.length}/{NIK_MAX} digit
                      </span>
                    </div>
                    <input
                      id={`guardian-nik-${g.id}`}
                      inputMode="numeric"
                      value={gForm.nik}
                      maxLength={NIK_MAX}
                      onChange={(e) => {
                        const cleanNik = digitsOnly(e.target.value, NIK_MAX);
                        setGuardianForms((prev) => ({
                          ...prev,
                          [g.id]: {
                            ...(prev[g.id] || gForm),
                            nik: cleanNik,
                          },
                        }));
                      }}
                      placeholder="16 digit angka"
                      aria-invalid={nikInvalid}
                      className={`w-full min-h-[40px] rounded-xl border px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 ${
                        nikInvalid
                          ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500'
                          : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor={`guardian-job-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Pekerjaan
                    </label>
                    <input
                      id={`guardian-job-${g.id}`}
                      value={gForm.occupation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGuardianForms((prev) => ({
                          ...prev,
                          [g.id]: { ...(prev[g.id] || gForm), occupation: val },
                        }));
                      }}
                      placeholder="cth: Wiraswasta / Guru / PNS"
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor={`guardian-phone-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      No. HP / WhatsApp{' '}
                      <Link
                        href="/portal/akun/profil"
                        className="text-[10px] text-emerald-700 hover:underline font-normal"
                      >
                        (Ubah di Halaman Profil)
                      </Link>
                    </label>
                    <input
                      id={`guardian-phone-${g.id}`}
                      value={gForm.phone}
                      disabled
                      title="No. HP / WhatsApp hanya dapat diubah melalui Halaman Profil"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor={`guardian-email-${g.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Email{' '}
                      <Link
                        href="/portal/akun/profil"
                        className="text-[10px] text-emerald-700 hover:underline font-normal"
                      >
                        (Ubah di Halaman Profil)
                      </Link>
                    </label>
                    <input
                      id={`guardian-email-${g.id}`}
                      type="email"
                      value={gForm.email}
                      disabled
                      title="Email hanya dapat diubah melalui Halaman Profil"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed px-3 py-2 text-sm sm:text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 min-w-0">
                    <StructuredAddressFields
                      title="Alamat Domisili Orang Tua / Wali"
                      value={{
                        province: gForm.province,
                        city: gForm.city,
                        district: gForm.district,
                        village: gForm.village,
                        rt_rw: gForm.rt_rw,
                        address: gForm.address,
                      }}
                      onChange={(addr) =>
                        setGuardianForms((prev) => ({
                          ...prev,
                          [g.id]: {
                            ...(prev[g.id] || gForm),
                            province: addr.province,
                            city: addr.city,
                            district: addr.district,
                            village: addr.village,
                            rt_rw: addr.rt_rw,
                            address: addr.address,
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={savingGuardianId === g.id || nikInvalid}
                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition shadow-xs"
                  >
                    {savingGuardianId === g.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Simpan Biodata Orang Tua/Wali
                  </button>
                </div>
              </form>
            </div>
          );
        })}

      {roleScope === 'orang-tua' &&
        guardians.length > 0 &&
        section === 'dokumen' &&
        guardians.map((g) => (
          <div key={g.id} className="space-y-2.5">
            {guardians.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  Wali dari {g.student?.full_name || '-'} ({g.relationship || 'WALI'})
                </span>
              </div>
            )}
            <SdmDocumentSection
              entityType="ORANG_TUA"
              entityId={g.id}
              documentOptions={ORANG_TUA_DOC_OPTIONS}
              documents={g.documents}
              onRefresh={loadSelfData}
              allowSelfManage={true}
            />
            {g.sharedStudentDocuments && g.sharedStudentDocuments.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 min-w-0">
                <p className="text-xs font-bold text-slate-800 break-words">
                  Dokumen Keluarga Tersinkron dari Data Siswa ({g.student?.full_name || '-'})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {g.sharedStudentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 text-xs min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 break-words">
                          {doc.document_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[11px] text-slate-500 break-all">{doc.file_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.verification_status === 'TERVERIFIKASI'
                              ? 'bg-emerald-100 text-emerald-700'
                              : doc.verification_status === 'DITOLAK'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {doc.verification_status || 'MENUNGGU'}
                        </span>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                        >
                          Lihat
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
