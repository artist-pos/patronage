import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";
import { ProvenanceBanner } from "@/components/dashboard/ProvenanceBanner";
import { ManageNotesList } from "@/components/profile/ManageNotesList";
import { getMyWrittenNotes } from "@/lib/notes";
import { FollowersTab } from "@/components/analytics/FollowersTab";
import { ProfileViewsChartWrapper } from "@/components/analytics/ProfileViewsChartWrapper";
import { ManageSubscriptionButton } from "@/components/dashboard/ManageSubscriptionButton";
import { formatCents } from "@/lib/commerce-fee";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Patronage",
};

interface PageProps {
  searchParams: Promise<{ tab?: string; period?: string }>;
}

const TABS = ["overview", "closing", "saved", "applied", "applications", "expired", "analytics", "campaign-reports", "notes", "subscriptions"] as const;
type Tab = typeof TABS[number];

// ── Sidebar structure ─────────────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  { id: "overview",         label: "Overview",         group: "OVERVIEW"      },
  { id: "closing",          label: "Closing Soon",     group: "OPPORTUNITIES" },
  { id: "saved",            label: "Saved",            group: "OPPORTUNITIES" },
  { id: "applied",          label: "Applied",          group: "OPPORTUNITIES" },
  { id: "applications",     label: "Applications",     group: "OPPORTUNITIES" },
  { id: "expired",          label: "Expired",          group: "OPPORTUNITIES" },
  { id: "analytics",        label: "Analytics",        group: "INSIGHTS"      },
  { id: "campaign-reports", label: "Campaign Reports", group: "INSIGHTS"      },
  { id: "notes",            label: "Notes",            group: "NOTES"         },
  { id: "subscriptions",    label: "My Support",       group: "SUPPORT"       },
] as const;

const SIDEBAR_GROUPS = ["OVERVIEW", "OPPORTUNITIES", "INSIGHTS", "NOTES", "SUPPORT"] as const;

