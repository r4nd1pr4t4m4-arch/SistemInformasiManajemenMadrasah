'use client';

import type { ReactNode } from 'react';

export type PersonalScope = 'siswa' | 'orang-tua' | 'gtk' | 'umum';
export type PersonalSection =
  | 'jadwal-pelajaran'
  | 'jadwal-piket'
  | 'tabungan'
  | 'absensi'
  | 'spp'
  | 'ujian'
  | 'bk'
  | 'guru-wali'
  | 'honorarium';

export const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export function getTodayIsoDay(): number {
  const jsDay = new Date().getDay(); // 0=Minggu .. 6=Sabtu
  return jsDay === 0 ? 7 : jsDay;
}

export function formatTimeShort(t?: string | null): string {
  if (!t) return '-';
  return String(t).slice(0, 5);
}

export function formatTimeValue(t?: unknown): string {
  if (!t) return '-';
  const raw = String(t).trim();
  if (!raw) return '-';
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return raw;
}

export function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const parts = String(t).trim().split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function getCurrentMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export interface PersonalPayload {
  scope: PersonalScope;
  profile: {
    userId: string;
    fullName: string;
    email: string;
    roles: string[];
  };
  student: {
    id: string;
    full_name: string;
    nis?: string | null;
    nisn?: string | null;
    status?: string | null;
  } | null;
  children: Array<{
    id: string;
    full_name: string;
    nis?: string | null;
    relation?: string | null;
  }>;
  teacher: {
    id: string;
    full_name: string;
    nip?: string | null;
    nuptk?: string | null;
    staff_type?: string | null;
    home_distance_km?: number | null;
  } | null;
  classroom: {
    id: string;
    name: string;
    grade_level?: string | null;
    homeroom_teacher?: { full_name?: string | null } | null;
  } | null;
  schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    jtm_count: number;
    subject?: { name?: string | null; code?: string | null; subject_group?: string | null } | null;
    teacher?: { full_name?: string | null } | null;
    classroom?: { name?: string | null; grade_level?: string | null } | null;
  }>;
  pickets: Array<{
    id: string;
    day_of_week: number;
    student_id?: string | null;
    task_notes?: string | null;
    notes?: string | null;
    student?: { id: string; full_name: string; nis?: string | null } | null;
    academic_year?: { name?: string | null } | null;
  }>;
  savingsAccounts: Array<{
    id: string;
    account_number: string;
    owner_type: string;
    owner_name: string;
    balance: number;
    is_active: boolean;
  }>;
  savingsTransactions: Array<{
    id: string;
    account_id: string;
    transaction_type: 'SETOR' | 'TARIK';
    amount: number;
    fee_percentage?: number | null;
    fee_amount?: number | null;
    net_amount?: number | null;
    balance_after: number;
    reference_number: string;
    notes?: string | null;
    transaction_date: string;
  }>;
  attendances: Array<Record<string, unknown>>;
  bills: Array<{
    id: string;
    title?: string | null;
    billing_month?: number | null;
    billing_year?: number | null;
    amount: number;
    original_amount?: number | null;
    discount_amount?: number | null;
    is_sibling_exempt?: boolean | null;
    notes?: string | null;
    paid_amount?: number | null;
    status: string;
    due_date?: string | null;
    fee_type?: { name?: string | null; category?: string | null } | null;
  }>;
  payments: Array<{
    id: string;
    bill_id: string;
    amount_paid?: number;
    amount?: number;
    payment_date: string;
    payment_method?: string | null;
    receipt_number?: string | null;
    reference_number?: string | null;
  }>;
  honorariums: Array<Record<string, unknown>>;
  bkRecords: Array<{
    id: string;
    incident_date: string;
    record_type: string;
    title?: string | null;
    description: string;
    follow_up?: string | null;
    counselor?: { full_name?: string | null } | null;
  }>;
  examRooms: Array<{
    id: string;
    seat_number?: string | null;
    exam_room?: {
      room_name?: string | null;
      period?: { name?: string | null; start_date?: string | null; end_date?: string | null } | null;
    } | null;
  }>;
  guruWaliTeacher?: { full_name?: string | null } | null;
  guruWaliLogs?: Array<{
    id: string;
    mentoring_date: string;
    topic: string;
    aspect?: string | null;
    notes: string;
    recommendation?: string | null;
    assignment?: {
      teacher?: { full_name?: string | null } | null;
    } | null;
  }>;
}

export function PersonalEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card rounded-3xl p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-2 min-w-0">
      {icon}
      <h3 className="text-sm font-bold text-slate-800 break-words">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md leading-relaxed break-words">{description}</p>
    </div>
  );
}

export function PersonalStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50/70 text-rose-900'
          : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 min-w-0 ${toneClass}`}>
      <p className="text-[11px] font-semibold opacity-75 uppercase truncate">{label}</p>
      <p className="text-xl sm:text-2xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  );
}
