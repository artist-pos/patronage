"use client";

import { RubricBuilder, type LocalCriterion } from "./RubricBuilder";
import { PartnerDocumentsUploader } from "./PartnerDocumentsUploader";
import type { PartnerDocument } from "@/types/database";

interface Props {
  opportunityId: string;
  criteria: LocalCriterion[];
  documents: PartnerDocument[];
  onCriteriaChange: (criteria: LocalCriterion[]) => void;
  onDocUploaded: (doc: PartnerDocument) => void;
  onDocDeleted: (id: string) => void;
}

export function StepRubric({
  opportunityId,
  criteria,
  documents,
  onCriteriaChange,
  onDocUploaded,
  onDocDeleted,
}: Props) {
  return (
    <div className="space-y-10 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Scoring &amp; documents</h2>
        <p className="text-sm text-stone-500">
          Set up your scoring rubric and upload any briefing material for your review panel. Both are optional.
        </p>
      </div>

      <RubricBuilder criteria={criteria} onChange={onCriteriaChange} />

      <div className="border-t border-black/10 pt-8">
        <PartnerDocumentsUploader
          opportunityId={opportunityId}
          documents={documents}
          onUploaded={onDocUploaded}
          onDeleted={onDocDeleted}
        />
      </div>
    </div>
  );
}
