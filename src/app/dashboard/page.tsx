import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";
import { ProvenanceBanner } from "@/components/dashboard/ProvenanceBanner";
import { ManageSubscriptionButton } from "@/components/dashboard/ManageSubscriptionButton";
import { formatCents } from "@/lib/commerce-fee";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Patronage",
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    period?: string;
    /** opportunities sub-filter: all | saved | closing | applied | expired */
    of?: string;
  }>;
}

const TABS = ["overview", "opportunities", "subscriptions"] as const;
type Tab = typeof TABS[number];

// Legacy tab aliases — old URLs still resolve correctly
const LEGACY_TAB_ALIASES: Record<string, Tab> = {
  closing:          "opportunities",
  saved:            "opportunities",
  applied:          "opportunities",
  applications:     "opportunities",
  expired:          "opportunities",
  analytics:        "overview",
  "campaign-reports": "overview",
  notes:            "overview",
};

// ── Sidebar structure ─────────────────────────────────────────────────────────
const PRIMARY_TABS = [
  { id: "overview",      label: "Overview"      },
  { id: "opportunities", label: "Opportunities" },
  { id: "subscriptions", label: "My Support"    },
] as const;

// Nav links (not inline tabs — navigate to their own pages)
const NAV_LINKS = [
  { id: "collection", label: "Collection", href: "/dashboard/collection" },
  { id: "messages",   label: "Messages",   href: "/messages"             },
] as const;

const SECONDARY_LINKS = [
  { id: "profile", label: "Profile", href: "/onboarding" },
  { id: "account", label: "Account", href: "/onboarding" },
] as const;

const OPP_FILTERS = ["all", "saved", "closing", "applied", "expired"] as const;
type OppFilter = typeof OPP_FILTERS[number];

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


export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const rawTab = params.tab ?? "overview";
  // Resolve legacy tab aliases (closing, saved, applied, applications, expired → opportunities)
  const resolvedTab = LEGACY_TAB_ALIASES[rawTab] ?? rawTab;
  const activeTab: Tab = (TABS as readonly string[]).includes(resolvedTab) ? resolvedTab as Tab : "overview";

  // Carry forward legacy tab as the opportunities sub-filter
  const legacyOppFilter: OppFilter | undefined =
    rawTab === "closing" ? "closing"
    : rawTab === "saved" || rawTab === "applied" || rawTab === "expired" ? rawTab as OppFilter
    : undefined;

  const rawOppFilter = params.of ?? legacyOppFilter ?? "all";
  const activeOppFilter: OppFilter = (OPP_FILTERS as readonly string[]).includes(rawOppFilter)
    ? rawOppFilter as OppFilter
    : "all";

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

  // ── Opportunity filter lists ──────────────────────────────────────────────
  const oppFilterList =
    activeOppFilter === "saved"   ? savedList
    : activeOppFilter === "closing" ? closingSoon
    : activeOppFilter === "applied" ? applied
    : activeOppFilter === "expired" ? expired
    : [...closingSoon, ...savedList, ...applied, ...expired]; // "all"

  const oppCounts: Record<OppFilter, number> = {
    all:     savedList.length + closingSoon.length + applied.length + expired.length,
    saved:   savedList.length,
    closing: closingSoon.length,
    applied: applied.length,
    expired: expired.length,
  };

  const totalOpps = savedList.length + closingSoon.length;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your opportunities, collection, and support in one place.
        </p>
      </div>

      {provenanceLinks.length > 0 && <ProvenanceBanner links={provenanceLinks} />}

      {/* ── Mobile: horizontal tabs ── */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {PRIMARY_TABS.map(({ id, label }) => (
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
            {id === "opportunities" && totalOpps > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 leading-none rounded-sm">
                {totalOpps}
              </span>
            )}
          </Link>
        ))}
        {NAV_LINKS.map(({ id, label, href }) => (
          <Link
            key={id}
            href={href}
            className="px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Desktop: sidebar + content ── */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">

        {/* Sidebar */}
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-8 space-y-6">
          {/* Primary tabs */}
          <div className="space-y-0.5">
            {PRIMARY_TABS.map(({ id, label }) => (
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
                {id === "opportunities" && totalOpps > 0 && (
                  <span className="text-xs bg-stone-200 text-stone-600 px-1.5 py-0.5 leading-none rounded-sm tabular-nums">
                    {totalOpps}
                  </span>
                )}
              </Link>
            ))}
            {NAV_LINKS.map(({ id, label, href }) => (
              <Link
                key={id}
                href={href}
                className="flex items-center px-3 py-2 text-sm rounded-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Secondary */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
              Settings
            </p>
            {SECONDARY_LINKS.map(({ id, label, href }) => (
              <Link
                key={id}
                href={href}
                className="flex items-center px-3 py-2 text-sm rounded-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                {label}
              </Link>
            ))}
          </div>
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

          {/* ── Opportunities ── */}
          {activeTab === "opportunities" && (
            <div className="space-y-6">
              {/* Filter chips */}
              <div className="flex flex-wrap gap-2">
                {OPP_FILTERS.map((f) => (
                  <Link
                    key={f}
                    href={`/dashboard?tab=opportunities&of=${f}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-full transition-colors ${
                      activeOppFilter === f
                        ? "border-black bg-black text-white"
                        : "border-border text-muted-foreground hover:border-black hover:text-foreground"
                    }`}
                  >
                    <span className="capitalize">{f === "closing" ? "Closing soon" : f}</span>
                    {oppCounts[f] > 0 && (
                      <span className={`text-[10px] tabular-nums ${activeOppFilter === f ? "opacity-70" : ""}`}>
                        {oppCounts[f]}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Applications panel (pipeline applications) */}
              {(activeOppFilter === "all" || activeOppFilter === "applied") && (applications.length > 0 || drafts.length > 0) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Applications</p>
                  <ApplicationsTab
                    initialApplications={applications as Parameters<typeof ApplicationsTab>[0]["initialApplications"]}
                    userId={user.id}
                    initialDrafts={drafts as Parameters<typeof ApplicationsTab>[0]["initialDrafts"]}
                  />
                </div>
              )}

              {/* Opportunity list */}
              {oppFilterList.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {activeOppFilter === "closing"
                      ? "No saved opportunities closing soon."
                      : activeOppFilter === "saved"
                      ? "No saved opportunities yet. Browse opportunities and save ones you want to revisit."
                      : activeOppFilter === "applied"
                      ? "No applications yet. Apply through Patronage to track your status here."
                      : activeOppFilter === "expired"
                      ? "No expired opportunities."
                      : "No saved opportunities yet."}
                  </p>
                  {(activeOppFilter === "all" || activeOppFilter === "saved" || activeOppFilter === "closing") && (
                    <Link href="/opportunities" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                      Browse Opportunities →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="border-t border-black">
                  {oppFilterList.map((item) => (
                    <OpportunityCard key={item.id} opp={item.opportunity} view="list" />
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


        </div>
      </div>
    </div>
  );
}
