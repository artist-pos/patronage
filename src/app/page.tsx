import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { getProfiles } from "@/lib/profiles";
import { getClosingSoonOpportunities } from "@/lib/opportunities";
import { getLatestUpdates } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, ProjectUpdateWithArtist } from "@/types/database";

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function OpportunityMiniCard({ opp }: { opp: Opportunity }) {
  const days = daysUntil(opp.deadline);
  const isUrgent = days !== null && days <= 1;
  const isSoon = days !== null && days <= 3;
  return (
    <Link
      href={`/opportunities/${opp.slug ?? opp.id}`}
      className="group relative border border-black flex hover:bg-muted/30 transition-colors overflow-hidden"
    >
      {/* Closing soon badge — mobile only; sm+ shows inline after title */}
      {days !== null && days <= 7 && !isSoon && (
        <Badge className="absolute top-2 left-2 z-10 text-xs font-normal sm:hidden bg-foreground text-background">
          Closing soon
        </Badge>
      )}

      {/* Partner logo — wider container, object-contain so logos breathe */}
      {opp.featured_image_url && (
        <div className="w-36 shrink-0 bg-white border-r border-black overflow-hidden flex items-center justify-center self-stretch">
          <Image
            src={opp.featured_image_url}
            alt={opp.title}
            width={120}
            height={120}
            unoptimized
            className="w-full h-auto max-h-full object-contain p-3"
            sizes="144px"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5 flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold group-hover:underline underline-offset-2 leading-snug line-clamp-2">
            {opp.title}
            {isSoon && days !== null && (
              <span className="text-red-600 font-medium ml-1">
                · {isUrgent ? "1d left" : `${days}d left`}
              </span>
            )}
          </p>
          {days !== null && days <= 7 && !isSoon && (
            <Badge className="hidden sm:inline-flex text-xs font-normal shrink-0 bg-foreground text-background">
              Closing soon
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{opp.organiser}</p>
        {opp.caption && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {opp.caption}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.type}
          </span>
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.country}
          </span>
          {opp.funding_range && (
            <span className="text-xs font-mono font-bold">
              {opp.funding_range}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StudioFeedCard({ u }: { u: ProjectUpdateWithArtist }) {
  const name = u.artist_full_name ?? u.artist_username;
  const href = u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}?from=feed`;
  return (
    <Link href={href} scroll={false} className="group block sm:inline-block sm:max-w-[280px] border border-border bg-background overflow-hidden">
      {u.image_url && (
        <div className="overflow-hidden bg-muted aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ display: "block" }}
          />
        </div>
      )}
      <div className="px-2.5 py-1.5 border-t border-border min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {u.artist_avatar_url ? (
            <div className="relative w-5 h-5 shrink-0 overflow-hidden border border-black">
              <Image src={u.artist_avatar_url} alt={name} fill loading="lazy" className="object-cover" sizes="20px" />
            </div>
          ) : (
            <div className="w-5 h-5 shrink-0 border border-black bg-muted flex items-center justify-center text-[8px] font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-xs font-semibold truncate flex-1 min-w-0">{name}</p>
        </div>
        {u.caption && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{u.caption}</p>
        )}
      </div>
    </Link>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  const isNewUser = !!user && !!user.created_at &&
    (Date.now() - new Date(user.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

  const [artists, opportunities, updates] = await Promise.all([
    getProfiles({}, 4),
    getClosingSoonOpportunities(4),
    getLatestUpdates(12),
  ]);

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
              <h1 className="text-4xl font-semibold tracking-tight">Find funding. Build your profile. Get seen.</h1>
              <p className="text-lg text-muted-foreground">
                Grants, residencies, and open calls for artists across Aotearoa and Australia — updated weekly, free to use.
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
                  List opportunities and reach artists directly.
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

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {updates.map((u) => (
                <StudioFeedCard key={u.id} u={u} />
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
