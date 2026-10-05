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
  title: "Dashboard",
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    period?: string;
    /** opportunities sub-filter: all | saved | closing | applied | expired */
    of?: string;
  }>;
}

const TABS = ["opportunities", "subscriptions"] as const;
type Tab = typeof TABS[number];

// Legacy tab aliases — old URLs still resolve correctly
const LEGACY_TAB_ALIASES: Record<string, Tab> = {
  closing:          "opportunities",
  saved:            "opportunities",
  applied:          "opportunities",
  applications:     "opportunities",
  expired:          "opportunities",
};

// ── Sidebar structure ─────────────────────────────────────────────────────────
const PRIMARY_TABS = [
  { id: "opportunities", label: "Opportunities" },
  { id: "subscriptions", label: "My Support"    },
] as const;

// Nav links (not inline tabs — navigate to their own pages)
const NAV_LINKS = [
  { id: "collection", label: "Collection", href: "/dashboard/collection" },
  { id: "messages",   label: "Messages",   href: "/messages"             },
] as const;

const OPP_FILTERS = ["all", "saved", "closing", "applied", "expired"] as const;
type OppFilter = typeof OPP_FILTERS[number];


export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const rawTab = params.tab ?? "overview";
  // Resolve legacy tab aliases (closing, saved, applied, applications, expired → opportunities)
  const resolvedTab = LEGACY_TAB_ALIASES[rawTab] ?? rawTab;

  // Redirect bare /dashboard (or any unknown tab) to the unified workspace; keep ?tab= subpages working
  if (!(TABS as readonly string[]).includes(resolvedTab)) {
    redirect("/studio");
  }

  const activeTab = resolvedTab as Tab;

  // Carry forward legacy tab as the opportunities sub-filter
  const legacyOppFilter: OppFilter | undefined =
    rawTab === "closing" ? "closing"
    : rawTab === "saved" || rawTab === "applied" || rawTab === "expired" ? rawTab as OppFilter
    : undefined;

  const rawOppFilter = params.of ?? legacyOppFilter ?? "all";
  const activeOppFilter: OppFilter = (OPP_FILTERS as readonly string[]).includes(rawOppFilter)
    ? rawOppFilter as OppFilter
    : "all";

  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, created_at")
    .eq("id", user.id)
    .single();

  const isArtist = userProfile?.role === "artist" || userProfile?.role === "owner" || userProfile?.role === "admin";
  if (isArtist) redirect("/studio");

  const isPatron = userProfile?.role === "patron" || userProfile?.role === "partner";

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

        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-10">

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
