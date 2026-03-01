import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmailCapture } from "@/components/home/EmailCapture";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { getProfiles } from "@/lib/profiles";
import { getClosingSoonOpportunities } from "@/lib/opportunities";
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
      className="group border border-black p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold group-hover:underline underline-offset-2 leading-snug">
          {opp.title}
        </p>
        {days !== null && days <= 7 && (
          <Badge className="text-xs font-normal bg-foreground text-background shrink-0">
            Closing soon
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{opp.organiser}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
          {opp.type}
        </span>
        <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
          {opp.country}
        </span>
        {opp.deadline && (
          <span className="text-xs text-muted-foreground">
            {days !== null && days >= 0 ? `${days}d remaining` : opp.deadline}
          </span>
        )}
      </div>
    </a>
  );
}

export default async function Home() {
  const [artists, opportunities] = await Promise.all([
    getProfiles({}, 4),
    getClosingSoonOpportunities(4),
  ]);

  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-6 py-16 space-y-16">

        {/* ── Hero ── */}
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-4xl font-semibold tracking-tight">Patronage</h1>
            <p className="text-lg text-muted-foreground">
              Grants, residencies, and open calls for New Zealand and Australian
              artists — curated and verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/opportunities">Browse Opportunities</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/artists">Join as Artist</Link>
            </Button>
          </div>
        </div>

        {/* ── Active Directory ── */}
        <div className="space-y-8 border-t border-border pt-16">
          <div className="space-y-1">
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
                  artists.map((a) => <ArtistCard key={a.id} artist={a} />)
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

      </div>

      {/* ── Weekly Digest – above footer ── */}
      <div className="border-t border-border px-6 py-12">
        <div className="max-w-xl mx-auto">
          <EmailCapture />
        </div>
      </div>
    </div>
  );
}
