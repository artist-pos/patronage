import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { FollowersTab } from "@/components/analytics/FollowersTab";
import { ProfileViewsChartWrapper } from "@/components/analytics/ProfileViewsChartWrapper";
import { AnalyticsExpandable } from "@/components/analytics/AnalyticsExpandable";
import { LEGACY_SECTION_ALIASES } from "./sidebar-config";

const SECTION_TO_ROUTE: Record<string, string> = {
  home:             "/studio",
  works:            "/studio/works",
  feed:             "/studio/feed",
  opportunities:    "/studio/opportunities",
  campaigns:        "/studio/qr-codes",
  "qr-codes":       "/studio/qr-codes",
  "profile-cv":     "/studio/profile",
  profile:          "/studio/profile",
  "support-tiers":  "/studio/support",
  support:          "/studio/support",
  analytics:        "/studio",
  account:          "/studio/account",
  provenance:       "/studio/provenance",
  rooms:            "/studio/exhibitions",
  exhibitions:      "/studio/exhibitions",
  earnings:         "/studio/earnings",
  collection:       "/dashboard/collection",
  messages:         "/messages",
};

interface PageProps {
  searchParams: Promise<{
    section?: string;
    tab?: string;
    [key: string]: string | undefined;
  }>;
}

export default async function StudioHomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // ── Legacy ?section= redirect ──────────────────────────────────────────
  const rawSection = params.section ?? params.tab;
  if (rawSection) {
    const resolved = LEGACY_SECTION_ALIASES[rawSection] ?? rawSection;
    const dest = SECTION_TO_ROUTE[resolved];
    if (dest && dest !== "/studio") {
      const sub = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (k !== "section" && k !== "tab" && v) sub.set(k, v);
      }
      const qs = sub.toString();
      redirect(qs ? `${dest}?${qs}` : dest);
    }
  }

  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (!profile) redirect("/onboarding/role");

  const role = profile.role;
  const isArtist = role === "artist" || role === "owner" || role === "admin";

  if (isArtist) {
    return <ArtistHome userId={user.id} />;
  }

  if (role === "partner") {
    return <PartnerHome />;
  }

  // Patron (default)
  return <PatronHome />;
}

// ── Artist Home ──────────────────────────────────────────────────────────────

async function ArtistHome({ userId }: { userId: string }) {
  const completionProfile = await fetchCompletionProfile(userId);
  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  const [pendingConfirmationCount, savedData, analyticsStats, analyticsFollowers] = await Promise.all([
    getPendingConfirmationCount(userId),
    getSavedOpportunities(),
    getProfileStats(userId, 30),
    getFollowers(userId),
  ]);

  const { closingSoon } = categorizeSaved(savedData);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Your studio at a glance.</p>
      </div>

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/studio/works", label: "My Work", description: "Manage your portfolio and listings" },
          { href: "/studio/feed", label: "Studio Feed", description: "Post updates and project threads" },
          { href: "/studio/opportunities", label: "Opportunities", description: "Saved grants, residencies, and applications" },
          { href: "/studio/profile", label: "Profile & CV", description: "Edit your bio, exhibitions, and press" },
          { href: "/studio/support", label: "Supporters", description: "Configure ways for patrons to support you" },
          { href: "/studio/earnings", label: "Earnings", description: "Track sales and manage payouts" },
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

      {closingSoon.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Closing Soon</p>
            <Link href="/studio/opportunities?of=closing" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
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

      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Analytics</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AnalyticsSummaryCard label="Profile Views" value={analyticsStats.profileViews30} period="30d" />
          <AnalyticsSummaryCard label="Followers" value={analyticsStats.followersTotal} />
          <AnalyticsSummaryCard label="Artwork Views" value={analyticsStats.artworkViews30} period="30d" />
          <AnalyticsSummaryCard label="Works Added" value={analyticsStats.worksAdded30} period="30d" />
        </div>

        <AnalyticsExpandable>
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discovery</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AnalyticsDetailCard
                  label="Profile Views"
                  value={analyticsStats.profileViews30}
                  prevValue={analyticsStats.profileViewsPrev30}
                  description="Visits to your public profile"
                  period="30d"
                />
                <AnalyticsDetailCard label="CV Downloads" value={analyticsStats.cvClicks30} description="Clicks on your CV link" period="30d" />
                <AnalyticsDetailCard label="Website Clicks" value={analyticsStats.websiteClicks30} description="Clicks through to your website" period="30d" />
              </div>
              <ProfileViewsChartWrapper data={analyticsStats.profileViewsTimeline} days={30} />
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Engagement</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AnalyticsDetailCard label="Artwork Views" value={analyticsStats.artworkViews30} description="Times your portfolio works were opened" period="30d" />
                <AnalyticsDetailCard label="Followers Gained" value={analyticsStats.followersGained30} description="New followers in the last 30 days" />
                <AnalyticsDetailCard label="Works Added" value={analyticsStats.worksAdded30} description="New works added to your portfolio" period="30d" />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career Activity</p>
              <div className="grid grid-cols-2 gap-3">
                <AnalyticsDetailCard label="Applied" value={analyticsStats.opportunitiesApplied} description="Opportunities applied to through Patronage" />
                <AnalyticsDetailCard label="Saved" value={analyticsStats.opportunitiesSaved} description="Opportunities bookmarked" />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Audience</p>
              <div className="flex items-end gap-5">
                <div className="space-y-0.5">
                  <p className="text-4xl font-bold tabular-nums">{analyticsStats.followersTotal.toLocaleString()}</p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Followers</p>
                </div>
                {analyticsStats.followersGained30 > 0 && (
                  <p className="text-sm text-green-600 mb-1">+{analyticsStats.followersGained30} this period</p>
                )}
              </div>
              {analyticsFollowers && <FollowersTab followers={analyticsFollowers} />}
            </div>
          </div>
        </AnalyticsExpandable>
      </section>
    </div>
  );
}

// ── Patron Home ──────────────────────────────────────────────────────────────

async function PatronHome() {
  const savedData = await getSavedOpportunities();
  const { closingSoon } = categorizeSaved(savedData);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Your dashboard at a glance.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/collection", label: "Collection", description: "Works you own and have acquired" },
          { href: "/opportunities", label: "Opportunities", description: "Browse grants, residencies, and open calls" },
          { href: "/messages", label: "Messages", description: "Conversations with artists and partners" },
          { href: "/dashboard?tab=subscriptions", label: "My Support", description: "Artists and tiers you support" },
          { href: "/artists", label: "Artists", description: "Discover artists on Patronage" },
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

      {closingSoon.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Closing Soon</p>
            <Link href="/opportunities" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
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
  );
}

// ── Partner Home ─────────────────────────────────────────────────────────────

function PartnerHome() {
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Your dashboard at a glance.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/opportunities", label: "Open Calls", description: "Browse and manage your opportunity listings" },
          { href: "/partner/roster", label: "Your Artists", description: "Artists associated with your organisation" },
          { href: "/messages", label: "Messages", description: "Conversations with artists and patrons" },
          { href: "/list-an-opportunity", label: "List an Opportunity", description: "Publish a new call, grant, or residency" },
          { href: "/artists", label: "Artists", description: "Discover artists on Patronage" },
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
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function AnalyticsSummaryCard({
  label, value, period,
}: {
  label: string; value: number; period?: string;
}) {
  return (
    <div className="border border-border p-4 space-y-1">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {period && <span className="ml-1 opacity-60">· {period}</span>}
      </p>
    </div>
  );
}

function AnalyticsDetailCard({
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
