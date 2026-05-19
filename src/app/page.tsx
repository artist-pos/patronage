import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { StudioFeedCard } from "@/components/feed/StudioFeedCard";
import { OpportunityMiniCard } from "@/components/opportunities/OpportunityMiniCard";
import { getProfiles } from "@/lib/profiles";
import { getClosingSoonOpportunities } from "@/lib/opportunities";
import { getLatestUpdates } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

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
  const [supabase, artists, opportunities, updates] = await Promise.all([
    createClient(),
    getProfiles({}, 4),
    getClosingSoonOpportunities(4),
    getLatestUpdates(8),
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
