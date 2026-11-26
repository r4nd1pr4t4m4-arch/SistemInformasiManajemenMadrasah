'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Settings,
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

export default function KomunikasiPage() {
  const [tab, setTab] = useState<'PESAN' | 'IZIN' | 'WA'>('PESAN');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [hasWaEnvToken, setHasWaEnvToken] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReqRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);

  const [msgForm, setMsgForm] = useState({
    student_id: '',
    recipient_role: 'WALI_KELAS',
    subject: '',
    message: '',
  });
  const [leaveForm, setLeaveForm] = useState({
    student_id: '',
    leave_date: new Date().toISOString().slice(0, 10),
    leave_type: 'SAKIT',
    reason: '',
    attachment_url: '',
  });
  const [waForm, setWaForm] = useState({
    provider: 'DISABLED',
    api_url: '',
    is_enabled: false,
    notify_alpha: true,
    notify_spp: true,
    notify_ppdb: true,
    notify_qr_arrival: true,
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/komunikasi', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-700" />
              <span>Komunikasi Orang Tua ↔ Guru, Izin Cepat &amp; WhatsApp Gateway</span>
            </h1>
            <p className="text-xs text-slate-500">
              Kanal konsultasi terstruktur, permohonan izin tidak masuk cepat anak, serta konfigurasi WhatsApp Gateway.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab('PESAN')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
              tab === 'PESAN' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Konsultasi ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('IZIN')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
              tab === 'IZIN' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <CalendarOff className="w-3.5 h-3.5" /> Izin Tidak Masuk Cepat ({leaveRequests.length})
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab('WA')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                tab === 'WA' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
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
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <textarea
                required
                rows={2}
                value={msgForm.message}
                onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                placeholder="Tuliskan pesan Anda..."
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Kirim Pesan
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {messages.map((m) => (
                <div key={m.id} className="modular-card rounded-2xl p-4 space-y-2 border border-slate-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] mr-2">
                        {m.recipient_role.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-slate-900">
                        {m.subject} ({m.student?.full_name || 'Siswa'})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {m.status}
                    </span>
                  </div>
                  <p className="text-slate-700">{m.message}</p>
                  {m.reply_text ? (
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-950">
                      <p className="text-[10px] font-bold uppercase text-emerald-700">Balasan Guru:</p>
                      <p>{m.reply_text}</p>
                    </div>
                  ) : (
                    isStaff && (
                      <button
                        type="button"
                        onClick={async () => {
                          const reply = window.prompt('Tuliskan balasan konsultasi:');
                          if (!reply) return;
                          await postComm({ action: 'REPLY_MESSAGE', id: m.id, reply_text: reply }, 'Balasan terkirim.');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                      >
                        Balas Pesan
                      </button>
                    )
                  )}
                </div>
              ))}
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
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <select
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="SAKIT">Sakit</option>
                <option value="IZIN">Izin Keperluan Keluarga</option>
              </select>
              <input
                required
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Keterangan singkat *"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                type="url"
                value={leaveForm.attachment_url}
                onChange={(e) => setLeaveForm({ ...leaveForm, attachment_url: e.target.value })}
                placeholder="URL Foto Surat Dokter / Izin (Opsional)"
                className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Kirim Izin Cepat
              </button>
            </form>

            <div className="space-y-2">
              {leaveRequests.map((lr) => (
                <div
                  key={lr.id}
                  className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {lr.student?.full_name || 'Siswa'} — {lr.leave_type} ({lr.leave_date})
                    </p>
                    <p className="text-slate-600">{lr.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                          onClick={() =>
                            void postComm(
                              { action: 'REVIEW_QUICK_LEAVE', id: lr.id, status: 'DISETUJUI' },
                              'Izin disetujui & absensi siswa otomatis diperbarui!'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void postComm(
                              { action: 'REVIEW_QUICK_LEAVE', id: lr.id, status: 'DITOLAK' },
                              'Permohonan izin ditolak.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold"
                        >
                          Tolak
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Simpan Pengaturan WhatsApp Gateway
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
