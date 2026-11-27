'use client';

import { Users } from 'lucide-react';
import { SdmDocumentSection } from '@/components/sdm/sdm-document-section';
import {
  GTK_DOC_OPTIONS,
  ORANG_TUA_DOC_OPTIONS,
  type GtkSelfPayload,
  type GuardianSelfPayload,
  type SelfSdmRoleScope,
} from './types';

interface SelfSdmDocumentsSectionProps {
  roleScope: SelfSdmRoleScope;
  gtkData: GtkSelfPayload | null;
  guardians: GuardianSelfPayload[];
  onRefresh: () => Promise<void>;
}

export function SelfSdmDocumentsSection({
  roleScope,
  gtkData,
  guardians,
  onRefresh,
}: SelfSdmDocumentsSectionProps) {
  if (roleScope === 'gtk') {
    if (!gtkData) return null;
    return (
      <SdmDocumentSection
        entityType="GTK"
        entityId={String(gtkData.teacher.id)}
        documentOptions={GTK_DOC_OPTIONS}
        documents={gtkData.documents}
        onRefresh={onRefresh}
        allowSelfManage={true}
      />
    );
  }

  if (guardians.length === 0) return null;

  return (
    <>
      {guardians.map((g) => (
        <div key={g.id} className="space-y-2.5">
          {guardians.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <Users className="w-3.5 h-3.5 shrink-0" />
                Wali dari {g.student?.full_name || '-'} ({g.relationship || 'WALI'})
              </span>
            </div>
          )}
          <SdmDocumentSection
            entityType="ORANG_TUA"
            entityId={g.id}
            documentOptions={ORANG_TUA_DOC_OPTIONS}
            documents={g.documents}
            onRefresh={onRefresh}
            allowSelfManage={true}
          />
          {g.sharedStudentDocuments && g.sharedStudentDocuments.length > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 min-w-0">
              <p className="text-xs font-bold text-slate-800 break-words">
                Dokumen Keluarga Tersinkron dari Data Siswa ({g.student?.full_name || '-'})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {g.sharedStudentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 text-xs min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 break-words">
                        {doc.document_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-slate-500 break-all">{doc.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.verification_status === 'TERVERIFIKASI'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.verification_status === 'DITOLAK'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {doc.verification_status || 'MENUNGGU'}
                      </span>
                      <a
                        href={`/api/sdm/documents/file?id=${encodeURIComponent(doc.id)}&entityType=SISWA`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                      >
                        Lihat
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
