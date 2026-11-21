'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/rbac';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { DigitalStudentCard } from '@/components/portal/cards/digital-card-viewer';

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  gender?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  address?: string | null;
  entry_year?: number | null;
  status?: string | null;
  photo_url?: string | null;
  qr_token?: string | null;
}

interface LetterRow {
  id: string;
  direction: string;
  category: string;
  letter_number: string;
  letter_date: string;
  subject: string;
  counterparty: string | null;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type LetterCategory =
  | 'SURAT_KETERANGAN_AKTIF'
  | 'SURAT_MUTASI'
  | 'SURAT_TUGAS'
  | 'SURAT_UNDANGAN'
  | 'SURAT_EDARAN'
  | 'LAINNYA';

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PersuratanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.PERSURATAN_MANAGE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [selectedCardStudentId, setSelectedCardStudentId] = useState('');
  const [letterSearch, setLetterSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');

  const [letterForm, setLetterForm] = useState(() => ({
    direction: 'KELUAR' as 'MASUK' | 'KELUAR',
    category: 'SURAT_KETERANGAN_AKTIF' as LetterCategory,
    letter_number: '',
    letter_date: getTodayIsoDate(),
    subject: '',
    counterparty: '',
  }));

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

  const fetchPersuratanData = useCallback(async () => {
    const [biRes, surRes] = await Promise.all([
      fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
      fetch('/api/layanan/persuratan', { cache: 'no-store' }),
    ]);

    const bi = await biRes.json().catch(() => null);
    const sur = await surRes.json().catch(() => null);

    if (!surRes.ok || !sur) {
      throw new Error(sur?.error || 'Gagal memuat arsip persuratan dari server.');
    }
    if (!biRes.ok || !bi) {
      throw new Error(bi?.error || 'Gagal memuat data siswa untuk kartu pelajar.');
    }

    return {
      students: (bi.students || []) as StudentOpt[],
      letters: (sur.letters || []) as LetterRow[],
    };
  }, []);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const data = await fetchPersuratanData();
        setStudents(data.students);
        setLetters(data.letters);
        setLoadError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data persuratan.';
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
    [fetchPersuratanData, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPersuratanData();
        if (!cancelled) {
          setStudents(data.students);
          setLetters(data.letters);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data persuratan.'
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
  }, [fetchPersuratanData]);

  async function postLetter(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || submitting) return;

    const trimmedNumber = letterForm.letter_number.trim();
    const trimmedSubject = letterForm.subject.trim();
    const trimmedCounterparty = letterForm.counterparty.trim();

    if (trimmedNumber.length < 2) {
      showToast('Nomor surat minimal 2 karakter.', 'error');
      return;
    }
    if (trimmedSubject.length < 3) {
      showToast('Perihal / subjek surat minimal 3 karakter.', 'error');
      return;
    }
    if (!letterForm.letter_date) {
      showToast('Tanggal surat wajib diisi.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/layanan/persuratan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...letterForm,
          letter_number: trimmedNumber,
          subject: trimmedSubject,
          counterparty: trimmedCounterparty || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || 'Gagal menyimpan arsip surat.', 'error');
        return;
      }
      showToast('Arsip surat berhasil disimpan.', 'success');
      setLetterForm((prev) => ({
        ...prev,
        letter_number: '',
        subject: '',
        counterparty: '',
      }));
      await loadData('refresh');
    } catch {
      showToast('Koneksi ke server terputus. Silakan coba lagi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const letterSummary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    for (const l of letters) {
      if (l.direction === 'MASUK') masuk += 1;
      else if (l.direction === 'KELUAR') keluar += 1;
    }
    return { masuk, keluar };
  }, [letters]);

  const filteredLetters = useMemo(() => {
    const q = letterSearch.trim().toLowerCase();
    return letters.filter((l) => {
      if (directionFilter !== 'ALL' && l.direction !== directionFilter) return false;
      if (q) {
        const haystack = `${l.letter_number} ${l.subject} ${l.counterparty || ''} ${l.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [directionFilter, letterSearch, letters]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass-card rounded-3xl p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Memuat persuratan &amp; kartu pelajar...</span>
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
          <h1 className="text-base font-bold text-slate-900">Gagal Memuat Layanan Persuratan</h1>
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

  const cardStudent = students.find((s) => s.id === selectedCardStudentId) || students[0];

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

      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Layanan Persuratan &amp; Kartu Pelajar Digital</span>
            </h1>
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3 h-3" /> Mode Lihat Saja
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Kelola arsip surat masuk dan keluar serta pratinjau/unduh kartu pelajar digital siswa.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px]">
            <span className="text-slate-500">Keluar: </span>
            <span className="font-bold text-emerald-800">{letterSummary.keluar}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[11px]">
            <span className="text-slate-500">Masuk: </span>
            <span className="font-bold text-sky-800">{letterSummary.masuk}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData('refresh')}
            disabled={refreshing || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            title="Muat ulang data persuratan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-6">
          {canManage && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-slate-900">Catat Surat Masuk / Keluar</h2>
                <p className="text-[11px] text-slate-500">
                  Isi detail surat untuk mencatat ke dalam buku arsip digital.
                </p>
              </div>

              <form onSubmit={postLetter} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="letter-direction"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Arah Surat
                    </label>
                    <select
                      id="letter-direction"
                      disabled={submitting}
                      value={letterForm.direction}
                      onChange={(e) =>
                        setLetterForm({
                          ...letterForm,
                          direction: e.target.value as 'MASUK' | 'KELUAR',
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="KELUAR">Surat Keluar</option>
                      <option value="MASUK">Surat Masuk</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="letter-category"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Kategori Surat
                    </label>
                    <select
                      id="letter-category"
                      disabled={submitting}
                      value={letterForm.category}
                      onChange={(e) =>
                        setLetterForm({
                          ...letterForm,
                          category: e.target.value as LetterCategory,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    >
                      <option value="SURAT_KETERANGAN_AKTIF">Ket. Siswa Aktif</option>
                      <option value="SURAT_MUTASI">Surat Mutasi</option>
                      <option value="SURAT_TUGAS">Surat Tugas Guru</option>
                      <option value="SURAT_UNDANGAN">Surat Undangan</option>
                      <option value="SURAT_EDARAN">Surat Edaran</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="letter-number"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Nomor Surat
                    </label>
                    <input
                      id="letter-number"
                      required
                      minLength={2}
                      disabled={submitting}
                      placeholder="cth: 045/MA-N/XI/2026"
                      value={letterForm.letter_number}
                      onChange={(e) =>
                        setLetterForm({ ...letterForm, letter_number: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="letter-date"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Tanggal Surat
                    </label>
                    <input
                      id="letter-date"
                      type="date"
                      required
                      disabled={submitting}
                      value={letterForm.letter_date}
                      onChange={(e) =>
                        setLetterForm({ ...letterForm, letter_date: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="letter-subject"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Perihal / Subjek Surat
                  </label>
                  <input
                    id="letter-subject"
                    required
                    minLength={3}
                    disabled={submitting}
                    placeholder="Perihal / Subjek Surat"
                    value={letterForm.subject}
                    onChange={(e) => setLetterForm({ ...letterForm, subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="letter-counterparty"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    {letterForm.direction === 'MASUK'
                      ? 'Pengirim / Instansi Asal (Opsional)'
                      : 'Tujuan / Penerima (Opsional)'}
                  </label>
                  <input
                    id="letter-counterparty"
                    disabled={submitting}
                    placeholder={
                      letterForm.direction === 'MASUK' ? 'Nama pengirim / instansi' : 'Tujuan surat'
                    }
                    value={letterForm.counterparty}
                    onChange={(e) => setLetterForm({ ...letterForm, counterparty: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Arsip Surat</span>
                </button>
              </form>
            </div>
          )}

          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Kartu Pelajar Digital</span>
            </h2>

            {students.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                Belum ada data siswa terdaftar untuk pratinjau kartu pelajar.
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label htmlFor="card-student-select" className="sr-only">
                    Pilih siswa untuk kartu pelajar digital
                  </label>
                  <select
                    id="card-student-select"
                    value={selectedCardStudentId}
                    onChange={(e) => setSelectedCardStudentId(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  >
                    <option value="">-- Pilih Siswa (Default: Siswa Pertama) --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {s.nis ? `(${s.nis})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {cardStudent && <DigitalStudentCard student={cardStudent} />}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Arsip Surat Digital ({filteredLetters.length})
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'KELUAR', label: 'Keluar' },
                  { key: 'MASUK', label: 'Masuk' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDirectionFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    directionFilter === tab.key
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
            <label htmlFor="letter-search" className="sr-only">
              Cari arsip surat
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="letter-search"
              type="search"
              value={letterSearch}
              onChange={(e) => setLetterSearch(e.target.value)}
              placeholder="Cari nomor surat, perihal, kategori, atau tujuan..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {filteredLetters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {letters.length === 0
                  ? 'Belum ada arsip surat tercatat.'
                  : 'Tidak ada arsip surat yang cocok dengan filter pencarian.'}
              </p>
              {(letterSearch || directionFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setLetterSearch('');
                    setDirectionFilter('ALL');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Reset pencarian &amp; filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-0.5">
              {filteredLetters.map((l) => (
                <div
                  key={l.id}
                  className="modular-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          l.direction === 'MASUK'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {l.direction}
                      </span>
                      <span className="font-mono font-bold text-slate-800 break-all">
                        {l.letter_number}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm break-words">{l.subject}</p>
                    <p className="text-[11px] text-slate-500 break-words">
                      {l.category.replace(/_/g, ' ')} • {l.counterparty || '-'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500">
                    {l.letter_date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
