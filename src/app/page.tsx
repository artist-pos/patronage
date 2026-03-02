import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmailCapture } from "@/components/home/EmailCapture";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { getProfiles } from "@/lib/profiles";
import { getClosingSoonOpportunities } from "@/lib/opportunities";
import { getLatestUpdates } from "@/lib/feed";
import type { Opportunity } from "@/types/database";

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function OpportunityMiniCard({ opp }: { opp: Opportunity }) {
  const days = daysUntil(opp.deadline);
  return (
    <a
      href={opp.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group border border-black flex sm:h-[200px] hover:bg-muted/30 transition-colors overflow-hidden"
    >
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
      <div className="p-4 flex flex-col gap-2 flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold group-hover:underline underline-offset-2 leading-snug line-clamp-2">
            {opp.title}
          </p>
          {days !== null && days <= 7 && (
            <Badge className="text-xs font-normal bg-foreground text-background shrink-0">
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
          {opp.deadline && (
            <span className="text-xs text-muted-foreground ml-auto">
              {days !== null && days >= 0 ? `${days}d remaining` : opp.deadline}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default async function Home() {
  const [artists, opportunities, updates] = await Promise.all([
    getProfiles({}, 4),
    getClosingSoonOpportunities(4),
    getLatestUpdates(12),
  ]);

  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-6 py-16 space-y-16">

        {/* ── Hero ── */}
        <div className="space-y-6 flex flex-col items-center text-center">
          <div className="space-y-1.5">
            <h1 className="text-4xl font-semibold tracking-tight">Patronage</h1>
            <p className="text-lg text-muted-foreground">
              Grants, residencies, and open calls for New Zealand and Australian
              artists — curated and verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild>
              <Link href="/opportunities">Browse Opportunities</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/artists">Join as an Artist</Link>
            </Button>
          </div>
        </div>

        {/* ── Active Directory ── */}
        <div className="space-y-8 border-t border-border pt-16">
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Active Directory</h2>
            <p className="text-sm text-muted-foreground">
              Recently joined artists and opportunities closing soon.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Artists */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Artists
                </h3>
                <Link
                  href="/artists"
                  className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {artists.length > 0 ? (
                  artists.map((a) => <ArtistCard key={a.id} artist={a} compact />)
                ) : (
                  <p className="text-sm text-muted-foreground">No artists yet.</p>
                )}
              </div>
            </div>

            {/* Opportunities */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Opportunities
                </h3>
                <Link
                  href="/opportunities"
                  className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {opportunities.length > 0 ? (
                  opportunities.map((o) => <OpportunityMiniCard key={o.id} opp={o} />)
                ) : (
                  <p className="text-sm text-muted-foreground">No opportunities yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Latest from the Studio ── */}
        {updates.length > 0 && (
          <div className="space-y-6 border-t border-border pt-16">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight">Latest from the Studio</h2>
              <p className="text-sm text-muted-foreground">Work in progress from the Patronage community.</p>
            </div>

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-6 gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 scrollbar-none">
              {updates.map((u) => (
                <Link
                  key={u.id}
                  href={`/projects/${u.id}`}
                  className="group relative shrink-0 w-48 sm:w-auto aspect-square border border-border overflow-hidden bg-muted block"
                >
                  <Image
                    src={u.image_url}
                    alt={u.caption ?? `Update by ${u.artist_full_name ?? u.artist_username}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 192px, (max-width: 1024px) 25vw, 16vw"
                  />
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    {u.caption && (
                      <p className="text-xs leading-snug line-clamp-3 mb-1">{u.caption}</p>
                    )}
                    <p className="text-xs font-semibold truncate">
                      {u.artist_full_name ?? u.artist_username}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Weekly Digest – above footer ── */}
      <div className="border-t border-border px-6 py-12 text-center">
        <div className="max-w-md mx-auto">
          <EmailCapture />
        </div>
      </div>
    </div>
  );
}
