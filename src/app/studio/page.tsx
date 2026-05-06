import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchCompletionProfile, getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { SectionLockGate } from "@/components/studio/SectionLockGate";
import { StudioPageShell } from "./StudioPageShell";
import { Section, VALID_SECTIONS, TAB_TO_SECTION } from "./sidebar-config";
import { getProfileById } from "@/lib/profiles";
import { getArtistUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { WorksTable } from "@/components/dashboard/WorksTable";
import { AddWorkButton } from "@/components/dashboard/AddWorkButton";
import { AddPortfolioWorkButton } from "@/components/dashboard/AddPortfolioWorkButton";
import { SupportTiersManager } from "@/components/profile/SupportTiersManager";
import { CampaignDeleteButton } from "@/components/campaigns/CampaignDeleteButton";
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
import { StudioCarousel } from "@/components/profile/StudioCarousel";
import { ProjectsSection } from "@/components/profile/ProjectsSection";
import type { Metadata } from "next";
import type { SupportTier, ExhibitionEntry, BibliographyEntry, CollectiveMember, ProjectUpdateWithArtist, Project } from "@/types/database";

export const metadata: Metadata = {
  title: "Studio — Patronage",
};

// ── Page ────────────────────────────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<{ section?: string; tab?: string }>;
}

