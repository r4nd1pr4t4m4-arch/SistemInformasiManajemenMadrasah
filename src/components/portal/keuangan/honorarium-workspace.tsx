'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { AdditionalDutyType } from '@/types/database';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { HonorariumSlipModal } from './honorarium-slip-modal';
import type { HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';
import type {
  AcademicYearOption,
  DailyHourRow,
  HonorariumRow,
  HonorariumSection,
  RateSnapshot,
  TeacherDutyAssignment,
  TeacherOption,
  ToastState,
} from './honorarium/types';
import { JarakGuruSection, TarifJamSection } from './honorarium/tarif-and-jarak-sections';
import { TugasTambahanSection } from './honorarium/tugas-tambahan-section';
import { RekapSection } from './honorarium/rekap-section';

export type { HonorariumSection } from './honorarium/types';

export function HonorariumWorkspace({ section }: { section: HonorariumSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.HONORARIUM_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [activeHonorSlip, setActiveHonorSlip] = useState<HonorariumSlipData | null>(null);
  const [ratePerJtm, setRatePerJtm] = useState(25000);
  const [transportRatePerKm, setTransportRatePerKm] = useState(2000);
  const [schoolStartTime, setSchoolStartTime] = useState('07:30');
  const [schoolEndTime, setSchoolEndTime] = useState('12:30');
  const [savedRateSnapshot, setSavedRateSnapshot] = useState<RateSnapshot>({
    ratePerJtm: 25000,
    transportRatePerKm: 2000,
    schoolStartTime: '07:30',
    schoolEndTime: '12:30',
  });

  const [dailyHours, setDailyHours] = useState<DailyHourRow[]>([]);
  const [savedDailyHours, setSavedDailyHours] = useState<DailyHourRow[]>([]);
  const [dutyTypes, setDutyTypes] = useState<AdditionalDutyType[]>([]);
  const [teacherDuties, setTeacherDuties] = useState<TeacherDutyAssignment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [dutyAllowanceDrafts, setDutyAllowanceDrafts] = useState<Record<string, string>>({});
  const [honorariums, setHonorariums] = useState<HonorariumRow[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const fetchHonorariumData = useCallback(async () => {
    const needTeachers = section !== 'tarif-jam';
    const [honRes, biRes] = await Promise.all([
      fetch('/api/keuangan/honorarium', { cache: 'no-store' }),
      needTeachers ? fetch('/api/akademik/buku-induk', { cache: 'no-store' }) : Promise.resolve(null),
    ]);

    const hon = await honRes.json().catch(() => null);
    if (!honRes.ok || !hon) {
      throw new Error(hon?.error || 'Gagal memuat data honorarium dari server.');
    }

    let nextTeachers: TeacherOption[] = [];
    if (biRes) {
      const bi = await biRes.json().catch(() => null);
      if (!biRes.ok || !bi) {
        throw new Error(bi?.error || 'Gagal memuat daftar guru dari server.');
      }
      nextTeachers = bi.teachers || [];
    }

    const nextRate: RateSnapshot = {
      ratePerJtm: Number(hon.ratePerJtm ?? 25000),
      transportRatePerKm: Number(hon.transportRatePerKm ?? 2000),
      schoolStartTime: String(hon.schoolStartTime || '07:30').slice(0, 5),
      schoolEndTime: String(hon.schoolEndTime || '12:30').slice(0, 5),
    };
    const nextDailyHours: DailyHourRow[] = Array.isArray(hon.dailyHours) ? hon.dailyHours : [];

    return {
      nextTeachers,
      nextRate,
      nextDailyHours,
      dutyTypes: (hon.dutyTypes || []) as AdditionalDutyType[],
      teacherDuties: (hon.teacherDuties || []) as TeacherDutyAssignment[],
      academicYears: (hon.academicYears || []) as AcademicYearOption[],
      honorariums: (hon.honorariums || []) as HonorariumRow[],
    };
  }, [section]);

  const applyFetchedData = useCallback(
    (payload: Awaited<ReturnType<typeof fetchHonorariumData>>) => {
      if (section !== 'tarif-jam') {
        setTeachers(payload.nextTeachers);
      }
      setRatePerJtm(payload.nextRate.ratePerJtm);
      setTransportRatePerKm(payload.nextRate.transportRatePerKm);
      setSchoolStartTime(payload.nextRate.schoolStartTime);
      setSchoolEndTime(payload.nextRate.schoolEndTime);
      setSavedRateSnapshot(payload.nextRate);

      setDailyHours(payload.nextDailyHours);
      setSavedDailyHours(payload.nextDailyHours.map((d) => ({ ...d })));
      setDutyTypes(payload.dutyTypes);
      setTeacherDuties(payload.teacherDuties);
      setAcademicYears(payload.academicYears);
      const nextDrafts: Record<string, string> = {};
      for (const dt of payload.dutyTypes) {
        nextDrafts[dt.id] = String(Number(dt.monthly_allowance ?? 0));
      }
      setDutyAllowanceDrafts(nextDrafts);
      setHonorariums(payload.honorariums);
      setLoadError(null);
    },
    [section]
  );

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchHonorariumData();
        applyFetchedData(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data honorarium.';
        if (mode === 'initial') {
          setLoadError(message);
        } else {
          showToast(message, 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyFetchedData, fetchHonorariumData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchHonorariumData();
        if (!cancelled) {
          applyFetchedData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data honorarium.'
          );
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
  }, [applyFetchedData, fetchHonorariumData]);

  async function callHonorApi(
    method: 'POST' | 'PATCH' | 'DELETE',
    body: { action?: string; [key: string]: unknown },
    msg: string
  ) {
    const actionKey = body.action || method;
    if (submittingAction) return false;
    setSubmittingAction(actionKey);
    try {
      const res = await fetch('/api/keuangan/honorarium', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Terjadi kesalahan saat menyimpan data.', 'error');
        return false;
      }
      showToast(msg, 'success');
      await loadData('refresh');
      return true;
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
      return false;
    } finally {
      setSubmittingAction(null);
    }
  }

  const handleRefresh = useCallback(() => {
    void loadData('refresh');
  }, [loadData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat data honorarium guru...</span>
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
          <h1 className="text-base font-bold text-slate-900">
            Gagal Memuat Pengaturan Honorarium
          </h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
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
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 shadow-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}

      {section === 'tarif-jam' && (
        <TarifJamSection
          canManage={canManage}
          ratePerJtm={ratePerJtm}
          setRatePerJtm={setRatePerJtm}
          transportRatePerKm={transportRatePerKm}
          setTransportRatePerKm={setTransportRatePerKm}
          schoolStartTime={schoolStartTime}
          setSchoolStartTime={setSchoolStartTime}
          schoolEndTime={schoolEndTime}
          setSchoolEndTime={setSchoolEndTime}
          savedRateSnapshot={savedRateSnapshot}
          dailyHours={dailyHours}
          setDailyHours={setDailyHours}
          savedDailyHours={savedDailyHours}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={handleRefresh}
          callHonorApi={callHonorApi}
          showToast={showToast}
        />
      )}

      {section === 'jarak-guru' && (
        <JarakGuruSection
          canManage={canManage}
          teachers={teachers}
          transportRatePerKm={transportRatePerKm}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={handleRefresh}
          callHonorApi={callHonorApi}
          showToast={showToast}
        />
      )}

      {section === 'tugas-tambahan' && (
        <TugasTambahanSection
          canManage={canManage}
          teachers={teachers}
          dutyTypes={dutyTypes}
          teacherDuties={teacherDuties}
          academicYears={academicYears}
          dutyAllowanceDrafts={dutyAllowanceDrafts}
          setDutyAllowanceDrafts={setDutyAllowanceDrafts}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={handleRefresh}
          callHonorApi={callHonorApi}
          showToast={showToast}
        />
      )}

      {section === 'rekap' && (
        <RekapSection
          canManage={canManage}
          teachers={teachers}
          honorariums={honorariums}
          ratePerJtm={ratePerJtm}
          refreshing={refreshing}
          submittingAction={submittingAction}
          onRefresh={handleRefresh}
          onOpenSlip={setActiveHonorSlip}
          callHonorApi={callHonorApi}
          showToast={showToast}
        />
      )}

      {activeHonorSlip && (
        <HonorariumSlipModal slip={activeHonorSlip} onClose={() => setActiveHonorSlip(null)} />
      )}
    </div>
  );
}
