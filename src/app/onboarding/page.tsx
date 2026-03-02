import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import { ExhibitionEditor } from "@/components/profile/ExhibitionEditor";
import { BibliographyEditor } from "@/components/profile/BibliographyEditor";
import { ProjectManager } from "@/components/profile/ProjectManager";
import { getArtistProjects } from "@/lib/projects";
import { getArtistUpdates } from "@/lib/feed";
import { redirect } from "next/navigation";
import type { ExhibitionEntry, BibliographyEntry } from "@/types/database";

export const metadata = { title: "Edit Profile — Patronage" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  const [artistProjects, artistUpdates] = profile
    ? await Promise.all([getArtistProjects(user.id), getArtistUpdates(user.id)])
    : [[], []];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile ? "Edit profile" : "Set up your profile"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile
            ? "Update your public artist profile."
            : "Complete your profile to appear in the artist directory."}
        </p>
      </div>

      {/* Visuals — shown only once profile exists */}
      {profile && (
        <section className="space-y-8">
          <h2 className="text-base font-semibold">Visuals</h2>

          <div className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Profile Picture</p>
              <p className="text-xs text-muted-foreground">
                Square headshot shown on your public profile. Cropped and resized to 400 × 400 px.
              </p>
            </div>
            <AvatarUploader profileId={user.id} />
          </div>

          <div className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Featured Artwork</p>
              <p className="text-xs text-muted-foreground">
                Displayed as the background of your directory card. Landscape works best.
              </p>
            </div>
            <FeaturedImageUploader profileId={user.id} />
          </div>
        </section>
      )}

      <section className="space-y-6 border-t border-border pt-12">
        <h2 className="text-base font-semibold">Profile details</h2>
        <ProfileForm profile={profile} />
      </section>

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Portfolio</h2>
            <p className="text-xs text-muted-foreground">
              Upload up to 10 images. JPEG or PNG, max 10 MB each. Resized to 1600px before
              uploading. Add a caption to each image by clicking below it.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} />
        </section>
      )}

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">CV</h2>
            <p className="text-xs text-muted-foreground">
              Upload a PDF of your CV. It will be publicly linked from your profile.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} mode="cv" />
        </section>
      )}

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Exhibition History</h2>
            <p className="text-xs text-muted-foreground">
              List solo and group exhibitions. Displayed on your public profile grouped by type.
            </p>
          </div>
          <ExhibitionEditor
            profileId={user.id}
            initial={(profile.exhibition_history ?? []) as ExhibitionEntry[]}
          />
        </section>
      )}

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Selected Bibliography</h2>
            <p className="text-xs text-muted-foreground">
              Reviews, interviews, and features. Displayed as bibliographic citations on your public profile.
            </p>
          </div>
          <BibliographyEditor
            profileId={user.id}
            initial={(profile.press_bibliography ?? []) as BibliographyEntry[]}
          />
        </section>
      )}

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Project Threads</h2>
            <p className="text-xs text-muted-foreground">
              Group your studio updates into named threads — e.g. &lsquo;Fabrication Diary&rsquo; or &lsquo;Installation 2026&rsquo;. Each thread gets its own public timeline page.
            </p>
          </div>
          <ProjectManager projects={artistProjects} updates={artistUpdates} />
        </section>
      )}

      {/* ── Danger Zone ── */}
      {profile && (
        <section className="space-y-4 border-t border-black pt-12 mt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
            <p className="text-xs text-muted-foreground">
              Terminating your account is permanent. Your profile, portfolio
              images, and all data will be deleted immediately and cannot be recovered.
            </p>
          </div>
          <TerminateAccountButton />
        </section>
      )}
    </div>
  );
}
