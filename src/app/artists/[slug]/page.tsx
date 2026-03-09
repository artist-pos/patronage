import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfiles } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { computeBadges } from "@/lib/badges";
import type { CountryEnum, DisciplineEnum } from "@/types/database";
import Link from "next/link";

// Revalidate every 24 hours — new artists joining won't require a full rebuild
export const revalidate = 86400;

// Only known slugs are valid — return 404 for anything else
export const dynamicParams = false;

// ── Slug → filter mappings ────────────────────────────────────────────────────

interface CountryMeta {
  kind: "country";
  value: CountryEnum;
  label: string;        // used in H1: "[label] Artists"
  adjective: string;    // used in prose: "[adjective] artists"
}

interface DisciplineMeta {
  kind: "discipline";
  value: DisciplineEnum;
  label: string;        // used in H1: plural form
  singular: string;     // "painter", "musician"
  prose: string;        // used in descriptive paragraph
}

type SlugMeta = CountryMeta | DisciplineMeta;

const SLUG_MAP: Record<string, SlugMeta> = {
  // Countries
  "new-zealand": { kind: "country", value: "NZ",     label: "New Zealand",  adjective: "New Zealand-based" },
  "australia":   { kind: "country", value: "AUS",    label: "Australian",   adjective: "Australian" },
  "uk":          { kind: "country", value: "UK",     label: "UK",           adjective: "UK-based" },
  "us":          { kind: "country", value: "US",     label: "US",           adjective: "US-based" },
  "eu":          { kind: "country", value: "EU",     label: "European",     adjective: "European" },
  "global":      { kind: "country", value: "Global", label: "Global",       adjective: "internationally based" },
  // Disciplines
  "visual-art":    { kind: "discipline", value: "visual_art",   label: "Visual Artists",                 singular: "visual artist",          prose: "painters, printmakers, sculptors, and visual artists" },
  "music":         { kind: "discipline", value: "music",        label: "Musicians",                      singular: "musician",               prose: "composers, performers, producers, and musicians" },
  "poetry":        { kind: "discipline", value: "poetry",       label: "Poets",                          singular: "poet",                   prose: "poets and spoken-word artists" },
  "writing":       { kind: "discipline", value: "writing",      label: "Writers",                        singular: "writer",                 prose: "novelists, essayists, and writers" },
  "dance":         { kind: "discipline", value: "dance",        label: "Dancers & Choreographers",       singular: "dancer or choreographer", prose: "dancers, choreographers, and movement artists" },
  "film":          { kind: "discipline", value: "film",         label: "Filmmakers",                     singular: "filmmaker",              prose: "directors, cinematographers, and filmmakers" },
  "photography":   { kind: "discipline", value: "photography",  label: "Photographers",                  singular: "photographer",           prose: "photographers and lens-based artists" },
  "craft":         { kind: "discipline", value: "craft",        label: "Craft Artists",                  singular: "craft artist",           prose: "ceramicists, textile artists, and craft makers" },
  "performance":   { kind: "discipline", value: "performance",  label: "Performance Artists",            singular: "performance artist",     prose: "performance and interdisciplinary artists" },
};

// ── Static params ─────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(SLUG_MAP).map((slug) => ({ slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = SLUG_MAP[slug];
  if (!meta) return { title: "Artists — Patronage" };

  const h1 = meta.kind === "country"
    ? `${meta.label} Artists`
    : meta.label;

  const description = meta.kind === "country"
    ? `Browse portfolios and available works from ${meta.adjective} artists on Patronage — discover exhibition histories, studio updates, and original works.`
    : `Discover ${meta.prose} on Patronage — browse portfolios, available works, and exhibition history.`;

  return {
    title: `${h1} | Patronage`,
    description,
    alternates: { canonical: `/artists/${slug}` },
    openGraph: {
      title: `${h1} | Patronage`,
      description,
      url: `/artists/${slug}`,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArtistCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = SLUG_MAP[slug];
  if (!meta) notFound();

  const filter =
    meta.kind === "country"
      ? { country: meta.value }
      : { discipline: meta.value };

  const supabase = await createClient();

  const [artists, collectedResult, worksCountResult] = await Promise.all([
    getProfiles(filter),
    supabase
      .from("artworks")
      .select("creator_id")
      .neq("current_owner_id", "creator_id"),
    supabase
      .from("artworks")
      .select("profile_id"),
  ]);

  const collectedSet = new Set(
    (collectedResult.data ?? [])
      .filter((r: { creator_id: string }) => r.creator_id)
      .map((r: { creator_id: string }) => r.creator_id)
  );

  const worksCountMap = new Map<string, number>();
  for (const row of worksCountResult.data ?? []) {
    const r = row as { profile_id: string };
    worksCountMap.set(r.profile_id, (worksCountMap.get(r.profile_id) ?? 0) + 1);
  }

  const h1 = meta.kind === "country"
    ? `${meta.label} Artists`
    : meta.label;

  const prose = meta.kind === "country"
    ? `Discover ${meta.adjective} artists on Patronage — browse portfolios, available works, studio updates, and exhibition history from active ${meta.adjective} artists in our community.`
    : `Discover ${meta.prose} on Patronage — browse portfolios, available works, studio updates, and exhibition history from active ${meta.singular}s in our community.`;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">
      <div className="space-y-3">
        <nav className="text-xs text-muted-foreground">
          <Link href="/artists" className="hover:text-foreground transition-colors">Artists</Link>
          <span className="mx-1.5">›</span>
          <span>{h1}</span>
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight">{h1}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{prose}</p>
        <p className="text-xs text-muted-foreground">
          {artists.length} artist{artists.length !== 1 ? "s" : ""}
        </p>
      </div>

      {artists.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No artists in this category yet.</p>
          <Link href="/artists" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
            Browse all artists →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              view="gallery"
              badges={computeBadges(
                { ...artist, received_grants: (artist as { received_grants?: string[] }).received_grants ?? [] },
                worksCountMap.get(artist.id) ?? 0,
                collectedSet.has(artist.id)
              )}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <Link href="/artists" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← All artists
        </Link>
      </div>
    </div>
  );
}
