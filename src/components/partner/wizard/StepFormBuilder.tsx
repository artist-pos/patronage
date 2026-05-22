"use client";

import { FormBuilderPanel } from "./FormBuilderPanel";
import { LivePreviewPane } from "./LivePreviewPane";
import type { PipelineQuestion, PipelineConfig } from "@/types/database";

interface Props {
  questions: PipelineQuestion[];
  showBadges: boolean;
  artistDocs: PipelineConfig["artist_documents"];
  onChange: (patch: {
    questions?: PipelineQuestion[];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
  }) => void;
}

export function StepFormBuilder({ questions, showBadges, artistDocs, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Application form</h2>
        <p className="text-sm text-stone-500">
          Customise the questions artists answer when applying. The preview updates as you edit.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        <FormBuilderPanel
          questions={questions}
          showBadges={showBadges}
          artistDocs={artistDocs}
          onChange={onChange}
        />

        <div className="lg:sticky lg:top-[72px]">
          <LivePreviewPane
            questions={questions}
            artistDocs={artistDocs}
            showBadges={showBadges}
          />
        </div>
      </div>
    </div>
  );
}
