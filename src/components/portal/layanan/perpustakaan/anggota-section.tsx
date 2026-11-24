'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  CreditCard,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { DigitalLibraryCard } from '@/components/portal/cards/digital-card-viewer';
import type {
  MemberFilter,
  MemberRow,
  PostLibFn,
  PublicMemberFormState,
  ShowToastFn,
} from './types';

interface AnggotaSectionProps {
  members: MemberRow[];
  canManage: boolean;
  canViewAllMembers: boolean;
  refreshing: boolean;
  submittingAction: string | null;
  onRefresh: () => void;
  postLib: PostLibFn;
  showToast: ShowToastFn;
}

export function AnggotaSection({
  members,
  canManage,
  canViewAllMembers,
  refreshing,
  submittingAction,
  onRefresh,
  postLib,
  showToast,
}: AnggotaSectionProps) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('ALL');
  const [publicMemberForm, setPublicMemberForm] = useState<PublicMemberFormState>({
    full_name: '',
    phone: '',
    email: '',
  });

  const memberSummary = useMemo(() => {
    let autoCount = 0;
    let umumCount = 0;
    for (const m of members) {
      if (m.is_auto_registered) autoCount += 1;
      else umumCount += 1;
    }
    return { autoCount, umumCount };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (memberFilter === 'AUTO' && !m.is_auto_registered) return false;
      if (memberFilter === 'UMUM' && m.is_auto_registered) return false;
      if (q) {
        const haystack = `${m.full_name} ${m.member_code} ${m.member_type} ${m.phone || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [memberFilter, memberSearch, members]);

  async function handleRegisterPublicMember(e: FormEvent) {
    e.preventDefault();
    if (!canManage || submittingAction) return;
    const fullName = publicMemberForm.full_name.trim();
    const phone = publicMemberForm.phone.trim();
    const email = publicMemberForm.email.trim();
    if (fullName.length < 2) {
      showToast('Nama lengkap minimal 2 karakter.', 'error');
      return;
    }
    if (phone.length < 6) {
      showToast('Nomor HP / WhatsApp minimal 6 karakter.', 'error');
      return;
    }
    const ok = await postLib(
      {
        action: 'REGISTER_PUBLIC_MEMBER',
        full_name: fullName,
        phone,
        email,
      },
      'Anggota umum E-Library berhasil didaftarkan.'
    );
    if (ok) {
      setPublicMemberForm({ full_name: '', phone: '', email: '' });
    }
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0] || null;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-700 shrink-0" />
              <span>
                {canViewAllMembers
                  ? 'Keanggotaan & Kartu E-Library'
                  : 'Kartu Anggota E-Library Saya'}
              </span>
            </h1>
            {canViewAllMembers && !canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {canViewAllMembers
              ? 'Kelola pendaftaran anggota umum E-Library serta pratinjau dan unduh kartu anggota perpustakaan digital.'
              : 'Pratinjau dan unduh kartu anggota perpustakaan digital pribadi Anda sebagai file PNG.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canViewAllMembers && (
            <>
              <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
                <span className="text-slate-500">Otomatis: </span>
                <span className="font-bold text-sky-800">{memberSummary.autoCount}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
                <span className="text-slate-500">Umum: </span>
                <span className="font-bold text-emerald-800">{memberSummary.umumCount}</span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || Boolean(submittingAction)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang data kartu anggota perpustakaan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      {canViewAllMembers && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {canManage && (
            <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Anggota Umum E-Library
                </h2>
                <p className="text-[11px] text-slate-500">
                  Warga madrasah/sekolah otomatis terdaftar saat masuk Buku Induk. Masyarakat
                  umum mendaftar di sini untuk akses e-book.
                </p>
              </div>

              <form onSubmit={handleRegisterPublicMember} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="lib-member-name"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="lib-member-name"
                    required
                    minLength={2}
                    disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                    placeholder="Nama Lengkap"
                    value={publicMemberForm.full_name}
                    onChange={(e) =>
                      setPublicMemberForm({ ...publicMemberForm, full_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="lib-member-phone"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    No. HP / WhatsApp
                  </label>
                  <input
                    id="lib-member-phone"
                    type="tel"
                    required
                    minLength={6}
                    disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                    placeholder="mis. 081234567890"
                    value={publicMemberForm.phone}
                    onChange={(e) =>
                      setPublicMemberForm({ ...publicMemberForm, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="lib-member-email"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id="lib-member-email"
                    type="email"
                    disabled={submittingAction === 'REGISTER_PUBLIC_MEMBER'}
                    placeholder="nama@email.com"
                    value={publicMemberForm.email}
                    onChange={(e) =>
                      setPublicMemberForm({ ...publicMemberForm, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={Boolean(submittingAction)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                >
                  {submittingAction === 'REGISTER_PUBLIC_MEMBER' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Daftar Anggota Umum</span>
                </button>
              </form>
            </div>
          )}

          <div
            className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'
              } glass-card rounded-3xl p-5 sm:p-6 space-y-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Kartu Anggota Perpustakaan ({filteredMembers.length})
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { key: 'ALL', label: 'Semua' },
                    { key: 'AUTO', label: 'Otomatis' },
                    { key: 'UMUM', label: 'Umum' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMemberFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${memberFilter === tab.key
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
              <label htmlFor="lib-member-search" className="sr-only">
                Cari anggota perpustakaan
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="lib-member-search"
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Cari nama, kode anggota, atau nomor HP..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            {filteredMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  {members.length === 0
                    ? 'Belum ada anggota perpustakaan terdaftar.'
                    : 'Tidak ada anggota yang cocok dengan pencarian atau filter.'}
                </p>
                {(memberSearch || memberFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberSearch('');
                      setMemberFilter('ALL');
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Reset pencarian &amp; filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-0.5">
                {filteredMembers.map((m) => {
                  const isSelected = selectedMember?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`w-full text-left modular-card rounded-xl p-3 flex items-center justify-between gap-2.5 text-xs transition border ${isSelected
                        ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-300'
                        : 'border-transparent hover:border-slate-200'
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-words">{m.full_name}</p>
                        <p className="font-mono text-[11px] text-emerald-700 break-all">
                          {m.member_code}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px]">
                        {m.member_type} {m.is_auto_registered ? '(Otomatis)' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!canViewAllMembers && members.length === 0 && (
        <div className="glass-card rounded-3xl p-8 text-center space-y-2">
          <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">
            Kartu Anggota E-Library Belum Tersedia
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Akun Anda belum terdaftar sebagai anggota perpustakaan. Hubungi Pustakawan atau Tata
            Usaha jika Anda memerlukan kartu anggota E-Library.
          </p>
        </div>
      )}

      {selectedMember && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-700 shrink-0" />
                <span>Pratinjau &amp; Unduh Kartu Perpustakaan (PNG)</span>
              </h2>
              <p className="text-xs text-slate-500">
                {canViewAllMembers
                  ? 'Klik salah satu anggota di atas untuk menampilkan kartu depan & belakangnya.'
                  : 'Gunakan tombol di bawah untuk melihat sisi depan/belakang atau mengunduh kartu Anda sebagai file PNG.'}
              </p>
            </div>
            {members.length > 1 && (
              <div className="w-full sm:w-auto min-w-0">
                <label htmlFor="lib-member-preview-select" className="sr-only">
                  Pilih anggota untuk pratinjau kartu
                </label>
                <select
                  id="lib-member-preview-select"
                  value={selectedMember.id}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full sm:w-72 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.member_code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="max-w-xl">
            <DigitalLibraryCard member={selectedMember} />
          </div>
        </div>
      )}
    </div>
  );
}
