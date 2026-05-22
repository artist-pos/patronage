"use client";

import { useState } from "react";
import { RubricBuilder, type LocalCriterion } from "@/components/partner/wizard/RubricBuilder";
import { PartnerDocumentsUploader } from "@/components/partner/wizard/PartnerDocumentsUploader";
import { saveRubricCriteria } from "@/app/partner/opportunities/[id]/new/actions";
import type { PartnerDocument } from "@/types/database";

interface Props {
  opportunityId: string;
  initialCriteria: LocalCriterion[];
  initialDocuments: PartnerDocument[];
}

export function ManageRubricSection({ opportunityId, initialCriteria, initialDocuments }: Props) {
  const [criteria, setCriteria] = useState<LocalCriterion[]>(initialCriteria);
  const [documents, setDocuments] = useState<PartnerDocument[]>(initialDocuments);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await saveRubricCriteria(opportunityId, criteria);
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="space-y-8">
      <RubricBuilder criteria={criteria} onChange={setCriteria} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-black text-white text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save rubric"}
        </button>
      </div>

      <div className="border-t border-black/10 pt-6 space-y-3">
        <p className="text-sm font-medium">Brief documents</p>
        <p className="text-xs text-stone-500">Upload PDFs or supporting files artists can download when applying.</p>
        <PartnerDocumentsUploader
          opportunityId={opportunityId}
          documents={documents}
          onUploaded={(doc) => setDocuments((prev) => [...prev, doc])}
          onDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
        />
      </div>
    </div>
  );
}
