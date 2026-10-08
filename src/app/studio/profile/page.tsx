import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getCitiesWithRegions, getArtsOrganisations, getLocalBoards } from "@/lib/regions";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { ExhibitionEditor } from "@/components/profile/ExhibitionEditor";
import { EducationEditor } from "@/components/profile/EducationEditor";
import { BibliographyEditor } from "@/components/profile/BibliographyEditor";
import { GrantsSection } from "@/components/profile/GrantsSection";
import { StructuredGrantsManager } from "@/components/profile/StructuredGrantsManager";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { CollectivesManager } from "@/components/profile/CollectivesManager";
import type { Metadata } from "next";
import type { ExhibitionEntry, EducationEntry, BibliographyEntry, CollectiveMember, Grant } from "@/types/database";

export const metadata: Metadata = { title: "Profile & CV — Studio" };

export default async function StudioProfilePage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [fullProfile, cities, boards, artsOrgs, membershipsResult, grantsResult] = await Promise.all([
    getProfileById(user.id),
    getCitiesWithRegions(),
    getLocalBoards(),
    getArtsOrganisations(),
    supabase
      .from("collective_members")
      .select("*, collective:collectives(*)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .then((r) => r.data),
    supabase
      .from("grants")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!fullProfile) redirect("/auth/login");

  const initialMemberships = (membershipsResult ?? []) as CollectiveMember[];
  const structuredGrants = (grantsResult.data ?? []) as Grant[];

  return (
    <div className="space-y-12">
      {/* Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 gap-10 items-start">
        <section className="space-y-8">
          <h2 className="text-base font-semibold">Visuals</h2>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Profile Picture</p>
              <p className="text-sm text-muted-foreground">
                Square headshot shown on your public profile. Cropped and resized to 400 × 400 px.
              </p>
            </div>
            <AvatarUploader profileId={user.id} />
          </div>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Featured Image</p>
              <p className="text-sm text-muted-foreground">
                Displayed as the background of your directory card. Landscape works best.
              </p>
            </div>
            <FeaturedImageUploader profileId={user.id} />
          </div>
        </section>
        <section className="space-y-6 border-t border-border pt-10 lg:border-t-0 lg:pt-0">
          <h2 className="text-base font-semibold">Profile details</h2>
          <ProfileForm profile={fullProfile} role={fullProfile.role} cities={cities} boards={boards} artsOrgs={artsOrgs} stayOnPage />
        </section>
      </div>

      {/* Groups */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Groups</h2>
          <p className="text-sm text-muted-foreground">
            Create or join artist groups. Expand a group to manage members — search for artists by name or username to add them.
          </p>
        </div>
        <CollectivesManager userId={user.id} initialMemberships={initialMemberships} />
      </section>

      {/* CV */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">CV</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PDF of your CV. It will be publicly linked from your profile.
          </p>
        </div>
        <PortfolioUploader profileId={user.id} mode="cv" />
      </section>

      {/* Professional CV */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Professional CV</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PDF of your professional CV. This is <strong>not</strong> shown publicly — it is shared privately with partners only when you apply for roles through Patronage.
          </p>
        </div>
        <PortfolioUploader profileId={user.id} mode="professional-cv" />
      </section>

      {/* Education */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Education</h2>
          <p className="text-sm text-muted-foreground">
            Where you have studied, from school to art school. Shown on the CV tab of your profile.
          </p>
        </div>
        <EducationEditor
          profileId={user.id}
          initial={(fullProfile.education ?? []) as EducationEntry[]}
        />
      </section>

      {/* Exhibition History */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Exhibition History</h2>
          <p className="text-sm text-muted-foreground">
            List solo and group exhibitions. Displayed on your public profile grouped by type.
          </p>
        </div>
        <ExhibitionEditor
          profileId={user.id}
          initial={(fullProfile.exhibition_history ?? []) as ExhibitionEntry[]}
        />
      </section>

      {/* Grants */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Grants Received</h2>
          <p className="text-sm text-muted-foreground">
            Log grants, awards, or funding you have received. You can link each grant to a Studio project and generate QR codes for installations.
          </p>
        </div>
        <StructuredGrantsManager initialGrants={structuredGrants} />
        {((fullProfile as unknown as { received_grants?: string[] }).received_grants ?? []).length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Legacy tags</p>
            <GrantsSection
              initialGrants={(fullProfile as unknown as { received_grants?: string[] }).received_grants ?? []}
            />
          </div>
        )}
      </section>

      {/* Press */}
      <section className="space-y-4 border-t border-border pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Media & Press</h2>
          <p className="text-sm text-muted-foreground">
            Reviews, interviews, and features. Displayed as bibliographic citations on your public profile.
          </p>
        </div>
        <BibliographyEditor
          profileId={user.id}
          initial={(fullProfile.press_bibliography ?? []) as BibliographyEntry[]}
        />
      </section>
    </div>
  );
}
