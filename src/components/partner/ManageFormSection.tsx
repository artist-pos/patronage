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
  const [termsPdfUrl, setTermsPdfUrl] = useState<string | null>(opp.pipeline_config?.terms_pdf_url ?? null);
  const [portfolioPickCount, setPortfolioPickCount] = useState(opp.pipeline_config?.portfolio_pick_count ?? 3);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configRef = useRef<PipelineConfig>(
    (opp.pipeline_config as PipelineConfig | null) ?? {
      questions: [],
      artist_documents: [],
      terms_pdf_url: null,
    }
  );
  // Mirrors showBadges state so doSave always reads the latest value even if a
  // debounced save fires after a newer render replaced its closure.
  const showBadgesRef = useRef(showBadges);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const doSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    try {
      await updateOpportunityPartner(opp.id, {
        pipeline_config: configRef.current,
        show_badges_in_submission: showBadgesRef.current,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  }, [opp.id]);

  const queueSave = useCallback(
    () => {
      clearTimeout(saveTimer.current);
      setSaveStatus("idle");
      saveTimer.current = setTimeout(() => {
        doSave();
      }, 800);
    },
    [doSave]
  );

  function handleChange(patch: {
    questions?: PipelineQuestion[];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
    termsPdfUrl?: string | null;
    portfolioPickCount?: number;
  }) {
    const newQuestions = patch.questions ?? questions;
    const newDocs = patch.artistDocs ?? artistDocs;
    const newBadges = patch.showBadges ?? showBadges;
    const newTermsPdfUrl = patch.termsPdfUrl !== undefined ? patch.termsPdfUrl : termsPdfUrl;
    const newPortfolioPickCount = patch.portfolioPickCount ?? portfolioPickCount;

    if (patch.questions !== undefined) setQuestions(newQuestions);
    if (patch.artistDocs !== undefined) setArtistDocs(newDocs);
    if (patch.showBadges !== undefined) { setShowBadges(newBadges); showBadgesRef.current = newBadges; }
    if (patch.termsPdfUrl !== undefined) setTermsPdfUrl(newTermsPdfUrl);
    if (patch.portfolioPickCount !== undefined) setPortfolioPickCount(newPortfolioPickCount);

    configRef.current = {
      ...configRef.current,
      ...(patch.questions !== undefined && { questions: newQuestions }),
      ...(patch.artistDocs !== undefined && { artist_documents: newDocs }),
      ...(patch.termsPdfUrl !== undefined && { terms_pdf_url: newTermsPdfUrl }),
      ...(patch.portfolioPickCount !== undefined && { portfolio_pick_count: newPortfolioPickCount }),
    };

    queueSave();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        <FormBuilderPanel
          opportunityId={opp.id}
          questions={questions}
          showBadges={showBadges}
          artistDocs={artistDocs}
          termsPdfUrl={termsPdfUrl}
          portfolioPickCount={portfolioPickCount}
          onChange={handleChange}
        />
        <div className="lg:sticky lg:top-[57px]">
          <LivePreviewPane
            questions={questions}
            artistDocs={artistDocs}
            showBadges={showBadges}
            portfolioPickCount={portfolioPickCount}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saveStatus === "error" && (
          <span className="text-xs text-destructive">Couldn&apos;t save — try again</span>
        )}
        <button
          type="button"
          onClick={doSave}
          disabled={saveStatus === "saving"}
          className="px-4 py-2 bg-black text-white text-sm disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
