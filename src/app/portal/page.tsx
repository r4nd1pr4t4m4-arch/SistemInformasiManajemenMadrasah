'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { AppRole } from '@/types/database';
import { mapDutyCodeToRole } from '@/lib/auth/rbac';
import { useApiQuery } from '@/lib/hooks/use-api-query';
import type { DashboardPayload } from '@/components/portal/dashboard/types';
import { DashboardSkeleton } from '@/components/portal/dashboard/dashboard-skeleton';
import {
  DashboardHeroSection,
  DashboardTeachingSection,
} from '@/components/portal/dashboard/hero-and-teaching-sections';
import {
  DashboardExecutiveSection,
  DashboardFinanceSection,
  DashboardServicesAndPersonalSection,
} from '@/components/portal/dashboard/executive-finance-services-sections';
import { DashboardExecutiveChartsAndEws } from '@/components/portal/dashboard/executive-charts-and-ews';

export default function PortalDashboardPage() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const dashboardUrl = selectedChildId
    ? `/api/portal/dashboard?studentId=${encodeURIComponent(selectedChildId)}`
    : '/api/portal/dashboard';

  const {
    data,
    loading,
    validating: refreshing,
    error: errorMsg,
    refetch: loadDashboard,
  } = useApiQuery<DashboardPayload>(dashboardUrl, {
    staleTimeMs: 30_000,
    revalidateOnFocus: true,
  });

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (errorMsg && !data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center space-y-3 border border-rose-200">
          <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Gagal Memuat Dashboard Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadDashboard(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const user = data.user;
  const effectiveRoles: AppRole[] = user?.effectiveRoles || user?.roles || [];
  const hasRole = (roles: AppRole[]) => effectiveRoles.some((r) => roles.includes(r));

  const teacher = data.teacherProfile;
  const additionalDuties = teacher?.additionalDuties || [];
  const exec = data.executiveSummary;
  const teaching = data.teachingSummary;
  const finance = data.financeSummary;
  const baseRoles: AppRole[] = user?.roles || [];
  const isPrivilegedFinanceBaseRole = baseRoles.some((r) =>
    ['SUPERADMIN', 'OPERATOR', 'KEPALA_LEMBAGA', 'BENDAHARA', 'KEPALA_TU'].includes(r)
  );
  const isGuruOnlyDashboard = baseRoles.includes('GURU') && !isPrivilegedFinanceBaseRole;
  const hasBendaharaKomiteDuty = additionalDuties.some(
    (d) =>
      mapDutyCodeToRole(d.code) === 'BENDAHARA_KOMITE' ||
      mapDutyCodeToRole(d.name) === 'BENDAHARA_KOMITE'
  );
  const hasPengelolaTabunganDuty = additionalDuties.some(
    (d) =>
      mapDutyCodeToRole(d.code) === 'PENGELOLA_TABUNGAN' ||
      mapDutyCodeToRole(d.name) === 'PENGELOLA_TABUNGAN'
  );

  const showSppCard = Boolean(finance?.spp) && (!isGuruOnlyDashboard || hasBendaharaKomiteDuty);
  const showTabunganCard =
    Boolean(finance?.tabungan) && (!isGuruOnlyDashboard || hasPengelolaTabunganDuty);
  const showHonorariumCard = Boolean(finance?.honorarium) && !isGuruOnlyDashboard;
  const showFinanceSection = showSppCard || showTabunganCard || showHonorariumCard;
  const visibleFinanceCardsCount =
    Number(showSppCard) + Number(showTabunganCard) + Number(showHonorariumCard);
  const bk = data.bkSummary;
  const guruWali = data.guruWaliSummary;
  const library = data.librarySummary;
  const studentPersonal = data.studentProfile;
  const alumni = data.alumniSummary;

  const parsedToday = data.todayDate ? new Date(`${data.todayDate}T00:00:00`) : null;
  const todayFormatted =
    parsedToday && !Number.isNaN(parsedToday.getTime())
      ? parsedToday.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            className="px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100/60 transition"
          >
            Muat Ulang
          </button>
        </div>
      )}

      <DashboardHeroSection
        data={data}
        todayFormatted={todayFormatted}
        refreshing={refreshing}
        onRefresh={() => void loadDashboard(true)}
      />

      {teaching && teacher && (
        <DashboardTeachingSection
          todayDayOfWeek={data.todayDayOfWeek}
          teaching={teaching}
          additionalDuties={additionalDuties}
        />
      )}

      {exec && <DashboardExecutiveSection exec={exec} hasRole={hasRole} />}

      {(exec || showFinanceSection || data.ewsSummary) && (
        <DashboardExecutiveChartsAndEws
          exec={exec}
          finance={showFinanceSection ? finance : null}
          ews={data.ewsSummary || null}
        />
      )}

      {showFinanceSection && finance && (
        <DashboardFinanceSection
          finance={finance}
          showSppCard={showSppCard}
          showTabunganCard={showTabunganCard}
          showHonorariumCard={showHonorariumCard}
          visibleFinanceCardsCount={visibleFinanceCardsCount}
          isGuruOnlyDashboard={isGuruOnlyDashboard}
          hasBendaharaKomiteDuty={hasBendaharaKomiteDuty}
          hasPengelolaTabunganDuty={hasPengelolaTabunganDuty}
        />
      )}

      <DashboardServicesAndPersonalSection
        bk={bk}
        guruWali={guruWali}
        studentPersonal={studentPersonal}
        linkedChildren={data.linkedChildren || []}
        selectedChildId={selectedChildId || studentPersonal?.student.id || ''}
        onSelectChild={(id) => setSelectedChildId(id)}
        library={library}
        libraryMember={data.libraryMember}
        alumni={alumni}
      />

      {!teaching &&
        !exec &&
        !showFinanceSection &&
        !bk &&
        !guruWali &&
        !studentPersonal &&
        !library &&
        !alumni && (
          <div className="glass-card rounded-3xl p-6 sm:p-8 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">Selamat Datang di Portal Terpadu</h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Belum ada modul operasional yang terhubung ke akun Anda. Gunakan menu navigasi atau
              buka halaman profil akun untuk memeriksa data Anda.
            </p>
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/portal/akun/profil"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                Profil Akun Saya
              </Link>
              <Link
                href="/e-library"
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 text-xs font-semibold transition"
              >
                Jelajahi E-Library
              </Link>
            </div>
          </div>
        )}
    </div>
  );
}
