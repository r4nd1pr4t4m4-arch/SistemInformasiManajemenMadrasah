'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import {
  PAGE_SIZE,
  type ActiveAccount,
  type ActiveStudent,
  type AlumniStudent,
  type WorkspaceMessage,
} from './types';

interface LulusanSectionProps {
  alumniStudents: AlumniStudent[];
  activeStudents: ActiveStudent[];
  accounts: ActiveAccount[];
  loading: boolean;
  canManageLulusan: boolean;
  graduateModalOpen: boolean;
  onCloseGraduateModal: () => void;
  onMessage: (message: WorkspaceMessage | null) => void;
  onReload: () => Promise<void>;
}

export function LulusanSection({
  alumniStudents,
  activeStudents,
  accounts,
  loading,
  canManageLulusan,
  graduateModalOpen,
  onCloseGraduateModal,
  onMessage,
  onReload,
}: LulusanSectionProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [graduateStudentId, setGraduateStudentId] = useState('');
  const [graduateYear, setGraduateYear] = useState(String(new Date().getFullYear()));

  const [linkModalStudent, setLinkModalStudent] = useState<AlumniStudent | null>(null);
  const [linkProfileId, setLinkProfileId] = useState('');

  const anyModalOpen = graduateModalOpen || Boolean(linkModalStudent);
  useEffect(() => {
    if (!anyModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        setModalError(null);
        onCloseGraduateModal();
        setLinkModalStudent(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyModalOpen, saving, onCloseGraduateModal]);

  const filteredLulusan = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumniStudents;
    return alumniStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.nisn || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        String(s.graduation_year || '').includes(q)
    );
  }, [alumniStudents, search]);

  const activeCount = filteredLulusan.length;
  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedLulusan = useMemo(
    () => filteredLulusan.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredLulusan, pageStart]
  );

  function closeGraduateModal() {
    setModalError(null);
    onCloseGraduateModal();
  }

  function closeLinkModal() {
    setModalError(null);
    setLinkModalStudent(null);
  }

  async function handleGraduate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const gradYearNum = Number(graduateYear);
    if (!graduateStudentId) {
      setModalError('Pilih siswa aktif terlebih dahulu.');
      return;
    }
    if (!Number.isInteger(gradYearNum) || gradYearNum < 1980 || gradYearNum > 2100) {
      setModalError('Tahun lulus harus antara 1980 dan 2100.');
      return;
    }

    setSaving(true);
    setModalError(null);
    onMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'alumni-graduate',
          student_id: graduateStudentId,
          graduation_year: gradYearNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal meluluskan siswa.');
      onCloseGraduateModal();
      setGraduateStudentId('');
      onMessage({ type: 'ok', text: 'Siswa berhasil ditetapkan sebagai Alumni (LULUS).' });
      await onReload();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkModalStudent || saving) return;
    setSaving(true);
    setModalError(null);
    onMessage(null);
    try {
      const res = await fetch('/api/sdm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'siswa',
          id: linkModalStudent.id,
          profile_id: linkProfileId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menautkan akun alumni.');
      setLinkModalStudent(null);
      onMessage({ type: 'ok', text: 'Penautan akun alumni berhasil disimpan.' });
      await onReload();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">
            Daftar Lulusan ({filteredLulusan.length})
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama, NIS, NISN, tahun lulus..."
                aria-label="Cari data alumni"
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Memuat data alumni...
          </div>
        ) : pagedLulusan.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {alumniStudents.length === 0
              ? 'Belum ada siswa berstatus LULUS.'
              : 'Tidak ada data lulusan yang cocok dengan pencarian.'}
          </div>
        ) : (
          <>
            {/* Mobile Cards for Lulusan */}
            <div className="md:hidden space-y-3">
              {pagedLulusan.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 break-words">
                        {item.full_name}
                      </p>
                      <p className="text-slate-500 break-all mt-0.5">
                        {item.phone || '-'} · {item.email || '-'}
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold tabular-nums">
                      Lulus {item.graduation_year || '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white rounded-xl p-2 border border-slate-100 tabular-nums">
                    <div className="truncate">NIS: {item.nis || '-'}</div>
                    <div className="truncate">NISN: {item.nisn || '-'}</div>
                  </div>

                  {item.profile && (
                    <div className="flex">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                        <Link2 className="w-3 h-3 shrink-0" />
                        {item.profile.full_name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                    <Link
                      href={`/portal/sdm/alumni/${item.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                    >
                      Detail
                    </Link>
                    {canManageLulusan && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setLinkModalStudent(item);
                          setLinkProfileId(item.profile_id || '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Tautkan Akun
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table for Lulusan */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-3 px-3">Nama Alumni</th>
                    <th className="py-3 px-3">NIS / NISN</th>
                    <th className="py-3 px-3">Tahun Lulus</th>
                    <th className="py-3 px-3">Akun Portal</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedLulusan.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.full_name}</p>
                        <p className="text-xs text-slate-500">
                          {item.phone || '-'} · {item.email || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                        <div>NIS: {item.nis || '-'}</div>
                        <div>NISN: {item.nisn || '-'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 tabular-nums">
                        {item.graduation_year || '-'}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {item.profile ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                            <Link2 className="w-3 h-3 shrink-0" />
                            {item.profile.full_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum ditautkan</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/portal/sdm/alumni/${item.id}`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                          >
                            Detail
                          </Link>
                          {canManageLulusan && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                setLinkModalStudent(item);
                                setLinkProfileId(item.profile_id || '');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              Tautkan Akun
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && activeCount > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, activeCount)} dari{' '}
              {activeCount} data
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Halaman sebelumnya"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700 tabular-nums">
                Hal {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Halaman berikutnya"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {graduateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="graduate-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              closeGraduateModal();
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="graduate-modal-title" className="text-lg font-bold text-slate-900">
                Tetapkan Siswa sebagai Alumni
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={closeGraduateModal}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleGraduate} className="space-y-4 text-sm">
              <div>
                <label
                  htmlFor="grad-student"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Pilih Siswa Aktif *
                </label>
                <select
                  id="grad-student"
                  required
                  value={graduateStudentId}
                  onChange={(e) => setGraduateStudentId(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.nis ? `(NIS: ${s.nis})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="grad-year"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Tahun Lulus *
                </label>
                <input
                  id="grad-year"
                  required
                  min={1980}
                  max={2100}
                  type="number"
                  value={graduateYear}
                  onChange={(e) => setGraduateYear(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeGraduateModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Memproses...' : 'Luluskan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkModalStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              closeLinkModal();
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="link-modal-title" className="text-lg font-bold text-slate-900">
                Tautkan Akun Alumni
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={closeLinkModal}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLink} className="space-y-4 text-sm">
              <p className="text-xs text-slate-600">
                Alumni:{' '}
                <span className="font-semibold text-slate-900">{linkModalStudent.full_name}</span>
              </p>
              <div>
                <label
                  htmlFor="link-profile"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Akun Portal Aktif
                </label>
                <select
                  id="link-profile"
                  value={linkProfileId}
                  onChange={(e) => setLinkProfileId(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">-- Lepas Tautan --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.full_name} ({acc.email || acc.phone || acc.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeLinkModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
