import { createClient } from "@/lib/supabase/server";
import { WizardShell } from "@/components/partner/wizard/WizardShell";
import { FreeListingHandoff } from "@/components/partner/wizard/FreeListingHandoff";
import type { Opportunity } from "@/types/database";

export const metadata = { title: "List a free opportunity — Patronage" };

// A minimal Opportunity shell for the anonymous wizard. The wizard only reads a
// handful of these fields; everything is editable client-side and held in
// localStorage until the user signs in.
const BLANK_FREE_OPP = {
  id: "",
  title: "",
  organiser: "",
  description: null,
  full_description: null,
  type: "Grant",
  country: "NZ",
  status: "draft",
  routing_type: "external",
  pipeline_config: null,
  featured_image_url: null,
  show_badges_in_submission: false,
} as unknown as Opportunity;

export default async function ListFreePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated arrival = returning from sign-in. Convert the saved draft into
  // a real listing and hand off to the normal wizard. (Also covers a logged-in
  // partner who lands here directly — the handoff falls back to the normal flow.)
  if (user) {
    return <FreeListingHandoff />;
  }

  return (
    <div className="min-h-screen bg-background">
      <WizardShell
        opp={BLANK_FREE_OPP}
        initialStep={2}
        isPipeline={false}
        initialCriteria={[]}
        initialDocuments={[]}
        anonymous
      />
    </div>
  );
}
