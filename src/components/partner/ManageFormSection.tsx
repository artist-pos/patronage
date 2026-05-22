"use client";

import { useState, useRef, useCallback } from "react";
import { FormBuilderPanel } from "@/components/partner/wizard/FormBuilderPanel";
import { LivePreviewPane } from "@/components/partner/wizard/LivePreviewPane";
import { updateOpportunityPartner } from "@/app/partner/opportunities/[id]/edit/actions";
import type { Opportunity, PipelineConfig, PipelineQuestion } from "@/types/database";

interface Props {
  opp: Opportunity;
}

export function ManageFormSection({ opp }: Props) {
  const [questions, setQuestions] = useState<PipelineQuestion[]>(
    opp.pipeline_config?.questions ?? []
  );
  const [showBadges, setShowBadges] = useState(opp.show_badges_in_submission ?? false);
  const [artistDocs, setArtistDocs] = useState<PipelineConfig["artist_documents"]>(
    opp.pipeline_config?.artist_documents ?? []
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configRef = useRef<PipelineConfig>(
    (opp.pipeline_config as PipelineConfig | null) ?? {
      questions: [],
      artist_documents: [],
      terms_pdf_url: null,
    }
  );

  const queueSave = useCallback(
    (patch: Parameters<typeof updateOpportunityPartner>[1]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateOpportunityPartner(opp.id, patch).catch(console.error);
      }, 800);
    },
    [opp.id]
  );

  function handleChange(patch: {
    questions?: PipelineQuestion[];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
  }) {
    const newQuestions = patch.questions ?? questions;
    const newDocs = patch.artistDocs ?? artistDocs;
    const newBadges = patch.showBadges ?? showBadges;

    if (patch.questions !== undefined) setQuestions(newQuestions);
    if (patch.artistDocs !== undefined) setArtistDocs(newDocs);
    if (patch.showBadges !== undefined) setShowBadges(newBadges);

    configRef.current = {
      ...configRef.current,
      ...(patch.questions !== undefined && { questions: newQuestions }),
      ...(patch.artistDocs !== undefined && { artist_documents: newDocs }),
    };

    const savePatch: Parameters<typeof updateOpportunityPartner>[1] = {
      pipeline_config: configRef.current,
    };
    if (patch.showBadges !== undefined) savePatch.show_badges_in_submission = newBadges;
    queueSave(savePatch);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
      <FormBuilderPanel
        questions={questions}
        showBadges={showBadges}
        artistDocs={artistDocs}
        onChange={handleChange}
      />
      <div className="lg:sticky lg:top-[57px]">
        <LivePreviewPane
          questions={questions}
          artistDocs={artistDocs}
          showBadges={showBadges}
        />
      </div>
    </div>
  );
}
