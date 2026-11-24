'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AkademikModal } from '../akademik-ui';
import type {
  GeofenceModalState,
  JtmAdjustModalState,
  JtmDiffModalState,
  PostPresensiFn,
  ShowToastFn,
  TeacherOpt,
} from './types';

interface PresensiModalsProps {
  outsideModal: GeofenceModalState | null;
  setOutsideModal: Dispatch<SetStateAction<GeofenceModalState | null>>;
  captureBrowserGps: (notify?: boolean) => void;
  jtmAdjustModal: JtmAdjustModalState | null;
  setJtmAdjustModal: Dispatch<SetStateAction<JtmAdjustModalState | null>>;
  jtmDiffModal: JtmDiffModalState | null;
  setJtmDiffModal: Dispatch<SetStateAction<JtmDiffModalState | null>>;
  teachers: TeacherOpt[];
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  postPresensi: PostPresensiFn;
  showToast: ShowToastFn;
}

export function PresensiModals({
  outsideModal,
  setOutsideModal,
  captureBrowserGps,
  jtmAdjustModal,
  setJtmAdjustModal,
  jtmDiffModal,
  setJtmDiffModal,
  teachers,
  submitting,
  setSubmitting,
  postPresensi,
  showToast,
}: PresensiModalsProps) {
  return (
    <>
      {/* Modal Popup Di Luar Radius Geofencing (Req #2) */}
      <AkademikModal
        open={Boolean(outsideModal)}
        onClose={() => setOutsideModal(null)}
        title="Di Luar Radius Geofencing"
      >
        {outsideModal && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Absensi geofencing hanya bisa dilakukan di dalam radius yang diizinkan oleh lembaga.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span>Jarak Anda saat ini:</span>
                <strong>{outsideModal.distanceMeters} meter</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Radius maksimal diizinkan:</span>
                <strong>{outsideModal.radiusMeters} meter</strong>
              </div>
              <div className="text-[11px] text-rose-700 pt-1 border-t border-rose-200/70 font-mono break-all">
                Posisi Anda: {outsideModal.teacherLat}, {outsideModal.teacherLng}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Pastikan Anda berada di lingkungan madrasah/sekolah dan GPS perangkat aktif, lalu klik{' '}
              <strong>Ambil GPS Perangkat</strong> untuk memperbarui posisi Anda.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutsideModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutsideModal(null);
                  captureBrowserGps(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Perbarui GPS Sekarang
              </button>
            </div>
          </>
        )}
      </AkademikModal>

      {/* Modal 1: Penyesuaian JTM saat Konfirmasi Kehadiran */}
      <AkademikModal
        open={Boolean(jtmAdjustModal)}
        onClose={() => {
          if (!submitting) setJtmAdjustModal(null);
        }}
        title="Konfirmasi Kehadiran & Penyesuaian JTM"
      >
        {jtmAdjustModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan jumlah JTM yang akan diperoleh{' '}
              <strong className="text-slate-900">{jtmAdjustModal.teacherName}</strong> (
              {jtmAdjustModal.label}) setelah mengisi laporan / jurnal yang diwajibkan.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">JTM Jadwal Seharusnya:</span>
              <strong className="text-slate-900">{jtmAdjustModal.expectedJtm} JTM</strong>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-adjust-approved-input"
                className="block text-xs font-semibold text-slate-700"
              >
                JTM yang Diperoleh (Disetujui)
              </label>
              <input
                id="jtm-adjust-approved-input"
                type="number"
                min={0}
                max={jtmAdjustModal.expectedJtm}
                step="0.5"
                value={jtmAdjustModal.approvedJtm}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  const val = Number.isFinite(parsed)
                    ? Math.min(jtmAdjustModal.expectedJtm, Math.max(0, parsed))
                    : 0;
                  setJtmAdjustModal({
                    ...jtmAdjustModal,
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
                onClick={() => setJtmAdjustModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const raw = Number(jtmAdjustModal.approvedJtm);
                  const clampedApproved = Number.isFinite(raw)
                    ? Math.min(jtmAdjustModal.expectedJtm, Math.max(0, raw))
                    : 0;
                  const diff = Number((jtmAdjustModal.expectedJtm - clampedApproved).toFixed(2));
                  const teacherId =
                    jtmAdjustModal.sessionItem?.teacher_id || jtmAdjustModal.att?.teacher_id || '';
                  if (diff > 0) {
                    setJtmDiffModal({
                      sessionItem: jtmAdjustModal.sessionItem,
                      att: jtmAdjustModal.att,
                      teacherId,
                      expectedJtm: jtmAdjustModal.expectedJtm,
                      approvedJtm: clampedApproved,
                      diffJtm: diff,
                      picketAttendanceId: jtmAdjustModal.picketAttendanceId,
                      recipientTeacherId: '',
                      reason: '',
                    });
                    setJtmAdjustModal(null);
                    return;
                  }
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    const res = jtmAdjustModal.sessionItem
                      ? await postPresensi({
                          action: 'CONFIRM_SCHEDULE_SESSION',
                          session_type: 'MENGAJAR',
                          session_date: jtmAdjustModal.sessionItem.session_date,
                          teacher_id: jtmAdjustModal.sessionItem.teacher_id,
                          schedule_id: jtmAdjustModal.sessionItem.schedule_id,
                          delegation_id: jtmAdjustModal.sessionItem.delegation_id,
                          picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                          approved_jtm: clampedApproved,
                        })
                      : await postPresensi({
                          action: 'CONFIRM_ATTENDANCE',
                          attendance_id: jtmAdjustModal.att!.id,
                          picket_attendance_id: jtmAdjustModal.picketAttendanceId,
                          approved_jtm: clampedApproved,
                        });
                    if (res) {
                      showToast(
                        'success',
                        `Jadwal dikonfirmasi dengan ${clampedApproved} JTM.`
                      );
                      setJtmAdjustModal(null);
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {jtmAdjustModal.approvedJtm < jtmAdjustModal.expectedJtm
                  ? 'Lanjut Alokasi Selisih JTM →'
                  : 'Konfirmasi Hadir'}
              </button>
            </div>
          </div>
        )}
      </AkademikModal>

      {/* Modal 2: Alokasi Selisih JTM ke Guru / Pengawas Lain */}
      <AkademikModal
        open={Boolean(jtmDiffModal)}
        onClose={() => {
          if (!submitting) setJtmDiffModal(null);
        }}
        title="Alokasi Selisih JTM"
      >
        {jtmDiffModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Terdapat selisih <strong className="text-slate-900">{jtmDiffModal.diffJtm} JTM</strong>{' '}
              (dari {jtmDiffModal.expectedJtm} JTM menjadi {jtmDiffModal.approvedJtm} JTM). Pilih
              guru/pengawas yang menerima selisih JTM ini. Penerima wajib melakukan presensi,
              dikonfirmasi kehadirannya, dan mengisi Jurnal/BAP.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-diff-recipient-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Guru / Pengawas Penerima Selisih JTM <span className="text-rose-500">*</span>
              </label>
              <select
                id="jtm-diff-recipient-select"
                required
                value={jtmDiffModal.recipientTeacherId}
                onChange={(e) =>
                  setJtmDiffModal({ ...jtmDiffModal, recipientTeacherId: e.target.value })
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">-- Pilih Guru / Pengawas Penerima Selisih JTM --</option>
                {teachers
                  .filter((t) => t.id !== jtmDiffModal.teacherId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jtm-diff-reason-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Keterangan / Alasan Penyesuaian JTM (Opsional)
              </label>
              <input
                id="jtm-diff-reason-input"
                placeholder="Contoh: Jam terakhir digantikan guru piket"
                value={jtmDiffModal.reason}
                onChange={(e) => setJtmDiffModal({ ...jtmDiffModal, reason: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setJtmDiffModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !jtmDiffModal.recipientTeacherId}
                onClick={async () => {
                  if (submitting || !jtmDiffModal.recipientTeacherId) return;
                  setSubmitting(true);
                  const trimmedReason = jtmDiffModal.reason.trim();
                  try {
                    const res = jtmDiffModal.sessionItem
                      ? await postPresensi({
                          action: 'CONFIRM_SCHEDULE_SESSION',
                          session_type: 'MENGAJAR',
                          session_date: jtmDiffModal.sessionItem.session_date,
                          teacher_id: jtmDiffModal.sessionItem.teacher_id,
                          schedule_id: jtmDiffModal.sessionItem.schedule_id,
                          delegation_id: jtmDiffModal.sessionItem.delegation_id,
                          picket_attendance_id: jtmDiffModal.picketAttendanceId,
                          approved_jtm: jtmDiffModal.approvedJtm,
                          diff_recipient_teacher_id: jtmDiffModal.recipientTeacherId,
                          diff_reason: trimmedReason || null,
                        })
                      : await postPresensi({
                          action: 'CONFIRM_ATTENDANCE',
                          attendance_id: jtmDiffModal.att!.id,
                          picket_attendance_id: jtmDiffModal.picketAttendanceId,
                          approved_jtm: jtmDiffModal.approvedJtm,
                          diff_recipient_teacher_id: jtmDiffModal.recipientTeacherId,
                          diff_reason: trimmedReason || null,
                        });
                    if (res) {
                      showToast(
                        'success',
                        `Kehadiran dikonfirmasi (${jtmDiffModal.approvedJtm} JTM) & selisih ${jtmDiffModal.diffJtm} JTM dialokasikan.`
                      );
                      setJtmDiffModal(null);
                    }
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
    </>
  );
}
