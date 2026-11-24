'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import {
  AkademikErrorBanner,
  AkademikLoading,
  AkademikToast,
  useAkademikToast,
} from './akademik-ui';
import type {
  ActiveAccountRow,
  BukuIndukSection,
  StudentRow,
  SubmitEntityFn,
  TeacherRow,
} from './buku-induk/types';
import { PenempatanAkunSection } from './buku-induk/penempatan-akun-section';
import { SiswaSection } from './buku-induk/siswa-section';
import { GtkSection } from './buku-induk/gtk-section';

export type { BukuIndukSection } from './buku-induk/types';

export function BukuIndukWorkspace({ section }: { section: BukuIndukSection }) {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BUKU_INDUK_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, dismissToast } = useAkademikToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<ActiveAccountRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/akademik/buku-induk', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data Buku Induk Digital.');
      }
      setLoadError(null);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setActiveAccounts(data.activeAccounts || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const submitEntity: SubmitEntityFn = useCallback(
    async (body, msg) => {
      if (submitting) return false;
      setSubmitting(true);
      try {
        const res = await fetch('/api/akademik/buku-induk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Terjadi kesalahan saat menyimpan data.');
          return false;
        }
        showToast('success', msg);
        await loadData();
        return true;
      } catch {
        showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, showToast, loadData]
  );

  if (loading) {
    return <AkademikLoading label="Memuat Buku Induk Digital..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AkademikToast toast={toast} onDismiss={dismissToast} />
      <AkademikErrorBanner error={loadError} onRetry={handleRefresh} />

      {section === 'penempatan-akun' && (
        <PenempatanAkunSection
          canManage={canManage}
          activeAccounts={activeAccounts}
          refreshing={refreshing}
          submitting={submitting}
          onRefresh={handleRefresh}
          submitEntity={submitEntity}
          showToast={showToast}
        />
      )}

      {section === 'siswa' && (
        <SiswaSection
          canManage={canManage}
          students={students}
          refreshing={refreshing}
          submitting={submitting}
          onRefresh={handleRefresh}
          submitEntity={submitEntity}
          showToast={showToast}
        />
      )}

      {section === 'gtk' && (
        <GtkSection
          canManage={canManage}
          teachers={teachers}
          refreshing={refreshing}
          submitting={submitting}
          onRefresh={handleRefresh}
          submitEntity={submitEntity}
          showToast={showToast}
        />
      )}
    </div>
  );
}
