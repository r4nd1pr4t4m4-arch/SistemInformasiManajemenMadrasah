'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { SavingsSlipModal } from '@/components/portal/keuangan/savings-slip-modal';
import type { SavingsSlipData } from '@/lib/cards/savings-slip-png';
import { SppSlipModal } from '@/components/portal/keuangan/spp-slip-modal';
import type { SppSlipData } from '@/lib/cards/spp-slip-png';
import { HonorariumSlipModal } from '@/components/portal/keuangan/honorarium-slip-modal';
import type { HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';
import {
  getCurrentMinutesOfDay,
  getTodayIsoDay,
  type PersonalPayload,
  type PersonalScope,
  type PersonalSection,
} from './sections/types';
import {
  JadwalPelajaranSection,
  JadwalPiketSection,
} from './sections/jadwal-and-piket-sections';
import {
  SppSection,
  TabunganSection,
} from './sections/tabungan-and-spp-sections';
import {
  AbsensiSection,
  HonorariumSection,
} from './sections/absensi-and-honorarium-sections';
import {
  BkSection,
  GuruWaliSection,
  UjianSection,
} from './sections/ujian-bk-guruwali-sections';

export type { PersonalScope, PersonalSection };

export function PersonalWorkspace({
  scope,
  section,
  title,
  subtitle,
}: {
  scope: PersonalScope;
  section: PersonalSection;
  title: string;
  subtitle: string;
}) {
  const [data, setData] = useState<PersonalPayload | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [todayDay, setTodayDay] = useState<number>(() => getTodayIsoDay());
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [activeSlip, setActiveSlip] = useState<SavingsSlipData | null>(null);
  const [activeSppSlip, setActiveSppSlip] = useState<SppSlipData | null>(null);
  const [activeHonorSlip, setActiveHonorSlip] = useState<HonorariumSlipData | null>(null);

  useEffect(() => {
    const syncTime = () => {
      setTodayDay(getTodayIsoDay());
      setNowMinutes(getCurrentMinutesOfDay());
    };
    syncTime();
    const timer = setInterval(syncTime, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ scope, section });
    if (selectedChildId) params.set('student_id', selectedChildId);

    fetch(`/api/portal/personal?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');
        return json as PersonalPayload;
      })
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [scope, section, selectedChildId, reloadTick]);

  const sectionResetKey = `${scope}-${section}-${selectedChildId || data?.student?.id || 'default'}`;

  const childrenList = Array.isArray(data?.children) ? data.children : [];

  return (
    <div className="space-y-6 min-w-0">
      {/* Header & Identity Banner */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight break-words">
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
          {!error && data?.student && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold max-w-full break-words">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">
                  {data.student.full_name}
                  {data.student.nis ? ` (NIS: ${data.student.nis})` : ''}
                </span>
              </span>
              {data.classroom && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold max-w-full break-words">
                  Kelas: {data.classroom.name}
                  {data.classroom.homeroom_teacher?.full_name
                    ? ` • Wali: ${data.classroom.homeroom_teacher.full_name}`
                    : ''}
                </span>
              )}
            </div>
          )}
          {!error && data?.teacher && scope === 'gtk' && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold max-w-full break-words">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">
                  {data.teacher.full_name}
                  {data.teacher.nip
                    ? ` (NIP: ${data.teacher.nip})`
                    : data.teacher.nuptk
                      ? ` (NUPTK: ${data.teacher.nuptk})`
                      : ''}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2.5 w-full md:w-auto shrink-0">
          {/* Child selector for Orang Tua */}
          {scope === 'orang-tua' && childrenList.length > 1 && (
            <div className="w-full sm:w-auto sm:min-w-[220px] min-w-0 flex-1 sm:flex-none">
              <label
                htmlFor="personal-child-select"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Pilih Putra / Putri:
              </label>
              <select
                id="personal-child-select"
                disabled={loading}
                value={selectedChildId || data?.student?.id || ''}
                onChange={(e) => {
                  setLoading(true);
                  setError(null);
                  setSelectedChildId(e.target.value);
                }}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
              >
                {childrenList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.full_name} {child.nis ? `(${child.nis})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadTick((t) => t + 1);
            }}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="glass-card rounded-3xl p-10 sm:p-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat data...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {section === 'jadwal-pelajaran' && (
            <JadwalPelajaranSection
              key={sectionResetKey}
              data={data}
              scope={scope}
              todayDay={todayDay}
              nowMinutes={nowMinutes}
            />
          )}

          {section === 'jadwal-piket' && (
            <JadwalPiketSection
              key={sectionResetKey}
              data={data}
              scope={scope}
              todayDay={todayDay}
            />
          )}

          {section === 'tabungan' && (
            <TabunganSection
              key={sectionResetKey}
              data={data}
              scope={scope}
              onSelectSlip={setActiveSlip}
            />
          )}

          {section === 'absensi' && (
            <AbsensiSection
              key={sectionResetKey}
              data={data}
              scope={scope}
            />
          )}

          {section === 'spp' && (
            <SppSection
              key={sectionResetKey}
              data={data}
              scope={scope}
              onSelectSppSlip={setActiveSppSlip}
            />
          )}

          {section === 'honorarium' && (
            <HonorariumSection
              key={sectionResetKey}
              data={data}
              onSelectHonorSlip={setActiveHonorSlip}
            />
          )}

          {section === 'ujian' && (
            <UjianSection
              key={sectionResetKey}
              data={data}
            />
          )}

          {section === 'bk' && (
            <BkSection
              key={sectionResetKey}
              data={data}
              scope={scope}
            />
          )}

          {section === 'guru-wali' && (
            <GuruWaliSection
              key={sectionResetKey}
              data={data}
              scope={scope}
            />
          )}
        </>
      )}

      {activeSlip && (
        <SavingsSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />
      )}
      {activeSppSlip && (
        <SppSlipModal slip={activeSppSlip} onClose={() => setActiveSppSlip(null)} />
      )}
      {activeHonorSlip && (
        <HonorariumSlipModal slip={activeHonorSlip} onClose={() => setActiveHonorSlip(null)} />
      )}
    </div>
  );
}
