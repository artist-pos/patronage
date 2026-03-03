import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import { ExhibitionEditor } from "@/components/profile/ExhibitionEditor";
import { BibliographyEditor } from "@/components/profile/BibliographyEditor";
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

  if (!profile?.role) redirect("/onboarding/role");

  const isArtist = profile.role === "artist" || profile.role === "owner";

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile ? "Edit profile" : "Set up your profile"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile
            ? isArtist
              ? "Update your public artist profile."
              : "Update your profile."
            : "Complete your profile to get started."}
        </p>
      </div>

      {/* Visuals */}
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
              <p className="text-sm font-medium">Featured Image</p>
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
        <ProfileForm profile={profile} role={profile.role} />
      </section>

      {/* Artist-only: Portfolio */}
      {profile && isArtist && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Portfolio</h2>
            <p className="text-xs text-muted-foreground">
              Upload up to 10 images. JPEG or PNG, max 10 MB each. Resized to 1600px before
              uploading. Add a caption to each image by clicking below it. Drag images to reorder.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} />
        </section>
      )}

      {/* Artist-only: CV */}
      {profile && isArtist && (
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

      {/* Artist-only: Exhibition History */}
      {profile && isArtist && (
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

      {/* Bibliography — "Selected Bibliography" for artists, "Media & Press" for others */}
      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">
              {isArtist ? "Selected Bibliography" : "Media & Press"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isArtist
                ? "Reviews, interviews, and features. Displayed as bibliographic citations on your public profile."
                : "Press coverage, interviews, and features relevant to your work."}
            </p>
          </div>
          <BibliographyEditor
            profileId={user.id}
            initial={(profile.press_bibliography ?? []) as BibliographyEntry[]}
          />
        </section>
      )}

      {/* Danger Zone */}
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
