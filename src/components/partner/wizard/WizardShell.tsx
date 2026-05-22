"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WizardChrome } from "./WizardChrome";
import { StepTemplate } from "./StepTemplate";
import { StepBasics, type Patch as BasicsPatch } from "./StepBasics";
import { StepFormBuilder } from "./StepFormBuilder";
import { StepRubric } from "./StepRubric";
import { StepPostSelection } from "./StepPostSelection";
import { StepReviewPublish } from "./StepReviewPublish";
import { updateOpportunityPartner } from "@/app/partner/opportunities/[id]/edit/actions";
import { saveRubricCriteria } from "@/app/partner/opportunities/[id]/new/actions";
import { submitDraftForReview } from "@/app/partner/opportunities/new/actions";
import type { Opportunity, PartnerDocument, PipelineConfig, PostSelectionConfig } from "@/types/database";
import type { TemplateKey } from "@/lib/pipeline-templates";
import type { LocalCriterion } from "./RubricBuilder";

type NotificationDefaults = {
  shortlisted: "send" | "hold";
  rejected: "send" | "hold";
  selected: "send" | "hold";
};

interface Props {
  opp: Opportunity;
  initialStep: number;
  isPipeline: boolean;
  initialCriteria: LocalCriterion[];
  initialDocuments: PartnerDocument[];
}

const FREE_STEPS = [
  { number: 2, label: "Basics" },
  { number: 3, label: "Review" },
];

const PIPELINE_STEPS = [
  { number: 1, label: "Template" },
  { number: 2, label: "Basics" },
  { number: 3, label: "Form" },
  { number: 4, label: "Scoring" },
  { number: 5, label: "Post-selection" },
  { number: 6, label: "Review & Publish" },
];

const DEFAULT_POST_SELECTION: PostSelectionConfig = {
  requires_campaign: false,
  requires_studio_updates: false,
  update_frequency_days: 30,
  requires_documentation: false,
  doc_fields: [],
};

const DEFAULT_NOTIFICATION_DEFAULTS = {
  shortlisted: "hold" as const,
  rejected: "hold" as const,
  selected: "send" as const,
};

