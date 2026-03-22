import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowers } from "@/lib/follows";
import { FollowersTab } from "@/components/analytics/FollowersTab";

export const metadata = { title: "Analytics — Patronage" };

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

export default async function ProfileAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (!profile) redirect("/onboarding");

  const isArtist = profile.role === "artist" || profile.role === "owner";

  const [stats, followers] = await Promise.all([
    getProfileStats(user.id),
    getFollowers(user.id),
  ]);

  const hasNoData =
    stats.profileViews30 === 0 &&
    stats.artworkViews30 === 0 &&
    stats.cvClicks30 === 0 &&
    stats.followersTotal === 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          How your profile is performing — last 30 days.
        </p>
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
              +{stats.followersGained30} this month
            </p>
          )}
        </div>
        <FollowersTab followers={followers} />
      </section>

      {/* ── Discovery ── */}
      <section className="space-y-4 border-t border-border pt-8">
        <SectionLabel label="Discovery" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Profile Views"
            value={stats.profileViews30}
            prevValue={stats.profileViewsPrev30}
            description="Visits to your public profile, excluding your own"
            period="30d"
          />
          <StatCard
            label="CV Downloads"
            value={stats.cvClicks30}
            description="Clicks on your CV link"
            period="30d"
          />
          <StatCard
            label="Website Clicks"
            value={stats.websiteClicks30}
            description="Clicks through to your personal website"
            period="30d"
          />
        </div>
      </section>

      {/* ── Engagement ── */}
      <section className="space-y-4 border-t border-border pt-8">
        <SectionLabel label="Engagement" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Artwork Views"
            value={stats.artworkViews30}
            description="Times your portfolio works were opened"
            period="30d"
          />
          <StatCard
            label="Followers Gained"
            value={stats.followersGained30}
            description="New followers in the last 30 days"
            period="30d"
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
              period="30d"
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
