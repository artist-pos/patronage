import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { OpportunityMiniCard } from "@/components/opportunities/OpportunityMiniCard";
import { HUB_CONTENT, HUB_TYPE_LABEL } from "@/lib/hub-content";
import type { Opportunity } from "@/types/database";

export const metadata: Metadata = {
  title: "Search | Patronage",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

interface HubMatch {
  label: string;
  description: string;
  url: string;
}

function matchHubs(q: string): HubMatch[] {
  const lower = q.toLowerCase();
  const words = lower.split(/\s+/);

  const TYPE_KEYWORDS: Record<string, string[]> = {
    grants: ["grant", "grants", "funding", "fund"],
    residencies: ["residency", "residencies", "studio", "retreat"],
    "open-calls": ["open call", "open calls", "submission", "submit"],
    prizes: ["prize", "prizes", "award", "awards"],
    jobs: ["job", "jobs", "employment", "work", "career", "position"],
  };
  const COUNTRY_KEYWORDS: Record<string, string[]> = {
    "new-zealand": ["nz", "new zealand", "aotearoa", "kiwi"],
    australia: ["aus", "australia", "australian"],
  };

  const matchedTypes = Object.entries(TYPE_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => words.some((w) => w.includes(kw)) || lower.includes(kw)))
    .map(([slug]) => slug);

  const matchedCountries = Object.entries(COUNTRY_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([slug]) => slug);

  const results: HubMatch[] = [];

  for (const type of matchedTypes) {
    for (const country of matchedCountries) {
      const key = `${type}/${country}`;
      if (HUB_CONTENT[key]) {
        results.push({
          label: HUB_CONTENT[key].title,
          description: HUB_CONTENT[key].intro,
          url: `/opportunities/${key}`,
        });
      }
    }
    if (matchedCountries.length === 0) {
      results.push({
        label: `${HUB_TYPE_LABEL[type] ?? type}`,
        description: `Browse all ${(HUB_TYPE_LABEL[type] ?? type).toLowerCase()} on Patronage`,
        url: `/opportunities?type=${encodeURIComponent(Object.keys(HUB_CONTENT).find((k) => k.startsWith(type)) ?? type)}`,
      });
    }
  }

  return results;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q: raw = "" } = await searchParams;
  const q = raw.trim();

  if (q.length < 2) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Enter at least 2 characters to search opportunities, artists, and resources.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const p = `%${q}%`;
  const oppSelect = "id, slug, title, organiser, type, country, city, deadline, featured_image_url, caption, funding_range, sub_categories, status, is_active, opens_at, funding_amount, grant_type, recipients_count, is_recurring, recurrence_pattern, is_featured, entry_fee, routing_type, custom_fields, show_badges_in_submission, claim_token, claim_email, claim_token_expires_at, claim_invite_sent_at, claim_invite_email, claim_invite_scheduled_for, claim_invite_template, claim_link_opened_at, claim_link_open_count, view_count, description, full_description, source_url, profile_id, created_at, entry_fee_currency, entry_fee_local, artist_payment_type, travel_support, travel_support_details, tags, career_stage, recurrence_open_day, recurrence_close_day, recurrence_end_date, pipeline_config, is_patronage_supported, confidence, pipeline_paid_at, featured_until";

  const [oppsRes, artistsRes] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, slug, title, organiser, type, country, city, deadline, featured_image_url, caption, funding_range, sub_categories")
      .eq("is_active", true)
      .eq("status", "published")
      .or(`title.ilike.${p},organiser.ilike.${p},description.ilike.${p},caption.ilike.${p}`)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, medium, country")
      .in("role", ["artist", "owner"])
      .eq("is_active", true)
      .or(`full_name.ilike.${p},username.ilike.${p}`)
      .limit(6),
  ]);

  const opps = (oppsRes.data ?? []) as unknown as Opportunity[];
  const artists = artistsRes.data ?? [];
  const hubs = matchHubs(q);
  const hasResults = hubs.length > 0 || opps.length > 0 || artists.length > 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search results</h1>
        <p className="text-sm text-muted-foreground">for &ldquo;{q}&rdquo;</p>
      </div>

      {!hasResults && (
        <div className="space-y-4 py-8">
          <p className="text-sm text-muted-foreground">
            No results for &ldquo;{q}&rdquo;.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/opportunities" className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">Browse opportunities</Link>
            <Link href="/artists" className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">Browse artists</Link>
            <Link href="/resources" className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">Resources</Link>
          </div>
        </div>
      )}

      {/* Hub suggestions */}
      {hubs.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Pages</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hubs.map((hub) => (
              <Link
                key={hub.url}
                href={hub.url}
                className="group border border-black p-4 hover:bg-muted/30 transition-colors space-y-1"
              >
                <p className="text-sm font-semibold group-hover:underline underline-offset-2">{hub.label}</p>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{hub.description}</p>
              </Link>
            ))}
            <Link
              key="resources"
              href="/resources"
              className="group border border-black p-4 hover:bg-muted/30 transition-colors space-y-1"
            >
              <p className="text-sm font-semibold group-hover:underline underline-offset-2">Resources for artists</p>
              <p className="text-xs text-muted-foreground leading-snug">Grant writing, budgeting, artist statements, and funding body guides.</p>
            </Link>
          </div>
        </section>
      )}

      {/* Opportunities */}
      {opps.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Opportunities · {opps.length}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {opps.map((opp) => (
              <OpportunityMiniCard key={opp.id} opp={opp} />
            ))}
          </div>
          <Link
            href={`/opportunities?search=${encodeURIComponent(q)}`}
            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            All opportunities matching &ldquo;{q}&rdquo; →
          </Link>
        </section>
      )}

      {/* Artists */}
      {artists.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Artists · {artists.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/${artist.username}`}
                className="group flex items-center gap-3 border border-black p-3 hover:bg-muted/30 transition-colors"
              >
                {artist.avatar_url ? (
                  <div className="relative w-10 h-10 shrink-0 border border-black overflow-hidden">
                    <Image src={artist.avatar_url} alt={artist.full_name ?? artist.username} fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 border border-black bg-muted flex items-center justify-center text-sm font-medium">
                    {(artist.full_name ?? artist.username).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                    {artist.full_name ?? artist.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{artist.username}{artist.country ? ` · ${artist.country}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
