'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  Coins,
  FileText,
  GraduationCap,
  HeartHandshake,
  MapPin,
  PiggyBank,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  DEFAULT_ADDITIONAL_DUTIES,
  DEFAULT_INSTITUTION_SETTINGS,
} from '@/lib/data/demo-seed';
import { verifyGeofence } from '@/lib/domain/geofence';
import {
  calculateTeacherHonorarium,
  formatRupiah,
} from '@/lib/domain/honorarium';
import type { AdditionalDutyType, InstitutionType } from '@/types/database';

type PortalTab =
  | 'overview'
  | 'pengaturan'
  | 'presensi'
  | 'honorarium'
  | 'keuangan'
  | 'perpustakaan'
  | 'bk_wali'
  | 'alumni';

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');

  // 1. State Pengaturan Fleksibel Madrasah / Sekolah
  const [institutionType, setInstitutionType] = useState<InstitutionType>(
    DEFAULT_INSTITUTION_SETTINGS.institution_type
  );
  const [institutionName, setInstitutionName] = useState(
    DEFAULT_INSTITUTION_SETTINGS.name
  );
  const [geofenceRadius, setGeofenceRadius] = useState(
    DEFAULT_INSTITUTION_SETTINGS.geofence_radius_meters
  );

  // 2. State Simulasi Presensi GPS Geofencing
  const [teacherLat, setTeacherLat] = useState(-6.2004);
  const [teacherLng, setTeacherLng] = useState(106.8169);

  const geofenceResult = useMemo(
    () =>
      verifyGeofence(
        { lat: teacherLat, lng: teacherLng },
        {
          lat: DEFAULT_INSTITUTION_SETTINGS.geofence_lat ?? -6.2,
          lng: DEFAULT_INSTITUTION_SETTINGS.geofence_lng ?? 106.816666,
        },
        geofenceRadius
      ),
    [teacherLat, teacherLng, geofenceRadius]
  );

  // 3. State Pengaturan & Kalkulasi Honorarium Guru
  const [ratePerJtm, setRatePerJtm] = useState(25000);
  const [duties, setDuties] = useState<AdditionalDutyType[]>(
    DEFAULT_ADDITIONAL_DUTIES
  );
  const [selectedDutyCodes, setSelectedDutyCodes] = useState<string[]>([
    'WALI_KELAS',
    'BENDAHARA_KOMITE',
  ]);
  const [teachingJtm, setTeachingJtm] = useState(24);
  const [substituteJtm, setSubstituteJtm] = useState(4);
  const [examSupervisorJtm, setExamSupervisorJtm] = useState(6);
  const [examCommitteeJtm, setExamCommitteeJtm] = useState(4);

  const honorariumResult = useMemo(() => {
    const selected = duties
      .filter((d) => selectedDutyCodes.includes(d.code))
      .map((d) => ({
        code: d.code,
        name: d.name,
        receivesAllowance: d.receives_allowance,
        monthlyAllowance: d.monthly_allowance,
      }));

    return calculateTeacherHonorarium(
      {
        teachingJtm,
        substituteJtm,
        examSupervisorJtm,
        examCommitteeJtm,
      },
      ratePerJtm,
      selected
    );
  }, [
    duties,
    selectedDutyCodes,
    teachingJtm,
    substituteJtm,
    examSupervisorJtm,
    examCommitteeJtm,
    ratePerJtm,
  ]);

  function toggleDutySelection(code: string) {
    setSelectedDutyCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function updateDutyAllowance(code: string, value: number) {
    setDuties((prev) =>
      prev.map((d) => (d.code === code ? { ...d, monthly_allowance: value } : d))
    );
  }

  const navItems: { id: PortalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Ringkasan 3 Pilar', icon: <Building2 className="w-4 h-4" /> },
    { id: 'pengaturan', label: 'Identitas & CMS', icon: <Settings className="w-4 h-4" /> },
    { id: 'presensi', label: 'Presensi GPS & Ujian', icon: <MapPin className="w-4 h-4" /> },
    { id: 'honorarium', label: 'Honorarium JTM', icon: <Calculator className="w-4 h-4" /> },
    { id: 'keuangan', label: 'SPP & Tabungan', icon: <PiggyBank className="w-4 h-4" /> },
    { id: 'perpustakaan', label: 'E-Library & Surat', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'bk_wali', label: 'BK & Guru Wali', icon: <HeartHandshake className="w-4 h-4" /> },
    { id: 'alumni', label: 'Tracer Study', icon: <GraduationCap className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            title="Kembali ke Website Resmi"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <p className="font-bold text-slate-900 text-sm md:text-base">
              Portal Terpadu — {institutionName}
            </p>
            <p className="text-xs text-slate-500">
              Mode Lembaga: <span className="font-semibold text-emerald-700">{institutionType}</span> •{' '}
              {institutionType === 'MADRASAH' ? 'OSIM & Kepala Madrasah' : 'OSIS & Kepala Sekolah'}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-800">
          Tahap 1: Arsitektur &amp; Fondasi Aktif
        </span>
      </header>

      <div className="max-w-7xl w-full mx-auto px-4 py-6 grid md:grid-cols-12 gap-6 flex-1">
        {/* Sidebar */}
        <aside className="md:col-span-3 space-y-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === item.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="md:col-span-9 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h1 className="text-xl font-bold text-slate-900">
                  Arsitektur &amp; Skema Database SIMMS Siap
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Seluruh 18+ modul dari 3 pilar utama telah dimodelkan di{' '}
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                    supabase/migrations/0001_initial_schema.sql
                  </code>
                  . Gunakan menu di sebelah kiri untuk mencoba simulasi fondasi yang sudah aktif.
                </p>

                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-800">Pilar 1: Website &amp; CMS</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">6 Modul Publik &amp; PPDB</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Profil, Berita, Galeri, Direktori GTK/Prestasi, PPDB Online (R2), Kontak &amp; FAQ
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                    <p className="text-xs font-semibold text-sky-800">Pilar 2: Portal Akademik</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Buku Induk, Jadwal &amp; Ujian</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Presensi GPS Geofencing, Delegasi Pengganti, Pengawas &amp; Panitia Ujian (JTM)
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-800">Pilar 3: Administrasi &amp; TU</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Keuangan, Surat &amp; Layanan</p>
                    <p className="text-xs text-slate-600 mt-1">
                      SPP/Komite, Tabungan Umum, Honorarium JTM, E-Library, BK, Guru Wali, Alumni
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pengaturan' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Pengaturan Identitas Lembaga (Fleksibel Madrasah / Sekolah)
                </h2>
                <p className="text-sm text-slate-600">
                  Mengubah tipe lembaga akan menyesuaikan istilah otomatis (OSIM/OSIS, Kepala Madrasah/Kepala Sekolah, NSM/NPSN).
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipe Satuan Pendidikan
                  </label>
                  <select
                    value={institutionType}
                    onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="MADRASAH">Madrasah (MI / MTs / MA)</option>
                    <option value="SEKOLAH">Sekolah Umum (SD / SMP / SMA / SMK)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lembaga
                  </label>
                  <input
                    type="text"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Radius Geofencing Presensi Guru (Meter)
                  </label>
                  <input
                    type="number"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value) || 50)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presensi' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Simulator Presensi Guru (GPS Geofencing) &amp; Delegasi / Ujian
                </h2>
                <p className="text-sm text-slate-600">
                  Validasi jarak Haversine terhadap koordinat lembaga (Titik pusat: -6.200000, 106.816666, radius {geofenceRadius}m).
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude Guru
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={teacherLat}
                    onChange={(e) => setTeacherLat(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude Guru
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={teacherLng}
                    onChange={(e) => setTeacherLng(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  geofenceResult.isWithinGeofence
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <p className="font-bold text-sm">
                  {geofenceResult.isWithinGeofence
                    ? '✓ Di Dalam Area Geofencing — Presensi Valid'
                    : '✕ Di Luar Area Geofencing — Presensi Ditolak'}
                </p>
                <p className="text-xs mt-1">
                  Jarak terukur: <strong>{geofenceResult.distanceMeters} meter</strong> (Batas maksimal:{' '}
                  {geofenceResult.radiusMeters} meter)
                </p>
              </div>
            </div>
          )}

          {activeTab === 'honorarium' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Kalkulator &amp; Pengaturan Honorarium Guru
                  </h2>
                  <p className="text-sm text-slate-600">
                    Tarif per JTM dan tunjangan bulanan tugas tambahan dapat diatur admin.{' '}
                    <strong>Bendahara Komite</strong> &amp; <strong>Pengelola Tabungan</strong> otomatis tidak mendapat tambahan tunjangan.
                  </p>
                </div>

                <div className="grid sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tarif / JTM (Rp)
                    </label>
                    <input
                      type="number"
                      value={ratePerJtm}
                      onChange={(e) => setRatePerJtm(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      JTM Mengajar
                    </label>
                    <input
                      type="number"
                      value={teachingJtm}
                      onChange={(e) => setTeachingJtm(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      JTM Pengganti
                    </label>
                    <input
                      type="number"
                      value={substituteJtm}
                      onChange={(e) => setSubstituteJtm(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      JTM Pengawas Ujian
                    </label>
                    <input
                      type="number"
                      value={examSupervisorJtm}
                      onChange={(e) => setExamSupervisorJtm(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      JTM Panitia Ujian
                    </label>
                    <input
                      type="number"
                      value={examCommitteeJtm}
                      onChange={(e) => setExamCommitteeJtm(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Ringkasan Hasil Hitung */}
                <div className="grid sm:grid-cols-3 gap-4 bg-slate-900 text-white p-5 rounded-xl">
                  <div>
                    <p className="text-xs text-slate-400">
                      Honor JTM ({honorariumResult.totalJtm} JTM × {formatRupiah(ratePerJtm)})
                    </p>
                    <p className="text-lg font-bold mt-1">
                      {formatRupiah(honorariumResult.jtmHonorariumAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tunjangan Tugas Tambahan</p>
                    <p className="text-lg font-bold text-emerald-400 mt-1">
                      {formatRupiah(honorariumResult.additionalDutyAllowance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Honorarium Diterima</p>
                    <p className="text-xl font-extrabold text-amber-400 mt-1">
                      {formatRupiah(honorariumResult.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Daftar Tugas Tambahan */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Centang Tugas Tambahan Guru &amp; Atur Nominal Bulanan (Rp)
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                    {duties.map((duty) => {
                      const checked = selectedDutyCodes.includes(duty.code);
                      return (
                        <div
                          key={duty.code}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                            checked ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200'
                          }`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDutySelection(duty.code)}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{duty.name}</p>
                              {!duty.receives_allowance && (
                                <span className="text-[10px] font-semibold text-rose-600">
                                  Tanpa tunjangan honorarium
                                </span>
                              )}
                            </div>
                          </label>
                          <input
                            type="number"
                            disabled={!duty.receives_allowance}
                            value={duty.monthly_allowance}
                            onChange={(e) =>
                              updateDutyAllowance(duty.code, Number(e.target.value) || 0)
                            }
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-xs font-mono text-right disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'keuangan' ||
            activeTab === 'perpustakaan' ||
            activeTab === 'bk_wali' ||
            activeTab === 'alumni') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                {activeTab === 'keuangan' && <Coins className="w-4 h-4" />}
                {activeTab === 'perpustakaan' && <FileText className="w-4 h-4" />}
                {activeTab === 'bk_wali' && <ShieldAlert className="w-4 h-4" />}
                {activeTab === 'alumni' && <Users className="w-4 h-4" />}
                <span>Modul Siap Dikembangkan di Tahap Berikutnya</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tabel database PostgreSQL dan tipe TypeScript untuk modul ini sudah tersedia di{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                  supabase/migrations/0001_initial_schema.sql
                </code>
                . Setelah Anda menghubungkan Supabase &amp; Cloudflare R2 di{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.env.local</code>, kita akan melanjutkan pembangunan CRUD penuh per modul secara bertahap.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
