'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface TeacherOpt {
  id: string;
  full_name: string;
}

export default function PresensiPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);

  const [teacherAttForm, setTeacherAttForm] = useState({
    teacher_id: '',
    attendance_type: 'MENGAJAR' as 'HARIAN' | 'MENGAJAR' | 'PIKET',
    jtm_earned: 2,
    latitude: -6.2,
    longitude: 106.816666,
  });

  const [delegationForm, setDelegationForm] = useState({
    delegation_date: '',
    delegation_type: 'MENGAJAR' as 'MENGAJAR' | 'PIKET',
    original_teacher_id: '',
    substitute_teacher_id: '',
    jtm_transferred: 2,
    reason: '',
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    setDelegationForm((prev) =>
      prev.delegation_date ? prev : { ...prev, delegation_date: new Date().toISOString().slice(0, 10) }
    );
    fetch('/api/akademik/buku-induk')
      .then((res) => res.json())
      .then((data) => setTeachers(data.teachers || []))
      .finally(() => setLoading(false));
  }, []);

  async function postPresensi(body: unknown) {
    const res = await fetch('/api/akademik/presensi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Terjadi kesalahan.');
      return null;
    }
    return data;
  }

  function captureBrowserGps() {
    if (!navigator.geolocation) {
      showToast('Browser tidak mendukung geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTeacherAttForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        showToast('Koordinat GPS berhasil diambil.');
      },
      () => showToast('Izin lokasi GPS ditolak atau tidak tersedia.')
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data presensi &amp; delegasi...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-slate-900">
              Presensi Guru (GPS Geofencing)
            </h1>
            <button
              type="button"
              onClick={captureBrowserGps}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Ambil GPS Perangkat
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({ action: 'TEACHER_ATTENDANCE', ...teacherAttForm });
              if (res?.geofence) {
                showToast(
                  res.geofence.isWithinGeofence
                    ? `Presensi VALID (jarak ${res.geofence.distanceMeters}m dari sekolah).`
                    : `Di luar radius geofence (${res.geofence.distanceMeters}m > ${res.geofence.radiusMeters}m), JTM = 0.`
                );
              }
            }}
            className="space-y-3"
          >
            <select
              required
              value={teacherAttForm.teacher_id}
              onChange={(e) =>
                setTeacherAttForm({ ...teacherAttForm, teacher_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Guru --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={teacherAttForm.attendance_type}
                onChange={(e) =>
                  setTeacherAttForm({
                    ...teacherAttForm,
                    attendance_type: e.target.value as 'HARIAN' | 'MENGAJAR' | 'PIKET',
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="MENGAJAR">Mengajar</option>
                <option value="PIKET">Guru Piket</option>
                <option value="HARIAN">Harian</option>
              </select>
              <input
                type="number"
                min={0}
                value={teacherAttForm.jtm_earned}
                onChange={(e) =>
                  setTeacherAttForm({ ...teacherAttForm, jtm_earned: Number(e.target.value) })
                }
                placeholder="JTM"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.000001"
                value={teacherAttForm.latitude}
                onChange={(e) =>
                  setTeacherAttForm({ ...teacherAttForm, latitude: Number(e.target.value) })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
              <input
                type="number"
                step="0.000001"
                value={teacherAttForm.longitude}
                onChange={(e) =>
                  setTeacherAttForm({ ...teacherAttForm, longitude: Number(e.target.value) })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs"
            >
              Catat Presensi GPS
            </button>
          </form>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Delegasi Guru Pengganti (Mengajar / Piket)
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await postPresensi({ action: 'CREATE_DELEGATION', ...delegationForm });
              if (res) showToast('Delegasi guru pengganti berhasil dicatat.');
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={delegationForm.delegation_date}
                onChange={(e) =>
                  setDelegationForm({ ...delegationForm, delegation_date: e.target.value })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <select
                value={delegationForm.delegation_type}
                onChange={(e) =>
                  setDelegationForm({
                    ...delegationForm,
                    delegation_type: e.target.value as 'MENGAJAR' | 'PIKET',
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="MENGAJAR">Pengganti Mengajar</option>
                <option value="PIKET">Pengganti Piket</option>
              </select>
            </div>
            <select
              required
              value={delegationForm.original_teacher_id}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, original_teacher_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Guru Berhalangan --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <select
              required
              value={delegationForm.substitute_teacher_id}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, substitute_teacher_id: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">-- Guru Pengganti --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={delegationForm.jtm_transferred}
                onChange={(e) =>
                  setDelegationForm({
                    ...delegationForm,
                    jtm_transferred: Number(e.target.value),
                  })
                }
                placeholder="JTM Dialihkan"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <input
                placeholder="Alasan (Sakit/Dinas)"
                value={delegationForm.reason}
                onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Simpan Delegasi Pengganti
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
