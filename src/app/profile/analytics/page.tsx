import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getProfileStats } from "@/lib/profileAnalytics";
import { getFollowerCount, getFollowers } from "@/lib/follows";
import { FollowerAccordion } from "@/components/profile/FollowerAccordion";

export const metadata = { title: "My Analytics — Patronage" };

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="border border-black p-5 space-y-1">
      <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs font-semibold uppercase tracking-widest">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function ProfileAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (!profile) redirect("/onboarding");

  const [stats, followerCount, followers] = await Promise.all([
    getProfileStats(user.id),
    getFollowerCount(user.id),
    getFollowers(user.id),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Analytics</h1>
        <p className="text-sm text-muted-foreground">
          How your profile is performing — last 30 days.
        </p>
      </div>

      {/* ── Followers ── */}
      <div className="space-y-4 border-b border-border pb-8">
        <div className="space-y-0.5">
          <p className="text-6xl font-bold tabular-nums">{followerCount.toLocaleString()}</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Total Followers
          </p>
        </div>
        <FollowerAccordion followers={followers} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Profile Views"
          value={stats.views}
          description="Visits to your public profile (excluding your own)"
        />
        <StatCard
          label="CV Downloads"
          value={stats.cvClicks}
          description="Clicks on your CV download link"
        />
        <StatCard
          label="Website Visits"
          value={stats.websiteClicks}
          description="Clicks to your personal website"
        />
        <StatCard
          label="Bibliography"
          value={stats.bibClicks}
          description="Clicks on your press / bibliography links"
        />
        <StatCard
          label="Messages Received"
          value={stats.messagesReceived}
          description="Messages sent to you through Patronage"
        />
      </div>

      {/* Callout if no data yet */}
      {stats.views === 0 &&
        stats.cvClicks === 0 &&
        stats.websiteClicks === 0 &&
        stats.bibClicks === 0 && (
          <p className="text-xs text-muted-foreground border border-dashed border-border p-4">
            No activity recorded yet. Data starts tracking once visitors view your public profile.
            Make sure your profile is active and discoverable in the{" "}
            <Link href="/artists" className="underline underline-offset-2">
              artist directory
            </Link>
            .
          </p>
        )}

      {/* Links */}
      <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-6">
        <Link href={`/${profile.username}`} className="underline underline-offset-2 hover:text-foreground transition-colors">
          View public profile →
        </Link>
        <Link href="/profile/edit" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Edit profile →
        </Link>
      </div>

    </div>
  );
}