export default async function StudioPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/dashboard");
  }

  // Always fetch completion fields — lightweight, cached across shell + page.
  const completionProfile = await fetchCompletionProfile(user.id);
  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  const params = await searchParams;
  const rawSection =
    params.section ??
    (params.tab ? TAB_TO_SECTION[params.tab] : undefined) ??
    "profile";
  const activeSection: Section = VALID_SECTIONS.includes(rawSection)
    ? (rawSection as Section)
    : "profile";

  if (activeSection === "provenance") redirect("/studio/provenance");

  // ── Conditional data fetching ─────────────────────────────────────────────
  const needsIdentity  = activeSection === "profile" || activeSection === "cv";
  const needsWorks     = activeSection === "portfolio" || activeSection === "available" || activeSection === "sold";
  const needsUpdates   = activeSection === "updates";
  const needsProjects  = activeSection === "projects";
  const needsCampaigns = activeSection === "campaigns";
  const needsTiers     = activeSection === "support";

  // Identity: full profile + collectives (profile section only)
  const [fullProfile, membershipsRaw] = needsIdentity
    ? await Promise.all([
        getProfileById(user.id),
        activeSection === "profile"
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

  // Works: portfolio, available, sold
  const [portfolioResult, availableResult, soldResult, featuredRows, engagementRows] =
    needsWorks
      ? await Promise.all([
          supabase
            .from("portfolio_images")
            .select("id, url, caption, description, hide_from_archive, position, created_at, content_type, title, year, medium, dimensions, linked_artwork_id")
            .eq("profile_id", user.id)
            .eq("is_available", false)
            .order("position", { ascending: true }),
          supabase
            .from("artworks")
            .select("id, url, caption, description, price, price_currency, is_available, hide_available, hide_price, position, created_at")
            .eq("profile_id", user.id)
            .eq("is_available", true)
            .order("position", { ascending: true }),
          supabase
            .from("artworks")
            .select("id, url, caption, price, price_currency, created_at, current_owner_id, hidden_from_artist, ledger_id")
            .eq("creator_id", user.id)
            .neq("current_owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("portfolio_images")
            .select("id, is_featured")
            .eq("profile_id", user.id)
            .eq("is_available", false)
            .eq("is_featured", true),
          supabase
            .from("portfolio_images")
            .select("id")
            .eq("profile_id", user.id)
            .eq("is_available", false)
            .then(async ({ data: pids }) => {
              const ids = (pids ?? []).map((r: { id: string }) => r.id);
              if (!ids.length) return { data: [] };
              return supabase
                .from("engagement_logs")
                .select("work_id, event_type")
                .in("work_id", ids);
            }),
        ])
      : [null, null, null, null, null];

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

  // Studio Updates + Projects
  const [studioUpdates, studioProjects] =
    needsUpdates || needsProjects
      ? await Promise.all([
          getArtistUpdates(user.id),
          getArtistProjects(user.id),
        ])
      : [[] as ProjectUpdateWithArtist[], [] as Project[]];

  // Campaigns
  let campaigns: Array<{
    id: string; title: string; campaign_type: string; status: string;
    partner_name: string | null; campaign_start_date: string | null; campaign_end_date: string | null;
  }> = [];
  if (needsCampaigns) {
    try {
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, campaign_type, status, partner_name, campaign_start_date, campaign_end_date")
        .eq("artist_profile_id", user.id)
        .order("created_at", { ascending: false });
      campaigns = (data ?? []) as typeof campaigns;
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StudioPageShell username={profileRow.username} activeSection={activeSection}>
      <div className="space-y-10">

          {/* ── Profile section ── */}
          {activeSection === "profile" && fullProfile && (
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

              {/* Email Preferences */}
              <section className="space-y-4 border-t border-border pt-10">
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

              {/* Danger Zone */}
              <section className="space-y-4 border-t border-black pt-10 mt-4">
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

          {/* ── CV & History section ── */}
          {activeSection === "cv" && fullProfile && (
            <div className="space-y-12">
              {/* CV upload */}
              <section className="space-y-4">
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

              {/* Media & Press */}
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

          {/* ── Portfolio section ── */}
          {activeSection === "portfolio" && (
            <div className="space-y-6">
              {featuredCount > 0 || portfolioWorks.length > 0 ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground border border-border px-4 py-2.5">
                  <span>
                    <span className="font-semibold text-foreground">{featuredCount}</span> of 8 works featured
                    {featuredCount > 0 && " — shown on your profile overview"}
                  </span>
                  {featuredCount === 0 && (
                    <span>Open any work and mark it as Featured to curate your overview.</span>
                  )}
                </div>
              ) : null}
              <WorksTable
                section="portfolio"
                portfolioWorks={portfolioWorks as Parameters<typeof WorksTable>[0]["portfolioWorks"]}
                availableWorks={availableWorks as Parameters<typeof WorksTable>[0]["availableWorks"]}
                soldWorks={soldWorks as Parameters<typeof WorksTable>[0]["soldWorks"]}
                featuredCount={featuredCount}
                profileId={user.id}
                engagementMap={engagementMap}
              />
              <AddPortfolioWorkButton profileId={user.id} />
            </div>
          )}

          {/* ── Available section ── */}
          {activeSection === "available" && (
            <div className="space-y-6">
              {!profileComplete && missingFields.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-amber-900">
                    Your listed works aren&apos;t publicly visible yet.
                  </p>
                  <p className="text-sm text-amber-800">
                    Complete your profile to show works for sale on your public page. Add:{" "}
                    {missingFields.map((f, i) => (
                      <span key={f.key}>
                        {i > 0 && ", "}
                        <a href={f.href} className="underline underline-offset-2 hover:text-amber-950 transition-colors">
                          {f.label}
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Works listed for sale. Patrons can make offers directly from your profile.
                </p>
                <AddWorkButton profileId={user.id} />
              </div>
              <WorksTable
                section="available"
                portfolioWorks={portfolioWorks as Parameters<typeof WorksTable>[0]["portfolioWorks"]}
                availableWorks={availableWorks as Parameters<typeof WorksTable>[0]["availableWorks"]}
                soldWorks={soldWorks as Parameters<typeof WorksTable>[0]["soldWorks"]}
                featuredCount={featuredCount}
                profileId={user.id}
              />
            </div>
          )}

          {/* ── Sold section ── */}
          {activeSection === "sold" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Works transferred to collectors. These are permanent provenance records.
              </p>
              <WorksTable
                section="sold"
                portfolioWorks={portfolioWorks as Parameters<typeof WorksTable>[0]["portfolioWorks"]}
                availableWorks={availableWorks as Parameters<typeof WorksTable>[0]["availableWorks"]}
                soldWorks={soldWorks as Parameters<typeof WorksTable>[0]["soldWorks"]}
                featuredCount={featuredCount}
                profileId={user.id}
              />
            </div>
          )}

          {/* ── Studio Updates section ── */}
          {activeSection === "updates" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Studio Updates</h2>
                <p className="text-sm text-muted-foreground">
                  Post works in progress, process shots, and studio moments. Updates appear in the public feed and on your profile.
                </p>
              </div>
              <StudioCarousel
                updates={studioUpdates}
                artistUsername={profileRow.username}
                isOwner={true}
                projects={studioProjects.map((p) => ({ id: p.id, title: p.title }))}
                profileId={user.id}
              />
            </div>
          )}

          {/* ── Projects section ── */}
          {activeSection === "projects" && (
            <div className="space-y-6">
              <ProjectsSection
                projects={studioProjects}
                updates={studioUpdates}
                isOwner={true}
              />
            </div>
          )}

          {/* ── Campaigns section ── */}
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

          {/* ── Support Tiers section ── */}
          {activeSection === "support" && (
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

      </div>
    </StudioPageShell>
  );
}
