import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { WorksTable } from "@/components/dashboard/WorksTable";
import { AddWorkButton } from "@/components/dashboard/AddWorkButton";
import { AddPortfolioWorkButton } from "@/components/dashboard/AddPortfolioWorkButton";
import { FollowersTab } from "@/components/analytics/FollowersTab";
import { SupportTiersManager } from "@/components/profile/SupportTiersManager";
import { CampaignDeleteButton } from "@/components/campaigns/CampaignDeleteButton";
import type { Metadata } from "next";
import type { SupportTier } from "@/types/database";

export const metadata: Metadata = {
  title: "Studio — Patronage",
};

const STUDIO_TABS = [
  { id: "works",     label: "Works" },
  { id: "campaigns", label: "Campaigns" },
  { id: "commerce",  label: "Commerce" },
  { id: "analytics", label: "Analytics" },
  { id: "support",   label: "Support Tiers" },
] as const;
type StudioTab = typeof STUDIO_TABS[number]["id"];

const WORK_SECTIONS = ["portfolio", "available", "sold"] as const;
type WorkSection = typeof WORK_SECTIONS[number];

// ── Shared stat card for analytics ──────────────────────────────────────────
function StatCard({
  label, value, description, period, prevValue,
}: {
  label: string; value: number; description: string; period?: string; prevValue?: number;
}) {
  const diff = prevValue !== undefined ? value - prevValue : null;
  const contextLine =
    diff !== null
      ? diff > 0 ? `↑ ${diff} more than last month`
        : diff < 0 ? `↓ ${Math.abs(diff)} fewer than last month`
        : "About the same as last month"
      : value === 0 ? "Nothing tracked yet — check back soon."
      : null;

  return (
    <div className="border border-black p-4 space-y-1.5">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {description}
        {period && <span className="ml-1 opacity-60">· {period}</span>}
      </p>
      {contextLine && <p className="text-[11px] text-gray-400">{contextLine}</p>}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<{ tab?: string; section?: string }>;
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

  const params = await searchParams;
  const activeTab: StudioTab = (STUDIO_TABS.map(t => t.id) as string[]).includes(params.tab ?? "")
    ? (params.tab as StudioTab)
    : "works";
  const activeSection: WorkSection = (WORK_SECTIONS as readonly string[]).includes(params.section ?? "")
    ? (params.section as WorkSection)
    : "portfolio";

  // ── Conditional data fetching ─────────────────────────────────────────────

  // Works tab
  const [portfolioResult, availableResult, soldResult, featuredRows, engagementRows] =
    activeTab === "works"
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
            .select("id, url, caption, price, price_currency, created_at, current_owner_id, hidden_from_artist")
            .eq("creator_id", user.id)
            .neq("current_owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("portfolio_images")
            .select("id, is_featured")
            .eq("profile_id", user.id)
            .eq("is_available", false)
            .eq("is_featured", true),
          // Engagement counts for portfolio works — fetched separately to avoid blocking
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
    ((featuredRows as { data: { id: string }[] | null } | null)?.data ?? []).map(r => r.id)
  );
  const portfolioWorks = (
    (portfolioResult as { data: { id: string; [key: string]: unknown }[] | null } | null)?.data ?? []
  ).map(w => ({ ...w, is_featured: featuredIds.has(w.id) }));
  const availableWorks = (availableResult as { data: unknown[] | null } | null)?.data ?? [];
  const soldWorks = (soldResult as { data: unknown[] | null } | null)?.data ?? [];
  const featuredCount = featuredIds.size;

  const engagementMap: Record<string, { view: number; play: number }> = {};
  for (const row of ((engagementRows as { data: { work_id: string; event_type: string }[] | null } | null)?.data ?? [])) {
    if (!engagementMap[row.work_id]) engagementMap[row.work_id] = { view: 0, play: 0 };
    if (row.event_type === "view") engagementMap[row.work_id].view++;
    if (row.event_type === "play") engagementMap[row.work_id].play++;
  }

  // Analytics tab
  const [analyticsStats, followers] = activeTab === "analytics"
    ? await Promise.all([getProfileStats(user.id), getFollowers(user.id)])
    : [null, null];

  // Support Tiers tab
  const { data: tiersData } = activeTab === "support"
    ? await supabase
        .from("support_tiers")
        .select("*")
        .eq("profile_id", user.id)
        .order("sort_order", { ascending: true })
    : { data: null };
  const initialTiers = (tiersData ?? []) as SupportTier[];

  // Campaigns tab — table may not exist yet; handled gracefully
  let campaigns: Array<{
    id: string; title: string; campaign_type: string; status: string;
    partner_name: string | null; campaign_start_date: string | null; campaign_end_date: string | null;
  }> = [];
  if (activeTab === "campaigns") {
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
          <p className="text-sm text-muted-foreground">
            Manage your works, campaigns, and creative practice.
          </p>
        </div>
        <Link
          href={`/${profileRow.username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View profile →
        </Link>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-black overflow-x-auto">
        {STUDIO_TABS.map(({ id, label }) => (
          <Link
            key={id}
            href={id === "works" ? "/studio" : `/studio?tab=${id}`}
            className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
              activeTab === id
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Works tab ── */}
      {activeTab === "works" && (
        <div className="space-y-6">
          {/* Works section sub-tabs */}
          <div className="flex gap-0 border-b border-black">
            {[
              { key: "portfolio", label: `Portfolio (${portfolioWorks.length})` },
              { key: "available", label: `Available (${availableWorks.length})` },
              { key: "sold",      label: `Sold (${soldWorks.length})` },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/studio?section=${key}`}
                className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  activeSection === key
                    ? "font-semibold border-b-2 border-black -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

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

          {activeSection === "available" && (
            <div className="space-y-6">
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
        </div>
      )}

      {/* ── Campaigns tab ── */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Campaigns</h2>
              <p className="text-sm text-muted-foreground">
                QR campaigns for public art, exhibitions, and activations.
              </p>
            </div>
            <Link
              href="/studio/campaigns/new"
              className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
            >
              + Create campaign
            </Link>
          </div>

          {campaigns.length === 0 ? (
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
              {campaigns.map(c => (
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

      {/* ── Commerce tab ── */}
      {activeTab === "commerce" && (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm font-medium">Commerce</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Consolidated sales, enquiries, and print pricing management. Coming soon.
          </p>
          <Link href="/studio?section=available" className="inline-block text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground">
            Manage available works →
          </Link>
        </div>
      )}

      {/* ── Analytics tab ── */}
      {activeTab === "analytics" && analyticsStats && (
        <div className="space-y-10">
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Audience</p>
            <div className="flex items-end gap-5">
              <div className="space-y-0.5">
                <p className="text-5xl font-bold tabular-nums">{analyticsStats.followersTotal.toLocaleString()}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Followers</p>
              </div>
              {analyticsStats.followersGained30 > 0 && (
                <p className="text-sm text-green-600 mb-1">+{analyticsStats.followersGained30} this month</p>
              )}
            </div>
            {followers && <FollowersTab followers={followers} />}
          </section>

          <section className="space-y-4 border-t border-border pt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discovery</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Profile Views" value={analyticsStats.profileViews30} prevValue={analyticsStats.profileViewsPrev30} description="Visits to your public profile" period="30d" />
              <StatCard label="CV Downloads" value={analyticsStats.cvClicks30} description="Clicks on your CV link" period="30d" />
              <StatCard label="Website Clicks" value={analyticsStats.websiteClicks30} description="Clicks through to your website" period="30d" />
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Engagement</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Artwork Views" value={analyticsStats.artworkViews30} description="Times your portfolio works were opened" period="30d" />
              <StatCard label="Followers Gained" value={analyticsStats.followersGained30} description="New followers in the last 30 days" period="30d" />
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career Activity</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Applied" value={analyticsStats.opportunitiesApplied} description="Opportunities applied to through Patronage" />
              <StatCard label="Saved" value={analyticsStats.opportunitiesSaved} description="Opportunities bookmarked or saved" />
              <StatCard label="Works Added" value={analyticsStats.worksAdded30} description="New works added to your portfolio" period="30d" />
            </div>
          </section>
        </div>
      )}

      {/* ── Support Tiers tab ── */}
      {activeTab === "support" && (
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
  );
}
