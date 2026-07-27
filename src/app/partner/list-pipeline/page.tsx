import { createClient } from "@/lib/supabase/server";
import { WizardShell } from "@/components/partner/wizard/WizardShell";
import { PipelineListingHandoff } from "@/components/partner/wizard/PipelineListingHandoff";
import type { Opportunity } from "@/types/database";

export const metadata = { title: "List a pipeline opportunity — Patronage" };

// A minimal Opportunity shell for the anonymous wizard. The wizard only reads a
// handful of these fields; everything is editable client-side and held in
// localStorage until the user signs in.
const BLANK_PIPELINE_OPP = {
  id: "",
  title: "",
  organiser: "",
  description: null,
  full_description: null,
  type: "Grant",
  country: "NZ",
  status: "draft",
  routing_type: "pipeline",
  pipeline_config: null,
  featured_image_url: null,
  show_badges_in_submission: false,
} as unknown as Opportunity;

export default async function ListPipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated arrival = returning from sign-in. Convert the saved draft into
  // a real listing and hand off to the normal wizard. (Also covers a logged-in
  // partner who lands here directly — the handoff falls back to the normal flow.)
  if (user) {
    return <PipelineListingHandoff />;
  }

  return (
    <div className="min-h-screen bg-background">
      <WizardShell
        opp={BLANK_PIPELINE_OPP}
        initialStep={1}
        isPipeline
        initialCriteria={[]}
        initialDocuments={[]}
        anonymous
      />
    </div>
  );
}
