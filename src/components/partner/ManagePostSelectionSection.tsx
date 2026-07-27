"use client";

import { useState, useRef, useCallback } from "react";
import { StepPostSelection } from "@/components/partner/wizard/StepPostSelection";
import { updateOpportunityPartner } from "@/app/partner/opportunities/[id]/edit/actions";
import type { Opportunity, PostSelectionConfig, PipelineConfig } from "@/types/database";
import { ALL_STAGE_VALUES, type PipelineStagesConfig } from "@/lib/pipeline-stages";

interface NotificationDefaults {
  shortlisted: "send" | "hold";
  rejected: "send" | "hold";
  selected: "send" | "hold";
}

const DEFAULT_POST_SELECTION: PostSelectionConfig = {
  requires_campaign: false,
  requires_studio_updates: false,
  update_frequency_days: 30,
  requires_documentation: false,
  doc_fields: [],
};

const DEFAULT_NOTIFICATION_DEFAULTS: NotificationDefaults = {
  shortlisted: "hold",
  rejected: "hold",
  selected: "send",
};

interface Props {
  opp: Opportunity;
}

export function ManagePostSelectionSection({ opp }: Props) {
  const [postSelection, setPostSelection] = useState<PostSelectionConfig>(
    opp.pipeline_config?.post_selection ?? DEFAULT_POST_SELECTION
  );
  const [notificationDefaults, setNotificationDefaults] = useState<NotificationDefaults>(
    (opp.pipeline_config?.notification_defaults as NotificationDefaults | undefined) ??
      DEFAULT_NOTIFICATION_DEFAULTS
  );
  const [stagesConfig, setStagesConfig] = useState<PipelineStagesConfig>(
    opp.pipeline_config?.pipeline_stages ?? { enabled: ALL_STAGE_VALUES }
  );
  const configRef = useRef<PipelineConfig>(
    (opp.pipeline_config as PipelineConfig | null) ?? {
      questions: [],
      artist_documents: [],
      terms_pdf_url: null,
    }
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const doSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    try {
      await updateOpportunityPartner(opp.id, { pipeline_config: configRef.current });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  }, [opp.id]);

  const queueSave = useCallback(
    (newConfig: PipelineConfig) => {
      void newConfig; // already written into configRef.current by the caller
      clearTimeout(saveTimer.current);
      setSaveStatus("idle");
      saveTimer.current = setTimeout(() => {
        doSave();
      }, 800);
    },
    [doSave]
  );

  function handlePostSelectionChange(config: PostSelectionConfig) {
    setPostSelection(config);
    const newConfig: PipelineConfig = { ...configRef.current, post_selection: config };
    configRef.current = newConfig;
    queueSave(newConfig);
  }

  function handleNotificationDefaultsChange(defaults: NotificationDefaults) {
    setNotificationDefaults(defaults);
    const newConfig: PipelineConfig = { ...configRef.current, notification_defaults: defaults };
    configRef.current = newConfig;
    queueSave(newConfig);
  }

  function handleStagesConfigChange(config: PipelineStagesConfig) {
    setStagesConfig(config);
    const newConfig: PipelineConfig = { ...configRef.current, pipeline_stages: config };
    configRef.current = newConfig;
    queueSave(newConfig);
  }

  return (
    <div className="space-y-6">
      <StepPostSelection
        postSelection={postSelection}
        notificationDefaults={notificationDefaults}
        stagesConfig={stagesConfig}
        onPostSelectionChange={handlePostSelectionChange}
        onNotificationDefaultsChange={handleNotificationDefaultsChange}
        onStagesConfigChange={handleStagesConfigChange}
      />

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
