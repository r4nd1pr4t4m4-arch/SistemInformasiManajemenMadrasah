'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/domain/honorarium';
import type { AdditionalDutyType } from '@/types/database';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { HonorariumSlipModal } from './honorarium-slip-modal';
import type { HonorariumDutyItem, HonorariumSlipData } from '@/lib/cards/honorarium-slip-png';

interface TeacherOption {
  id: string;
  full_name: string;
  home_distance_km?: number;
}

interface HonorariumRow {
  id: string;
  period_month: number;
  period_year: number;
  teaching_jtm?: number;
  substitute_jtm?: number;
  exam_supervisor_jtm?: number;
  exam_committee_jtm?: number;
  event_jtm?: number;
  picket_jtm?: number;
  ceremony_jtm?: number;
  paid_holiday_jtm?: number;
  total_jtm: number;
  rate_per_jtm?: number;
  jtm_honorarium_amount: number;
  additional_duty_allowance: number;
  transport_allowance?: number;
  total_amount: number;
  status: string;
  teacher?: { full_name: string; nip?: string | null; home_distance_km?: number | null } | null;
  items?: HonorariumDutyItem[];
}

interface DailyHourRow {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

interface RateSnapshot {
  ratePerJtm: number;
  transportRatePerKm: number;
  schoolStartTime: string;
  schoolEndTime: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
  semester: 'GANJIL' | 'GENAP' | string;
  is_active: boolean;
}

interface TeacherDutyAssignment {
  id: string;
  teacher_id: string;
  duty_type_id: string;
  academic_year_id?: string | null;
  decree_number?: string | null;
  is_active?: boolean;
  teacher?: { full_name: string } | null;
  duty_type?: {
    code: string;
    name: string;
    receives_allowance: boolean;
    monthly_allowance: number;
  } | null;
  academic_year?: AcademicYearOption | null;
}

const DAY_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

function parseTimeMinutes(timeStr: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatDurationLabel(startTime: string, endTime: string): string {
  const start = parseTimeMinutes(startTime);
  const end = parseTimeMinutes(endTime);
  if (start === null || end === null) return 'Format jam tidak valid';
  const diff = end - start;
  if (diff <= 0) return 'Jam pulang harus > masuk';
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours} jam ${mins} mnt` : `${hours} jam`;
}

export type HonorariumSection = 'tarif-jam' | 'jarak-guru' | 'tugas-tambahan' | 'rekap';

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
  const [distanceForm, setDistanceForm] = useState({ teacher_id: '', home_distance_km: '0' });
  const [distanceSearch, setDistanceSearch] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'configured' | 'zero'>('all');
  const [dutyTypes, setDutyTypes] = useState<AdditionalDutyType[]>([]);
  const [teacherDuties, setTeacherDuties] = useState<TeacherDutyAssignment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [dutyAllowanceDrafts, setDutyAllowanceDrafts] = useState<Record<string, string>>({});
  const [dutyTypeSearch, setDutyTypeSearch] = useState('');
  const [teacherDutySearch, setTeacherDutySearch] = useState('');
  const [dutyToDelete, setDutyToDelete] = useState<TeacherDutyAssignment | null>(null);
  const [selectedDutyIds, setSelectedDutyIds] = useState<string[]>([]);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [honorariums, setHonorariums] = useState<HonorariumRow[]>([]);

  const [assignDutyForm, setAssignDutyForm] = useState({
    teacher_id: '',
    duty_type_id: '',
    academic_year_id: '',
    decree_number: '',
  });
  const [genForm, setGenForm] = useState(() => {
    const now = new Date();
    return {
      teacher_id: '',
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
    };
  });
  const [rekapSearch, setRekapSearch] = useState('');
  const [rekapStatusFilter, setRekapStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'PAID'>(
    'ALL'
  );

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
      const defaultAcademicYearId =
        payload.academicYears.find((ay) => ay.is_active)?.id ||
        payload.academicYears[0]?.id ||
        '';
      if (defaultAcademicYearId) {
        setAssignDutyForm((prev) =>
          prev.academic_year_id ? prev : { ...prev, academic_year_id: defaultAcademicYearId }
        );
      }
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

  const rateValidationError = useMemo(() => {
    if (!Number.isFinite(ratePerJtm) || ratePerJtm < 0) {
      return 'Tarif per JTM tidak boleh bernilai negatif.';
    }
    if (!Number.isFinite(transportRatePerKm) || transportRatePerKm < 0) {
      return 'Tarif transport per KM tidak boleh bernilai negatif.';
    }
    const startMin = parseTimeMinutes(schoolStartTime);
    const endMin = parseTimeMinutes(schoolEndTime);
    if (startMin === null || endMin === null) {
      return 'Jam masuk dan jam pulang sekolah wajib diisi dengan format HH:MM.';
    }
    if (endMin <= startMin) {
      return 'Jam pulang sekolah harus lebih besar daripada jam masuk sekolah.';
    }
    return null;
  }, [ratePerJtm, schoolEndTime, schoolStartTime, transportRatePerKm]);

  const invalidDailyDays = useMemo(() => {
    const invalid = new Set<number>();
    for (const dh of dailyHours) {
      if (!dh.is_active) continue;
      const startMin = parseTimeMinutes(dh.start_time);
      const endMin = parseTimeMinutes(dh.end_time);
      if (startMin === null || endMin === null || endMin <= startMin) {
        invalid.add(dh.day_of_week);
      }
    }
    return invalid;
  }, [dailyHours]);

  const isRateDirty =
    ratePerJtm !== savedRateSnapshot.ratePerJtm ||
    transportRatePerKm !== savedRateSnapshot.transportRatePerKm ||
    schoolStartTime !== savedRateSnapshot.schoolStartTime ||
    schoolEndTime !== savedRateSnapshot.schoolEndTime;

  const isDailyHoursDirty = useMemo(() => {
    if (dailyHours.length !== savedDailyHours.length) return true;
    return dailyHours.some((dh, idx) => {
      const saved = savedDailyHours[idx];
      if (!saved) return true;
      return (
        dh.day_of_week !== saved.day_of_week ||
        dh.is_active !== saved.is_active ||
        dh.start_time !== saved.start_time ||
        dh.end_time !== saved.end_time
      );
    });
  }, [dailyHours, savedDailyHours]);

  const activeDaysCount = useMemo(
    () => dailyHours.filter((dh) => dh.is_active).length,
    [dailyHours]
  );

  const parsedDistanceKm =
    distanceForm.home_distance_km.trim() === '' ? NaN : Number(distanceForm.home_distance_km);

  const distanceValidationError = !distanceForm.teacher_id
    ? null
    : !Number.isFinite(parsedDistanceKm) || parsedDistanceKm < 0 || parsedDistanceKm > 500
      ? 'Jarak harus berupa angka antara 0 sampai 500 KM.'
      : null;

  const roundedPreviewKm =
    Number.isFinite(parsedDistanceKm) && parsedDistanceKm >= 0
      ? Math.round(parsedDistanceKm * 100) / 100
      : 0;

  const configuredDistanceCount = useMemo(
    () => teachers.filter((t) => Number(t.home_distance_km ?? 0) > 0).length,
    [teachers]
  );

  const filteredDistanceTeachers = useMemo(() => {
    const normalizedQuery = distanceSearch.trim().toLowerCase();
    return teachers.filter((t) => {
      const km = Number(t.home_distance_km ?? 0);
      if (distanceFilter === 'configured' && km <= 0) return false;
      if (distanceFilter === 'zero' && km > 0) return false;
      if (normalizedQuery && !t.full_name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [distanceFilter, distanceSearch, teachers]);

  const filteredDutyTypes = useMemo(() => {
    const q = dutyTypeSearch.trim().toLowerCase();
    if (!q) return dutyTypes;
    return dutyTypes.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [dutyTypeSearch, dutyTypes]);

  const filteredTeacherDuties = useMemo(() => {
    const q = teacherDutySearch.trim().toLowerCase();
    if (!q) return teacherDuties;
    return teacherDuties.filter(
      (td) =>
        (td.teacher?.full_name || '').toLowerCase().includes(q) ||
        (td.duty_type?.name || '').toLowerCase().includes(q) ||
        (td.decree_number || '').toLowerCase().includes(q) ||
        (td.academic_year?.name || '').toLowerCase().includes(q) ||
        (td.academic_year?.semester || '').toLowerCase().includes(q)
    );
  }, [teacherDuties, teacherDutySearch]);

  const isDuplicateDutyAssignment = useMemo(() => {
    if (
      !assignDutyForm.teacher_id ||
      !assignDutyForm.duty_type_id ||
      !assignDutyForm.academic_year_id
    ) {
      return false;
    }
    return teacherDuties.some(
      (td) =>
        td.teacher_id === assignDutyForm.teacher_id &&
        td.duty_type_id === assignDutyForm.duty_type_id &&
        td.academic_year_id === assignDutyForm.academic_year_id
    );
  }, [
    assignDutyForm.academic_year_id,
    assignDutyForm.duty_type_id,
    assignDutyForm.teacher_id,
    teacherDuties,
  ]);

  async function handleAssignDuty(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (
      !assignDutyForm.teacher_id ||
      !assignDutyForm.duty_type_id ||
      !assignDutyForm.academic_year_id
    ) {
      showToast('Pilih guru, jenis tugas tambahan, serta semester & tahun ajaran.', 'error');
      return;
    }
    if (isDuplicateDutyAssignment) {
      showToast(
        'Guru tersebut sudah memiliki tugas tambahan yang sama pada semester dan tahun ajaran ini.',
        'error'
      );
      return;
    }
    const ok = await callHonorApi(
      'POST',
      {
        action: 'ASSIGN_DUTY',
        teacher_id: assignDutyForm.teacher_id,
        duty_type_id: assignDutyForm.duty_type_id,
        academic_year_id: assignDutyForm.academic_year_id,
        decree_number: assignDutyForm.decree_number.trim() || null,
      },
      'Tugas tambahan guru berhasil disimpan.'
    );
    if (ok) {
      setAssignDutyForm((prev) => ({
        ...prev,
        teacher_id: '',
        duty_type_id: '',
        decree_number: '',
      }));
    }
  }

  async function handleConfirmDeleteDuty() {
    if (!canManage || !dutyToDelete || submittingAction) return;
    const ok = await callHonorApi(
      'DELETE',
      {
        action: 'DELETE_DUTY_ASSIGNMENT',
        id: dutyToDelete.id,
      },
      'Penugasan tugas tambahan guru berhasil dihapus.'
    );
    if (ok) {
      setSelectedDutyIds((prev) => prev.filter((id) => id !== dutyToDelete.id));
      setDutyToDelete(null);
    }
  }

  const selectedDutiesList = useMemo(() => {
    if (selectedDutyIds.length === 0) return [];
    const selectedSet = new Set(selectedDutyIds);
    return teacherDuties.filter((td) => selectedSet.has(td.id));
  }, [selectedDutyIds, teacherDuties]);

  const allFilteredSelected = useMemo(() => {
    if (filteredTeacherDuties.length === 0) return false;
    const selectedSet = new Set(selectedDutyIds);
    return filteredTeacherDuties.every((td) => selectedSet.has(td.id));
  }, [filteredTeacherDuties, selectedDutyIds]);

  function toggleDutySelection(id: string) {
    setSelectedDutyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleToggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredTeacherDuties.map((td) => td.id));
      setSelectedDutyIds((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }
    setSelectedDutyIds((prev) => {
      const merged = new Set(prev);
      for (const td of filteredTeacherDuties) {
        merged.add(td.id);
      }
      return Array.from(merged);
    });
  }

  async function handleConfirmBatchDeleteDuty() {
    if (!canManage || selectedDutiesList.length === 0 || submittingAction) return;
    const ids = selectedDutiesList.map((td) => td.id);
    const ok = await callHonorApi(
      'DELETE',
      {
        action: 'DELETE_DUTY_ASSIGNMENT_BATCH',
        ids,
      },
      `${ids.length} penugasan tugas tambahan guru berhasil dihapus.`
    );
    if (ok) {
      setSelectedDutyIds([]);
      setBatchDeleteOpen(false);
    }
  }

  const filteredHonorariums = useMemo(() => {
    const q = rekapSearch.trim().toLowerCase();
    return honorariums.filter((h) => {
      if (rekapStatusFilter !== 'ALL' && h.status !== rekapStatusFilter) return false;
      if (q) {
        const name = (h.teacher?.full_name || '').toLowerCase();
        const periodStr = `${h.period_month}/${h.period_year}`;
        if (!name.includes(q) && !periodStr.includes(q)) return false;
      }
      return true;
    });
  }, [honorariums, rekapSearch, rekapStatusFilter]);

  const rekapSummary = useMemo(() => {
    let totalNominal = 0;
    let paidCount = 0;
    for (const h of honorariums) {
      totalNominal += Number(h.total_amount ?? 0);
      if (h.status === 'PAID') paidCount += 1;
    }
    return { totalNominal, paidCount };
  }, [honorariums]);

  async function handleGenerateHonorarium(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!genForm.teacher_id) {
      showToast('Pilih guru terlebih dahulu.', 'error');
      return;
    }
    if (
      !Number.isInteger(genForm.period_month) ||
      genForm.period_month < 1 ||
      genForm.period_month > 12
    ) {
      showToast('Bulan periode harus antara 1 sampai 12.', 'error');
      return;
    }
    if (
      !Number.isInteger(genForm.period_year) ||
      genForm.period_year < 2020 ||
      genForm.period_year > 2100
    ) {
      showToast('Tahun periode harus antara 2020 sampai 2100.', 'error');
      return;
    }
    await callHonorApi(
      'POST',
      { action: 'GENERATE_HONORARIUM', ...genForm },
      'Honorarium guru berhasil dihitung dari JTM & tunjangan.'
    );
  }

  async function handleSaveDutyAllowance(duty: AdditionalDutyType) {
    if (!canManage || !duty.receives_allowance || submittingAction) return;
    const raw = dutyAllowanceDrafts[duty.id] ?? String(Number(duty.monthly_allowance ?? 0));
    const parsed = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast(`Nominal tunjangan ${duty.name} tidak boleh negatif.`, 'error');
      return;
    }
    const rounded = Math.round(parsed);
    await callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_DUTY_ALLOWANCE',
        duty_type_id: duty.id,
        monthly_allowance: rounded,
      },
      `Tunjangan ${duty.name} diperbarui.`
    );
  }

  async function handleSaveDistance(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (!distanceForm.teacher_id) {
      showToast('Pilih guru terlebih dahulu.', 'error');
      return;
    }
    if (!Number.isFinite(parsedDistanceKm) || parsedDistanceKm < 0 || parsedDistanceKm > 500) {
      showToast('Jarak harus berupa angka antara 0 sampai 500 KM.', 'error');
      return;
    }
    const roundedKm = Math.round(parsedDistanceKm * 100) / 100;
    const ok = await callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_TEACHER_DISTANCE',
        teacher_id: distanceForm.teacher_id,
        home_distance_km: roundedKm,
      },
      'Jarak rumah guru (KM) berhasil diperbarui.'
    );
    if (ok) {
      setDistanceForm((prev) => ({
        ...prev,
        home_distance_km: String(roundedKm),
      }));
    }
  }

  function handleSaveRates(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    if (rateValidationError) {
      showToast(rateValidationError, 'error');
      return;
    }
    void callHonorApi(
      'PATCH',
      {
        action: 'UPDATE_RATE',
        rate_per_jtm: Math.round(ratePerJtm),
        transport_rate_per_km: Math.round(transportRatePerKm),
        school_start_time: schoolStartTime,
        school_end_time: schoolEndTime,
      },
      'Tarif JTM, jam sekolah & tarif transport diperbarui.'
    );
  }

  function handleSaveDailyHours() {
    if (!canManage || submittingAction) return;
    if (invalidDailyDays.size > 0) {
      const firstDay = Array.from(invalidDailyDays)[0];
      showToast(
        `Jam sekolah hari ${DAY_LABELS[firstDay] || firstDay} tidak valid (jam pulang harus lebih besar dari jam masuk).`,
        'error'
      );
      return;
    }
    void callHonorApi(
      'PATCH',
      { action: 'UPDATE_DAILY_HOURS', daily_hours: dailyHours },
      'Jam sekolah per hari berhasil diperbarui.'
    );
  }

  function handleApplyDefaultToActiveDays() {
    if (!canManage) return;
    const startMin = parseTimeMinutes(schoolStartTime);
    const endMin = parseTimeMinutes(schoolEndTime);
    if (startMin === null || endMin === null || endMin <= startMin) {
      showToast('Isi jam masuk & jam pulang default yang valid terlebih dahulu.', 'error');
      return;
    }
    setDailyHours((prev) =>
      prev.map((dh) =>
        dh.is_active
          ? { ...dh, start_time: schoolStartTime, end_time: schoolEndTime }
          : dh
      )
    );
    showToast('Jam default diterapkan ke seluruh hari aktif. Klik Simpan untuk menyimpan.', 'success');
  }

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
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Pengaturan Honorarium</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData('refresh')}
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
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Tarif JTM &amp; Jam Sekolah</span>
                </h1>
                {!canManage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Atur tarif dasar JTM, tarif transport per kilometer, dan jam operasional sekolah
                sebagai acuan perhitungan honorarium bulanan.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Tarif JTM: </span>
                <span className="font-bold text-emerald-800 font-mono">
                  {formatRupiah(savedRateSnapshot.ratePerJtm)}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px]">
                <span className="text-slate-500">Hari Aktif: </span>
                <span className="font-bold text-slate-800">{activeDaysCount}/7 hari</span>
              </div>
              <button
                type="button"
                onClick={() => void loadData('refresh')}
                disabled={refreshing || Boolean(submittingAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                title="Muat ulang pengaturan dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <form onSubmit={handleSaveRates} className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Tarif JTM, Jam Sekolah &amp; Transport per KM</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Nilai ini menjadi tarif standar dan jam masuk/pulang default.
                  </p>
                </div>
                {isRateDirty && canManage && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                    Belum disimpan
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label
                    htmlFor="honor-rate-jtm"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Tarif per JTM (Rp)
                  </label>
                  <input
                    id="honor-rate-jtm"
                    type="number"
                    min={0}
                    step={500}
                    disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                    value={ratePerJtm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRatePerJtm(Number.isFinite(val) ? Math.max(0, val) : 0);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <p className="text-[11px] text-emerald-700 font-medium font-mono">
                    {formatRupiah(ratePerJtm)} / JTM
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="honor-rate-transport"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Tarif Transport / KM (Rp)
                  </label>
                  <input
                    id="honor-rate-transport"
                    type="number"
                    min={0}
                    step={100}
                    disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                    value={transportRatePerKm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTransportRatePerKm(Number.isFinite(val) ? Math.max(0, val) : 0);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <p className="text-[11px] text-emerald-700 font-medium font-mono">
                    {formatRupiah(transportRatePerKm)} / KM
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="honor-school-start"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jam Masuk Sekolah Default
                  </label>
                  <input
                    id="honor-school-start"
                    type="time"
                    disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                    value={schoolStartTime}
                    onChange={(e) => setSchoolStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="honor-school-end"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Jam Pulang Sekolah Default
                  </label>
                  <input
                    id="honor-school-end"
                    type="time"
                    disabled={!canManage || submittingAction === 'UPDATE_RATE'}
                    value={schoolEndTime}
                    onChange={(e) => setSchoolEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Durasi jam sekolah default
                </span>
                <span
                  className={`font-semibold font-mono ${
                    rateValidationError ? 'text-rose-600' : 'text-slate-800'
                  }`}
                >
                  {formatDurationLabel(schoolStartTime, schoolEndTime)}
                </span>
              </div>

              {rateValidationError && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{rateValidationError}</span>
                </p>
              )}

              {canManage && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={Boolean(submittingAction) || Boolean(rateValidationError)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'UPDATE_RATE' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Pengaturan Tarif &amp; Jam Sekolah</span>
                  </button>
                  {isRateDirty && (
                    <button
                      type="button"
                      disabled={Boolean(submittingAction)}
                      onClick={() => {
                        setRatePerJtm(savedRateSnapshot.ratePerJtm);
                        setTransportRatePerKm(savedRateSnapshot.transportRatePerKm);
                        setSchoolStartTime(savedRateSnapshot.schoolStartTime);
                        setSchoolEndTime(savedRateSnapshot.schoolEndTime);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Batal</span>
                    </button>
                  )}
                </div>
              )}
            </form>

            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900">
                      Jam Sekolah Per Hari (Senin – Minggu)
                    </h2>
                    {isDailyHoursDirty && canManage && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        Belum disimpan
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Atur jam masuk &amp; jam pulang masing-masing hari untuk menghitung persentase
                    durasi kehadiran tunjangan transportasi.
                  </p>
                </div>
                {canManage && dailyHours.length > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(submittingAction)}
                    onClick={handleApplyDefaultToActiveDays}
                    className="shrink-0 self-start px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold transition disabled:opacity-60"
                  >
                    Terapkan Jam Default
                  </button>
                )}
              </div>

              {dailyHours.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  Data jam sekolah harian belum tersedia.
                </div>
              ) : (
                <div className="space-y-2">
                  {dailyHours.map((dh) => {
                    const isInvalid = invalidDailyDays.has(dh.day_of_week);
                    const dayName = DAY_LABELS[dh.day_of_week] || `Hari ${dh.day_of_week}`;
                    return (
                      <div
                        key={dh.day_of_week}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition ${
                          isInvalid
                            ? 'bg-rose-50/70 border-rose-300'
                            : dh.is_active
                              ? 'bg-white border-slate-200'
                              : 'bg-slate-50/80 border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                          <label className="inline-flex items-center gap-2 min-w-[96px] font-semibold text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!canManage || submittingAction === 'UPDATE_DAILY_HOURS'}
                              checked={dh.is_active}
                              onChange={(e) =>
                                setDailyHours((prev) =>
                                  prev.map((x) =>
                                    x.day_of_week === dh.day_of_week
                                      ? { ...x, is_active: e.target.checked }
                                      : x
                                  )
                                )
                              }
                              className="w-4 h-4 rounded accent-emerald-600 disabled:opacity-60"
                            />
                            <span>{dayName}</span>
                          </label>

                          <span
                            className={`sm:hidden text-[11px] font-mono font-medium ${
                              !dh.is_active
                                ? 'text-slate-400'
                                : isInvalid
                                  ? 'text-rose-600'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {dh.is_active
                              ? formatDurationLabel(dh.start_time, dh.end_time)
                              : 'Libur / Nonaktif'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                          <input
                            type="time"
                            aria-label={`Jam masuk ${dayName}`}
                            disabled={
                              !canManage ||
                              !dh.is_active ||
                              submittingAction === 'UPDATE_DAILY_HOURS'
                            }
                            value={dh.start_time}
                            onChange={(e) =>
                              setDailyHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === dh.day_of_week
                                    ? { ...x, start_time: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="flex-1 sm:flex-none min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <span className="text-slate-400 shrink-0">–</span>
                          <input
                            type="time"
                            aria-label={`Jam pulang ${dayName}`}
                            disabled={
                              !canManage ||
                              !dh.is_active ||
                              submittingAction === 'UPDATE_DAILY_HOURS'
                            }
                            value={dh.end_time}
                            onChange={(e) =>
                              setDailyHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === dh.day_of_week
                                    ? { ...x, end_time: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="flex-1 sm:flex-none min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <span
                            className={`hidden sm:inline-block w-24 text-right text-[11px] font-mono shrink-0 ${
                              !dh.is_active
                                ? 'text-slate-400'
                                : isInvalid
                                  ? 'text-rose-600 font-semibold'
                                  : 'text-slate-600'
                            }`}
                          >
                            {dh.is_active
                              ? formatDurationLabel(dh.start_time, dh.end_time)
                              : 'Nonaktif'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {invalidDailyDays.size > 0 && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Periksa jam masuk &amp; pulang pada hari yang ditandai merah (jam pulang harus
                    lebih besar dari jam masuk).
                  </span>
                </p>
              )}

              {canManage && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={Boolean(submittingAction) || invalidDailyDays.size > 0}
                    onClick={handleSaveDailyHours}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'UPDATE_DAILY_HOURS' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Jam Sekolah Per Hari</span>
                  </button>
                  {isDailyHoursDirty && (
                    <button
                      type="button"
                      disabled={Boolean(submittingAction)}
                      onClick={() => setDailyHours(savedDailyHours.map((d) => ({ ...d })))}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Batal</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'jarak-guru' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Jarak Rumah Guru ke Madrasah / Sekolah</span>
                </h1>
                {!canManage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Jarak tempuh (KM) dikalikan tarif transport ({formatRupiah(transportRatePerKm)}
                /KM) dan persentase durasi kehadiran harian untuk menghitung tunjangan
                transportasi.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Sudah Diatur: </span>
                <span className="font-bold text-emerald-800">
                  {configuredDistanceCount}/{teachers.length} guru
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadData('refresh')}
                disabled={refreshing || Boolean(submittingAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                title="Muat ulang daftar guru dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {canManage && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">Perbarui Jarak Rumah Guru</h2>
                  <p className="text-[11px] text-slate-500">
                    Pilih guru dari daftar atau klik kartu guru di samping untuk mengisi jarak
                    otomatis.
                  </p>
                </div>

                <form onSubmit={handleSaveDistance} className="space-y-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="honor-distance-teacher"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nama Guru
                    </label>
                    <select
                      id="honor-distance-teacher"
                      required
                      disabled={submittingAction === 'UPDATE_TEACHER_DISTANCE'}
                      value={distanceForm.teacher_id}
                      onChange={(e) => {
                        const found = teachers.find((t) => t.id === e.target.value);
                        setDistanceForm({
                          teacher_id: e.target.value,
                          home_distance_km: String(Number(found?.home_distance_km ?? 0)),
                        });
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.home_distance_km ?? 0} KM)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="honor-distance-km"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Jarak Rumah ke Sekolah (KM)
                    </label>
                    <div className="relative">
                      <input
                        id="honor-distance-km"
                        type="number"
                        step="0.01"
                        min={0}
                        max={500}
                        required
                        disabled={submittingAction === 'UPDATE_TEACHER_DISTANCE'}
                        value={distanceForm.home_distance_km}
                        onChange={(e) =>
                          setDistanceForm((prev) => ({
                            ...prev,
                            home_distance_km: e.target.value,
                          }))
                        }
                        placeholder="mis. 4.25"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-12 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                        KM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Maksimal 500 KM (mendukung 2 angka desimal, mis. 4.25).
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">Estimasi maks. transport/hari</span>
                    <span className="font-bold font-mono text-emerald-700">
                      {formatRupiah(Math.round(roundedPreviewKm * transportRatePerKm))}
                    </span>
                  </div>

                  {distanceValidationError && (
                    <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{distanceValidationError}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      Boolean(submittingAction) ||
                      !distanceForm.teacher_id ||
                      Boolean(distanceValidationError)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'UPDATE_TEACHER_DISTANCE' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Jarak Guru</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Jarak Rumah Guru ({filteredDistanceTeachers.length})
                  </h2>
                  {canManage && (
                    <p className="text-[11px] text-slate-500">
                      Klik kartu guru untuk memilih dan mengubah jaraknya dengan cepat.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { key: 'all', label: 'Semua' },
                      { key: 'configured', label: 'Sudah Diatur' },
                      { key: 'zero', label: '0 KM' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDistanceFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        distanceFilter === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <label htmlFor="honor-distance-search" className="sr-only">
                  Cari nama guru
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="honor-distance-search"
                  type="search"
                  value={distanceSearch}
                  onChange={(e) => setDistanceSearch(e.target.value)}
                  placeholder="Cari nama guru..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              {filteredDistanceTeachers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    {teachers.length === 0
                      ? 'Belum ada data guru terdaftar.'
                      : 'Tidak ada guru yang sesuai dengan filter pencarian.'}
                  </p>
                  {(distanceSearch || distanceFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setDistanceSearch('');
                        setDistanceFilter('all');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Reset pencarian &amp; filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto pr-0.5">
                  {filteredDistanceTeachers.map((t) => {
                    const km = Number(t.home_distance_km ?? 0);
                    const isSelected = distanceForm.teacher_id === t.id;
                    const cardContent = (
                      <>
                        <div className="min-w-0 text-left">
                          <p className="font-bold text-slate-900 break-words">{t.full_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Est. {formatRupiah(Math.round(km * transportRatePerKm))}/hari
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-lg font-mono font-semibold text-[11px] ${
                            km > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {km} KM
                        </span>
                      </>
                    );

                    if (!canManage) {
                      return (
                        <div
                          key={t.id}
                          className="modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                        >
                          {cardContent}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setDistanceForm({
                            teacher_id: t.id,
                            home_distance_km: String(Number(t.home_distance_km ?? 0)),
                          })
                        }
                        className={`modular-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs transition w-full cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40'
                            : 'hover:border-emerald-300 hover:bg-slate-50/80'
                        }`}
                      >
                        {cardContent}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'tugas-tambahan' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Tugas Tambahan &amp; Tunjangan Guru</span>
                </h1>
                {!canManage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Kelola nominal tunjangan bulanan per jenis tugas tambahan dan tugaskan peran
                tambahan ke guru beserta nomor SK.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Penugasan Aktif: </span>
                <span className="font-bold text-emerald-800">{teacherDuties.length} tugas</span>
              </div>
              <button
                type="button"
                onClick={() => void loadData('refresh')}
                disabled={refreshing || Boolean(submittingAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                title="Muat ulang data tugas tambahan dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {canManage && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Tugaskan Tugas Tambahan ke Guru
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Penugasan aktif otomatis diperhitungkan pada slip honorarium bulanan guru.
                  </p>
                </div>

                <form onSubmit={handleAssignDuty} className="space-y-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="honor-duty-teacher"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nama Guru
                    </label>
                    <select
                      id="honor-duty-teacher"
                      required
                      disabled={submittingAction === 'ASSIGN_DUTY'}
                      value={assignDutyForm.teacher_id}
                      onChange={(e) =>
                        setAssignDutyForm({ ...assignDutyForm, teacher_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="honor-duty-type"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Jenis Tugas Tambahan
                    </label>
                    <select
                      id="honor-duty-type"
                      required
                      disabled={submittingAction === 'ASSIGN_DUTY'}
                      value={assignDutyForm.duty_type_id}
                      onChange={(e) =>
                        setAssignDutyForm({ ...assignDutyForm, duty_type_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Tugas Tambahan --</option>
                      {dutyTypes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{' '}
                          {d.receives_allowance
                            ? `(${formatRupiah(Number(d.monthly_allowance))}/bln)`
                            : '(Tanpa Tunjangan)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="honor-duty-academic-year"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Semester &amp; Tahun Ajaran
                    </label>
                    <select
                      id="honor-duty-academic-year"
                      required
                      disabled={submittingAction === 'ASSIGN_DUTY'}
                      value={assignDutyForm.academic_year_id}
                      onChange={(e) =>
                        setAssignDutyForm({ ...assignDutyForm, academic_year_id: e.target.value })
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Semester &amp; Tahun Ajaran --</option>
                      {academicYears.map((ay) => (
                        <option key={ay.id} value={ay.id}>
                          {ay.name} - Semester {ay.semester}
                          {ay.is_active ? ' (Aktif)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="honor-duty-decree"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nomor SK (Opsional)
                    </label>
                    <input
                      id="honor-duty-decree"
                      type="text"
                      disabled={submittingAction === 'ASSIGN_DUTY'}
                      value={assignDutyForm.decree_number}
                      onChange={(e) =>
                        setAssignDutyForm({ ...assignDutyForm, decree_number: e.target.value })
                      }
                      placeholder="mis. SK/012/XI/2026"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  {isDuplicateDutyAssignment && (
                    <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Guru ini sudah aktif pada tugas tambahan tersebut di semester dan tahun ajaran yang dipilih.
                      </span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      Boolean(submittingAction) ||
                      !assignDutyForm.teacher_id ||
                      !assignDutyForm.duty_type_id ||
                      !assignDutyForm.academic_year_id ||
                      isDuplicateDutyAssignment
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'ASSIGN_DUTY' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Tugaskan</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Master Tunjangan Tugas Tambahan ({filteredDutyTypes.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Ubah nominal tunjangan bulanan lalu klik Simpan pada baris terkait.
                  </p>
                </div>
              </div>

              <div className="relative">
                <label htmlFor="honor-duty-type-search" className="sr-only">
                  Cari jenis tugas tambahan
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="honor-duty-type-search"
                  type="search"
                  value={dutyTypeSearch}
                  onChange={(e) => setDutyTypeSearch(e.target.value)}
                  placeholder="Cari nama atau kode tugas tambahan..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              {filteredDutyTypes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  {dutyTypes.length === 0
                    ? 'Belum ada master jenis tugas tambahan.'
                    : 'Tidak ada jenis tugas tambahan yang cocok dengan pencarian.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto pr-0.5">
                  {filteredDutyTypes.map((d) => {
                    const currentVal = Number(d.monthly_allowance ?? 0);
                    const draftRaw = dutyAllowanceDrafts[d.id] ?? String(currentVal);
                    const draftNum = draftRaw.trim() === '' ? NaN : Number(draftRaw);
                    const isInvalidDraft =
                      d.receives_allowance && (!Number.isFinite(draftNum) || draftNum < 0);
                    const isDirty =
                      d.receives_allowance && !isInvalidDraft && Math.round(draftNum) !== currentVal;

                    return (
                      <div
                        key={d.id}
                        className={`modular-card rounded-xl p-3 flex flex-col justify-between gap-2.5 text-xs ${
                          isDirty ? 'border-amber-300 bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-bold text-slate-900 break-words">{d.name}</p>
                          {!d.receives_allowance ? (
                            <span className="inline-block text-[10px] font-semibold text-rose-600">
                              Tanpa tunjangan honorarium
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-mono text-emerald-700 font-medium">
                              Aktif: {formatRupiah(currentVal)}/bln
                            </span>
                          )}
                        </div>

                        {canManage ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              aria-label={`Tunjangan bulanan ${d.name}`}
                              disabled={!d.receives_allowance || Boolean(submittingAction)}
                              value={draftRaw}
                              onChange={(e) =>
                                setDutyAllowanceDrafts((prev) => ({
                                  ...prev,
                                  [d.id]: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            {d.receives_allowance && isDirty && (
                              <button
                                type="button"
                                aria-busy={Boolean(submittingAction) || undefined}
                                disabled={Boolean(submittingAction) || isInvalidDraft}
                                onClick={() => void handleSaveDutyAllowance(d)}
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition disabled:opacity-60"
                              >
                                {Boolean(submittingAction) && <Loader2 className="w-3 h-3 animate-spin" />}
                                <span>Simpan</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-right font-mono font-bold text-emerald-700">
                            {d.receives_allowance ? formatRupiah(currentVal) : '-'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Daftar Penugasan Aktif Guru ({filteredTeacherDuties.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Menampilkan guru yang sedang memegang tugas tambahan aktif.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                {canManage && filteredTeacherDuties.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllFiltered}
                      disabled={Boolean(submittingAction)}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
                    >
                      {allFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                    </button>
                    {selectedDutiesList.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedDutyIds([])}
                          disabled={Boolean(submittingAction)}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-600 transition disabled:opacity-50"
                        >
                          Reset ({selectedDutiesList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchDeleteOpen(true)}
                          disabled={Boolean(submittingAction)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Terpilih ({selectedDutiesList.length})</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
                <div className="relative w-full sm:w-72">
                  <label htmlFor="honor-assigned-duty-search" className="sr-only">
                    Cari penugasan guru
                  </label>
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="honor-assigned-duty-search"
                    type="search"
                    value={teacherDutySearch}
                    onChange={(e) => setTeacherDutySearch(e.target.value)}
                    placeholder="Cari guru, tugas, atau SK..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            {filteredTeacherDuties.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                {teacherDuties.length === 0
                  ? 'Belum ada guru yang ditugaskan pada tugas tambahan aktif.'
                  : 'Tidak ada penugasan aktif yang sesuai dengan pencarian.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-0.5">
                {filteredTeacherDuties.map((td) => {
                  const isSelected = selectedDutyIds.includes(td.id);
                  return (
                    <div
                      key={td.id}
                      className={`modular-card rounded-xl p-3.5 flex items-start justify-between gap-2.5 text-xs transition ${
                        isSelected ? 'ring-2 ring-rose-500/60 bg-rose-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {canManage && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDutySelection(td.id)}
                            disabled={Boolean(submittingAction)}
                            aria-label={`Pilih penugasan ${td.duty_type?.name || 'tugas tambahan'} untuk ${td.teacher?.full_name || 'guru'}`}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                          />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-bold text-slate-900 break-words">
                            {td.teacher?.full_name || 'Guru'}
                          </p>
                          <p className="text-[11px] font-medium text-emerald-700 break-words">
                            {td.duty_type?.name || 'Tugas Tambahan'}
                          </p>
                          {td.academic_year && (
                            <p className="text-[10px] text-slate-600 font-medium">
                              TA {td.academic_year.name} · Smt {td.academic_year.semester}
                            </p>
                          )}
                          {td.decree_number && (
                            <p className="text-[10px] text-slate-500 font-mono break-words">
                              SK: {td.decree_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {td.duty_type?.receives_allowance
                            ? formatRupiah(Number(td.duty_type.monthly_allowance ?? 0))
                            : 'Non-tunj.'}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDutyToDelete(td)}
                            disabled={Boolean(submittingAction)}
                            title="Hapus penugasan tugas tambahan"
                            aria-label={`Hapus penugasan ${td.duty_type?.name || 'tugas tambahan'} untuk ${td.teacher?.full_name || 'guru'}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'rekap' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Rekap &amp; Slip Honorarium Guru</span>
                </h1>
                {!canManage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Hitung honorarium bulanan dari akumulasi JTM, tunjangan tugas tambahan, dan
                tunjangan transport, lalu cetak atau ubah status pembayaran slip.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Total: </span>
                <span className="font-bold font-mono text-emerald-800">
                  {formatRupiah(rekapSummary.totalNominal)}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px]">
                <span className="text-slate-500">Lunas (PAID): </span>
                <span className="font-bold text-slate-800">
                  {rekapSummary.paidCount}/{honorariums.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadData('refresh')}
                disabled={refreshing || Boolean(submittingAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                title="Muat ulang rekap honorarium dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {canManage && (
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Generate Honorarium Bulanan</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Jika slip periode yang sama sudah ada, sistem akan menghitung ulang dan
                    memperbarui nominalnya.
                  </p>
                </div>

                <form onSubmit={handleGenerateHonorarium} className="space-y-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="honor-gen-teacher"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nama Guru
                    </label>
                    <select
                      id="honor-gen-teacher"
                      required
                      disabled={submittingAction === 'GENERATE_HONORARIUM'}
                      value={genForm.teacher_id}
                      onChange={(e) => setGenForm({ ...genForm, teacher_id: e.target.value })}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="honor-gen-month"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Bulan Periode
                      </label>
                      <select
                        id="honor-gen-month"
                        disabled={submittingAction === 'GENERATE_HONORARIUM'}
                        value={genForm.period_month}
                        onChange={(e) =>
                          setGenForm({ ...genForm, period_month: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                      >
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="honor-gen-year"
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Tahun Periode
                      </label>
                      <input
                        id="honor-gen-year"
                        type="number"
                        min={2020}
                        max={2100}
                        required
                        disabled={submittingAction === 'GENERATE_HONORARIUM'}
                        value={genForm.period_year}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setGenForm({
                            ...genForm,
                            period_year: Number.isFinite(val) ? val : 2026,
                          });
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(submittingAction) || !genForm.teacher_id}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                  >
                    {submittingAction === 'GENERATE_HONORARIUM' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Coins className="w-3.5 h-3.5" />
                    )}
                    <span>Hitung &amp; Simpan Slip Honorarium</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Rekap Honorarium Guru ({filteredHonorariums.length})
                </h2>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: 'Semua' },
                      { key: 'DRAFT', label: 'DRAFT' },
                      { key: 'APPROVED', label: 'APPROVED' },
                      { key: 'PAID', label: 'PAID' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRekapStatusFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        rekapStatusFilter === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <label htmlFor="honor-rekap-search" className="sr-only">
                  Cari nama guru atau periode
                </label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="honor-rekap-search"
                  type="search"
                  value={rekapSearch}
                  onChange={(e) => setRekapSearch(e.target.value)}
                  placeholder="Cari nama guru atau periode (mis. 11/2026)..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              {filteredHonorariums.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    {honorariums.length === 0
                      ? 'Belum ada slip honorarium yang di-generate.'
                      : 'Tidak ada data honorarium yang cocok dengan filter.'}
                  </p>
                  {(rekapSearch || rekapStatusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setRekapSearch('');
                        setRekapStatusFilter('ALL');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Reset pencarian &amp; filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[34rem] overflow-y-auto pr-0.5">
                  {filteredHonorariums.map((h) => {
                    const monthName =
                      MONTH_OPTIONS.find((m) => m.value === h.period_month)?.label ||
                      String(h.period_month);
                    const statusBadgeClass =
                      h.status === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : h.status === 'APPROVED'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200';

                    return (
                      <div
                        key={h.id}
                        className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-bold text-slate-900 break-words">
                            {h.teacher?.full_name || 'GTK'}{' '}
                            <span className="font-medium text-slate-500">
                              ({monthName} {h.period_year})
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 break-words">
                            {h.total_jtm} JTM ({formatRupiah(Number(h.jtm_honorarium_amount))}) +
                            Tunjangan ({formatRupiah(Number(h.additional_duty_allowance))}) +
                            Transport ({formatRupiah(Number(h.transport_allowance ?? 0))})
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap shrink-0">
                          <span className="font-bold font-mono text-emerald-700 text-sm">
                            {formatRupiah(Number(h.total_amount))}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveHonorSlip({
                                  id: h.id,
                                  teacherName: h.teacher?.full_name || 'GTK',
                                  teacherNip: h.teacher?.nip || null,
                                  homeDistanceKm: h.teacher?.home_distance_km ?? null,
                                  periodMonth: h.period_month,
                                  periodYear: h.period_year,
                                  teachingJtm: Number(h.teaching_jtm) || 0,
                                  substituteJtm: Number(h.substitute_jtm) || 0,
                                  examSupervisorJtm: Number(h.exam_supervisor_jtm) || 0,
                                  examCommitteeJtm: Number(h.exam_committee_jtm) || 0,
                                  eventJtm: Number(h.event_jtm) || 0,
                                  picketJtm: Number(h.picket_jtm) || 0,
                                  ceremonyJtm: Number(h.ceremony_jtm) || 0,
                                  paidHolidayJtm: Number(h.paid_holiday_jtm) || 0,
                                  totalJtm: Number(h.total_jtm) || 0,
                                  ratePerJtm: Number(h.rate_per_jtm) || ratePerJtm,
                                  jtmHonorariumAmount: Number(h.jtm_honorarium_amount) || 0,
                                  additionalDutyAllowance: Number(h.additional_duty_allowance) || 0,
                                  transportAllowance: Number(h.transport_allowance) || 0,
                                  totalAmount: Number(h.total_amount) || 0,
                                  status: h.status,
                                  dutyItems: h.items || [],
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                              title="Lihat & Unduh Slip PNG / PDF"
                            >
                              <Download className="w-3 h-3" /> Slip
                            </button>
                            {canManage ? (
                              <select
                                aria-label={`Status honorarium ${h.teacher?.full_name || 'GTK'}`}
                                disabled={Boolean(submittingAction)}
                                value={h.status}
                                onChange={(e) =>
                                  void callHonorApi(
                                    'PATCH',
                                    {
                                      action: 'UPDATE_STATUS',
                                      honorarium_id: h.id,
                                      status: e.target.value,
                                    },
                                    'Status honorarium diperbarui.'
                                  )
                                }
                                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-60 ${statusBadgeClass}`}
                              >
                                <option value="DRAFT">DRAFT</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="PAID">PAID</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusBadgeClass}`}
                              >
                                {h.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeHonorSlip && (
        <HonorariumSlipModal slip={activeHonorSlip} onClose={() => setActiveHonorSlip(null)} />
      )}

      {dutyToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-duty-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="delete-duty-modal-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Hapus Penugasan Tugas Tambahan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tindakan ini akan mencabut penugasan aktif guru.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDutyToDelete(null)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {dutyToDelete.teacher?.full_name || 'Guru'}
              </p>
              <p className="font-medium text-emerald-700">
                {dutyToDelete.duty_type?.name || 'Tugas Tambahan'}
              </p>
              {dutyToDelete.decree_number && (
                <p className="text-[11px] text-slate-500 font-mono">
                  SK: {dutyToDelete.decree_number}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDutyToDelete(null)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDuty}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs font-semibold text-white transition"
              >
                {submittingAction === 'DELETE_DUTY_ASSIGNMENT' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus Penugasan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {batchDeleteOpen && selectedDutiesList.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-duty-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="batch-delete-duty-modal-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Hapus {selectedDutiesList.length} Penugasan Tugas Tambahan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Seluruh penugasan aktif terpilih akan dicabut secara permanen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(false)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 max-h-56 overflow-y-auto space-y-2 text-xs">
              {selectedDutiesList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.teacher?.full_name || 'Guru'}
                    </p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      {item.duty_type?.name || 'Tugas Tambahan'}
                      {item.academic_year
                        ? ` · TA ${item.academic_year.name} (${item.academic_year.semester})`
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(false)}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDeleteDuty}
                disabled={submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs font-semibold text-white transition"
              >
                {submittingAction === 'DELETE_DUTY_ASSIGNMENT_BATCH' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus {selectedDutiesList.length} Penugasan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
