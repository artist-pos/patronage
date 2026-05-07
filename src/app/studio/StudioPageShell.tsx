import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { getMissingFields, getCompletionPercent, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { ProfileCompletionBanner } from "@/components/profile/ProfileCompletionBanner";
import { StudioNav } from "./StudioNav";

interface Props {
  username: string;
  activeSection: string;
  children: React.ReactNode;
}

async function getPendingProvenanceCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const admin = createAdminClient();
    const { count } = await admin
      .from("artworks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .neq("current_owner_id", user.id)
      .is("certificate_note", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function StudioPageShell({ username, activeSection, children }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [pendingProvenanceCount, pendingConfirmationCount, completionProfile] = await Promise.all([
    getPendingProvenanceCount(),
    user ? getPendingConfirmationCount(user.id) : Promise.resolve(0),
    user ? fetchCompletionProfile(user.id) : Promise.resolve(null),
  ]);

  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const percent = completionProfile ? getCompletionPercent(completionProfile) : 0;
  const complete = completionProfile ? isProfileComplete(completionProfile) : false;

  const lockedSections = complete ? [] : ["provenance", "campaigns"];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and creative practice.
          </p>
        </div>
        <Link
          href={`/${username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View profile →
        </Link>
      </div>

      <ProfileCompletionBanner percent={percent} missingFields={missingFields} />

      <StudioNav
        activeSection={activeSection}
        sectionDots={{
          provenance: pendingProvenanceCount > 0,
          confirmations: pendingConfirmationCount > 0,
        }}
        lockedSections={lockedSections}
      >
        {children}
      </StudioNav>
    </div>
  );
}
