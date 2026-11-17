'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PlusCircle,
  UserCheck,
} from 'lucide-react';

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: 'RUTIN_MINGGUAN' | 'INSIDENTAL';
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  jtm_allocated: number;
  is_active: boolean;
}

interface TeacherOpt {
  id: string;
  full_name: string;
}

interface PicketAttOpt {
  id: string;
  teacher_id: string;
  attendance_date: string;
  teacher?: { full_name: string } | null;
}

interface ConfirmationRow {
  id: string;
  event_date: string;
  confirmed_by_role: 'ADMIN' | 'GURU_PIKET';
  event?: { title: string; jtm_allocated: number } | null;
  teacher?: { full_name: string } | null;
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function ManajemenAcaraPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [confirmedPickets, setConfirmedPickets] = useState<PicketAttOpt[]>([]);
  const [canManageEvents, setCanManageEvents] = useState(false);

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'RUTIN_MINGGUAN' as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
    day_of_week: 1,
    start_date: '',
    end_date: '',
    start_time: '07:00',
    end_time: '08:30',
    location: '',
    jtm_allocated: 2,
  });

  const [confirmForm, setConfirmForm] = useState({
    event_id: '',
    teacher_id: '',
    event_date: '',
    picket_attendance_id: '',
    notes: '',
  });

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/acara');
      const data = await res.json();
      setEvents(data.events || []);
      setTeachers(data.teachers || []);
      setConfirmations(data.confirmations || []);
      setConfirmedPickets(data.confirmedPicketAttendances || []);
      setCanManageEvents(Boolean(data.canManageEvents));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setEventForm((prev) => ({
      ...prev,
      start_date: prev.start_date || today,
      end_date: prev.end_date || today,
    }));
    setConfirmForm((prev) => ({
      ...prev,
      event_date: prev.event_date || today,
    }));
    loadData();
  }, [loadData]);

  async function postAcara(body: unknown, successMsg: string) {
    const res = await fetch('/api/akademik/acara', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Terjadi kesalahan.');
      return false;
    }
    showToast('success', successMsg);
    await loadData();
    return true;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat manajemen acara &amp; kegiatan...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-700" /> Manajemen Acara &amp; Kegiatan
          </h1>
          <p className="text-xs text-slate-600">
            Kelola acara rutin mingguan maupun insidental (1 hari / rentang beberapa hari) serta
            konfirmasi kehadiran guru oleh Admin atau Guru Piket hari itu.
          </p>
        </div>
        <Link
          href="/portal/akademik/jurnal-acara"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
        >
          <ClipboardList className="w-4 h-4" /> Input Jurnal Acara
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Form Buat Acara (Admin/Kurikulum/Kesiswaan/TU) */}
        <div className="lg:col-span-5 space-y-5">
          {canManageEvents && (
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-700" /> Tambah Acara / Kegiatan
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await postAcara(
                    { action: 'CREATE_EVENT', ...eventForm },
                    'Acara/kegiatan berhasil ditambahkan.'
                  );
                  if (ok) {
                    setEventForm((prev) => ({
                      ...prev,
                      title: '',
                      description: '',
                      location: '',
                    }));
                  }
                }}
                className="space-y-2.5"
              >
                <input
                  required
                  placeholder="Nama Acara (mis. Upacara Bendera / Rapat Kerja)"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={eventForm.event_type}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        event_type: e.target.value as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="RUTIN_MINGGUAN">Rutin Mingguan</option>
                    <option value="INSIDENTAL">Insidental (Tanggal/Rentang)</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={eventForm.jtm_allocated}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, jtm_allocated: Number(e.target.value) })
                    }
                    placeholder="Alokasi JTM"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>

                {eventForm.event_type === 'RUTIN_MINGGUAN' ? (
                  <select
                    value={eventForm.day_of_week}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, day_of_week: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {DAY_NAMES.slice(1).map((d, idx) => (
                      <option key={d} value={idx + 1}>
                        Setiap Hari {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500">Tanggal Mulai</label>
                      <input
                        type="date"
                        required
                        value={eventForm.start_date}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, start_date: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500">Tanggal Selesai</label>
                      <input
                        type="date"
                        required
                        value={eventForm.end_date}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, end_date: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    type="time"
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>

                <input
                  placeholder="Lokasi (mis. Lapangan Utama / Aula)"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />

                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat kegiatan (opsional)"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Simpan Acara / Kegiatan
                </button>
              </form>
            </div>
          )}

          {/* Konfirmasi Kehadiran Guru pada Acara (Admin atau Guru Piket hari itu) */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Konfirmasi Kehadiran Guru di Acara
            </h2>
            <p className="text-xs text-slate-600">
              Dapat dikonfirmasi oleh <strong>Admin</strong> atau{' '}
              <strong>Guru Piket hari itu</strong> (yang sudah dikonfirmasi kehadirannya). Setelah
              dikonfirmasi, guru dapat mengisi Jurnal Acara.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAcara(
                  {
                    action: 'CONFIRM_EVENT_ATTENDANCE',
                    ...confirmForm,
                    picket_attendance_id: confirmForm.picket_attendance_id || null,
                  },
                  'Kehadiran guru pada acara berhasil dikonfirmasi.'
                );
                if (ok) {
                  setConfirmForm((prev) => ({ ...prev, teacher_id: '', notes: '' }));
                }
              }}
              className="space-y-2.5"
            >
              <select
                required
                value={confirmForm.event_id}
                onChange={(e) => setConfirmForm({ ...confirmForm, event_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Acara / Kegiatan --</option>
                {events
                  .filter((ev) => ev.is_active)
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.event_type === 'RUTIN_MINGGUAN' ? `Rutin ${DAY_NAMES[ev.day_of_week || 1]}` : `${ev.start_date} s.d. ${ev.end_date}`} • {ev.jtm_allocated} JTM)
                    </option>
                  ))}
              </select>

              <select
                required
                value={confirmForm.teacher_id}
                onChange={(e) => setConfirmForm({ ...confirmForm, teacher_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">-- Pilih Guru yang Hadir --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                required
                value={confirmForm.event_date}
                onChange={(e) => setConfirmForm({ ...confirmForm, event_date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />

              <select
                value={confirmForm.picket_attendance_id}
                onChange={(e) =>
                  setConfirmForm({ ...confirmForm, picket_attendance_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">
                  {canManageEvents
                    ? '-- Konfirmasi sebagai Admin (atau pilih Guru Piket) --'
                    : '-- Pilih Presensi Guru Piket Hari Ini --'}
                </option>
                {confirmedPickets.map((p) => (
                  <option key={p.id} value={p.id}>
                    Guru Piket: {p.teacher?.full_name} ({p.attendance_date})
                  </option>
                ))}
              </select>

              <input
                placeholder="Catatan konfirmasi (opsional)"
                value={confirmForm.notes}
                onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
              >
                Konfirmasi Kehadiran Acara
              </button>
            </form>
          </div>
        </div>

        {/* Daftar Acara & Riwayat Konfirmasi */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Acara / Kegiatan ({events.length})
            </h2>
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada acara/kegiatan yang terdaftar.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{ev.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ev.event_type === 'RUTIN_MINGGUAN'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {ev.event_type === 'RUTIN_MINGGUAN'
                            ? `Rutin: Setiap ${DAY_NAMES[ev.day_of_week || 1]}`
                            : `Insidental: ${ev.start_date}${
                                ev.end_date && ev.end_date !== ev.start_date
                                  ? ` s.d. ${ev.end_date}`
                                  : ''
                              }`}
                        </span>
                      </div>
                      <p className="text-slate-500">
                        {ev.start_time ? `${ev.start_time.slice(0, 5)}–${(ev.end_time || '').slice(0, 5)}` : 'Waktu fleksibel'}
                        {ev.location ? ` • ${ev.location}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                        +{ev.jtm_allocated} JTM
                      </span>
                      {canManageEvents && (
                        <button
                          type="button"
                          onClick={() =>
                            postAcara(
                              {
                                action: 'TOGGLE_EVENT',
                                event_id: ev.id,
                                is_active: !ev.is_active,
                              },
                              `Acara ${!ev.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            ev.is_active
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {ev.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Riwayat Konfirmasi Kehadiran Acara ({confirmations.length})
            </h2>
            {confirmations.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada konfirmasi kehadiran guru pada acara.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {confirmations.map((c) => (
                  <div
                    key={c.id}
                    className="modular-card rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {c.teacher?.full_name} • {c.event?.title}
                      </p>
                      <p className="text-slate-500">
                        Tanggal: {c.event_date} • Dikonfirmasi oleh{' '}
                        {c.confirmed_by_role === 'GURU_PIKET' ? 'Guru Piket' : 'Admin'}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold shrink-0">
                      {c.event?.jtm_allocated ?? 0} JTM
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
