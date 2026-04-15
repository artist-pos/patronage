import { redirect } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { FollowersTab } from "@/components/analytics/FollowersTab";

export const metadata = { title: "Analytics — Patronage" };

const ProfileViewsChart = dynamic(
  () => import("@/components/analytics/ProfileViewsChart").then((m) => m.ProfileViewsChart),
  { ssr: false }
);

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function StatCard({
  label,
  value,
  description,
  period,
  prevValue,
}: {
  label: string;
  value: number;
  description: string;
  period?: string;
  prevValue?: number;
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

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
  );
}

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function ProfileAnalyticsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (!profile) redirect("/onboarding");

  const isArtist = profile.role === "artist" || profile.role === "owner";

  const { range } = await searchParams;
  const days = range === "7" ? 7 : range === "90" ? 90 : 30;
  const periodLabel = days === 7 ? "7d" : days === 90 ? "90d" : "30d";

  const [stats, followers] = await Promise.all([
    getProfileStats(user.id, days),
    getFollowers(user.id),
  ]);

  const hasNoData =
    stats.profileViews30 === 0 &&
    stats.artworkViews30 === 0 &&
    stats.cvClicks30 === 0 &&
    stats.followersTotal === 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

      <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            How your profile is performing.
          </p>
        </div>
        {/* Date range toggle */}
        <div className="flex gap-1 shrink-0">
          {RANGE_OPTIONS.map(({ label, days: d }) => (
            <Link
              key={label}
              href={`/profile/analytics?range=${d}`}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                days === d
                  ? "border-black bg-black text-white"
                  : "border-border hover:border-black"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Audience ── */}
      <section className="space-y-5">
        <SectionLabel label="Audience" />
        <div className="flex items-end gap-5">
          <div className="space-y-0.5">
            <p className="text-6xl font-bold tabular-nums">{stats.followersTotal.toLocaleString()}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total Followers
            </p>
          </div>
          {stats.followersGained30 > 0 && (
            <p className="text-sm text-green-600 mb-1">
              +{stats.followersGained30} this period
            </p>
          )}
        </div>
        <FollowersTab followers={followers} />
      </section>

      {/* ── Discovery ── */}
      <section className="space-y-5 border-t border-border pt-8">
        <SectionLabel label="Discovery" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Profile Views"
            value={stats.profileViews30}
            prevValue={stats.profileViewsPrev30}
            description="Visits to your public profile, excluding your own"
            period={periodLabel}
          />
          <StatCard
            label="CV Downloads"
            value={stats.cvClicks30}
            description="Clicks on your CV link"
            period={periodLabel}
          />
          <StatCard
            label="Website Clicks"
            value={stats.websiteClicks30}
            description="Clicks through to your personal website"
            period={periodLabel}
          />
        </div>
        <ProfileViewsChart data={stats.profileViewsTimeline} days={days} />
      </section>

      {/* ── Engagement ── */}
      <section className="space-y-4 border-t border-border pt-8">
        <SectionLabel label="Engagement" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Artwork Views"
            value={stats.artworkViews30}
            description="Times your portfolio works were opened"
            period={periodLabel}
          />
          <StatCard
            label="Followers Gained"
            value={stats.followersGained30}
            description={`New followers in the last ${days} days`}
            period={periodLabel}
          />
        </div>
      </section>

      {/* ── Career Activity ── */}
      {isArtist && (
        <section className="space-y-4 border-t border-border pt-8">
          <SectionLabel label="Career Activity" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Applied"
              value={stats.opportunitiesApplied}
              description="Opportunities applied to through Patronage"
            />
            <StatCard
              label="Saved"
              value={stats.opportunitiesSaved}
              description="Opportunities bookmarked or saved"
            />
            <StatCard
              label="Works Added"
              value={stats.worksAdded30}
              description="New works added to your portfolio"
              period={periodLabel}
            />
          </div>
        </section>
      )}

      {/* Callout if no data yet */}
      {hasNoData && (
        <p className="text-xs text-muted-foreground border border-dashed border-border p-4">
          {isArtist ? (
            <>
              No activity recorded yet. Data starts tracking once visitors view your public profile.
              Make sure your profile is active and discoverable in the{" "}
              <Link href="/artists" className="underline underline-offset-2">
                artist directory
              </Link>
              .
            </>
          ) : (
            "No activity recorded yet. Data will appear here as your profile receives visits."
          )}
        </p>
      )}

      {/* Footer links */}
      <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-6">
        <Link
          href={`/${profile.username}`}
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          View public profile →
        </Link>
        <Link
          href="/profile/edit"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Edit profile →
        </Link>
      </div>

    </div>
  );
}