// ── Period options ────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "7d",       param: "7d"  },
  { label: "30d",      param: "30d" },
  { label: "90d",      param: "90d" },
  { label: "All time", param: "all" },
] as const;
type PeriodParam = typeof PERIODS[number]["param"];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, description, period, prevValue, allTime,
}: {
  label: string; value: number; description: string;
  period?: string; prevValue?: number; allTime?: boolean;
}) {
  const diff = !allTime && prevValue !== undefined ? value - prevValue : null;
  const contextLine =
    diff !== null
      ? diff > 0 ? `↑ ${diff} more than last period`
        : diff < 0 ? `↓ ${Math.abs(diff)} fewer than last period`
        : "About the same as last period"
      : value === 0 ? "Nothing tracked yet — check back soon."
      : null;

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
      {contextLine && <p className="text-[11px] text-gray-400">{contextLine}</p>}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const rawTab = params.tab ?? "overview";
  const activeTab: Tab = (TABS as readonly string[]).includes(rawTab) ? rawTab as Tab : "overview";

  const rawPeriod = params.period ?? "30d";
  const activePeriod: PeriodParam = PERIODS.some((p) => p.param === rawPeriod)
    ? (rawPeriod as PeriodParam)
    : "30d";
  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, created_at")
    .eq("id", user.id)
    .single();

  const isArtist = userProfile?.role === "artist" || userProfile?.role === "owner";
  const isPatron = userProfile?.role === "patron" || userProfile?.role === "partner";

  // Compute days for analytics period (including "all time" from account creation)
  const analyticsDays = (() => {
    if (activePeriod === "7d") return 7;
    if (activePeriod === "30d") return 30;
    if (activePeriod === "90d") return 90;
    // All time: days since account was created (minimum 30)
    const created = userProfile?.created_at ? new Date(userProfile.created_at) : new Date();
    return Math.max(30, Math.ceil((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
  })();

  // ── Core data (always needed) ─────────────────────────────────────────────
  const [saved, applicationsData, draftsData, provenanceData] = await Promise.all([
    getSavedOpportunities(),
    supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(id, slug, title, organiser, type, deadline, profile_id, profiles:profile_id(full_name, username))")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_application_drafts")
      .select("*, opportunity:opportunities(*)")
      .eq("artist_id", user.id)
      .order("updated_at", { ascending: false }),
    isPatron
      ? supabase
          .from("provenance_links")
          .select("id, artwork_id, artist_id, artworks(url, caption), artist_profile:artist_id(username, full_name)")
          .eq("patron_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const { closingSoon, saved: savedList, applied, expired } = categorizeSaved(saved);
  const applications = applicationsData.data ?? [];
  const drafts = draftsData.data ?? [];

  const provenanceLinks = (provenanceData.data ?? []).map((row: any) => ({
    id: row.id,
    artwork_id: row.artwork_id,
    artwork_url: row.artworks?.url ?? "",
    artwork_caption: row.artworks?.caption ?? null,
    artist_username: row.artist_profile?.username ?? "",
    artist_name: row.artist_profile?.full_name ?? null,
  }));

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes = activeTab === "notes" ? await getMyWrittenNotes(user.id) : null;

  // ── Subscriptions (support payments made by this user) ────────────────────
  type SubscriptionRow = {
    id: string;
    amount_cents: number;
    currency: string;
    tier_type: "one_off" | "recurring";
    status: "pending" | "active" | "past_due" | "canceled" | "one_off_paid" | "reverted";
    current_period_end: string | null;
    started_at: string | null;
    stripe_customer_id: string | null;
    support_tiers: { title: string }[] | null;
    profiles: { full_name: string | null; username: string | null }[] | null;
  };
  let subscriptions: SubscriptionRow[] = [];
  if (activeTab === "subscriptions") {
    const { data } = await supabase
      .from("support_subscriptions")
      .select(`
        id, amount_cents, currency, tier_type, status,
        current_period_end, started_at, stripe_customer_id,
        support_tiers!tier_id(title),
        profiles!recipient_id(full_name, username)
      `)
      .eq("supporter_id", user.id)
      .order("created_at", { ascending: false });
    subscriptions = (data ?? []) as unknown as SubscriptionRow[];
  }

  // ── Overview: profile views ───────────────────────────────────────────────
  let profileViews30 = 0;
  if (activeTab === "overview" && isArtist) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("profile_view_logs")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .gte("viewed_at", thirtyDaysAgo);
    profileViews30 = count ?? 0;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  // allTimeDays computed once for stat cards (always all-time)
  const allTimeDays = (() => {
    const created = userProfile?.created_at ? new Date(userProfile.created_at) : new Date();
    return Math.max(90, Math.ceil((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
  })();

  const [analyticsStats, followers] =
    activeTab === "analytics" && isArtist
      ? await Promise.all([
          getProfileStats(user.id, allTimeDays),
          getFollowers(user.id),
        ])
      : [null, null];

  // Slice the full timeline to the selected period for the chart
  const chartTimeline = analyticsStats
    ? analyticsStats.profileViewsTimeline.slice(-analyticsDays)
    : [];

  // ── Campaign reports ──────────────────────────────────────────────────────
  let campaignReports: Array<{
    id: string; title: string; status: string;
    scans: number; profileViews: number; enquiries: number; sales: number;
  }> = [];
  if (activeTab === "campaign-reports" && isArtist) {
    try {
      const { data: camps } = await supabase
        .from("campaigns")
        .select("id, title, status, campaign_start_date, campaign_end_date, partner_name")
        .eq("artist_profile_id", user.id)
        .order("created_at", { ascending: false });
      if (camps?.length) {
        const ids = camps.map((c: { id: string }) => c.id);
        const { data: events } = await supabase
          .from("campaign_events")
          .select("campaign_id, event_type")
          .in("campaign_id", ids);
        const counts: Record<string, { scans: number; profileViews: number; enquiries: number; sales: number }> = {};
        for (const ev of (events ?? [])) {
          if (!counts[ev.campaign_id]) counts[ev.campaign_id] = { scans: 0, profileViews: 0, enquiries: 0, sales: 0 };
          if (ev.event_type === "scan")         counts[ev.campaign_id].scans++;
          if (ev.event_type === "profile_view") counts[ev.campaign_id].profileViews++;
          if (ev.event_type === "enquiry")      counts[ev.campaign_id].enquiries++;
          if (ev.event_type === "sale")         counts[ev.campaign_id].sales++;
        }
        campaignReports = (camps as Array<{ id: string; title: string; status: string }>).map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          scans:        counts[c.id]?.scans        ?? 0,
          profileViews: counts[c.id]?.profileViews ?? 0,
          enquiries:    counts[c.id]?.enquiries    ?? 0,
          sales:        counts[c.id]?.sales        ?? 0,
        }));
      }
    } catch {
      // Table may not exist yet
    }
  }

  // ── Needs Attention ───────────────────────────────────────────────────────
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const closingIn48h = closingSoon.filter((item) => {
    if (!item.opportunity?.deadline) return false;
    return new Date(item.opportunity.deadline) <= twoDaysFromNow;
  });
  const closingThisWeek = closingSoon.filter((item) => {
    if (!item.opportunity?.deadline) return false;
    return new Date(item.opportunity.deadline) <= sevenDaysFromNow;
  });
  const needsAssetUpload = applications.filter((a: any) => a.status === "approved_pending_assets");

  // ── Sidebar counts ────────────────────────────────────────────────────────
  const counts: Partial<Record<Tab, number>> = {
    closing:      closingSoon.length,
    saved:        savedList.length,
    applied:      applied.length,
    applications: applications.length + drafts.length,
    expired:      expired.length,
  };

  const listMap: Record<string, typeof saved> = {
    closing: closingSoon,
    saved:   savedList,
    applied,
    expired,
  };
  const currentList = listMap[activeTab] ?? [];

  // Sidebar visibility
  const visibleSections = SIDEBAR_SECTIONS.filter((s) => {
    if (s.group === "INSIGHTS") return isArtist;
    return true;
  });
  const visibleGroups = SIDEBAR_GROUPS.filter((g) =>
    visibleSections.some((s) => s.group === g)
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Opportunities, insights, and notes in one place.
        </p>
      </div>

      {provenanceLinks.length > 0 && <ProvenanceBanner links={provenanceLinks} />}

      {/* ── Mobile: horizontal section tabs ── */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {visibleSections.map(({ id, label }) => (
          <Link
            key={id}
            href={`/dashboard?tab=${id}`}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              activeTab === id
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {counts[id as Tab] !== undefined && counts[id as Tab]! > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 leading-none rounded-sm">
                {counts[id as Tab]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Desktop: sidebar + content ── */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">

        {/* Sidebar */}
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-8 space-y-6">
          {visibleGroups.map((group) => (
            <div key={group} className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
                {group}
              </p>
              {visibleSections.filter((s) => s.group === group).map(({ id, label }) => (
                <Link
                  key={id}
                  href={`/dashboard?tab=${id}`}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-sm transition-colors ${
                    activeTab === id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{label}</span>
                  {counts[id as Tab] !== undefined && counts[id as Tab]! > 0 && (
                    <span className="text-xs bg-stone-200 text-stone-600 px-1.5 py-0.5 leading-none rounded-sm tabular-nums">
                      {counts[id as Tab]}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-10">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-10">

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-border p-4 space-y-1.5">
                  <p className="text-2xl font-bold tabular-nums">{savedList.length}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest">Saved</p>
                  <p className="text-[11px] text-muted-foreground">Active saved opportunities</p>
                </div>
                <div className="border border-border p-4 space-y-1.5">
                  <p className="text-2xl font-bold tabular-nums">{closingThisWeek.length}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest">Closing Soon</p>
                  <p className="text-[11px] text-muted-foreground">Deadlines within 7 days</p>
                </div>
                <div className="border border-border p-4 space-y-1.5">
                  <p className="text-2xl font-bold tabular-nums">{applications.length}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest">Applications</p>
                  <p className="text-[11px] text-muted-foreground">Active pipeline applications</p>
                </div>
                {isArtist && (
                  <div className="border border-border p-4 space-y-1.5">
                    <p className="text-2xl font-bold tabular-nums">{profileViews30}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest">Profile Views</p>
                    <p className="text-[11px] text-muted-foreground">Last 30 days</p>
                  </div>
                )}
              </div>

              {/* Needs attention — always shown */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Needs Attention
                </p>
                {provenanceLinks.length === 0 && needsAssetUpload.length === 0 && closingIn48h.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed border-border px-4 py-3">
                    Nothing needs attention right now.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {provenanceLinks.length > 0 && (
                      <div className="flex items-center justify-between border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm">
                          <span className="font-medium">{provenanceLinks.length} provenance transfer{provenanceLinks.length !== 1 ? "s" : ""}</span>
                          {" "}awaiting your approval
                        </p>
                        <Link href="/messages" className="text-xs underline underline-offset-2 shrink-0 ml-4">
                          Review →
                        </Link>
                      </div>
                    )}
                    {needsAssetUpload.length > 0 && (
                      <div className="flex items-center justify-between border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-sm">
                          <span className="font-medium">{needsAssetUpload.length} application{needsAssetUpload.length !== 1 ? "s" : ""}</span>
                          {" "}require a high-res asset upload
                        </p>
                        <Link href="/dashboard?tab=applications" className="text-xs underline underline-offset-2 shrink-0 ml-4">
                          Upload →
                        </Link>
                      </div>
                    )}
                    {closingIn48h.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm">
                          <span className="font-medium">{item.opportunity?.title}</span>
                          {" "}closes within 48 hours
                        </p>
                        {item.opportunity?.slug && (
                          <Link href={`/opportunities/${item.opportunity.slug}`} className="text-xs underline underline-offset-2 shrink-0 ml-4">
                            View →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Closing soon preview */}
              {closingSoon.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Closing Soon
                    </p>
                    <Link href="/dashboard?tab=closing" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                      View all →
                    </Link>
                  </div>
                  <div className="border-t border-black">
                    {closingSoon.slice(0, 3).map((item) => (
                      <OpportunityCard key={item.id} opp={item.opportunity} view="list" />
                    ))}
                  </div>
                </section>
              )}

              {closingSoon.length === 0 && savedList.length === 0 && applications.length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nothing saved yet — browse opportunities to get started.</p>
                  <Link href="/opportunities" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                    Browse Opportunities →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ── Applications ── */}
          {activeTab === "applications" && (
            <ApplicationsTab
              initialApplications={applications as Parameters<typeof ApplicationsTab>[0]["initialApplications"]}
              userId={user.id}
              initialDrafts={drafts as Parameters<typeof ApplicationsTab>[0]["initialDrafts"]}
            />
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && notes !== null && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Notes you&apos;ve left on studio updates across the platform.
              </p>
              <ManageNotesList initialNotes={notes} />
            </div>
          )}

          {/* ── Analytics ── */}
          {activeTab === "analytics" && analyticsStats && (
            <div className="space-y-10">

              {/* Audience — always all-time */}
              <section className="space-y-5">
                <SectionLabel label="Audience" />
                <div className="flex items-end gap-5">
                  <div className="space-y-0.5">
                    <p className="text-5xl font-bold tabular-nums">{analyticsStats.followersTotal.toLocaleString()}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Followers</p>
                  </div>
                  {analyticsStats.followersGained30 > 0 && (
                    <p className="text-sm text-green-600 mb-1">+{analyticsStats.followersGained30} all time</p>
                  )}
                </div>
                {followers && <FollowersTab followers={followers} />}
              </section>

              {/* Discovery — always all-time, chart responds to period */}
              <section className="space-y-5 border-t border-border pt-8">
                <SectionLabel label="Discovery" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Profile Views"
                    value={analyticsStats.profileViews30}
                    description="Visits to your public profile, excluding your own"
                    period="all time"
                    allTime
                  />
                  <StatCard
                    label="CV Downloads"
                    value={analyticsStats.cvClicks30}
                    description="Clicks on your CV link"
                    period="all time"
                  />
                  <StatCard
                    label="Website Clicks"
                    value={analyticsStats.websiteClicks30}
                    description="Clicks through to your personal website"
                    period="all time"
                  />
                </div>
                {/* Chart with period selector inline in its header */}
                <ProfileViewsChartWrapper
                  data={chartTimeline}
                  days={analyticsDays}
                  headerRight={
                    <div className="flex gap-1 shrink-0">
                      {PERIODS.map(({ label, param }) => (
                        <Link
                          key={param}
                          href={`/dashboard?tab=analytics&period=${param}`}
                          className={`text-xs px-2.5 py-1 border transition-colors ${
                            activePeriod === param
                              ? "border-black bg-black text-white"
                              : "border-border hover:border-black"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  }
                />
              </section>

              {/* Engagement — always all-time */}
              <section className="space-y-4 border-t border-border pt-8">
                <SectionLabel label="Engagement" />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Artwork Views"
                    value={analyticsStats.artworkViews30}
                    description="Times your portfolio works were opened"
                    period="all time"
                  />
                  <StatCard
                    label="Followers Gained"
                    value={analyticsStats.followersGained30}
                    description="New followers since joining"
                    period="all time"
                  />
                </div>
              </section>

              {/* Career Activity — always all-time */}
              <section className="space-y-4 border-t border-border pt-8">
                <SectionLabel label="Career Activity" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Applied"
                    value={analyticsStats.opportunitiesApplied}
                    description="Opportunities applied to through Patronage"
                    period="all time"
                  />
                  <StatCard
                    label="Saved"
                    value={analyticsStats.opportunitiesSaved}
                    description="Opportunities bookmarked or saved"
                    period="all time"
                  />
                  <StatCard
                    label="Works Added"
                    value={analyticsStats.worksAdded30}
                    description="New works added to your portfolio"
                    period="all time"
                  />
                </div>
              </section>

            </div>
          )}

          {/* ── Campaign Reports ── */}
          {activeTab === "campaign-reports" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-base font-semibold">Campaign Reports</p>
                  <p className="text-sm text-muted-foreground">Scan data and engagement for your QR campaigns.</p>
                </div>
                <Link href="/studio?section=campaigns" className="text-sm underline underline-offset-2 hover:text-foreground transition-colors">
                  Manage campaigns →
                </Link>
              </div>

              {campaignReports.length === 0 ? (
                <div className="py-16 space-y-3 text-center border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">No campaigns yet.</p>
                  <Link href="/studio?section=campaigns" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                    Create a campaign →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignReports.map((c) => (
                    <div key={c.id} className="border border-border p-5 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide ${
                            c.status === "live" ? "bg-green-100 text-green-700"
                              : c.status === "completed" ? "bg-stone-100 text-stone-500"
                              : "bg-stone-100 text-stone-600"
                          }`}>
                            {c.status === "live" ? "Active" : c.status === "completed" ? "Ended" : c.status}
                          </span>
                          <Link
                            href={`/studio/campaigns/${c.id}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Configure →
                          </Link>
                        </div>
                      </div>
                      {/* 4-column stats */}
                      <div className="grid grid-cols-4 gap-4 border-t border-border pt-4">
                        {[
                          { label: "Scans",         value: c.scans        },
                          { label: "Profile Views", value: c.profileViews },
                          { label: "Enquiries",     value: c.enquiries    },
                          { label: "Sales",         value: c.sales        },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── My Support (subscriptions) ── */}
          {activeTab === "subscriptions" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-base font-semibold">My Support</p>
                <p className="text-sm text-muted-foreground">Artists you&apos;re supporting through Patronage.</p>
              </div>

              {subscriptions.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-border space-y-3">
                  <p className="text-sm text-muted-foreground">You haven&apos;t supported any artists yet.</p>
                  <Link href="/feed" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                    Browse artists →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border">
                  {subscriptions.map((sub) => {
                    const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
                    const tier = Array.isArray(sub.support_tiers) ? sub.support_tiers[0] : sub.support_tiers;
                    const artistName = profile?.full_name ?? profile?.username ?? "Unknown artist";
                    const artistUsername = profile?.username;
                    const tierTitle = tier?.title ?? "Support";
                    const isActive = sub.status === "active";
                    const isRecurring = sub.tier_type === "recurring";

                    const statusLabel =
                      sub.status === "active"       ? (isRecurring ? "Active" : "Paid")
                      : sub.status === "one_off_paid" ? "Paid"
                      : sub.status === "past_due"   ? "Past due"
                      : sub.status === "canceled"   ? "Cancelled"
                      : sub.status === "pending"    ? "Pending"
                      : sub.status;

                    const statusClass =
                      isActive                      ? "bg-emerald-100 text-emerald-700"
                      : sub.status === "one_off_paid" ? "bg-emerald-100 text-emerald-700"
                      : sub.status === "past_due"   ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-stone-500";

                    return (
                      <div key={sub.id} className="flex items-center justify-between gap-4 px-4 py-4">
                        <div className="min-w-0 space-y-0.5">
                          {artistUsername ? (
                            <Link href={`/${artistUsername}`} className="text-sm font-medium hover:underline underline-offset-2">
                              {artistName}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium">{artistName}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {tierTitle} · {formatCents(sub.amount_cents, sub.currency)}
                            {isRecurring ? " / month" : ""}
                          </p>
                          {isActive && isRecurring && sub.current_period_end && (
                            <p className="text-[11px] text-muted-foreground">
                              Renews {new Date(sub.current_period_end).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide rounded-sm ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {isActive && isRecurring && <ManageSubscriptionButton />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Opportunity list sections ── */}
          {["closing", "saved", "applied", "expired"].includes(activeTab) && (
            currentList.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {activeTab === "closing"
                    ? "No saved opportunities closing in the next 14 days."
                    : activeTab === "saved"
                    ? "No saved opportunities. When you find something worth coming back to, save it and it'll appear here."
                    : activeTab === "applied"
                    ? "No applications yet. When you apply through Patronage, you can track their status here."
                    : "No expired opportunities."}
                </p>
                {(activeTab === "closing" || activeTab === "saved") && (
                  <Link href="/opportunities" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                    Browse Opportunities →
                  </Link>
                )}
              </div>
            ) : (
              <div className="border-t border-black">
                {currentList.map((item) => (
                  <OpportunityCard key={item.id} opp={item.opportunity} view="list" />
                ))}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}
