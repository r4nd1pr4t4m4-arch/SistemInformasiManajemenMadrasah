'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  RotateCcw,
  Search,
  Send,
  Settings,
  X,
} from 'lucide-react';

interface MessageRow {
  id: string;
  recipient_role: string;
  subject: string;
  message: string;
  reply_text: string | null;
  status: string;
  created_at: string;
  student?: { full_name: string; nis?: string | null } | null;
}

interface LeaveReqRow {
  id: string;
  leave_date: string;
  leave_type: string;
  reason: string;
  attachment_url: string | null;
  status: string;
  created_at?: string;
  student?: { full_name: string; nis?: string | null } | null;
}

const ITEMS_PER_PAGE = 8;

const INPUT_CLASS =
  'w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:opacity-60';

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

function formatDateTimeId(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnlyId(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Wali Kelas';
  return role.replace(/_/g, ' ');
}

export default function KomunikasiPage() {
  const [tab, setTab] = useState<'PESAN' | 'IZIN' | 'WA'>('PESAN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [hasWaEnvToken, setHasWaEnvToken] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showComposeForm, setShowComposeForm] = useState(false);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReqRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; nis?: string | null }>>([]);

  // Pencarian, Filter Status & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [replyModal, setReplyModal] = useState<{
    id: string;
    subject: string;
    originalMessage: string;
    studentName: string;
    replyText: string;
  } | null>(null);

  const [msgForm, setMsgForm] = useState({
    student_id: '',
    recipient_role: 'WALI_KELAS',
    subject: '',
    message: '',
  });
  const [leaveForm, setLeaveForm] = useState(() => ({
    student_id: '',
    leave_date: getTodayWibIso(),
    leave_type: 'SAKIT',
    reason: '',
    attachment_url: '',
  }));
  const [waForm, setWaForm] = useState({
    provider: 'DISABLED',
    api_url: '',
    is_enabled: false,
    notify_alpha: true,
    notify_spp: true,
    notify_ppdb: true,
    notify_qr_arrival: true,
  });

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/komunikasi', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        setLoadError(data.error || 'Gagal memuat data komunikasi.');
      } else {
        const nextStudents: Array<{ id: string; full_name: string; nis?: string | null }> =
          Array.isArray(data.students) ? data.students : [];
        setIsAdmin(Boolean(data.isAdmin));
        setIsStaff(Boolean(data.isStaff));
        setHasWaEnvToken(Boolean(data.hasWaEnvToken));
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setLeaveRequests(Array.isArray(data.leaveRequests) ? data.leaveRequests : []);
        setStudents(nextStudents);

        // Auto-pilih siswa jika akun hanya terhubung ke 1 siswa/anak
        if (nextStudents.length === 1) {
          const onlyId = nextStudents[0].id;
          setMsgForm((prev) => (prev.student_id ? prev : { ...prev, student_id: onlyId }));
          setLeaveForm((prev) => (prev.student_id ? prev : { ...prev, student_id: onlyId }));
        }

        if (data.waConfig) {
          setWaForm({
            provider: data.waConfig.provider || 'DISABLED',
            api_url: data.waConfig.api_url || '',
            is_enabled: Boolean(data.waConfig.is_enabled),
            notify_alpha: Boolean(data.waConfig.notify_alpha),
            notify_spp: Boolean(data.waConfig.notify_spp),
            notify_ppdb: Boolean(data.waConfig.notify_ppdb),
            notify_qr_arrival: Boolean(data.waConfig.notify_qr_arrival),
          });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  useEffect(() => {
    if (!replyModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setReplyModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replyModal, busy]);

  async function postComm(payload: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/komunikasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses permintaan.', 'err');
        return false;
      }
      showToast(msg);
      await loadData();
      return true;
    } catch {
      showToast('Terjadi kesalahan jaringan saat memproses permintaan.', 'err');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!msgForm.student_id) {
      showToast('Silakan pilih siswa / anak terlebih dahulu.', 'err');
      return;
    }
    const trimmedSubject = msgForm.subject.trim();
    const trimmedMessage = msgForm.message.trim();
    if (trimmedSubject.length < 3) {
      showToast('Perihal / topik konsultasi minimal 3 karakter.', 'err');
      return;
    }
    if (trimmedMessage.length < 5) {
      showToast('Isi pesan konsultasi minimal 5 karakter.', 'err');
      return;
    }
    const ok = await postComm(
      {
        action: 'SEND_MESSAGE',
        student_id: msgForm.student_id,
        recipient_role: msgForm.recipient_role,
        subject: trimmedSubject,
        message: trimmedMessage,
      },
      'Pesan konsultasi berhasil dikirim.'
    );
    if (ok) {
      setMsgForm((p) => ({ ...p, subject: '', message: '' }));
      setShowComposeForm(false);
      setCurrentPage(1);
    }
  }

  async function handleSubmitQuickLeave(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!leaveForm.student_id) {
      showToast('Silakan pilih siswa / anak terlebih dahulu.', 'err');
      return;
    }
    const trimmedReason = leaveForm.reason.trim();
    const trimmedAttachment = leaveForm.attachment_url.trim();
    if (trimmedReason.length < 3) {
      showToast('Keterangan izin minimal 3 karakter.', 'err');
      return;
    }
    if (trimmedAttachment && !isSafeUrl(trimmedAttachment)) {
      showToast('URL lampiran harus diawali http://, https://, atau /.', 'err');
      return;
    }
    const ok = await postComm(
      {
        action: 'SUBMIT_QUICK_LEAVE',
        student_id: leaveForm.student_id,
        leave_date: leaveForm.leave_date,
        leave_type: leaveForm.leave_type,
        reason: trimmedReason,
        attachment_url: trimmedAttachment || null,
      },
      'Permohonan izin tidak masuk berhasil dikirim ke Wali Kelas.'
    );
    if (ok) {
      setLeaveForm((p) => ({ ...p, reason: '', attachment_url: '' }));
      setShowComposeForm(false);
      setCurrentPage(1);
    }
  }

  async function handleSaveWaConfig(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedApiUrl = waForm.api_url.trim();
    if (trimmedApiUrl && !/^https?:\/\//i.test(trimmedApiUrl)) {
      showToast('Endpoint URL harus diawali http:// atau https://.', 'err');
      return;
    }
    await postComm(
      { action: 'SAVE_WA_CONFIG', ...waForm, api_url: trimmedApiUrl },
      'Pengaturan WhatsApp Gateway berhasil disimpan.'
    );
  }

  async function handleSubmitReply(e: FormEvent) {
    e.preventDefault();
    if (!replyModal || busy) return;
    const reply = replyModal.replyText.trim();
    if (reply.length < 3) {
      showToast('Isi balasan konsultasi minimal 3 karakter.', 'err');
      return;
    }
    const ok = await postComm(
      { action: 'REPLY_MESSAGE', id: replyModal.id, reply_text: reply },
      'Balasan konsultasi berhasil dikirim.'
    );
    if (ok) setReplyModal(null);
  }

  const pendingMessagesCount = useMemo(
    () => messages.filter((m) => !m.reply_text && m.status !== 'DIBALAS').length,
    [messages]
  );
  const pendingLeavesCount = useMemo(
    () => leaveRequests.filter((l) => l.status === 'MENUNGGU').length,
    [leaveRequests]
  );

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (m.subject || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q) ||
        (m.reply_text || '').toLowerCase().includes(q) ||
        (m.student?.full_name || '').toLowerCase().includes(q)
      );
    });
  }, [messages, searchQuery, statusFilter]);

  const filteredLeaves = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leaveRequests.filter((lr) => {
      if (statusFilter !== 'ALL' && lr.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (lr.student?.full_name || '').toLowerCase().includes(q) ||
        (lr.reason || '').toLowerCase().includes(q) ||
        (lr.leave_type || '').toLowerCase().includes(q) ||
        (lr.leave_date || '').includes(q)
      );
    });
  }, [leaveRequests, searchQuery, statusFilter]);

  const activeListCount = tab === 'PESAN' ? filteredMessages.length : filteredLeaves.length;
  const totalPages = Math.max(1, Math.ceil(activeListCount / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;

  const paginatedMessages = filteredMessages.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const paginatedLeaves = filteredLeaves.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const hasActiveFilter = searchQuery.trim().length > 0 || statusFilter !== 'ALL';

  function switchTab(nextTab: 'PESAN' | 'IZIN' | 'WA') {
    setTab(nextTab);
    setStatusFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
    setShowComposeForm(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed top-20 left-3 right-3 sm:left-auto sm:right-6 z-[60] sm:max-w-md p-3.5 sm:p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/95 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="[overflow-wrap:anywhere] leading-relaxed">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-4 sm:p-6 space-y-5 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                Komunikasi Orang Tua ↔ Guru &amp; Izin Cepat
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Kanal konsultasi terstruktur, permohonan izin tidak masuk cepat anak, serta konfigurasi WhatsApp Gateway.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tab !== 'WA' && (
              <button
                type="button"
                onClick={() => setShowComposeForm((prev) => !prev)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  showComposeForm
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                }`}
              >
                {showComposeForm ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Tutup Form
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{tab === 'PESAN' ? 'Tulis Konsultasi' : 'Ajukan Izin Cepat'}</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadData()}
              aria-label="Segarkan data komunikasi"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Tab Navigasi Responsif */}
        <div
          role="tablist"
          aria-label="Menu Komunikasi"
          className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'PESAN'}
            onClick={() => switchTab('PESAN')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition mb-2 ${
              tab === 'PESAN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Konsultasi</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                tab === 'PESAN' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {messages.length}
            </span>
            {isStaff && pendingMessagesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold tabular-nums">
                {pendingMessagesCount} baru
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'IZIN'}
            onClick={() => switchTab('IZIN')}
            className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition mb-2 ${
              tab === 'IZIN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <CalendarOff className="w-3.5 h-3.5 shrink-0" />
            <span>Izin Cepat</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                tab === 'IZIN' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {leaveRequests.length}
            </span>
            {isStaff && pendingLeavesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold tabular-nums">
                {pendingLeavesCount} tunggu
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'WA'}
              onClick={() => switchTab('WA')}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition mb-2 ${
                tab === 'WA'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp Gateway</span>
            </button>
          )}
        </div>

        {/* Toolbar Pencarian & Filter Status (Tab PESAN & IZIN) */}
        {tab !== 'WA' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  tab === 'PESAN'
                    ? 'Cari nama siswa, perihal, atau isi konsultasi...'
                    : 'Cari nama siswa, alasan, atau tanggal izin...'
                }
                aria-label="Cari data komunikasi"
                className="w-full min-h-[40px] rounded-xl border border-slate-300/90 bg-white pl-9 pr-9 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter status"
                className="flex-1 sm:flex-none min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Semua Status</option>
                {tab === 'PESAN' ? (
                  <>
                    <option value="TERKIRIM">Belum Dibalas</option>
                    <option value="DIBALAS">Sudah Dibalas</option>
                  </>
                ) : (
                  <>
                    <option value="MENUNGGU">Menunggu</option>
                    <option value="DISETUJUI">Disetujui</option>
                    <option value="DITOLAK">Ditolak</option>
                  </>
                )}
              </select>

              {hasActiveFilter && (
                <button
                  type="button"
                  title="Reset filter"
                  aria-label="Reset filter"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shrink-0 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB PESAN KONSULTASI ==================== */}
        {tab === 'PESAN' && (
          <div className="space-y-4 text-xs">
            {(showComposeForm || (!loading && messages.length === 0)) && (
              <form
                onSubmit={handleSendMessage}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Kirim Pesan Konsultasi Baru</h2>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowComposeForm(false)}
                      aria-label="Tutup form konsultasi"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {students.length === 0 && !loading && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Belum ada data siswa yang terhubung dengan akun Anda.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    required
                    disabled={busy || students.length === 0}
                    value={msgForm.student_id}
                    onChange={(e) => setMsgForm({ ...msgForm, student_id: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Pilih Siswa / Anak * --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                        {s.nis ? ` (${s.nis})` : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={busy}
                    value={msgForm.recipient_role}
                    onChange={(e) => setMsgForm({ ...msgForm, recipient_role: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="WALI_KELAS">Tujuan: Wali Kelas</option>
                    <option value="GURU_WALI">Tujuan: Guru Wali / Tahfidz</option>
                    <option value="GURU_BK">Tujuan: Guru BK</option>
                  </select>
                  <input
                    required
                    minLength={3}
                    disabled={busy}
                    value={msgForm.subject}
                    onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                    placeholder="Perihal / Topik Konsultasi (min. 3 karakter) *"
                    className={`sm:col-span-2 ${INPUT_CLASS}`}
                  />
                  <textarea
                    required
                    minLength={5}
                    rows={3}
                    disabled={busy}
                    value={msgForm.message}
                    onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                    placeholder="Tuliskan pesan konsultasi Anda (min. 5 karakter)..."
                    className="sm:col-span-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy || students.length === 0}
                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Kirim Pesan
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {loading && messages.length === 0 ? (
                <div className="space-y-3 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-slate-100 border border-slate-200/70" />
                  ))}
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-2">
                  <MessageSquare className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">
                    {messages.length === 0
                      ? 'Belum ada pesan konsultasi.'
                      : 'Tidak ada pesan yang cocok dengan filter.'}
                  </p>
                </div>
              ) : (
                paginatedMessages.map((m) => {
                  const isReplied = Boolean(m.reply_text) || m.status === 'DIBALAS';
                  const createdLabel = formatDateTimeId(m.created_at);
                  return (
                    <article
                      key={m.id}
                      className="modular-card rounded-2xl p-4 sm:p-5 space-y-3 border border-slate-200/80 min-w-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold text-[10px]">
                              {formatRoleLabel(m.recipient_role)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                isReplied
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200/70'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                              }`}
                            >
                              {isReplied ? 'Dibalas' : 'Menunggu Balasan'}
                            </span>
                            {createdLabel && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3 shrink-0" /> {createdLabel}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                            {m.subject}{' '}
                            <span className="font-semibold text-emerald-700">
                              • {m.student?.full_name || 'Siswa'}
                            </span>
                          </h3>
                        </div>
                      </div>

                      <p className="text-slate-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                        {m.message}
                      </p>

                      {m.reply_text ? (
                        <div className="rounded-xl bg-emerald-50/75 border border-emerald-200/80 p-3.5 text-emerald-950 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              Balasan Guru / Petugas
                            </p>
                            {isStaff && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setReplyModal({
                                    id: m.id,
                                    subject: m.subject,
                                    originalMessage: m.message,
                                    studentName: m.student?.full_name || 'Siswa',
                                    replyText: m.reply_text || '',
                                  })
                                }
                                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                              >
                                Ubah Balasan
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-line [overflow-wrap:anywhere] leading-relaxed">
                            {m.reply_text}
                          </p>
                        </div>
                      ) : (
                        isStaff && (
                          <div className="pt-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setReplyModal({
                                  id: m.id,
                                  subject: m.subject,
                                  originalMessage: m.message,
                                  studentName: m.student?.full_name || 'Siswa',
                                  replyText: '',
                                })
                              }
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                            >
                              <Reply className="w-3.5 h-3.5" /> Balas Pesan
                            </button>
                          </div>
                        )
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB IZIN CEPAT ==================== */}
        {tab === 'IZIN' && (
          <div className="space-y-4 text-xs">
            {(showComposeForm || (!loading && leaveRequests.length === 0)) && (
              <form
                onSubmit={handleSubmitQuickLeave}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Ajukan Izin Tidak Masuk Cepat</h2>
                  {leaveRequests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowComposeForm(false)}
                      aria-label="Tutup form izin cepat"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {students.length === 0 && !loading && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Belum ada data siswa yang terhubung dengan akun Anda.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <select
                    required
                    disabled={busy || students.length === 0}
                    value={leaveForm.student_id}
                    onChange={(e) => setLeaveForm({ ...leaveForm, student_id: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Pilih Anak / Siswa * --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                        {s.nis ? ` (${s.nis})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    required
                    disabled={busy}
                    value={leaveForm.leave_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_date: e.target.value })}
                    aria-label="Tanggal izin"
                    className={INPUT_CLASS}
                  />
                  <select
                    disabled={busy}
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="SAKIT">Sakit</option>
                    <option value="IZIN">Izin Keperluan Keluarga</option>
                  </select>
                  <input
                    required
                    minLength={3}
                    disabled={busy}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Keterangan singkat (min. 3 karakter) *"
                    className={INPUT_CLASS}
                  />
                  <input
                    type="text"
                    inputMode="url"
                    disabled={busy}
                    value={leaveForm.attachment_url}
                    onChange={(e) => setLeaveForm({ ...leaveForm, attachment_url: e.target.value })}
                    placeholder="URL Foto Surat Dokter / Izin (https://... atau /... — Opsional)"
                    className={`sm:col-span-2 lg:col-span-3 ${INPUT_CLASS}`}
                  />
                  <button
                    type="submit"
                    disabled={busy || students.length === 0}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Kirim Izin Cepat
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {loading && leaveRequests.length === 0 ? (
                <div className="space-y-2.5 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-slate-100 border border-slate-200/70" />
                  ))}
                </div>
              ) : filteredLeaves.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center space-y-2">
                  <CalendarOff className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">
                    {leaveRequests.length === 0
                      ? 'Belum ada permohonan izin cepat.'
                      : 'Tidak ada permohonan izin yang cocok dengan filter.'}
                  </p>
                </div>
              ) : (
                paginatedLeaves.map((lr) => (
                  <article
                    key={lr.id}
                    className="modular-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80 min-w-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            lr.leave_type === 'SAKIT'
                              ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                              : 'bg-sky-50 text-sky-700 border-sky-200/70'
                          }`}
                        >
                          {lr.leave_type}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            lr.status === 'DISETUJUI'
                              ? 'bg-emerald-100 text-emerald-800'
                              : lr.status === 'DITOLAK'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {lr.status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {formatDateOnlyId(lr.leave_date)}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                        {lr.student?.full_name || 'Siswa'}
                      </h3>
                      <p className="text-slate-600 leading-relaxed [overflow-wrap:anywhere]">
                        {lr.reason}
                      </p>

                      {isSafeUrl(lr.attachment_url) && (
                        <a
                          href={lr.attachment_url!.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold hover:underline pt-0.5"
                        >
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span>Lihat Lampiran Surat</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>

                    {isStaff && lr.status === 'MENUNGGU' && (
                      <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void postComm(
                              { action: 'REVIEW_QUICK_LEAVE', id: lr.id, status: 'DISETUJUI' },
                              'Izin disetujui & absensi siswa otomatis diperbarui!'
                            )
                          }
                          className="flex-1 sm:flex-none min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                        >
                          <Check className="w-3.5 h-3.5" /> Setujui
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void postComm(
                              { action: 'REVIEW_QUICK_LEAVE', id: lr.id, status: 'DITOLAK' },
                              'Permohonan izin ditolak.'
                            )
                          }
                          className="flex-1 sm:flex-none min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-semibold transition"
                        >
                          <X className="w-3.5 h-3.5" /> Tolak
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB WHATSAPP GATEWAY ==================== */}
        {tab === 'WA' && isAdmin && (
          <form onSubmit={handleSaveWaConfig} className="space-y-4 max-w-2xl text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-600">
                Status Environment Token (<code className="font-mono">WHATSAPP_GATEWAY_TOKEN</code>)
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  hasWaEnvToken
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {hasWaEnvToken ? 'Terdeteksi di Server' : 'Belum Diatur di .env / Vercel'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="wa-provider" className="block font-semibold text-slate-700 mb-1.5">
                  Provider Gateway
                </label>
                <select
                  id="wa-provider"
                  disabled={busy}
                  value={waForm.provider}
                  onChange={(e) => setWaForm({ ...waForm, provider: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="DISABLED">Nonaktif</option>
                  <option value="FONNTE">Fonnte</option>
                  <option value="WABLAS">Wablas</option>
                  <option value="WA_CLOUD">Meta WhatsApp Cloud API</option>
                </select>
              </div>
              <div>
                <label htmlFor="wa-endpoint" className="block font-semibold text-slate-700 mb-1.5">
                  Endpoint URL (Opsional)
                </label>
                <input
                  id="wa-endpoint"
                  type="text"
                  inputMode="url"
                  disabled={busy}
                  value={waForm.api_url}
                  onChange={(e) => setWaForm({ ...waForm, api_url: e.target.value })}
                  placeholder="https://api.fonnte.com/send"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              {(
                [
                  ['is_enabled', 'Aktifkan Pengiriman WhatsApp Gateway'],
                  ['notify_alpha', 'Kirim WA saat Siswa Alpa'],
                  ['notify_spp', 'Kirim WA Pengingat Tunggakan SPP'],
                  ['notify_ppdb', 'Kirim WA Perubahan Status PPDB'],
                  ['notify_qr_arrival', 'Kirim WA Real-Time saat Siswa Scan QR Gerbang'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 py-1 font-semibold text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={Boolean(waForm[key])}
                    onChange={(e) => setWaForm({ ...waForm, [key]: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 accent-emerald-600 shrink-0"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Pengaturan WhatsApp Gateway
            </button>
          </form>
        )}

        {/* Pagination untuk Tab PESAN & IZIN */}
        {tab !== 'WA' && totalPages > 1 && (
          <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              Hal. {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 transition"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal Balas Konsultasi */}
      {replyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comm-reply-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setReplyModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h2
                  id="comm-reply-modal-title"
                  className="text-base font-bold text-slate-900 [overflow-wrap:anywhere]"
                >
                  Balas Konsultasi — {replyModal.subject}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Siswa: {replyModal.studentName}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReplyModal(null)}
                aria-label="Tutup modal"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReply} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pesan Asli
                </p>
                <p className="text-xs text-slate-700 whitespace-pre-line [overflow-wrap:anywhere] leading-relaxed">
                  {replyModal.originalMessage}
                </p>
              </div>

              <div>
                <label
                  htmlFor="comm-reply-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Isi Balasan Konsultasi <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="comm-reply-input"
                  required
                  minLength={3}
                  rows={4}
                  disabled={busy}
                  value={replyModal.replyText}
                  onChange={(e) =>
                    setReplyModal((prev) => (prev ? { ...prev, replyText: e.target.value } : null))
                  }
                  placeholder="Tuliskan tanggapan atau arahan untuk orang tua / siswa (min. 3 karakter)..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReplyModal(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Kirim Balasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
