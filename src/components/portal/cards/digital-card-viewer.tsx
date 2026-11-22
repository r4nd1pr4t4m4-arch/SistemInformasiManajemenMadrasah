'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildVerificationUrl } from '@/lib/verification/document-verify';
import { InstitutionLogo } from '@/components/ui/institution-logo';
import {
  BookOpen,
  Download,
  FlipHorizontal,
  GraduationCap,
  Layers,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  type CardInstitutionInfo,
  type LibraryCardData,
  type StudentCardData,
  combineFrontBackCanvases,
  downloadCanvasAsPng,
  renderLibraryCardBackCanvas,
  renderLibraryCardFrontCanvas,
  renderStudentCardBackCanvas,
  renderStudentCardFrontCanvas,
} from '@/lib/cards/card-png-renderer';

const DEFAULT_INSTITUTION: CardInstitutionInfo = {
  name: 'Madrasah / Sekolah Terpadu',
  short_name: 'SIMMS',
  institution_type: 'MADRASAH',
  address: 'Alamat Lembaga Pendidikan',
  head_title_label: 'Kepala Madrasah / Sekolah',
  headmaster_name: 'Pimpinan Lembaga',
};

let cachedInstitutionPromise: Promise<CardInstitutionInfo> | null = null;

function fetchInstitutionInfo(): Promise<CardInstitutionInfo> {
  if (!cachedInstitutionPromise) {
    cachedInstitutionPromise = fetch('/api/cms/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.settings) {
          return json.settings as CardInstitutionInfo;
        }
        cachedInstitutionPromise = null;
        return DEFAULT_INSTITUTION;
      })
      .catch(() => {
        cachedInstitutionPromise = null;
        return DEFAULT_INSTITUTION;
      });
  }
  return cachedInstitutionPromise;
}

function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'ID'
  );
}

function sanitizeFileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function DigitalStudentCard({
  student,
  institution: institutionProp,
}: {
  student: StudentCardData;
  institution?: CardInstitutionInfo | null;
}) {
  const [fetchedInstitution, setFetchedInstitution] =
    useState<CardInstitutionInfo>(DEFAULT_INSTITUTION);
  const institution = institutionProp || fetchedInstitution;
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState<'front' | 'back' | 'both' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const hasProfilePhoto = Boolean(student.photo_url?.trim());

  useEffect(() => {
    if (institutionProp) return;
    let active = true;
    fetchInstitutionInfo().then((info) => {
      if (active) setFetchedInstitution(info);
    });
    return () => {
      active = false;
    };
  }, [institutionProp]);

  useEffect(() => {
    const payload = buildVerificationUrl({
      ref: student.qr_token || student.nisn || student.nis || student.id,
      type: 'KARTU_SISWA',
    });
    QRCode.toDataURL(payload, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [student.id, student.nis, student.nisn, student.qr_token]);

  async function handleDownload(side: 'front' | 'back' | 'both') {
    if (!hasProfilePhoto) {
      setDownloadError(
        'Unduhan ditolak: Pengguna belum memiliki foto profil yang disetujui Admin. Silakan unggah foto profil di halaman Profil Akun dan tunggu persetujuan Admin terlebih dahulu.'
      );
      return;
    }
    setDownloadError(null);
    setDownloading(side);
    try {
      const slug = sanitizeFileSlug(student.full_name || 'siswa');
      if (side === 'front') {
        const canvas = await renderStudentCardFrontCanvas(student, institution);
        downloadCanvasAsPng(canvas, `kartu-pelajar-${slug}-depan.png`);
      } else if (side === 'back') {
        const canvas = await renderStudentCardBackCanvas(student, institution);
        downloadCanvasAsPng(canvas, `kartu-pelajar-${slug}-belakang.png`);
      } else {
        const [front, back] = await Promise.all([
          renderStudentCardFrontCanvas(student, institution),
          renderStudentCardBackCanvas(student, institution),
        ]);
        const combined = combineFrontBackCanvases(front, back);
        downloadCanvasAsPng(combined, `kartu-pelajar-${slug}-lengkap.png`);
      }
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Gagal membuat file PNG kartu pelajar.'
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar View & Download */}
      {(!hasProfilePhoto || downloadError) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          {downloadError ||
            'Foto profil yang disetujui Admin wajib tersedia sebelum Kartu Pelajar dapat diunduh.'}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'both'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Depan &amp; Belakang
          </button>
          <button
            type="button"
            onClick={() => setViewMode('front')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'front'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Depan
          </button>
          <button
            type="button"
            onClick={() => setViewMode('back')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'back'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Belakang
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('front')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'front' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            PNG Depan
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('back')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'back' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FlipHorizontal className="w-3.5 h-3.5" />
            )}
            PNG Belakang
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('both')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'both' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5" />
            )}
            PNG Lengkap
          </button>
        </div>
      </div>

      {/* Card Preview(s) */}
      <div className="space-y-3">
        {(viewMode === 'both' || viewMode === 'front') && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sisi Depan Kartu Pelajar
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-md">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 text-white px-4 py-3 flex items-center justify-between gap-2 border-b-[3px] border-amber-400">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/95 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                    <InstitutionLogo
                      logoUrl={institution.logo_url}
                      alt="Logo"
                      className="w-7 h-7 object-contain"
                      fallback={<GraduationCap className="w-5 h-5" />}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-tight truncate uppercase">
                      {institution.name}
                    </p>
                    <p className="text-[10px] text-emerald-100 truncate">
                      {[
                        institution.nsm ? `NSM: ${institution.nsm}` : '',
                        institution.npsn ? `NPSN: ${institution.npsn}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/15 border border-white/30 text-[9px] font-bold tracking-wider uppercase">
                  Kartu Pelajar
                </span>
              </div>

              {/* Body */}
              <div className="p-3.5 sm:p-4 flex flex-wrap sm:flex-nowrap gap-3 sm:gap-3.5 items-start">
                <div className="shrink-0 space-y-1.5">
                  <div className="w-16 h-20 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-lg flex items-center justify-center overflow-hidden border border-slate-300 shadow-inner">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(student.full_name)
                    )}
                  </div>
                  <span className="block text-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                    {student.status || 'AKTIF'}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                      Identitas Peserta Didik
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {student.full_name}
                    </p>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-slate-700">
                    <p>
                      <span className="text-slate-400">NIS / NISN:</span>{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {student.nis || '-'} / {student.nisn || '-'}
                      </span>
                    </p>
                    <p className="truncate">
                      <span className="text-slate-400">TTL:</span>{' '}
                      {student.birth_place || '-'}
                      {student.birth_date ? `, ${formatDateId(student.birth_date)}` : ''}
                    </p>
                    <p>
                      <span className="text-slate-400">Gender:</span>{' '}
                      {student.gender === 'L'
                        ? 'Laki-laki'
                        : student.gender === 'P'
                        ? 'Perempuan'
                        : '-'}
                    </p>
                    <p className="line-clamp-1">
                      <span className="text-slate-400">Alamat:</span> {student.address || '-'}
                    </p>
                  </div>
                </div>

                {qrDataUrl && (
                  <div className="shrink-0 bg-white p-1.5 rounded-xl border border-slate-200 text-center">
                    <img src={qrDataUrl} alt="QR Verifikasi" className="w-16 h-16" />
                    <p className="text-[8px] font-bold text-slate-500 mt-0.5">VERIFIKASI</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-emerald-950 text-emerald-200 px-4 py-1.5 flex items-center justify-between text-[9px] font-mono">
                <span>Token: {student.qr_token || student.id.slice(0, 12).toUpperCase()}</span>
                <span>Kartu Pelajar Digital Resmi</span>
              </div>
            </div>
          </div>
        )}

        {(viewMode === 'both' || viewMode === 'back') && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sisi Belakang Kartu Pelajar
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md">
              <div className="bg-emerald-950 text-white px-4 py-2.5 flex items-center justify-between border-b-[3px] border-amber-400">
                <span className="text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  KETENTUAN &amp; VALIDASI KARTU PELAJAR
                </span>
                <span className="text-[10px] text-emerald-200 font-semibold">
                  {institution.short_name || 'SIMMS'}
                </span>
              </div>

              <div className="p-4 space-y-3 text-[11px] text-slate-700">
                <ol className="space-y-1 list-decimal list-inside text-[10.5px] leading-relaxed text-slate-700">
                  <li>Kartu ini adalah identitas resmi peserta didik pada Buku Induk lembaga.</li>
                  <li>Wajib dibawa saat kegiatan belajar mengajar, ujian, dan layanan akademik.</li>
                  <li>Berlaku selama berstatus siswa aktif dan tidak dapat dipindahtangankan.</li>
                  <li>Jika ditemukan/hilang, harap melapor ke Tata Usaha lembaga.</li>
                </ol>

                <div className="grid grid-cols-12 gap-2 pt-1 items-center">
                  <div className="col-span-7 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[10px] space-y-0.5">
                    <p className="font-bold text-emerald-800">Masa Berlaku &amp; Kontak</p>
                    <p className="line-clamp-1 text-slate-600">
                      {institution.address || 'Alamat Lembaga Pendidikan'}
                    </p>
                    <p className="text-slate-600">
                      Telp: {institution.phone || '-'} • {institution.email || '-'}
                    </p>
                    <p className="font-semibold text-slate-900">
                      Berlaku selama berstatus Siswa Aktif
                    </p>
                  </div>
                  <div className="col-span-5 text-center text-[10px] space-y-1">
                    <p className="text-slate-500">{institution.head_title_label || 'Kepala Lembaga'}</p>
                    {qrDataUrl && (
                      <img src={qrDataUrl} alt="QR" className="w-10 h-10 mx-auto opacity-90" />
                    )}
                    <p className="font-bold text-slate-900 truncate">
                      {institution.headmaster_name || 'Pimpinan Lembaga'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950 text-emerald-200 px-4 py-1.5 flex items-center justify-between text-[9px]">
                <span>NIS/NISN: {student.nis || '-'} / {student.nisn || '-'}</span>
                <span>{institution.website_url || institution.email || 'SIMMS Digital ID'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DigitalLibraryCard({
  member,
  institution: institutionProp,
}: {
  member: LibraryCardData;
  institution?: CardInstitutionInfo | null;
}) {
  const [fetchedInstitution, setFetchedInstitution] =
    useState<CardInstitutionInfo>(DEFAULT_INSTITUTION);
  const institution = institutionProp || fetchedInstitution;
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState<'front' | 'back' | 'both' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const hasProfilePhoto = Boolean(member.avatar_url?.trim() || member.photo_url?.trim());
  const requiresProfilePhoto = member.member_type !== 'UMUM';
  const canDownloadCard = !requiresProfilePhoto || hasProfilePhoto;

  useEffect(() => {
    if (institutionProp) return;
    let active = true;
    fetchInstitutionInfo().then((info) => {
      if (active) setFetchedInstitution(info);
    });
    return () => {
      active = false;
    };
  }, [institutionProp]);

  useEffect(() => {
    const payload = buildVerificationUrl({
      ref: member.member_code,
      type: 'KARTU_PERPUSTAKAAN',
    });
    QRCode.toDataURL(payload, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [member.id, member.member_code]);

  async function handleDownload(side: 'front' | 'back' | 'both') {
    if (!canDownloadCard) {
      setDownloadError(
        'Unduhan ditolak: Pengguna belum memiliki foto profil yang disetujui Admin. Silakan unggah foto profil di halaman Profil Akun dan tunggu persetujuan Admin terlebih dahulu.'
      );
      return;
    }
    setDownloadError(null);
    setDownloading(side);
    try {
      const slug = sanitizeFileSlug(member.full_name || member.member_code || 'anggota');
      if (side === 'front') {
        const canvas = await renderLibraryCardFrontCanvas(member, institution);
        downloadCanvasAsPng(canvas, `kartu-perpustakaan-${slug}-depan.png`);
      } else if (side === 'back') {
        const canvas = await renderLibraryCardBackCanvas(member, institution);
        downloadCanvasAsPng(canvas, `kartu-perpustakaan-${slug}-belakang.png`);
      } else {
        const [front, back] = await Promise.all([
          renderLibraryCardFrontCanvas(member, institution),
          renderLibraryCardBackCanvas(member, institution),
        ]);
        const combined = combineFrontBackCanvases(front, back);
        downloadCanvasAsPng(combined, `kartu-perpustakaan-${slug}-lengkap.png`);
      }
    } catch {
      setDownloadError('Gagal membuat gambar kartu perpustakaan. Silakan coba lagi.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar View & Download */}
      {(!canDownloadCard || downloadError) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          {downloadError ||
            'Foto profil yang disetujui Admin wajib tersedia sebelum Kartu Anggota Perpustakaan dapat diunduh.'}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'both'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Depan &amp; Belakang
          </button>
          <button
            type="button"
            onClick={() => setViewMode('front')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'front'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Depan
          </button>
          <button
            type="button"
            onClick={() => setViewMode('back')}
            className={`px-2.5 py-1 rounded-lg transition ${
              viewMode === 'back'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Belakang
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('front')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'front' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            PNG Depan
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('back')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'back' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FlipHorizontal className="w-3.5 h-3.5" />
            )}
            PNG Belakang
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => handleDownload('both')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition disabled:opacity-50"
          >
            {downloading === 'both' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5" />
            )}
            PNG Lengkap
          </button>
        </div>
      </div>

      {/* Card Preview(s) */}
      <div className="space-y-3">
        {(viewMode === 'both' || viewMode === 'front') && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sisi Depan Kartu Perpustakaan
            </p>
            <div className="rounded-2xl overflow-hidden border border-sky-200 bg-slate-50 shadow-md">
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-sky-700 text-white px-4 py-3 flex items-center justify-between gap-2 border-b-[3px] border-sky-400">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/95 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                    <InstitutionLogo
                      logoUrl={institution.logo_url}
                      alt="Logo"
                      className="w-7 h-7 object-contain"
                      fallback={<BookOpen className="w-5 h-5" />}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-tight truncate uppercase">
                      Kartu Anggota Perpustakaan
                    </p>
                    <p className="text-[10px] text-sky-100 truncate">
                      E-Library • {institution.name}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-sky-400/20 border border-sky-200/40 text-[9px] font-bold tracking-wider uppercase">
                  {member.member_type}
                </span>
              </div>

              <div className="p-4 flex gap-3.5 items-start">
                <div className="shrink-0 space-y-1.5">
                  <div className="w-16 h-18 rounded-xl bg-gradient-to-br from-blue-900 to-sky-600 text-white font-bold text-lg flex items-center justify-center shadow-inner">
                    {getInitials(member.full_name)}
                  </div>
                  <span className="block text-center px-1.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 font-mono text-[9px] font-bold">
                    {member.member_code}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-sky-700">
                      Identitas Anggota E-Library
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {member.full_name}
                    </p>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-slate-700">
                    <p>
                      <span className="text-slate-400">Kategori:</span>{' '}
                      {member.member_type === 'SISWA'
                        ? 'Peserta Didik'
                        : member.member_type === 'GTK'
                        ? 'Guru & Tenaga Kependidikan'
                        : 'Masyarakat Umum'}
                    </p>
                    <p className="truncate">
                      <span className="text-slate-400">HP / WA:</span> {member.phone || '-'}
                    </p>
                    <p className="truncate">
                      <span className="text-slate-400">Email:</span> {member.email || '-'}
                    </p>
                    <p>
                      <span className="text-slate-400">Terdaftar:</span>{' '}
                      {formatDateId(member.joined_at)}
                    </p>
                  </div>
                </div>

                {qrDataUrl && (
                  <div className="shrink-0 bg-white p-1.5 rounded-xl border border-sky-200 text-center">
                    <img src={qrDataUrl} alt="QR Anggota" className="w-16 h-16" />
                    <p className="text-[8px] font-bold text-sky-700 mt-0.5">PINJAM</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 text-sky-200 px-4 py-1.5 flex items-center justify-between text-[9px]">
                <span>Status: {member.status || 'AKTIF'}</span>
                <span>Perpustakaan Digital Terpadu</span>
              </div>
            </div>
          </div>
        )}

        {(viewMode === 'both' || viewMode === 'back') && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sisi Belakang Kartu Perpustakaan
            </p>
            <div className="rounded-2xl overflow-hidden border border-sky-200 bg-white shadow-md">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b-[3px] border-sky-400">
                <span className="text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  HAK AKSES &amp; TATA TERTIB E-LIBRARY
                </span>
                <span className="text-[10px] text-sky-200 font-semibold">
                  {institution.short_name || 'E-Library'}
                </span>
              </div>

              <div className="p-4 space-y-3 text-[11px] text-slate-700">
                <ol className="space-y-1 list-decimal list-inside text-[10.5px] leading-relaxed text-slate-700">
                  <li>Memberikan hak akses peminjaman buku fisik dan koleksi E-Book resmi.</li>
                  <li>Wajib menjaga keutuhan buku dan mengembalikan tepat waktu sesuai jatuh tempo.</li>
                  <li>Kartu bersifat pribadi dan tidak dapat dipinjamkan kepada pihak lain.</li>
                  <li>Hubungi Pustakawan jika kartu hilang atau terjadi perubahan data anggota.</li>
                </ol>

                <div className="grid grid-cols-12 gap-2 pt-1 items-center">
                  <div className="col-span-7 rounded-xl bg-sky-50 border border-sky-200 p-2.5 text-[10px] space-y-0.5">
                    <p className="font-bold text-sky-800">Layanan &amp; Kontak Perpustakaan</p>
                    <p className="line-clamp-1 text-slate-600">
                      {institution.address || 'Alamat Perpustakaan Lembaga'}
                    </p>
                    <p className="text-slate-600">
                      Telp: {institution.phone || '-'} • {institution.email || '-'}
                    </p>
                    <p className="font-mono font-bold text-slate-900">
                      Kode: {member.member_code}
                    </p>
                  </div>
                  <div className="col-span-5 text-center text-[10px] space-y-1">
                    <p className="text-slate-500">Pengelola Perpustakaan</p>
                    {qrDataUrl && (
                      <img src={qrDataUrl} alt="QR" className="w-10 h-10 mx-auto opacity-90" />
                    )}
                    <p className="font-bold text-slate-900 truncate">
                      {institution.short_name || institution.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-sky-200 px-4 py-1.5 flex items-center justify-between text-[9px]">
                <span>Anggota: {member.full_name}</span>
                <span>{institution.website_url || institution.email || 'E-Library Card'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
