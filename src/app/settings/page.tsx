import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getCitiesWithRegions, getArtsOrganisations, getLocalBoards } from "@/lib/regions";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PartnerOrgFields } from "@/components/profile/PartnerOrgFields";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import { DigestToggle } from "@/components/profile/DigestToggle";
import { PrivacySection } from "@/components/profile/PrivacySection";
import { RichOpportunityModal } from "@/components/profile/RichOpportunityModal";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

interface PageProps {
  searchParams: Promise<{ tab?: string; welcome?: string }>;
}

// CV & Press and Groups now live exclusively in /studio/profile
const SETTINGS_TABS = ["profile", "account"] as const;
type Tab = typeof SETTINGS_TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  "profile": "Profile",
  "account": "Account",
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const { user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;

  // Redirect old CV/Press and Groups bookmarks to /studio/profile
  if (params.tab === "cv-press" || params.tab === "collectives") {
    redirect("/studio/profile");
  }

  // The location taxonomy does not depend on the profile, so it loads beside it.
  const [profile, cities, boards, artsOrgs] = await Promise.all([
    getProfileById(user.id),
    getCitiesWithRegions(),
    getLocalBoards(),
    getArtsOrganisations(),
  ]);
  if (!profile?.role) redirect("/onboarding/role");

  const role = profile.role;
  const isArtist  = role === "artist" || role === "owner";
  const isPartner = role === "partner";

  const tabs = SETTINGS_TABS;
  const rawTab = params.tab ?? "profile";
  const activeTab: Tab = (tabs as readonly string[]).includes(rawTab)
    ? rawTab as Tab
    : "profile";

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">

      {/* Welcome banner — shown once after role selection */}
      {params.welcome === "1" && (
        <div className="mb-8 border border-black bg-black text-white px-6 py-4 space-y-0.5">
          <p className="text-sm font-semibold">Welcome to Patronage!</p>
          <p className="text-sm opacity-80">
            We&apos;ve subscribed you to our weekly digest — you&apos;ll never miss a deadline.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, preferences, and account.
          </p>
        </div>
        <Link
          href={`/${profile.username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View profile →
        </Link>
      </div>

      {/* Mobile tab bar */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {tabs.map((t) => (
          <Link
            key={t}
            href={t === "profile" ? "/settings" : `/settings?tab=${t}`}
            className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              activeTab === t
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Sidebar */}
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-8 space-y-0.5">
          {tabs.map((t) => (
            <Link
              key={t}
              href={t === "profile" ? "/settings" : `/settings?tab=${t}`}
              className={`flex items-center px-3 py-2 text-sm rounded-sm transition-colors ${
                activeTab === t
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* ── Profile ── */}
          {activeTab === "profile" && (
            <>
              {/* Visuals + Profile Details */}
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
                  <ProfileForm profile={profile} role={role} cities={cities} boards={boards} artsOrgs={artsOrgs} />
                  {isPartner && (
                    <PartnerOrgFields
                      profile={{
                        organisation_type: profile.organisation_type,
                        org_category: profile.org_category,
                        charitable_registration: profile.charitable_registration,
                        donation_url: profile.donation_url,
                        donation_enabled: profile.donation_enabled,
                      }}
                    />
                  )}
                </section>
              </div>

              {/* Partner — list an opportunity */}
              {isPartner && (
                <section className="space-y-4 border-t border-border pt-10">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Opportunities</h2>
                    <p className="text-sm text-muted-foreground">
                      Post an open call, commission, grant, or other opportunity for artists. Listings appear on your public profile.
                    </p>
                  </div>
                  <RichOpportunityModal triggerLabel="List an Opportunity" />
                </section>
              )}

              {/* Patron — professional CV */}
              {role === "patron" && (
                <section className="space-y-4 border-t border-border pt-10">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Professional CV</h2>
                    <p className="text-sm text-muted-foreground">
                      Shared privately with partners when you apply for roles through Patronage.
                    </p>
                  </div>
                  <PortfolioUploader profileId={user.id} mode="professional-cv" />
                </section>
              )}

              {/* Artist — link to Studio for CV editing */}
              {isArtist && (
                <section className="border-t border-border pt-10">
                  <p className="text-sm text-muted-foreground">
                    Edit your CV, press, exhibitions, and group affiliations in your{" "}
                    <Link href="/studio/profile" className="underline underline-offset-2 text-foreground hover:text-muted-foreground transition-colors">
                      Studio
                    </Link>.
                  </p>
                </section>
              )}
            </>
          )}

          {/* ── Account ── */}
          {activeTab === "account" && (
            <>
              <section className="space-y-4 max-w-lg">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">Email Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    {isArtist
                      ? "You are subscribed to the weekly digest by default. Toggle off to unsubscribe."
                      : "Opt in to receive a weekly digest of new and closing-soon opportunities."}
                  </p>
                </div>
                <DigestToggle
                  initial={profile.weekly_digest ?? (isArtist ? true : false)}
                  autoSync={isArtist && profile.weekly_digest === null}
                />
              </section>

              {/* Patron — privacy settings (Phase 10: simplified master toggle) */}
              {role === "patron" && (
                <section className="space-y-4 border-t border-border pt-10 max-w-lg">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Privacy</h2>
                    <p className="text-sm text-muted-foreground">
                      Control what visitors see on your public profile.
                    </p>
                  </div>
                  <PrivacySection
                    initial={{
                      collection_public: profile.collection_public ?? true,
                      show_taste: profile.show_taste ?? true,
                      show_follows: profile.show_follows ?? true,
                      show_location: profile.show_location ?? true,
                      show_previously_collected: profile.show_previously_collected ?? true,
                      show_supporting: profile.show_supporting ?? true,
                    }}
                  />
                </section>
              )}

              <section className="space-y-4 border-t border-black pt-10 max-w-lg">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
                  <p className="text-sm text-muted-foreground">
                    Closing your account is permanent. Your profile and all data will be deleted immediately and cannot be recovered.
                  </p>
                </div>
                <TerminateAccountButton />
              </section>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
