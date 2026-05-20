import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Button } from "@/components/ui/button";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { StudioFeedCard } from "@/components/feed/StudioFeedCard";
import { OpportunityMiniCard } from "@/components/opportunities/OpportunityMiniCard";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Profile, ProfileWithImage, Opportunity } from "@/types/database";
import type { ProjectUpdateWithArtist } from "@/types/database";

// ── Cached public data — shared across all visitors, revalidated every 5 min ──

const UPDATE_SELECT = `
  id, artist_id, project_id, image_url, caption, content_type, discipline,
  audio_url, video_url, text_content, embed_url, embed_provider,
  orientation, image_width, image_height, collaborator_ids,
  title, tldr, update_tag, created_at,
  profiles!project_updates_artist_id_fkey (username, full_name, avatar_url)
`;

const getCachedHomeData = unstable_cache(
  async (today: string) => {
    const supabase = createPublicClient();
    const [artistsRes, oppsRes, updatesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url, featured_image_url, medium, career_stage, country, role, created_at, is_active")
        .eq("is_active", true)
        .in("role", ["artist", "owner"])
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("opportunities")
        .select("id, slug, title, organiser, caption, type, country, city, deadline, opens_at, featured_image_url, is_featured, sub_categories, funding_range, funding_amount, entry_fee, grant_type, recipients_count, is_recurring, recurrence_pattern")
        .eq("is_active", true)
        .eq("status", "published")
        .or(`deadline.gte.${today},deadline.is.null`)
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(4),
      supabase
        .from("project_updates")
        .select(UPDATE_SELECT)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const artists: ProfileWithImage[] = (artistsRes.data ?? []).map((p: any) => ({
      ...p,
      primary_image_url: p.featured_image_url ?? null,
    }));

    const opportunities = (oppsRes.data ?? []) as Opportunity[];

    const updates: ProjectUpdateWithArtist[] = (updatesRes.data ?? []).map((row: any) => ({
      id: row.id,
      artist_id: row.artist_id,
      project_id: row.project_id ?? null,
      image_url: row.image_url ?? null,
      caption: row.caption ?? null,
      content_type: row.content_type ?? "image",
      discipline: row.discipline ?? null,
      audio_url: row.audio_url ?? null,
      video_url: row.video_url ?? null,
      text_content: row.text_content ?? null,
      embed_url: row.embed_url ?? null,
      embed_provider: row.embed_provider ?? null,
      orientation: row.orientation ?? null,
      image_width: row.image_width ?? null,
      image_height: row.image_height ?? null,
      created_at: row.created_at,
      artist_username: row.profiles?.username ?? "",
      artist_full_name: row.profiles?.full_name ?? null,
      artist_avatar_url: row.profiles?.avatar_url ?? null,
      collaborator_ids: row.collaborator_ids ?? [],
      title: row.title ?? null,
      tldr: row.tldr ?? null,
      update_tag: row.update_tag ?? "update",
      collaborators: [],
    }));

    return { artists, opportunities, updates };
  },
  ["home-data"],
  { revalidate: 300 }
);

export const metadata: Metadata = {
  title: "Patronage — Art Grants & Opportunities for NZ & Australian Artists",
  description:
    "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Browse 500+ live opportunities updated weekly.",
  alternates: { canonical: "https://patronage.nz" },
  openGraph: {
    title: "Patronage — Art Grants & Opportunities for NZ & Australian Artists",
    description:
      "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Browse 500+ live opportunities updated weekly.",
    url: "https://patronage.nz",
    type: "website",
  },
};


export default async function Home() {
  const today = new Date().toISOString().split("T")[0];
  const [supabase, { artists, opportunities, updates }] = await Promise.all([
    createClient(),
    getCachedHomeData(today),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  const isNewUser = !!user && !!user.created_at &&
    (Date.now() - new Date(user.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <div>
      <div className={`max-w-[1600px] mx-auto px-6 ${isAuthenticated ? "py-0 space-y-0" : "py-16 space-y-16"}`}>

        {/* ── Hero / Brand header ── */}
        {isAuthenticated ? (
          <h1 className="text-4xl font-semibold tracking-tight text-center mt-8 mb-4">
            Patronage
          </h1>
        ) : (
          <div className="space-y-6 flex flex-col items-center text-center">
            <div className="space-y-1.5">
              <h1 className="text-4xl font-semibold tracking-tight">Career infrastructure for artists in Aotearoa.</h1>
              <p className="text-lg text-muted-foreground">
                Grants, residencies, open calls, commissions, and the tools to build a sustainable practice. Free to use.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild>
                <Link href="/opportunities">Browse Opportunities</Link>
              </Button>
            </div>

            {/* ── Role-specific join buttons ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
              <Link
                href="/auth/signup?role=artist"
                className="flex flex-col items-center text-center gap-1 bg-black text-white px-5 py-4 hover:bg-black/85 transition-colors"
              >
                <span className="text-sm font-semibold">Join as an Artist</span>
                <span className="text-xs opacity-70 leading-snug">
                  Build your profile and find opportunities.
                </span>
              </Link>
              <Link
                href="/auth/signup?role=patron"
                className="flex flex-col items-center text-center gap-1 border border-black px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-semibold">Join as a Patron</span>
                <span className="text-xs text-muted-foreground leading-snug">
                  Follow and collect work from artists you believe in.
                </span>
              </Link>
              <Link
                href="/auth/signup?role=partner"
                className="flex flex-col items-center text-center gap-1 border border-black px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-semibold">Join as a Partner</span>
                <span className="text-xs text-muted-foreground leading-snug">
                  List opportunities, run applications, or invest in artists as part of your ESG strategy.
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Divider for authenticated view ── */}
        {isAuthenticated && (
          <hr className="my-6" style={{ borderColor: "#eeeeee" }} />
        )}

        {/* ── Active Directory ── */}
        <div className={`space-y-8 ${isAuthenticated ? "pt-0" : "border-t border-border pt-16"}`}>
          <div className="space-y-1 text-center">
            {isAuthenticated && isNewUser && (
              <p className="text-base text-gray-500 mb-2">
                Welcome to Patronage. Here&rsquo;s what&rsquo;s happening.
              </p>
            )}
            <h2 className="text-xl font-semibold tracking-tight">
              {isAuthenticated ? "What\u2019s happening" : "Active Directory"}
            </h2>
            <p className="text-sm text-muted-foreground">
              New artists and opportunities closing soon.
            </p>
          </div>

          {/* Mobile: stacked sections */}
          <div className="lg:hidden space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Artists</h3>
                <Link href="/artists" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">View all</Link>
              </div>
              <div className="flex flex-col gap-3">
                {artists.length > 0 ? artists.map((a) => <ArtistCard key={a.id} artist={a} compact />) : <p className="text-sm text-muted-foreground">No artists yet.</p>}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Opportunities</h3>
                <Link href="/opportunities" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">View all</Link>
              </div>
              <div className="flex flex-col gap-2">
                {opportunities.length > 0 ? opportunities.map((o) => <OpportunityMiniCard key={o.id} opp={o} />) : <p className="text-sm text-muted-foreground">No opportunities yet.</p>}
              </div>
            </div>
          </div>

          {/* Desktop: paired grid — each artist[i] and opportunity[i] share a CSS grid row,
              so align-items:stretch (the default) makes both cells the same height */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Artists</h3>
              <Link href="/artists" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">View all</Link>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Opportunities</h3>
              <Link href="/opportunities" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">View all</Link>
            </div>
            {/* Card pairs — Fragment keeps both as direct grid children so they share the row */}
            {Array.from({ length: Math.max(artists.length, opportunities.length) }, (_, i) => (
              <Fragment key={i}>
                {artists[i] ? <ArtistCard artist={artists[i]} compact /> : <div />}
                {opportunities[i] ? <OpportunityMiniCard opp={opportunities[i]} /> : <div />}
              </Fragment>
            ))}
          </div>
        </div>

        {/* ── Latest from the Studio ── */}
        {updates.length > 0 && (
          <div className="space-y-6 border-t border-border pt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                From the studio
              </h2>
              <Link href="/feed" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            </div>

            <div
              className="flex flex-row flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [scroll-snap-type:x_mandatory] [-webkit-overflow-scrolling:touch]"
            >
              {updates.map((u) => (
                <StudioFeedCard
                  key={u.id}
                  u={u}
                  className="shrink-0 [scroll-snap-align:start]"
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Sign-up CTA – above footer, hidden for authenticated users ── */}
      {!isAuthenticated && (
        <div className="border-t border-border px-6 py-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Stay across it
            </p>
            <p className="text-sm text-muted-foreground">
              New opportunities in your inbox every week. Free.
            </p>
            <Button asChild>
              <Link href="/auth/signup">Create a free account</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
