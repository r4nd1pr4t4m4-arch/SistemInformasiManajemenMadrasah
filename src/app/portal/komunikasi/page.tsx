'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
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
  student?: { full_name: string } | null;
}

interface LeaveReqRow {
  id: string;
  leave_date: string;
  leave_type: string;
  reason: string;
  attachment_url: string | null;
  status: string;
  student?: { full_name: string } | null;
}

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

export default function KomunikasiPage() {
  const [tab, setTab] = useState<'PESAN' | 'IZIN' | 'WA'>('PESAN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [hasWaEnvToken, setHasWaEnvToken] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReqRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);

  const [replyModal, setReplyModal] = useState<{
    id: string;
    subject: string;
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
        setIsAdmin(Boolean(data.isAdmin));
        setIsStaff(Boolean(data.isStaff));
        setHasWaEnvToken(Boolean(data.hasWaEnvToken));
        setMessages(data.messages || []);
        setLeaveRequests(data.leaveRequests || []);
        setStudents(data.students || []);
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

  async function handleSubmitReply(e: FormEvent) {
    e.preventDefault();
    if (!replyModal) return;
    const reply = replyModal.replyText.trim();
    if (!reply) {
      showToast('Balasan konsultasi tidak boleh kosong.', 'err');
      return;
    }
    const ok = await postComm(
      { action: 'REPLY_MESSAGE', id: replyModal.id, reply_text: reply },
      'Balasan konsultasi berhasil dikirim.'
    );
    if (ok) setReplyModal(null);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
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
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Komunikasi Orang Tua ↔ Guru, Izin Cepat &amp; WhatsApp Gateway</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kanal konsultasi terstruktur, permohonan izin tidak masuk cepat anak, serta konfigurasi WhatsApp Gateway.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab('PESAN')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'PESAN'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Konsultasi ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('IZIN')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'IZIN'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CalendarOff className="w-3.5 h-3.5" /> Izin Tidak Masuk Cepat ({leaveRequests.length})
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab('WA')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                tab === 'WA'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> WhatsApp Gateway
            </button>
          )}
        </div>

        {tab === 'PESAN' && (
          <div className="space-y-4 text-xs">
            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                const ok = await postComm({ action: 'SEND_MESSAGE', ...msgForm }, 'Pesan konsultasi berhasil dikirim.');
                if (ok) setMsgForm((p) => ({ ...p, subject: '', message: '' }));
              }}
              className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
            >
              <select
                required
                value={msgForm.student_id}
                onChange={(e) => setMsgForm({ ...msgForm, student_id: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="">-- Pilih Siswa / Anak --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <select
                value={msgForm.recipient_role}
                onChange={(e) => setMsgForm({ ...msgForm, recipient_role: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="WALI_KELAS">Tujuan: Wali Kelas</option>
                <option value="GURU_WALI">Tujuan: Guru Wali / Tahfidz</option>
                <option value="GURU_BK">Tujuan: Guru BK</option>
              </select>
              <input
                required
                value={msgForm.subject}
                onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                placeholder="Perihal / Topik Konsultasi *"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <textarea
                required
                rows={2}
                value={msgForm.message}
                onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                placeholder="Tuliskan pesan Anda..."
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Kirim Pesan
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {messages.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat pesan konsultasi...' : 'Belum ada pesan konsultasi.'}
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] mr-2">
                          {m.recipient_role.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-900 break-words">
                          {m.subject} ({m.student?.full_name || 'Siswa'})
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] shrink-0">
                        {m.status}
                      </span>
                    </div>
                    <p className="text-slate-700 break-words">{m.message}</p>
                    {m.reply_text ? (
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-950">
                        <p className="text-[10px] font-bold uppercase text-emerald-700">Balasan Guru:</p>
                        <p className="break-words">{m.reply_text}</p>
                      </div>
                    ) : (
                      isStaff && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setReplyModal({
                              id: m.id,
                              subject: m.subject,
                              studentName: m.student?.full_name || 'Siswa',
                              replyText: '',
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                        >
                          Balas Pesan
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'IZIN' && (
          <div className="space-y-4 text-xs">
            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                const ok = await postComm(
                  { action: 'SUBMIT_QUICK_LEAVE', ...leaveForm },
                  'Permohonan izin tidak masuk berhasil dikirim ke Wali Kelas.'
                );
                if (ok) setLeaveForm((p) => ({ ...p, reason: '', attachment_url: '' }));
              }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
            >
              <select
                required
                value={leaveForm.student_id}
                onChange={(e) => setLeaveForm({ ...leaveForm, student_id: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="">-- Pilih Anak / Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                required
                value={leaveForm.leave_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <select
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              >
                <option value="SAKIT">Sakit</option>
                <option value="IZIN">Izin Keperluan Keluarga</option>
              </select>
              <input
                required
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Keterangan singkat *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <input
                type="url"
                value={leaveForm.attachment_url}
                onChange={(e) => setLeaveForm({ ...leaveForm, attachment_url: e.target.value })}
                placeholder="URL Foto Surat Dokter / Izin (Opsional)"
                className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kirim Izin Cepat
              </button>
            </form>

            <div className="space-y-2">
              {leaveRequests.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? 'Memuat daftar izin cepat...' : 'Belum ada permohonan izin cepat.'}
                </div>
              ) : (
                leaveRequests.map((lr) => (
                  <div
                    key={lr.id}
                    className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">
                        {lr.student?.full_name || 'Siswa'} — {lr.leave_type} ({lr.leave_date})
                      </p>
                      <p className="text-slate-600 break-words">{lr.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                      {isStaff && lr.status === 'MENUNGGU' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void postComm(
                                { action: 'REVIEW_QUICK_LEAVE', id: lr.id, status: 'DISETUJUI' },
                                'Izin disetujui & absensi siswa otomatis diperbarui!'
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
                          >
                            Setujui
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
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-semibold transition"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'WA' && isAdmin && (
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              await postComm({ action: 'SAVE_WA_CONFIG', ...waForm }, 'Pengaturan WhatsApp Gateway berhasil disimpan.');
            }}
            className="space-y-4 max-w-2xl text-xs"
          >
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              Status Environment Token (<code className="font-mono">WHATSAPP_GATEWAY_TOKEN</code>):{' '}
              <strong className={hasWaEnvToken ? 'text-emerald-700' : 'text-amber-700'}>
                {hasWaEnvToken ? 'Terdeteksi di Server' : 'Belum Diatur di .env / Vercel'}
              </strong>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Provider Gateway</label>
                <select
                  value={waForm.provider}
                  onChange={(e) => setWaForm({ ...waForm, provider: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                >
                  <option value="DISABLED">Nonaktif</option>
                  <option value="FONNTE">Fonnte</option>
                  <option value="WABLAS">Wablas</option>
                  <option value="WA_CLOUD">Meta WhatsApp Cloud API</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Endpoint URL (Opsional)</label>
                <input
                  value={waForm.api_url}
                  onChange={(e) => setWaForm({ ...waForm, api_url: e.target.value })}
                  placeholder="https://api.fonnte.com/send"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              {(
                [
                  ['is_enabled', 'Aktifkan Pengiriman WhatsApp Gateway'],
                  ['notify_alpha', 'Kirim WA saat Siswa Alpa'],
                  ['notify_spp', 'Kirim WA Pengingat Tunggakan SPP'],
                  ['notify_ppdb', 'Kirim WA Perubahan Status PPDB'],
                  ['notify_qr_arrival', 'Kirim WA Real-Time saat Siswa Scan QR Gerbang'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waForm[key])}
                    onChange={(e) => setWaForm({ ...waForm, [key]: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Pengaturan WhatsApp Gateway
            </button>
          </form>
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <h2 id="comm-reply-modal-title" className="text-base font-bold text-slate-900 break-words">
                  Balas Konsultasi — {replyModal.subject}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Siswa: {replyModal.studentName}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReplyModal(null)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReply} className="space-y-4">
              <div>
                <label htmlFor="comm-reply-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Isi Balasan Konsultasi *
                </label>
                <textarea
                  id="comm-reply-input"
                  required
                  rows={4}
                  value={replyModal.replyText}
                  onChange={(e) =>
                    setReplyModal((prev) => (prev ? { ...prev, replyText: e.target.value } : null))
                  }
                  placeholder="Tuliskan tanggapan atau arahan untuk orang tua / siswa..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReplyModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
