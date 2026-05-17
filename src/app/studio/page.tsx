import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { SectionLockGate } from "@/components/studio/SectionLockGate";
import { StudioPageShell } from "./StudioPageShell";
import { Section, VALID_SECTIONS, LEGACY_SECTION_ALIASES } from "./sidebar-config";
import { getProfileById } from "@/lib/profiles";
import { getArtistUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { SupportTiersManager } from "@/components/profile/SupportTiersManager";
import { CampaignDeleteButton } from "@/components/campaigns/CampaignDeleteButton";
import { CreateCampaignFromSelectionButton } from "@/components/campaigns/CreateCampaignFromSelectionButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import { ExhibitionEditor } from "@/components/profile/ExhibitionEditor";
import { BibliographyEditor } from "@/components/profile/BibliographyEditor";
import { GrantsSection } from "@/components/profile/GrantsSection";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { DigestToggle } from "@/components/profile/DigestToggle";
import { CollectivesManager } from "@/components/profile/CollectivesManager";
import { FollowersTab } from "@/components/analytics/FollowersTab";
import { ProfileViewsChartWrapper } from "@/components/analytics/ProfileViewsChartWrapper";
import { getMyWrittenNotes } from "@/lib/notes";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { WorksTabsClient } from "@/components/studio/WorksTabsClient";
import { FeedTabsClient } from "@/components/studio/FeedTabsClient";
import { OpportunitiesFilterClient } from "@/components/studio/OpportunitiesFilterClient";
import type { Metadata } from "next";
import type { SupportTier, ExhibitionEntry, BibliographyEntry, CollectiveMember, ProjectUpdateWithArtist, Project } from "@/types/database";

export const metadata: Metadata = {
  title: "Studio — Patronage",
};

// ── Page ────────────────────────────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<{
    section?: string;
    tab?: string;
    /** works sub-tab: archival | for-sale | sold | collected */
    wt?: string;
    /** feed sub-tab: updates | projects | notes */
    ft?: string;
    /** analytics period */
    range?: string;
    /** opportunities filter */
    of?: string;
    /** first-run welcome banner — set by /onboarding/role after artist signup */
    welcome?: string;
  }>;
}

