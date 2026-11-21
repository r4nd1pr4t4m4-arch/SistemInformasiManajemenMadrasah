'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ClipboardList, Loader2, PlusCircle, UserCheck } from 'lucide-react';
import {
  AkademikEmptyState,
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';

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

interface CeremonyRow {
  id: string;
  ceremony_date: string;
  teacher_id: string;
  original_teacher_id: string | null;
  jtm_allocated: number;
  status: 'TERJADWAL' | 'TERLAKSANA' | 'DIBATALKAN';
  substitution_reason: string | null;
  substituted_by_role: string | null;
  teacher?: { full_name: string } | null;
  original_teacher?: { full_name: string } | null;
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type AcaraSection = 'kegiatan' | 'konfirmasi' | 'upacara';

export function AcaraWorkspace({ section }: { section: AcaraSection }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [ceremonies, setCeremonies] = useState<CeremonyRow[]>([]);
  const [confirmedPickets, setConfirmedPickets] = useState<PicketAttOpt[]>([]);
  const [canManageEvents, setCanManageEvents] = useState(false);

  const [ceremonyForm, setCeremonyForm] = useState(() => ({
    ceremony_date: new Date().toISOString().slice(0, 10),
    teacher_id: '',
    jtm_allocated: 2,
    notes: '',
  }));
  const [subCeremonyForm, setSubCeremonyForm] = useState({
    ceremony_id: '',
    substitute_teacher_id: '',
    picket_attendance_id: '',
    reason: '',
  });

  const [eventForm, setEventForm] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: '',
      description: '',
      event_type: 'RUTIN_MINGGUAN' as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
      day_of_week: 1,
      start_date: today,
      end_date: today,
      start_time: '07:00',
      end_time: '08:30',
      location: '',
      jtm_allocated: 2,
    };
  });

  const [confirmForm, setConfirmForm] = useState(() => ({
    event_id: '',
    teacher_id: '',
    event_date: new Date().toISOString().slice(0, 10),
    picket_attendance_id: '',
    notes: '',
  }));

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/acara', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat manajemen acara.');
      setLoadError(null);
      setEvents(data.events || []);
      setTeachers(data.teachers || []);
      setConfirmations(data.confirmations || []);
      setCeremonies(data.ceremonies || []);
      setConfirmedPickets(data.confirmedPicketAttendances || []);
      setCanManageEvents(Boolean(data.canManageEvents));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function postAcara(body: unknown, successMsg: string) {
    if (submitting) return false;
    setSubmitting(true);
    try {
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
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <AkademikLoading label="Memuat manajemen acara & kegiatan..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={loadData} />

      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Manajemen Acara &amp; Kegiatan</span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Kelola acara rutin mingguan maupun insidental (1 hari / rentang beberapa hari) serta
            konfirmasi kehadiran guru oleh Admin atau Guru Piket hari itu.
          </p>
        </div>
        <Link
          href="/portal/akademik/jurnal-acara"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
        >
          <ClipboardList className="w-4 h-4" /> Input Jurnal Acara
        </Link>
      </div>

      {section !== 'upacara' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {((section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0)) ||
            (section === 'kegiatan' && canManageEvents)) && (
            <div className="lg:col-span-5 space-y-5">
              {section === 'kegiatan' && canManageEvents && (
                <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Tambah Acara / Kegiatan</span>
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        eventForm.event_type === 'INSIDENTAL' &&
                        eventForm.start_date &&
                        eventForm.end_date &&
                        eventForm.end_date < eventForm.start_date
                      ) {
                        showToast('error', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
                        return;
                      }
                      const ok = await postAcara(
                        { action: 'CREATE_EVENT', ...eventForm, title: eventForm.title.trim() },
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={eventForm.event_type}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            event_type: e.target.value as 'RUTIN_MINGGUAN' | 'INSIDENTAL',
                          })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                          setEventForm({
                            ...eventForm,
                            jtm_allocated: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        placeholder="Alokasi JTM"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>

                    {eventForm.event_type === 'RUTIN_MINGGUAN' ? (
                      <select
                        value={eventForm.day_of_week}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, day_of_week: Number(e.target.value) })
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        {DAY_NAMES.slice(1).map((d, idx) => (
                          <option key={d} value={idx + 1}>
                            Setiap Hari {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Acara / Kegiatan
                    </button>
                  </form>
                </div>
              )}

              {section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0) && (
                <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Konfirmasi Kehadiran Guru di Acara</span>
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dapat dikonfirmasi oleh <strong>Admin</strong> atau{' '}
                    <strong>Guru Piket hari itu</strong> (yang sudah dikonfirmasi kehadirannya).
                    Setelah dikonfirmasi, guru dapat mengisi Jurnal Acara.
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Pilih Acara / Kegiatan --</option>
                      {events
                        .filter((ev) => ev.is_active)
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title} (
                            {ev.event_type === 'RUTIN_MINGGUAN'
                              ? `Rutin ${DAY_NAMES[ev.day_of_week || 1]}`
                              : `${ev.start_date} s.d. ${ev.end_date}`}{' '}
                            • {ev.jtm_allocated} JTM)
                          </option>
                        ))}
                    </select>

                    <select
                      required
                      value={confirmForm.teacher_id}
                      onChange={(e) => setConfirmForm({ ...confirmForm, teacher_id: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
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
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Konfirmasi Kehadiran Acara
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          <div
            className={`${
              (section === 'konfirmasi' && (canManageEvents || confirmedPickets.length > 0)) ||
              (section === 'kegiatan' && canManageEvents)
                ? 'lg:col-span-7'
                : 'lg:col-span-12'
            } space-y-5`}
          >
            {section === 'kegiatan' && (
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Acara / Kegiatan ({events.length})
                </h2>
                {events.length === 0 ? (
                  <AkademikEmptyState
                    icon={<CalendarDays className="w-6 h-6" />}
                    message="Belum ada acara/kegiatan yang terdaftar."
                  />
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 break-words">{ev.title}</span>
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
                            {ev.start_time
                              ? `${ev.start_time.slice(0, 5)}–${(ev.end_time || '').slice(0, 5)}`
                              : 'Waktu fleksibel'}
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
                              disabled={submitting}
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
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 transition ${
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
            )}

            {section === 'konfirmasi' && (
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Riwayat Konfirmasi Kehadiran Acara ({confirmations.length})
                </h2>
                {confirmations.length === 0 ? (
                  <AkademikEmptyState
                    icon={<UserCheck className="w-6 h-6" />}
                    message="Belum ada konfirmasi kehadiran guru pada acara."
                  />
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {confirmations.map((c) => (
                      <div
                        key={c.id}
                        className="modular-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 break-words">
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
            )}
          </div>
        </div>
      )}

      {/* Upacara Bendera Hari Senin (Pembina & Pengganti) */}
      {section === 'upacara' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Upacara Bendera Hari Senin — Pembina Upacara &amp; Pengganti ({ceremonies.length})
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guru yang bertugas sebagai <strong>Pembina Upacara Bendera Hari Senin</strong> (atau{' '}
              <strong>Pembina Pengganti</strong> yang ditunjuk Admin / Guru Piket terkonfirmasi Admin)
              mendapatkan JTM setelah pelaksanaan upacara dikonfirmasi.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {(canManageEvents || confirmedPickets.length > 0) && (
              <div className="lg:col-span-5 space-y-4">
                {canManageEvents && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await postAcara(
                        { action: 'CREATE_CEREMONY', ...ceremonyForm },
                        'Jadwal Pembina Upacara Hari Senin berhasil disimpan.'
                      );
                      if (ok) {
                        setCeremonyForm((prev) => ({
                          ...prev,
                          teacher_id: '',
                          jtm_allocated: 2,
                          notes: '',
                        }));
                      }
                    }}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      Jadwalkan Pembina Upacara (Hari Senin)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="date"
                        required
                        value={ceremonyForm.ceremony_date}
                        onChange={(e) =>
                          setCeremonyForm({ ...ceremonyForm, ceremony_date: e.target.value })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={ceremonyForm.jtm_allocated}
                        onChange={(e) =>
                          setCeremonyForm({
                            ...ceremonyForm,
                            jtm_allocated: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        placeholder="JTM"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <select
                      required
                      value={ceremonyForm.teacher_id}
                      onChange={(e) =>
                        setCeremonyForm({ ...ceremonyForm, teacher_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">-- Pilih Guru Pembina Upacara --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Catatan (opsional)"
                      value={ceremonyForm.notes}
                      onChange={(e) => setCeremonyForm({ ...ceremonyForm, notes: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Jadwal Pembina Upacara
                    </button>
                  </form>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await postAcara(
                      {
                        action: 'SUBSTITUTE_CEREMONY_LEADER',
                        ...subCeremonyForm,
                        picket_attendance_id: subCeremonyForm.picket_attendance_id || null,
                      },
                      'Pembina Upacara Pengganti berhasil ditunjuk.'
                    );
                    if (ok) {
                      setSubCeremonyForm({
                        ceremony_id: '',
                        substitute_teacher_id: '',
                        picket_attendance_id: '',
                        reason: '',
                      });
                    }
                  }}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                >
                  <p className="text-xs font-bold text-slate-800">
                    Tunjuk Pembina Upacara Pengganti (Admin / Guru Piket Terkonfirmasi)
                  </p>
                  <select
                    required
                    value={subCeremonyForm.ceremony_id}
                    onChange={(e) =>
                      setSubCeremonyForm({ ...subCeremonyForm, ceremony_id: e.target.value })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Jadwal Upacara Senin (Terjadwal) --</option>
                    {ceremonies
                      .filter((c) => c.status === 'TERJADWAL')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.ceremony_date} • Pembina: {c.teacher?.full_name} ({c.jtm_allocated} JTM)
                        </option>
                      ))}
                  </select>
                  <select
                    required
                    value={subCeremonyForm.substitute_teacher_id}
                    onChange={(e) =>
                      setSubCeremonyForm({
                        ...subCeremonyForm,
                        substitute_teacher_id: e.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih Guru Pembina Pengganti --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subCeremonyForm.picket_attendance_id}
                    onChange={(e) =>
                      setSubCeremonyForm({
                        ...subCeremonyForm,
                        picket_attendance_id: e.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">
                      {canManageEvents
                        ? '-- Sebagai Admin (atau pilih Guru Piket Terkonfirmasi) --'
                        : '-- Pilih Presensi Guru Piket / Pengganti Terkonfirmasi Admin --'}
                    </option>
                    {confirmedPickets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.attendance_date} • {p.teacher?.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Alasan penggantian (Sakit/Izin/Dinas)"
                    value={subCeremonyForm.reason}
                    onChange={(e) =>
                      setSubCeremonyForm({ ...subCeremonyForm, reason: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Tunjuk Pembina Pengganti
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${
                canManageEvents || confirmedPickets.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
              } space-y-2 max-h-96 overflow-y-auto pr-1`}
            >
              {ceremonies.length === 0 ? (
                <AkademikEmptyState
                  icon={<CalendarDays className="w-6 h-6" />}
                  message="Belum ada jadwal Pembina Upacara Bendera Hari Senin."
                />
              ) : (
                ceremonies.map((c) => {
                  const matchingPicket = confirmedPickets.find(
                    (p) => p.attendance_date === c.ceremony_date
                  );
                  return (
                    <div
                      key={c.id}
                      className="modular-card rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-bold text-slate-900 break-words">
                          Senin, {c.ceremony_date} • {c.teacher?.full_name}
                          {c.original_teacher?.full_name && (
                            <span className="font-normal text-slate-500">
                              {' '}
                              (menggantikan {c.original_teacher.full_name})
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500 break-words">
                          Status:{' '}
                          <strong
                            className={
                              c.status === 'TERLAKSANA' ? 'text-emerald-700' : 'text-amber-700'
                            }
                          >
                            {c.status}
                          </strong>
                          {c.substitution_reason ? ` • Alasan: ${c.substitution_reason}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold ${
                            c.status === 'TERLAKSANA'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {c.status === 'TERLAKSANA'
                            ? `+${c.jtm_allocated} JTM`
                            : `0/${c.jtm_allocated} JTM`}
                        </span>
                        {c.status === 'TERJADWAL' && (canManageEvents || matchingPicket) && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              postAcara(
                                {
                                  action: 'CONFIRM_CEREMONY',
                                  ceremony_id: c.id,
                                  picket_attendance_id: !canManageEvents
                                    ? matchingPicket?.id || null
                                    : null,
                                },
                                `Upacara ${c.ceremony_date} dikonfirmasi terlaksana (+${c.jtm_allocated} JTM).`
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold transition"
                          >
                            Konfirmasi Terlaksana
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