export function WizardShell({
  opp: initialOpp,
  initialStep,
  isPipeline,
  initialCriteria,
  initialDocuments,
}: Props) {
  const steps = isPipeline ? PIPELINE_STEPS : FREE_STEPS;
  const minStep = steps[0].number;
  const maxStep = steps[steps.length - 1].number;

  const [opp, setOpp] = useState<Opportunity>(initialOpp);
  const [step, setStep] = useState(initialStep);
  const [template, setTemplate] = useState<TemplateKey | null>(
    (initialOpp.pipeline_config?.template as TemplateKey | undefined) ?? null
  );
  const [criteria, setCriteria] = useState<LocalCriterion[]>(initialCriteria);
  const [documents, setDocuments] = useState<PartnerDocument[]>(initialDocuments);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  // Notification defaults with fallback to pipeline_config or defaults
  const [notificationDefaults, setNotificationDefaults] = useState<NotificationDefaults>(
    (initialOpp.pipeline_config?.notification_defaults as NotificationDefaults | undefined) ??
      DEFAULT_NOTIFICATION_DEFAULTS
  );

  // Post-selection config
  const [postSelection, setPostSelection] = useState<PostSelectionConfig>(
    initialOpp.pipeline_config?.post_selection ?? DEFAULT_POST_SELECTION
  );

  // Questions + artist docs + badges (from pipeline_config)
  const questions = opp.pipeline_config?.questions ?? [];
  const artistDocs = (opp.pipeline_config?.artist_documents ?? []) as PipelineConfig["artist_documents"];
  const showBadges = opp.show_badges_in_submission ?? false;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const queueSave = useCallback(
    (patch: Parameters<typeof updateOpportunityPartner>[1]) => {
      setSaveStatus("saving");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await updateOpportunityPartner(opp.id, patch);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("idle");
        }
      }, 800);
    },
    [opp.id]
  );

  function handleBasicsChange(patch: BasicsPatch) {
    setOpp((prev) => ({ ...prev, ...patch }));
    queueSave(patch as Parameters<typeof updateOpportunityPartner>[1]);
  }

  function handleFormChange(patch: {
    questions?: PipelineConfig["questions"];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
  }) {
    setOpp((prev) => {
      const prevConfig = prev.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
      const newConfig: PipelineConfig = {
        ...prevConfig,
        ...(patch.questions !== undefined && { questions: patch.questions }),
        ...(patch.artistDocs !== undefined && { artist_documents: patch.artistDocs }),
      };
      return { ...prev, pipeline_config: newConfig, show_badges_in_submission: patch.showBadges ?? prev.show_badges_in_submission };
    });

    const configPatch: Parameters<typeof updateOpportunityPartner>[1] = {};
    if (patch.showBadges !== undefined) configPatch.show_badges_in_submission = patch.showBadges;
    if (patch.questions !== undefined || patch.artistDocs !== undefined) {
      configPatch.pipeline_config = {
        ...(opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null }),
        ...(patch.questions !== undefined && { questions: patch.questions }),
        ...(patch.artistDocs !== undefined && { artist_documents: patch.artistDocs }),
      };
    }
    if (Object.keys(configPatch).length > 0) queueSave(configPatch);
  }

  function handlePostSelectionChange(config: PostSelectionConfig) {
    setPostSelection(config);
    const prevConfig = opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
    queueSave({
      pipeline_config: { ...prevConfig, post_selection: config },
    });
  }

  function handleNotificationDefaultsChange(defaults: NotificationDefaults) {
    setNotificationDefaults(defaults);
    const prevConfig = opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
    queueSave({
      pipeline_config: { ...prevConfig, notification_defaults: defaults },
    });
  }

  const allRequired = !!(
    opp.title?.trim() &&
    opp.organiser?.trim() &&
    (opp.full_description?.trim() || (opp as { description?: string | null }).description?.trim()) &&
    opp.country
  );

  async function handleNext() {
    if (step === 4 && isPipeline) {
      await saveRubricCriteria(opp.id, criteria);
    }
    if (step === maxStep) {
      if (!allRequired || submitting) return;
      setSubmitting(true);
      setSubmitError(null);
      const result = await submitDraftForReview(opp.id);
      setSubmitting(false);
      if (result.error) { setSubmitError(result.error); return; }
      if (result.redirectTo) router.push(result.redirectTo);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > minStep) setStep((s) => s - 1);
  }

  const nextDisabled = (step === 1 && !template) || (step === maxStep && (!allRequired || submitting));
  const isLastStep = step === maxStep;

  return (
    <>
      <WizardChrome
        steps={steps}
        currentStep={step}
        oppId={opp.id}
        type={isPipeline ? "pipeline" : "free"}
        saveStatus={saveStatus}
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={nextDisabled}
        isLastStep={isLastStep}
      />

      <main className="max-w-[1280px] mx-auto px-6 py-10 pb-24">
        {step === 1 && isPipeline && (
          <StepTemplate
            selectedTemplate={template}
            onChange={(key, qs) => {
              setTemplate(key);
              const prevConfig = opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
              const newConfig: PipelineConfig = { ...prevConfig, questions: qs, template: key as PipelineConfig["template"] };
              setOpp((prev) => ({ ...prev, pipeline_config: newConfig }));
              queueSave({ pipeline_config: newConfig });
            }}
          />
        )}

        {step === 2 && (
          <StepBasics
            opp={opp}
            isFree={!isPipeline}
            onChange={handleBasicsChange}
          />
        )}

        {step === 3 && isPipeline && (
          <StepFormBuilder
            questions={questions}
            showBadges={showBadges}
            artistDocs={artistDocs}
            onChange={handleFormChange}
          />
        )}

        {step === 4 && isPipeline && (
          <StepRubric
            opportunityId={opp.id}
            criteria={criteria}
            documents={documents}
            onCriteriaChange={setCriteria}
            onDocUploaded={(doc) => setDocuments((prev) => [...prev, doc])}
            onDocDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
          />
        )}

        {step === 5 && isPipeline && (
          <StepPostSelection
            postSelection={postSelection}
            notificationDefaults={notificationDefaults}
            onPostSelectionChange={handlePostSelectionChange}
            onNotificationDefaultsChange={handleNotificationDefaultsChange}
          />
        )}

        {step === (isPipeline ? 6 : 3) && (
          <StepReviewPublish
            opp={opp}
            criteria={criteria}
            isPipeline={isPipeline}
            submitError={submitError}
          />
        )}
      </main>
    </>
  );
}