export default async function StudioPage({ searchParams }: PageProps) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [{ data: profileRow }, completionProfile] = await Promise.all([
    supabase.from("profiles").select("role, username").eq("id", user.id).single(),
    fetchCompletionProfile(user.id),
  ]);

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/dashboard");
  }

  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  const params = await searchParams;
  const raw = params.section ?? params.tab ?? "works";
  // Resolve legacy section IDs and tab aliases to new canonical IDs
  const resolved = LEGACY_SECTION_ALIASES[raw] ?? raw;
  const activeSection: Section = VALID_SECTIONS.includes(resolved)
    ? (resolved as Section)
    : "works";

  if (activeSection === "provenance") redirect("/studio/provenance");
  if (activeSection === "collection") redirect("/dashboard/collection");

  // Sub-tab initial values — read once for SSR; client components manage subsequent switches
  const WORKS_TABS = ["archival", "for-sale", "sold"] as const;
  type WorksTab = typeof WORKS_TABS[number];
  const initialWorksTab: WorksTab = (WORKS_TABS as readonly string[]).includes(params.wt ?? "")
    ? (params.wt as WorksTab)
    : "archival";

  const FEED_TABS = ["updates", "projects", "notes"] as const;
  type FeedTab = typeof FEED_TABS[number];
  const initialFeedTab: FeedTab = (FEED_TABS as readonly string[]).includes(params.ft ?? "")
    ? (params.ft as FeedTab)
    : "updates";

  const analyticsDays = params.range === "7" ? 7 : params.range === "90" ? 90 : 30;

  // ── Conditional data fetching ─────────────────────────────────────────────
  const needsIdentity      = activeSection === "profile-cv" || activeSection === "account";
  const needsWorks         = activeSection === "works";
  const needsUpdates       = activeSection === "feed";
  const needsProjects      = activeSection === "feed";
  const needsCampaigns     = activeSection === "campaigns";
  const needsTiers         = activeSection === "support-tiers";
  // Notes always fetched with feed section so the tab switch is instant
  const needsNotes         = activeSection === "feed";
  const needsAnalytics     = activeSection === "analytics";
  const needsOpportunities = activeSection === "opportunities" || activeSection === "home";

  // Identity: full profile + collectives (profile section only)
  const [fullProfile, membershipsRaw] = needsIdentity
    ? await Promise.all([
        getProfileById(user.id),
        activeSection === "profile-cv"
          ? supabase
              .from("collective_members")
              .select("*, collective:collectives(*)")
              .eq("user_id", user.id)
              .order("joined_at", { ascending: true })
              .then((r) => r.data)
          : Promise.resolve(null),
      ])
    : [null, null];

  const initialMemberships = (membershipsRaw ?? []) as CollectiveMember[];

  // Works: portfolio, available, sold, confirmations, collected — all in one round
  const [portfolioResult, availableResult, soldResult, featuredRows, engagementRows, pendingConfirmationCount] =
    needsWorks
      ? await Promise.all([
          supabase
            .from("artworks")
            .select("id, url, caption, description, hide_from_archive, is_available, position, created_at, content_type, title, year, medium, dimensions")
            .eq("profile_id", user.id)
            .eq("creator_id", user.id)
            .eq("is_available", false)
            .neq("source", "holder_uploaded")
            .order("position", { ascending: true }),
          supabase
            .from("artworks")
            .select("id, url, caption, description, price_cents, is_poa, price_currency, is_available, hide_available, hide_price, position, created_at")
            .eq("profile_id", user.id)
            .eq("is_available", true)
            .order("position", { ascending: true }),
          supabase
            .from("artworks")
            .select("id, url, caption, price_cents, is_poa, price_currency, created_at, current_owner_id, hidden_from_artist, ledger_id")
            .eq("creator_id", user.id)
            .neq("current_owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("artworks")
            .select("id, is_featured")
            .eq("profile_id", user.id)
            .eq("creator_id", user.id)
            .eq("is_available", false)
            .eq("is_featured", true),
          supabase
            .from("artworks")
            .select("id")
            .eq("profile_id", user.id)
            .eq("creator_id", user.id)
            .eq("is_available", false)
            .then(async ({ data: pids }) => {
              const ids = (pids ?? []).map((r: { id: string }) => r.id);
              if (!ids.length) return { data: [] };
              return supabase
                .from("engagement_logs")
                .select("work_id, event_type")
                .in("work_id", ids);
            }),
          getPendingConfirmationCount(user.id),
        ])
      : [null, null, null, null, null, 0];

  const featuredIds = new Set(
    ((featuredRows as { data: { id: string }[] | null } | null)?.data ?? []).map((r) => r.id)
  );
  const portfolioWorks = (
    (portfolioResult as { data: { id: string; [key: string]: unknown }[] | null } | null)?.data ?? []
  ).map((w) => ({ ...w, is_featured: featuredIds.has(w.id) }));
  const availableWorks = (availableResult as { data: unknown[] | null } | null)?.data ?? [];
  const soldWorks = (soldResult as { data: unknown[] | null } | null)?.data ?? [];
  const featuredCount = featuredIds.size;

  const engagementMap: Record<string, { view: number; play: number }> = {};
  for (const row of ((engagementRows as { data: { work_id: string; event_type: string }[] | null } | null)?.data ?? [])) {
    if (!engagementMap[row.work_id]) engagementMap[row.work_id] = { view: 0, play: 0 };
    if (row.event_type === "view") engagementMap[row.work_id].view++;
    if (row.event_type === "play") engagementMap[row.work_id].play++;
  }

  // Studio Updates + Projects + artworks for project linking
  const [studioUpdates, studioProjects, feedArtworksResult] =
    needsUpdates || needsProjects
      ? await Promise.all([
          getArtistUpdates(user.id),
          getArtistProjects(user.id),
          supabase
            .from("artworks")
            .select("id, title, caption")
            .eq("creator_id", user.id)
            .order("created_at", { ascending: false }),
        ])
      : [[] as ProjectUpdateWithArtist[], [] as Project[], null];

  const feedArtworks = ((feedArtworksResult as { data: { id: string; title: string | null; caption: string | null }[] | null } | null)?.data ?? [])
    .map((a) => ({ id: a.id, label: a.title ?? a.caption ?? "Untitled" }));

  // Campaigns
  let campaigns: Array<{
    id: string; title: string; campaign_type: string; status: string;
    partner_name: string | null; campaign_start_date: string | null; campaign_end_date: string | null;
  }> = [];
  let unlinkedSelections: Array<{
    id: string;
    opportunity_id: string;
    opportunity: { id: string; title: string; type: string; organiser: string | null } | null;
  }> = [];
  if (needsCampaigns) {
    try {
      const [{ data: campaignsData }, { data: selectedApps }, { data: existingCampaigns }] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, title, campaign_type, status, partner_name, campaign_start_date, campaign_end_date")
          .eq("artist_profile_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("opportunity_applications")
          .select("id, opportunity_id, opportunity:opportunity_id(id, title, type, organiser)")
          .eq("artist_id", user.id)
          .in("status", ["selected", "approved_pending_assets"]),
        supabase
          .from("campaigns")
          .select("opportunity_id")
          .eq("artist_profile_id", user.id)
          .not("opportunity_id", "is", null),
      ]);
      campaigns = (campaignsData ?? []) as typeof campaigns;
      const linkedOppIds = new Set(
        ((existingCampaigns ?? []) as Array<{ opportunity_id: string | null }>)
          .map(c => c.opportunity_id)
          .filter(Boolean) as string[]
      );
      unlinkedSelections = ((selectedApps ?? []) as unknown as typeof unlinkedSelections)
        .filter(a => a.opportunity_id && !linkedOppIds.has(a.opportunity_id));
    } catch {
      // Table may not exist yet — show empty state
    }
  }

  // Support Tiers
  const { data: tiersData } = needsTiers
    ? await supabase
        .from("support_tiers")
        .select("*")
        .eq("profile_id", user.id)
        .order("sort_order", { ascending: true })
    : { data: null };
  const initialTiers = (tiersData ?? []) as SupportTier[];


  // Notes (Feed section — Notes tab)
  const feedNotes = needsNotes ? await getMyWrittenNotes(user.id) : [];

  // Opportunities
  const OPP_FILTERS = ["all", "saved", "closing", "applied", "expired"] as const;
  type OppFilter = typeof OPP_FILTERS[number];
  const activeOppFilter: OppFilter = (OPP_FILTERS as readonly string[]).includes(params.of ?? "")
    ? (params.of as OppFilter)
    : "all";

  let savedList: ReturnType<typeof categorizeSaved>["saved"] = [];
  let closingSoon: ReturnType<typeof categorizeSaved>["closingSoon"] = [];
  let applied: ReturnType<typeof categorizeSaved>["applied"] = [];
  let expired: ReturnType<typeof categorizeSaved>["expired"] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let applications: any[] = [];

  if (needsOpportunities) {
    const [savedData, applicationsData] = await Promise.all([
      getSavedOpportunities(),
      supabase
        .from("opportunity_applications")
        .select("*, opportunity:opportunities(id, slug, title, organiser, type, deadline, profile_id, pipeline_config, profiles:profile_id(full_name, username))")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const categorised = categorizeSaved(savedData);
    savedList   = categorised.saved;
    closingSoon = categorised.closingSoon;
    applied     = categorised.applied;
    expired     = categorised.expired;
    applications = applicationsData.data ?? [];
  }

  // Analytics
  const [analyticsStats, analyticsFollowers] = needsAnalytics
    ? await Promise.all([
        getProfileStats(user.id, analyticsDays),
        getFollowers(user.id),
      ])
    : [null, null];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StudioPageShell username={profileRow.username} activeSection={activeSection}>
      {params.welcome === "1" && (
        <div className="mb-8 border border-black bg-black text-white px-6 py-4 space-y-0.5">
          <p className="text-sm font-semibold">Welcome to Patronage!</p>
          <p className="text-sm opacity-80">
            We&apos;ve subscribed you to the weekly digest — you&apos;ll never miss a deadline. Start by completing your profile.
          </p>
        </div>
      )}
      <div className="space-y-10">

        {/* ── Profile & CV ── */}
        {activeSection === "profile-cv" && fullProfile && (
          <div className="space-y-12">
            {/* Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 gap-10 items-start">
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
              <section className="space-y-6 border-t border-border pt-10 lg:border-t-0 lg:pt-0">
                <h2 className="text-base font-semibold">Profile details</h2>
                <ProfileForm profile={fullProfile} role={fullProfile.role} />
              </section>
            </div>

            {/* Collectives */}
            <section className="space-y-4 border-t border-border pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Collectives & Groups</h2>
                <p className="text-xs text-muted-foreground">
                  Create or join artist collectives. Expand a collective to manage members — search for artists by name or username to add them.
                </p>
              </div>
              <CollectivesManager userId={user.id} initialMemberships={initialMemberships} />
            </section>

            {/* CV */}
            <section className="space-y-4 border-t border-border pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">CV</h2>
                <p className="text-xs text-muted-foreground">
                  Upload a PDF of your CV. It will be publicly linked from your profile.
                </p>
              </div>
              <PortfolioUploader profileId={user.id} mode="cv" />
            </section>

            {/* Professional CV */}
            <section className="space-y-4 border-t border-border pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Professional CV</h2>
                <p className="text-xs text-muted-foreground">
                  Upload a PDF of your professional CV. This is <strong>not</strong> shown publicly — it is shared privately with partners only when you apply for roles through Patronage.
                </p>
              </div>
              <PortfolioUploader profileId={user.id} mode="professional-cv" />
            </section>

            {/* Exhibition History */}
            <section className="space-y-4 border-t border-border pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Exhibition History</h2>
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
                  List grants, awards, or funding you have received. These appear as trust signals on your profile.
                </p>
              </div>
              <GrantsSection
                initialGrants={(fullProfile as unknown as { received_grants?: string[] }).received_grants ?? []}
              />
            </section>

            {/* Press */}
            <section className="space-y-4 border-t border-border pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Media & Press</h2>
                <p className="text-xs text-muted-foreground">
                  Reviews, interviews, and features. Displayed as bibliographic citations on your public profile.
                </p>
              </div>
              <BibliographyEditor
                profileId={user.id}
                initial={(fullProfile.press_bibliography ?? []) as BibliographyEntry[]}
              />
            </section>
          </div>
        )}

        {/* ── Account ── */}
        {activeSection === "account" && fullProfile && (
          <div className="space-y-12 max-w-2xl">
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Email Preferences</h2>
                <p className="text-xs text-muted-foreground">
                  You are subscribed to the weekly digest by default. Toggle off to unsubscribe.
                </p>
              </div>
              <DigestToggle
                initial={fullProfile.weekly_digest ?? true}
                autoSync={fullProfile.weekly_digest === null}
              />
            </section>

            <section className="space-y-4 border-t border-black pt-10">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
                <p className="text-xs text-muted-foreground">
                  Terminating your account is permanent. Your profile, portfolio images, and all data will be deleted immediately and cannot be recovered.
                </p>
              </div>
              <TerminateAccountButton />
            </section>
          </div>
        )}

        {/* ── Works ── */}
        {activeSection === "works" && (
          <WorksTabsClient
            initialTab={initialWorksTab}
            profileId={user.id}
            profileComplete={profileComplete}
            missingFields={missingFields}
            portfolioWorks={portfolioWorks as Parameters<typeof WorksTabsClient>[0]["portfolioWorks"]}
            availableWorks={availableWorks as Parameters<typeof WorksTabsClient>[0]["availableWorks"]}
            soldWorks={soldWorks as Parameters<typeof WorksTabsClient>[0]["soldWorks"]}
            featuredCount={featuredCount}
            engagementMap={engagementMap}
            pendingConfirmationCount={pendingConfirmationCount}
          />
        )}

        {/* ── Studio Feed ── */}
        {activeSection === "feed" && (
          <FeedTabsClient
            initialTab={initialFeedTab}
            artistUsername={profileRow.username}
            profileId={user.id}
            studioUpdates={studioUpdates}
            studioProjects={studioProjects}
            feedArtworks={feedArtworks}
            feedNotes={feedNotes}
          />
        )}

        {/* ── Campaigns ── */}
        {activeSection === "campaigns" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Campaigns</h2>
                <p className="text-sm text-muted-foreground">
                  QR campaigns for public art, exhibitions, and activations.
                </p>
              </div>
              {profileComplete && (
                <Link
                  href="/studio/campaigns/new"
                  className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
                >
                  + Create campaign
                </Link>
              )}
            </div>

            {/* Unlinked selection prompts */}
            {profileComplete && unlinkedSelections.length > 0 && (
              <div className="space-y-3">
                {unlinkedSelections.map((sel) => (
                  <div key={sel.id} className="flex items-center justify-between gap-4 border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium text-emerald-900">
                        You&apos;ve been selected for{" "}
                        <span className="font-semibold">{sel.opportunity?.title ?? "an opportunity"}</span>.
                      </p>
                      <p className="text-xs text-emerald-700">Create a campaign page to share your work with the public.</p>
                    </div>
                    <div className="shrink-0">
                      <CreateCampaignFromSelectionButton
                        applicationId={sel.id}
                        opportunityId={sel.opportunity_id}
                        opportunityTitle={sel.opportunity?.title ?? ""}
                        opportunityType={sel.opportunity?.type ?? "other"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!profileComplete ? (
              <SectionLockGate featureName="Campaigns" missingFields={missingFields} />
            ) : campaigns.length === 0 ? (
              <div className="py-16 space-y-3 text-center border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Campaigns appear here when you&apos;re selected for partner opportunities, or when you create one for your next show.
                </p>
                <Link
                  href="/studio/campaigns/new"
                  className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
                >
                  Create QR labels for your next show →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.partner_name ?? "Self-managed"}
                        {c.campaign_start_date && ` · ${c.campaign_start_date}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide ${
                        c.status === "live" ? "bg-green-100 text-green-700"
                          : c.status === "completed" ? "bg-stone-100 text-stone-500"
                          : "bg-stone-100 text-stone-600"
                      }`}>
                        {c.status}
                      </span>
                      <Link
                        href={`/studio/campaigns/${c.id}`}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {c.status === "live" ? "View →" : "Configure →"}
                      </Link>
                      <CampaignDeleteButton campaignId={c.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Support Tiers ── */}
        {activeSection === "support-tiers" && (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Support Tiers</h2>
              <p className="text-xs text-muted-foreground">
                Configure support tiers for patrons to back your practice. Payments are coming soon — configure tiers now to capture early interest.
              </p>
            </div>
            <SupportTiersManager initialTiers={initialTiers} />
          </div>
        )}

        {/* ── Analytics ── */}
        {activeSection === "analytics" && analyticsStats && (
          <div className="space-y-10">
            {/* Period selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Analytics</h2>
              <div className="flex gap-1">
                {([7, 30, 90] as const).map((d) => (
                  <Link
                    key={d}
                    href={`/studio?section=analytics&range=${d}`}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      analyticsDays === d
                        ? "border-black bg-black text-white"
                        : "border-border hover:border-black"
                    }`}
                  >
                    {d}d
                  </Link>
                ))}
              </div>
            </div>

            {/* Audience */}
            <section className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Audience</p>
              <div className="flex items-end gap-5">
                <div className="space-y-0.5">
                  <p className="text-6xl font-bold tabular-nums">{analyticsStats.followersTotal.toLocaleString()}</p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Followers</p>
                </div>
                {analyticsStats.followersGained30 > 0 && (
                  <p className="text-sm text-green-600 mb-1">+{analyticsStats.followersGained30} this period</p>
                )}
              </div>
              {analyticsFollowers && <FollowersTab followers={analyticsFollowers} />}
            </section>

            {/* Discovery */}
            <section className="space-y-5 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discovery</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AnalyticsStatCard label="Profile Views" value={analyticsStats.profileViews30} prevValue={analyticsStats.profileViewsPrev30} description="Visits to your public profile" period={`${analyticsDays}d`} />
                <AnalyticsStatCard label="CV Downloads" value={analyticsStats.cvClicks30} description="Clicks on your CV link" period={`${analyticsDays}d`} />
                <AnalyticsStatCard label="Website Clicks" value={analyticsStats.websiteClicks30} description="Clicks through to your website" period={`${analyticsDays}d`} />
              </div>
              <ProfileViewsChartWrapper data={analyticsStats.profileViewsTimeline} days={analyticsDays} />
            </section>

            {/* Engagement */}
            <section className="space-y-4 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Engagement</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AnalyticsStatCard label="Artwork Views" value={analyticsStats.artworkViews30} description="Times your portfolio works were opened" period={`${analyticsDays}d`} />
                <AnalyticsStatCard label="Followers Gained" value={analyticsStats.followersGained30} description={`New followers in the last ${analyticsDays} days`} />
                <AnalyticsStatCard label="Works Added" value={analyticsStats.worksAdded30} description="New works added to your portfolio" period={`${analyticsDays}d`} />
              </div>
            </section>

            {/* Career */}
            <section className="space-y-4 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career Activity</p>
              <div className="grid grid-cols-2 gap-3">
                <AnalyticsStatCard label="Applied" value={analyticsStats.opportunitiesApplied} description="Opportunities applied to through Patronage" />
                <AnalyticsStatCard label="Saved" value={analyticsStats.opportunitiesSaved} description="Opportunities bookmarked" />
              </div>
            </section>
          </div>
        )}

        {/* ── Home ── */}
        {activeSection === "home" && (
          <div className="space-y-10">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Your studio at a glance.</p>
            </div>

            {/* Profile completion nudge */}
            {!profileComplete && missingFields.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Finish setting up your profile</p>
                <p className="text-sm text-amber-800">
                  Add{" "}
                  {missingFields.map((f, i) => (
                    <span key={f.key}>
                      {i > 0 && ", "}
                      <Link href={f.href} className="underline underline-offset-2 hover:text-amber-950 transition-colors">
                        {f.label}
                      </Link>
                    </span>
                  ))}{" "}
                  to unlock all features and appear in the directory.
                </p>
              </div>
            )}

            {/* Quick links grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: "/studio?section=works", label: "Works", description: "Manage your portfolio and listings" },
                { href: "/studio?section=feed", label: "Studio Feed", description: "Post updates and project threads" },
                { href: "/studio?section=opportunities", label: "Opportunities", description: "Saved grants, residencies, and applications" },
                { href: "/studio?section=analytics", label: "Analytics", description: "Profile views, followers, and engagement" },
                { href: "/studio?section=profile-cv", label: "Profile & CV", description: "Edit your bio, exhibitions, and press" },
                { href: "/studio?section=support-tiers", label: "Support Tiers", description: "Configure patron support levels" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border border-border p-4 space-y-1 hover:border-black transition-colors group"
                >
                  <p className="text-sm font-semibold group-hover:underline underline-offset-2">{item.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </Link>
              ))}
            </div>

            {/* Pending confirmations */}
            {pendingConfirmationCount > 0 && (
              <div className="flex items-center justify-between border border-amber-200 bg-amber-50 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-900">
                  <span className="font-semibold">{pendingConfirmationCount}</span> work{pendingConfirmationCount !== 1 ? "s" : ""} need attribution confirmation.
                </p>
                <Link href="/studio/pending-confirmations" className="text-sm text-amber-900 underline underline-offset-2 shrink-0 ml-4">
                  Review →
                </Link>
              </div>
            )}

            {/* Closing soon opportunities */}
            {closingSoon.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Closing Soon</p>
                  <Link href="/studio?section=opportunities&of=closing" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
                    View all
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {closingSoon.slice(0, 3).map((saved) => (
                    <OpportunityCard key={saved.id} opp={saved.opportunity} view="list" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Opportunities ── */}
        {activeSection === "opportunities" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Opportunities</h2>
              <p className="text-sm text-muted-foreground">
                Saved grants, residencies, and open calls — plus your active applications.
              </p>
            </div>
            <OpportunitiesFilterClient
              initialFilter={activeOppFilter}
              userId={user.id}
              savedList={savedList}
              closingSoon={closingSoon}
              applied={applied}
              expired={expired}
              applications={applications}
            />
          </div>
        )}

      </div>
    </StudioPageShell>
  );
}

function AnalyticsStatCard({
  label, value, description, period, prevValue,
}: {
  label: string; value: number; description: string; period?: string; prevValue?: number;
}) {
  const diff = prevValue !== undefined ? value - prevValue : null;
  return (
    <div className="border border-black p-5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
        {diff !== null && diff !== 0 && (
          <span className={`text-xs tabular-nums mt-1.5 ${diff > 0 ? "text-green-600" : "text-muted-foreground"}`}>
            {diff > 0 ? "+" : "−"}{Math.abs(diff).toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
        {period && <span className="ml-1 opacity-60">· {period}</span>}
      </p>
    </div>
  );
}
