'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileWarning,
  Home,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { usePortalSession } from '@/lib/hooks/use-portal-session';
import { PERMISSIONS } from '@/lib/auth/rbac';

interface BkSummaryRow {
  student_id: string;
  full_name: string;
  nis: string | null;
  violation_points: number;
  achievement_points: number;
  consultation_count: number;
  recommended_action: string;
}

interface BkRuleRow {
  id: string;
  code: string;
  rule_type: 'PELANGGARAN' | 'PRESTASI';
  title: string;
  default_points: number;
  sanction_hint: string | null;
}

interface BookingRow {
  id: string;
  student_id: string;
  preferred_date: string;
  topic: string;
  status: 'MENUNGGU' | 'DIJADWALKAN' | 'SELESAI' | 'DIBATALKAN';
  counselor_notes: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface HomeVisitRow {
  id: string;
  visit_date: string;
  visited_address: string | null;
  met_with: string | null;
  summary: string;
  follow_up: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

interface StudentOpt {
  id: string;
  full_name: string;
  nis: string | null;
}

export default function BkKasusLanjutanPage() {
  const { hasPermission } = usePortalSession();
  const canManage = hasPermission(PERMISSIONS.BK_MANAGE);

  const [tab, setTab] = useState<'POIN' | 'KATALOG' | 'BOOKING' | 'HOMEVISIT'>('POIN');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [summaries, setSummaries] = useState<BkSummaryRow[]>([]);
  const [catalog, setCatalog] = useState<BkRuleRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisitRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);

  const [ruleForm, setRuleForm] = useState({
    code: '',
    rule_type: 'PELANGGARAN' as 'PELANGGARAN' | 'PRESTASI',
    title: '',
    default_points: 10,
    sanction_hint: '',
  });

  const [bookingForm, setBookingForm] = useState({
    student_id: '',
    preferred_date: new Date().toISOString().slice(0, 10),
    topic: '',
  });

  const [visitForm, setVisitForm] = useState({
    student_id: '',
    visit_date: new Date().toISOString().slice(0, 10),
    visited_address: '',
    met_with: '',
    summary: '',
    follow_up: '',
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bkRes, stRes] = await Promise.all([
        fetch('/api/layanan/bk', { cache: 'no-store' }),
        fetch('/api/akademik/buku-induk', { cache: 'no-store' }),
      ]);
      const bkData = await bkRes.json().catch(() => ({}));
      const stData = await stRes.json().catch(() => ({}));
      if (bkRes.ok) {
        setSummaries(bkData.studentPointSummary || []);
        setCatalog(bkData.catalog || []);
        setBookings(bkData.bookings || []);
        setHomeVisits(bkData.homeVisits || []);
      }
      if (stRes.ok) setStudents(stData.students || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function postBk(payload: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/layanan/bk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memproses permintaan.', 'err');
        return null;
      }
      showToast(msg);
      await loadAll();
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueSp(student: BkSummaryRow, level: 'SP1' | 'SP2' | 'SP3' | 'PANGGILAN_ORTU') {
    const reason = window.prompt(
      `Masukkan alasan penerbitan ${level} untuk ${student.full_name}:`,
      `Akumulasi poin pelanggaran mencapai ${student.violation_points} poin.`
    );
    if (!reason) return;
    const res = await postBk(
      { action: 'ISSUE_SP_LETTER', student_id: student.student_id, letter_level: level, reason },
      `${level} berhasil diterbitkan ke E-Office Persuratan & notifikasi keluarga terkirim.`
    );
    if (res?.letter?.letter_number) {
      showToast(`Draf ${level} (${res.letter.letter_number}) berhasil dibuat di E-Office Persuratan.`);
    }
  }

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_RULE', ...ruleForm }, 'Aturan poin berhasil ditambahkan.');
    if (ok) setRuleForm({ code: '', rule_type: 'PELANGGARAN', title: '', default_points: 10, sanction_hint: '' });
  }

  async function handleCreateBooking(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_BOOKING', ...bookingForm }, 'Jadwal konseling berhasil dibuat.');
    if (ok) setBookingForm({ student_id: '', preferred_date: new Date().toISOString().slice(0, 10), topic: '' });
  }

  async function handleCreateVisit(e: FormEvent) {
    e.preventDefault();
    const ok = await postBk({ action: 'CREATE_HOME_VISIT', ...visitForm }, 'Laporan Home Visit berhasil disimpan.');
    if (ok) {
      setVisitForm({
        student_id: '',
        visit_date: new Date().toISOString().slice(0, 10),
        visited_address: '',
        met_with: '',
        summary: '',
        follow_up: '',
      });
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
              <ShieldAlert className="w-5 h-5 text-emerald-700" />
              <span>Manajemen Kasus BK, SP1–SP3, Konseling &amp; Home Visit</span>
            </h1>
            <p className="text-xs text-slate-500">
              Pantau akumulasi poin siswa, terbitkan SP otomatis ke Persuratan, kelola katalog tata tertib, jadwal konseling, &amp; kunjungan rumah.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'POIN', label: `Akumulasi Poin & SP (${summaries.length})`, icon: FileWarning },
              { id: 'KATALOG', label: `Katalog Tata Tertib (${catalog.length})`, icon: BookOpen },
              { id: 'BOOKING', label: `Jadwal Konseling (${bookings.length})`, icon: Calendar },
              { id: 'HOMEVISIT', label: `Home Visit (${homeVisits.length})`, icon: Home },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'POIN' && (
          <div className="space-y-3 text-xs">
            {summaries.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-500">
                Belum ada rekap poin siswa.
              </div>
            ) : (
              summaries.map((s) => (
                <div
                  key={s.student_id}
                  className="modular-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{s.full_name}</span>
                      <span className="font-mono text-[10px] text-slate-400">NIS: {s.nis || '-'}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.violation_points >= 50
                            ? 'bg-rose-100 text-rose-800'
                            : s.violation_points >= 25
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Rekomendasi: {s.recommended_action}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Pelanggaran: <strong className="text-rose-700">{s.violation_points} poin</strong> • Prestasi:{' '}
                      <strong className="text-emerald-700">+{s.achievement_points} poin</strong> • Konsultasi:{' '}
                      <strong>{s.consultation_count}x</strong>
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {(['SP1', 'SP2', 'SP3', 'PANGGILAN_ORTU'] as const).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          disabled={busy}
                          onClick={() => void handleIssueSp(s, lv)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-[11px]"
                        >
                          Terbitkan {lv.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'KATALOG' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateRule}
                className="grid sm:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Kode *</label>
                  <input
                    required
                    value={ruleForm.code}
                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                    placeholder="P-01"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Jenis *</label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, rule_type: e.target.value as 'PELANGGARAN' | 'PRESTASI' })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="PELANGGARAN">Pelanggaran</option>
                    <option value="PRESTASI">Prestasi</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">Nama Tata Tertib / Prestasi *</label>
                  <input
                    required
                    value={ruleForm.title}
                    onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                    placeholder="mis. Terlambat masuk > 15 menit"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Poin *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={ruleForm.default_points}
                    onChange={(e) => setRuleForm({ ...ruleForm, default_points: Number(e.target.value) || 5 })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {catalog.map((r) => (
                <div
                  key={r.id}
                  className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {r.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.rule_type === 'PELANGGARAN'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {r.rule_type} ({r.default_points} poin)
                    </span>
                    <span className="font-semibold text-slate-900">{r.title}</span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/layanan/bk?id=${encodeURIComponent(r.id)}&target=rule`, {
                          method: 'DELETE',
                        });
                        await loadAll();
                      }}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'BOOKING' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateBooking}
                className="grid sm:grid-cols-12 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">Siswa *</label>
                  <select
                    required
                    value={bookingForm.student_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, student_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Sesi *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.preferred_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, preferred_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Topik Konseling *</label>
                  <input
                    required
                    value={bookingForm.topic}
                    onChange={(e) => setBookingForm({ ...bookingForm, topic: e.target.value })}
                    placeholder="mis. Motivasi belajar / karir"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Jadwalkan
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {b.student?.full_name || 'Siswa'} — {b.topic}
                    </p>
                    <p className="text-[11px] text-slate-500">Tanggal: {b.preferred_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 font-bold text-[10px]">
                      {b.status}
                    </span>
                    {canManage && b.status !== 'SELESAI' && (
                      <button
                        type="button"
                        onClick={() =>
                          void postBk(
                            { action: 'UPDATE_BOOKING', id: b.id, status: 'SELESAI' },
                            'Sesi konseling ditandai selesai.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-[11px]"
                      >
                        Selesai
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'HOMEVISIT' && (
          <div className="space-y-4 text-xs">
            {canManage && (
              <form
                onSubmit={handleCreateVisit}
                className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
              >
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Siswa *</label>
                  <select
                    required
                    value={visitForm.student_id}
                    onChange={(e) => setVisitForm({ ...visitForm, student_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Kunjungan *</label>
                  <input
                    type="date"
                    required
                    value={visitForm.visit_date}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Dikunjungi</label>
                  <input
                    value={visitForm.visited_address}
                    onChange={(e) => setVisitForm({ ...visitForm, visited_address: e.target.value })}
                    placeholder="Alamat rumah orang tua/wali"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bertemu Dengan</label>
                  <input
                    value={visitForm.met_with}
                    onChange={(e) => setVisitForm({ ...visitForm, met_with: e.target.value })}
                    placeholder="mis. Ayah / Ibu Kandung"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Hasil Kunjungan / Berita Acara *</label>
                  <textarea
                    required
                    rows={2}
                    value={visitForm.summary}
                    onChange={(e) => setVisitForm({ ...visitForm, summary: e.target.value })}
                    placeholder="Ringkasan hasil kunjungan rumah..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Simpan Laporan Home Visit
                  </button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {homeVisits.map((v) => (
                <div key={v.id} className="modular-card rounded-2xl p-4 space-y-1 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{v.student?.full_name || 'Siswa'}</p>
                    <span className="text-[11px] text-slate-400">{v.visit_date}</span>
                  </div>
                  <p className="text-slate-700">{v.summary}</p>
                  {v.met_with && <p className="text-[11px] text-slate-500">Bertemu: {v.met_with}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
