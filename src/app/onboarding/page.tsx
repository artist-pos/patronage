import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import { ExhibitionEditor } from "@/components/profile/ExhibitionEditor";
import { BibliographyEditor } from "@/components/profile/BibliographyEditor";
import { GrantsSection } from "@/components/profile/GrantsSection";
import { RichOpportunityModal } from "@/components/profile/RichOpportunityModal";
import { redirect } from "next/navigation";
import type { ExhibitionEntry, BibliographyEntry } from "@/types/database";

export const metadata = { title: "Edit Profile — Patronage" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);

  if (!profile?.role) redirect("/onboarding/role");

  const isArtist = profile.role === "artist" || profile.role === "owner";
  const { welcome } = await searchParams;
  const showWelcomeBanner = isArtist && welcome === "1";

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-12 space-y-12">

      {/* ── Welcome / subscription confirmation banner ── */}
      {showWelcomeBanner && (
        <div className="border border-black bg-black text-white px-6 py-4 space-y-0.5">
          <p className="text-sm font-semibold">Welcome to Patronage!</p>
          <p className="text-sm opacity-80">
            We&apos;ve subscribed you to our Weekly Digest to ensure you never miss a deadline.
          </p>
        </div>
      )}

      {/* ── Header ── */}
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isArtist ? "Edit your artist profile" : "Update your profile"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isArtist
            ? "Update your public artist profile."
            : "Update your profile."}
        </p>
      </div>

      {/* ── Two-column grid: Visuals + Profile Details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 gap-10 items-start">

        {/* Left: Visuals */}
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

        {/* Right: Profile Details */}
        <section className="space-y-6 border-t border-border pt-10 lg:border-t-0 lg:pt-0">
          <h2 className="text-base font-semibold">Profile details</h2>
          <ProfileForm profile={profile} role={profile.role} />
        </section>
      </div>

      {/* ── Artist-only: Portfolio ── */}
      {isArtist && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Portfolio</h2>
            <p className="text-xs text-muted-foreground">
              Upload up to 10 images. JPEG or PNG, max 10 MB each. Resized to 1600 px before
              uploading. Add a title and description to each image by clicking below it. Drag to reorder.
              Use Hide to remove an image from your public profile without deleting it.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} />
        </section>
      )}

      {/* ── Artist-only: CV ── */}
      {isArtist && (
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

      {/* ── Artist-only: Exhibition History ── */}
      {isArtist && (
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

      {/* ── Artist-only: Grants Received ── */}
      {isArtist && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Grants Received</h2>
            <p className="text-xs text-muted-foreground">
              List grants, awards, or funding you have received. These appear as trust signals on your profile.
            </p>
          </div>
          <GrantsSection initialGrants={(profile as unknown as { received_grants?: string[] }).received_grants ?? []} />
        </section>
      )}

      {/* ── Patron / Partner: List an Opportunity ── */}
      {!isArtist && (
        <section className="space-y-4 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Opportunities</h2>
            <p className="text-xs text-muted-foreground">
              Post an open call, commission, grant, or other opportunity for artists. Listings appear on your public profile.
            </p>
          </div>
          <RichOpportunityModal triggerLabel="List an Opportunity" />
        </section>
      )}

      {/* ── Media & Press (all roles) ── */}
      <section className="space-y-6 border-t border-border pt-12">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Media & Press</h2>
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

      {/* ── Danger Zone ── */}
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
    </div>
  );
}
