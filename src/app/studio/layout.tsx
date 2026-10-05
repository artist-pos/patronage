import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { getMissingFields, getCompletionPercent, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { ProfileCompletionBanner } from "@/components/profile/ProfileCompletionBanner";
import { StudioNav } from "./StudioNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio",
};

const WORKSPACE_LABELS: Record<string, { title: string; subtitle: string }> = {
  artist: { title: "Studio", subtitle: "Manage your profile and creative practice." },
  owner:  { title: "Studio", subtitle: "Manage your profile and creative practice." },
  admin:  { title: "Studio", subtitle: "Manage your profile and creative practice." },
  patron: { title: "Dashboard", subtitle: "Your collection, opportunities, and support." },
  partner: { title: "Dashboard", subtitle: "Manage your calls, artists, and listings." },
};

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [{ data: profileRow }, completionProfile] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, username")
      .eq("id", user.id)
      .single(),
    fetchCompletionProfile(user.id),
  ]);

  if (!profileRow) redirect("/onboarding/role");

  const role = profileRow.role;
  const isArtist = role === "artist" || role === "owner" || role === "admin";
  const labels = WORKSPACE_LABELS[role] ?? WORKSPACE_LABELS.patron;

  const [pendingProvenanceCount, pendingConfirmationCount] = isArtist
    ? await Promise.all([
        (async () => {
          try {
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
        })(),
        getPendingConfirmationCount(user.id),
      ])
    : [0, 0];

  const missingFields = completionProfile
    ? getMissingFields(completionProfile)
    : [];
  const percent = completionProfile
    ? getCompletionPercent(completionProfile)
    : 0;
  const complete = completionProfile
    ? isProfileComplete(completionProfile)
    : false;
  const lockedSections = complete ? [] : ["provenance", "qr-codes"];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
          <p className="text-sm text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>
        <Link
          href={`/${profileRow.username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View profile →
        </Link>
      </div>

      {isArtist && (
        <ProfileCompletionBanner
          percent={percent}
          missingFields={missingFields}
        />
      )}

      <StudioNav
        role={role}
        sectionDots={{ provenance: pendingProvenanceCount > 0 }}
        sectionCounts={{
          works:
            pendingConfirmationCount > 0 ? pendingConfirmationCount : 0,
        }}
        lockedSections={lockedSections}
      >
        {children}
      </StudioNav>
    </div>
  );
}
