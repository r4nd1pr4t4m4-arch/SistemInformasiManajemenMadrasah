'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';

interface EkskulRow {
  id: string;
  name: string;
  category: string;
  schedule_info: string | null;
  coach?: { full_name: string } | null;
}

interface MemberRow {
  id: string;
  extracurricular_id: string;
  student_id: string;
  grade: string;
  attendance_count: number;
  student?: { full_name: string; nis: string | null } | null;
  extracurricular?: { name: string } | null;
}

interface PortfolioRow {
  id: string;
  title: string;
  category: string;
  level: string;
  achieved_date: string;
  organizer: string | null;
  certificate_url: string | null;
  student?: { full_name: string; nis: string | null } | null;
}

export default function EkstrakurikulerPage() {
  const [tab, setTab] = useState<'EKSKUL' | 'PORTOFOLIO'>('EKSKUL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [ekskuls, setEkskuls] = useState<EkskulRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([]);

  const [ekskulForm, setEkskulForm] = useState({
    name: '',
    category: 'OLAHRAGA',
    coach_teacher_id: '',
    schedule_info: '',
  });
  const [memberForm, setMemberForm] = useState({
    extracurricular_id: '',
    student_id: '',
    grade: 'Baik',
    attendance_count: 1,
  });
  const [portForm, setPortForm] = useState({
    student_id: '',
    title: '',
    category: 'AKADEMIK',
    level: 'KABUPATEN',
    achieved_date: new Date().toISOString().slice(0, 10),
    organizer: '',
    certificate_url: '',
  });

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/layanan/ekstrakurikuler', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEkskuls(data.extracurriculars || []);
        setMembers(data.members || []);
        setPortfolios(data.portfolios || []);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function postAction(payload: Record<string, unknown>, msg: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/layanan/ekstrakurikuler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan.', 'err');
        return false;
      }
      showToast(msg);
      await loadData();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateEkskul(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'CREATE_EKSKUL', ...ekskulForm, coach_teacher_id: ekskulForm.coach_teacher_id || null },
      'Ekstrakurikuler berhasil ditambahkan.'
    );
    if (ok) setEkskulForm({ name: '', category: 'OLAHRAGA', coach_teacher_id: '', schedule_info: '' });
  }

  async function handleEnrollMember(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'ENROLL_MEMBER', ...memberForm },
      'Anggota & nilai ekstrakurikuler berhasil disimpan.'
    );
    if (ok) setMemberForm((prev) => ({ ...prev, student_id: '' }));
  }

  async function handleCreatePortfolio(e: FormEvent) {
    e.preventDefault();
    const ok = await postAction(
      { action: 'CREATE_PORTFOLIO', ...portForm },
      'Portofolio prestasi siswa berhasil ditambahkan.'
    );
    if (ok) {
      setPortForm({
        student_id: '',
        title: '',
        category: 'AKADEMIK',
        level: 'KABUPATEN',
        achieved_date: new Date().toISOString().slice(0, 10),
        organizer: '',
        certificate_url: '',
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
              <Trophy className="w-5 h-5 text-emerald-700" />
              <span>Ekstrakurikuler &amp; Portofolio Prestasi Siswa</span>
            </h1>
            <p className="text-xs text-slate-500">
              Kelola kegiatan ekstrakurikuler, pembina, presensi/predikat anggota, serta sertifikat prestasi digital siswa.
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
            onClick={() => setTab('EKSKUL')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'EKSKUL' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Ekstrakurikuler &amp; Anggota ({ekskuls.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('PORTOFOLIO')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'PORTOFOLIO' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Portofolio Prestasi Siswa ({portfolios.length})
          </button>
        </div>

        {tab === 'EKSKUL' ? (
          <div className="space-y-6 text-xs">
            <div className="grid lg:grid-cols-2 gap-4">
              <form onSubmit={handleCreateEkskul} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h2 className="font-bold text-slate-900">Tambah Master Ekstrakurikuler</h2>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input
                    required
                    value={ekskulForm.name}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, name: e.target.value })}
                    placeholder="Nama Ekskul (mis. Pramuka)"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                  <select
                    value={ekskulForm.coach_teacher_id}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, coach_teacher_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">-- Pembina (Opsional) --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={ekskulForm.schedule_info}
                    onChange={(e) => setEkskulForm({ ...ekskulForm, schedule_info: e.target.value })}
                    placeholder="Jadwal (mis. Jumat 14:30)"
                    className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Simpan Ekskul
                </button>
              </form>

              <form onSubmit={handleEnrollMember} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h2 className="font-bold text-slate-900">Daftarkan / Nilai Anggota Ekskul</h2>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <select
                    required
                    value={memberForm.extracurricular_id}
                    onChange={(e) => setMemberForm({ ...memberForm, extracurricular_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">-- Pilih Ekskul --</option>
                    {ekskuls.map((ek) => (
                      <option key={ek.id} value={ek.id}>
                        {ek.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={memberForm.student_id}
                    onChange={(e) => setMemberForm({ ...memberForm, student_id: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={memberForm.grade}
                    onChange={(e) => setMemberForm({ ...memberForm, grade: e.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={memberForm.attendance_count}
                    onChange={(e) => setMemberForm({ ...memberForm, attendance_count: Number(e.target.value) || 0 })}
                    placeholder="Jumlah Hadir Latihan"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold"
                >
                  Simpan Anggota &amp; Nilai
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Daftar Anggota &amp; Predikat ({members.length})</h3>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="modular-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {m.student?.full_name || 'Siswa'} — <span className="text-emerald-700">{m.extracurricular?.name || '-'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Predikat: <strong>{m.grade}</strong> • Kehadiran latihan: <strong>{m.attendance_count}x</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/layanan/ekstrakurikuler?id=${encodeURIComponent(m.id)}&target=member`, {
                        method: 'DELETE',
                      });
                      await loadData();
                    }}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            <form onSubmit={handleCreatePortfolio} className="grid sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <select
                required
                value={portForm.student_id}
                onChange={(e) => setPortForm({ ...portForm, student_id: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <input
                required
                value={portForm.title}
                onChange={(e) => setPortForm({ ...portForm, title: e.target.value })}
                placeholder="Judul Prestasi / Sertifikat *"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <select
                value={portForm.level}
                onChange={(e) => setPortForm({ ...portForm, level: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="SEKOLAH">Tingkat Sekolah</option>
                <option value="KECAMATAN">Kecamatan</option>
                <option value="KABUPATEN">Kabupaten/Kota</option>
                <option value="PROVINSI">Provinsi</option>
                <option value="NASIONAL">Nasional</option>
              </select>
              <input
                type="date"
                required
                value={portForm.achieved_date}
                onChange={(e) => setPortForm({ ...portForm, achieved_date: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <input
                type="url"
                value={portForm.certificate_url}
                onChange={(e) => setPortForm({ ...portForm, certificate_url: e.target.value })}
                placeholder="URL Sertifikat Digital (Opsional)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Portofolio Prestasi
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {portfolios.map((p) => (
                <div
                  key={p.id}
                  className="modular-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 border border-slate-200/80"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.student?.full_name || 'Siswa'} — {p.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tingkat {p.level} • {p.achieved_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.certificate_url && (
                      <a
                        href={p.certificate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold"
                      >
                        Sertifikat <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/layanan/ekstrakurikuler?id=${encodeURIComponent(p.id)}&target=portfolio`, {
                          method: 'DELETE',
                        });
                        await loadData();
                      }}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
