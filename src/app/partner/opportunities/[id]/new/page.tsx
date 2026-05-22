import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardShell } from "@/components/partner/wizard/WizardShell";
import { getRubricCriteria, getPartnerDocuments } from "./actions";
import type { Opportunity, PartnerDocument } from "@/types/database";
import type { LocalCriterion } from "@/components/partner/wizard/RubricBuilder";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; type?: string }>;
}

export default async function NewOpportunityWizardPage({ params, searchParams }: Props) {
  const [{ id }, { step: stepParam, type: typeParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [oppResult, criteriaResult, docsResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .eq("profile_id", user.id)
      .single(),
    getRubricCriteria(id),
    getPartnerDocuments(id),
  ]);

  if (!oppResult.data) redirect("/partner/dashboard");

  const opp = oppResult.data as Opportunity;
  const isPipeline = typeParam === "pipeline" || opp.routing_type === "pipeline";

  const pipelineSteps = [1, 2, 3, 4, 5, 6];
  const freeSteps = [2, 3];
  const validSteps = isPipeline ? pipelineSteps : freeSteps;

  const requestedStep = parseInt(stepParam ?? "1");
  const initialStep = validSteps.includes(requestedStep)
    ? requestedStep
    : validSteps[0];

  const initialCriteria: LocalCriterion[] = criteriaResult.map((c) => ({
    id: c.id,
    label: c.label,
    helper: c.helper,
    weight: c.weight,
    scale_max: c.scale_max,
    position: c.position,
    locked: c.locked,
  }));

  return (
    <div className="min-h-screen bg-background">
      <WizardShell
        opp={opp}
        initialStep={initialStep}
        isPipeline={isPipeline}
        initialCriteria={initialCriteria}
        initialDocuments={docsResult}
      />
    </div>
  );
}
