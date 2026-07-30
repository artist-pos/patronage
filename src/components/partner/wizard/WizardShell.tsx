"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FREE_LISTING_DRAFT_KEY } from "@/lib/free-listing";
import { PIPELINE_LISTING_DRAFT_KEY } from "@/lib/pipeline-listing";
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
import { ALL_STAGE_VALUES, type PipelineStagesConfig } from "@/lib/pipeline-stages";
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
  /** Anonymous free-listing mode: persist to localStorage, gate auth at submit. */
  anonymous?: boolean;
}

const FREE_STEPS = [
  { number: 2, label: "Basics" },
  { number: 3, label: "Review" },
];

// Anonymous authors only fill the info step; they must sign in before the rest
// of the listing process (review + publish), which happens once authenticated.
const FREE_STEPS_ANON = [{ number: 2, label: "Basics" }];

const PIPELINE_STEPS = [
  { number: 1, label: "Template" },
  { number: 2, label: "Basics" },
  { number: 3, label: "Form" },
  { number: 4, label: "Scoring" },
  { number: 5, label: "Post-selection" },
  { number: 6, label: "Review & Publish" },
];

// Anonymous partners only fill Template + Basics; everything past that persists
// against a real opportunity id (rubric, documents, terms upload) so it's
// gated behind sign-in, same as free listings only doing Basics anonymously.
const PIPELINE_STEPS_ANON = [
  { number: 1, label: "Template" },
  { number: 2, label: "Basics" },
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
  anonymous = false,
}: Props) {
  const steps = isPipeline
    ? (anonymous ? PIPELINE_STEPS_ANON : PIPELINE_STEPS)
    : (anonymous ? FREE_STEPS_ANON : FREE_STEPS);
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

  // Pipeline stages config
  const [stagesConfig, setStagesConfig] = useState<PipelineStagesConfig>(
    initialOpp.pipeline_config?.pipeline_stages ?? { enabled: ALL_STAGE_VALUES }
  );

  // Questions + artist docs + badges (from pipeline_config)
  const questions = opp.pipeline_config?.questions ?? [];
  const artistDocs = (opp.pipeline_config?.artist_documents ?? []) as PipelineConfig["artist_documents"];
  const showBadges = opp.show_badges_in_submission ?? false;
  const portfolioPickCount = opp.pipeline_config?.portfolio_pick_count ?? 3;
  const workDescriptionsEnabled = opp.pipeline_config?.work_descriptions_enabled ?? false;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Anonymous mode: hydrate from localStorage once, then mirror every change to
  // it so the draft survives the sign-in round-trip (incl. email confirmation).
  // Pipeline also persists the selected template alongside the opp patch.
  const [hydrated, setHydrated] = useState(!anonymous);
  useEffect(() => {
    if (!anonymous) return;
    // Reading localStorage must happen after mount (it's unavailable during SSR),
    // so loading the saved draft into state here is intentional, not a cascade.
    try {
      const raw = localStorage.getItem(isPipeline ? PIPELINE_LISTING_DRAFT_KEY : FREE_LISTING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPipeline) {
          if (parsed.opp) setOpp((prev) => ({ ...prev, ...parsed.opp }));
          if (parsed.template) setTemplate(parsed.template as TemplateKey);
        } else {
          setOpp((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymous]);

  useEffect(() => {
    if (!anonymous || !hydrated) return;
    try {
      if (isPipeline) {
        localStorage.setItem(PIPELINE_LISTING_DRAFT_KEY, JSON.stringify({ opp, template }));
      } else {
        localStorage.setItem(FREE_LISTING_DRAFT_KEY, JSON.stringify(opp));
      }
    } catch {
      /* ignore */
    }
  }, [anonymous, hydrated, isPipeline, opp, template]);

  const queueSave = useCallback(
    (patch: Parameters<typeof updateOpportunityPartner>[1]) => {
      if (anonymous) return; // persistence handled by the localStorage effect
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
    [opp.id, anonymous]
  );

  function handleBasicsChange(patch: BasicsPatch) {
    setOpp((prev) => ({ ...prev, ...patch }));
    queueSave(patch as Parameters<typeof updateOpportunityPartner>[1]);
  }

  function handleFormChange(patch: {
    questions?: PipelineConfig["questions"];
    showBadges?: boolean;
    artistDocs?: PipelineConfig["artist_documents"];
    termsPdfUrl?: string | null;
    portfolioPickCount?: number;
    workDescriptionsEnabled?: boolean;
  }) {
    setOpp((prev) => {
      const prevConfig = prev.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
      const newConfig: PipelineConfig = {
        ...prevConfig,
        ...(patch.questions !== undefined && { questions: patch.questions }),
        ...(patch.artistDocs !== undefined && { artist_documents: patch.artistDocs }),
        ...(patch.termsPdfUrl !== undefined && { terms_pdf_url: patch.termsPdfUrl }),
        ...(patch.portfolioPickCount !== undefined && { portfolio_pick_count: patch.portfolioPickCount }),
        ...(patch.workDescriptionsEnabled !== undefined && { work_descriptions_enabled: patch.workDescriptionsEnabled }),
      };
      return { ...prev, pipeline_config: newConfig, show_badges_in_submission: patch.showBadges ?? prev.show_badges_in_submission };
    });

    const configPatch: Parameters<typeof updateOpportunityPartner>[1] = {};
    if (patch.showBadges !== undefined) configPatch.show_badges_in_submission = patch.showBadges;
    if (patch.questions !== undefined || patch.artistDocs !== undefined || patch.termsPdfUrl !== undefined || patch.portfolioPickCount !== undefined || patch.workDescriptionsEnabled !== undefined) {
      configPatch.pipeline_config = {
        ...(opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null }),
        ...(patch.questions !== undefined && { questions: patch.questions }),
        ...(patch.artistDocs !== undefined && { artist_documents: patch.artistDocs }),
        ...(patch.termsPdfUrl !== undefined && { terms_pdf_url: patch.termsPdfUrl }),
        ...(patch.portfolioPickCount !== undefined && { portfolio_pick_count: patch.portfolioPickCount }),
        ...(patch.workDescriptionsEnabled !== undefined && { work_descriptions_enabled: patch.workDescriptionsEnabled }),
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

  function handleStagesConfigChange(config: PipelineStagesConfig) {
    setStagesConfig(config);
    const prevConfig = opp.pipeline_config ?? { questions: [], artist_documents: [], terms_pdf_url: null };
    queueSave({
      pipeline_config: { ...prevConfig, pipeline_stages: config },
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
      // Anonymous free/pipeline listing: they've entered the info; gate auth here
      // before the rest of the process. Persist and send them to sign in / sign
      // up; they return to /partner/list-free or /partner/list-pipeline, which
      // finalises the draft and resumes the wizard authenticated.
      if (anonymous) {
        try {
          if (isPipeline) {
            localStorage.setItem(PIPELINE_LISTING_DRAFT_KEY, JSON.stringify({ opp, template }));
          } else {
            localStorage.setItem(FREE_LISTING_DRAFT_KEY, JSON.stringify(opp));
          }
        } catch {
          /* ignore */
        }
        // role=partner so a new account created from here defaults to partner;
        // returning users just sign in (role unchanged).
        const next = isPipeline ? "/partner/list-pipeline" : "/partner/list-free";
        router.push(`/auth/login?next=${encodeURIComponent(next)}&role=partner`);
        return;
      }
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
        anonymous={anonymous}
        nextLabel={anonymous && isLastStep ? "Sign in to continue →" : undefined}
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
            canUploadImage={!anonymous}
          />
        )}

        {step === 3 && isPipeline && (
          <StepFormBuilder
            opportunityId={opp.id}
            questions={questions}
            showBadges={showBadges}
            artistDocs={artistDocs}
            termsPdfUrl={opp.pipeline_config?.terms_pdf_url ?? null}
            portfolioPickCount={portfolioPickCount}
            workDescriptionsEnabled={workDescriptionsEnabled}
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
            stagesConfig={stagesConfig}
            onPostSelectionChange={handlePostSelectionChange}
            onNotificationDefaultsChange={handleNotificationDefaultsChange}
            onStagesConfigChange={handleStagesConfigChange}
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
