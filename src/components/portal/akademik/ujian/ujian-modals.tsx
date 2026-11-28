'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AkademikModal } from '../akademik-ui';
import { parseDecimalInput } from '@/lib/validation/decimal';
import { DecimalInput } from '@/components/ui/decimal-input';
import type {
  RemoveRoomMemberModalState,
  SupAdjustModalState,
  SupDiffModalState,
  TeacherOpt,
} from './types';

export interface UjianModalsProps {
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  loadData: () => Promise<void>;
  postUjian: (body: unknown, msg: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', text: string) => void;
  teachers: TeacherOpt[];
  confirmCommitteeId: string;
  supAdjustModal: SupAdjustModalState | null;
  setSupAdjustModal: (modal: SupAdjustModalState | null) => void;
  supDiffModal: SupDiffModalState | null;
  setSupDiffModal: (modal: SupDiffModalState | null) => void;
  removeRoomMemberModal: RemoveRoomMemberModalState | null;
  setRemoveRoomMemberModal: (modal: RemoveRoomMemberModalState | null) => void;
}

export function UjianModals({
  submitting,
  setSubmitting,
  loadData,
  postUjian,
  showToast,
  teachers,
  confirmCommitteeId,
  supAdjustModal,
  setSupAdjustModal,
  supDiffModal,
  setSupDiffModal,
  removeRoomMemberModal,
  setRemoveRoomMemberModal,
}: UjianModalsProps) {
  const [supJtmDraft, setSupJtmDraft] = useState<{ key: string; value: string } | null>(null);
  const currentSupKey = supAdjustModal
    ? `${supAdjustModal.sup.id}:${supAdjustModal.expectedJtm}`
    : '';
  const supApprovedJtmInput =
    supAdjustModal && supJtmDraft?.key === currentSupKey
      ? supJtmDraft.value
      : supAdjustModal
        ? String(supAdjustModal.approvedJtm)
        : '';
  return (
    <>
      {/* Modal 1: Penyesuaian JTM Pengawas Ujian */}
      <AkademikModal
        open={Boolean(supAdjustModal)}
        onClose={() => {
          if (!submitting) setSupAdjustModal(null);
        }}
        title="Konfirmasi Kehadiran & Penyesuaian JTM Pengawas"
      >
        {supAdjustModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan JTM yang akan diperoleh{' '}
              <strong className="text-slate-900">{supAdjustModal.sup.teacher?.full_name}</strong> (
              {supAdjustModal.sup.exam_date} • {supAdjustModal.sup.session_name}) setelah mengisi
              BAP.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">JTM Pengawasan Seharusnya:</span>
              <strong className="text-slate-900">{supAdjustModal.expectedJtm} JTM</strong>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="sup-adjust-jtm-input"
                className="block text-xs font-semibold text-slate-700"
              >
                JTM yang Diperoleh (Disetujui)
              </label>
              <DecimalInput
                id="sup-adjust-jtm-input"
                maxDecimals={2}
                value={supApprovedJtmInput}
                onValueChange={(normalized) => {
                  setSupJtmDraft({ key: currentSupKey, value: normalized });
                  const parsed = parseDecimalInput(normalized);
                  const val =
                    parsed !== null
                      ? Math.min(supAdjustModal.expectedJtm, Math.max(0, parsed))
                      : 0;
                  setSupAdjustModal({
                    ...supAdjustModal,
                    approvedJtm: val,
                  });
                }}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSupAdjustModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const raw = Number(supAdjustModal.approvedJtm);
                  const clampedApproved = Number.isFinite(raw)
                    ? Math.min(supAdjustModal.expectedJtm, Math.max(0, raw))
                    : 0;
                  const diff = Number((supAdjustModal.expectedJtm - clampedApproved).toFixed(2));
                  if (diff > 0) {
                    setSupDiffModal({
                      sup: supAdjustModal.sup,
                      expectedJtm: supAdjustModal.expectedJtm,
                      approvedJtm: clampedApproved,
                      diffJtm: diff,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setSupAdjustModal(null);
                    return;
                  }
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/akademik/presensi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'PENGAWAS_UJIAN',
                        session_date: supAdjustModal.sup.exam_date,
                        teacher_id: supAdjustModal.sup.teacher_id,
                        exam_supervisor_id: supAdjustModal.sup.id,
                        committee_attendance_id: confirmCommitteeId || null,
                        approved_jtm: clampedApproved,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast('error', data.error || 'Gagal mengonfirmasi pengawas.');
                      return;
                    }
                    showToast('success', 'Jadwal Pengawas Ujian dikonfirmasi. Pengawas siap mengisi BAP.');
                    setSupAdjustModal(null);
                    await loadData();
                  } catch {
                    showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {supAdjustModal.approvedJtm < supAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </div>
        )}
      </AkademikModal>

      {/* Modal 2: Alokasi Selisih JTM Pengawas Ujian */}
      <AkademikModal
        open={Boolean(supDiffModal)}
        onClose={() => {
          if (!submitting) setSupDiffModal(null);
        }}
        title="Alokasi Selisih JTM Pengawas"
      >
        {supDiffModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Terdapat selisih <strong className="text-slate-900">{supDiffModal.diffJtm} JTM</strong>{' '}
              (dari {supDiffModal.expectedJtm} JTM menjadi {supDiffModal.approvedJtm} JTM). Pilih
              pengawas pengganti/penerima selisih JTM ini. Penerima wajib melakukan presensi,
              dikonfirmasi Admin/Panitia, dan mengisi BAP.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="sup-diff-recipient-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Pengawas Penerima Selisih JTM <span className="text-rose-500">*</span>
              </label>
              <select
                id="sup-diff-recipient-select"
                required
                value={supDiffModal.recipientTeacherId}
                onChange={(e) =>
                  setSupDiffModal({ ...supDiffModal, recipientTeacherId: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Pengawas Penerima Selisih JTM --</option>
                {teachers
                  .filter((t) => t.id !== supDiffModal.sup.teacher_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="sup-diff-reason-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Keterangan / Alasan Penyesuaian JTM (Opsional)
              </label>
              <input
                id="sup-diff-reason-input"
                placeholder="Contoh: Pengawasan sesi kedua digantikan guru lain"
                value={supDiffModal.reason}
                onChange={(e) => setSupDiffModal({ ...supDiffModal, reason: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSupDiffModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !supDiffModal.recipientTeacherId}
                onClick={async () => {
                  if (submitting || !supDiffModal.recipientTeacherId) return;
                  setSubmitting(true);
                  const trimmedReason = supDiffModal.reason.trim();
                  try {
                    const res = await fetch('/api/akademik/presensi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'CONFIRM_SCHEDULE_SESSION',
                        session_type: 'PENGAWAS_UJIAN',
                        session_date: supDiffModal.sup.exam_date,
                        teacher_id: supDiffModal.sup.teacher_id,
                        exam_supervisor_id: supDiffModal.sup.id,
                        committee_attendance_id: confirmCommitteeId || null,
                        approved_jtm: supDiffModal.approvedJtm,
                        diff_recipient_teacher_id: supDiffModal.recipientTeacherId,
                        diff_reason: trimmedReason || null,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast('error', data.error || 'Gagal mengonfirmasi & mengalokasikan selisih.');
                      return;
                    }
                    showToast(
                      'success',
                      `Kehadiran dikonfirmasi (${supDiffModal.approvedJtm} JTM) & selisih ${supDiffModal.diffJtm} JTM dialokasikan.`
                    );
                    setSupDiffModal(null);
                    await loadData();
                  } catch {
                    showToast('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Konfirmasi &amp; Alokasikan Selisih
              </button>
            </div>
          </div>
        )}
      </AkademikModal>

      {/* Modal Konfirmasi Keluarkan Siswa dari Ruang Ujian */}
      <AkademikModal
        open={Boolean(removeRoomMemberModal)}
        onClose={() => {
          if (!submitting) setRemoveRoomMemberModal(null);
        }}
        title="Keluarkan Peserta dari Ruang Ujian"
      >
        {removeRoomMemberModal && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
              Anda akan mengeluarkan siswa{' '}
              <strong className="text-rose-950">{removeRoomMemberModal.studentName}</strong> dari{' '}
              <strong className="text-rose-950">{removeRoomMemberModal.roomName}</strong>. Siswa
              tetap dapat ditempatkan kembali ke ruang ujian lain pada periode ini.
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setRemoveRoomMemberModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const ok = await postUjian(
                    {
                      action: 'REMOVE_EXAM_ROOM_STUDENT',
                      exam_room_student_id: removeRoomMemberModal.id,
                    },
                    `Siswa ${removeRoomMemberModal.studentName} dikeluarkan dari ruang ujian.`
                  );
                  if (ok) setRemoveRoomMemberModal(null);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Keluarkan Siswa
              </button>
            </div>
          </div>
        )}
      </AkademikModal>
    </>
  );
}
