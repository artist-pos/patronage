import Link from "next/link";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
import type { GridItem, GridSeriesItem } from "@/components/profile/PortfolioGrid";
import { SoldWorksSection } from "@/components/profile/SoldWorksSection";
import { CollectionSection } from "@/components/profile/CollectionSection";
import { gridImageSrc } from "@/lib/image";
import type { PortfolioImage, Artwork } from "@/types/database";

interface SeriesCard {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
  position?: number;
  year?: number;
}

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface CollectionWork extends Artwork {
  creator_profile: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  portfolioImages: PortfolioImage[];
  availableWorks: Artwork[];
  soldWorks: SoldWork[];
  collectionWorks: CollectionWork[];
  profileId: string;
  username: string;
  artistName: string;
  artistAvatarUrl?: string | null;
  viewerRole: string | null;
  isOwner: boolean;
  hideSoldSection: boolean;
  displayName: string;
  galleryRowHeight?: number;
  galleryGutter?: number;
  worksRowH?: number;
  worksHGap?: number;
  worksVGap?: number;
  worksLastRowAlign?: "left" | "center" | "right";
  seriesList?: SeriesCard[];
}

function toSeriesItem(s: SeriesCard): GridSeriesItem {
  return {
    _kind: "series" as const,
    id: s.id,
    title: s.title,
    slug: s.slug,
    hero_image_url: s.hero_image_url,
    artworkCount: s.artworkCount,
    is_featured: s.is_featured,
    position: s.position,
    year: s.year,
  };
}

const byPosition = (a: GridItem, b: GridItem) =>
  ((a as { position?: number | null }).position ?? 9999) -
  ((b as { position?: number | null }).position ?? 9999);

/**
 * Profile work sections, per the v2 Artist Profile canvas. The profile is
 * portfolio, storefront and record at once — the split is by CURATION:
 *
 *   Selected work — the curated portfolio voice: featured works + featured
 *   series at hero scale on the feed surface. Availability appears as a chip.
 *
 *   Archive — the complete record: every work, grouped by year, uniform
 *   small tiles. Featured/available works appear here too; the archive is
 *   never partial.
 */
export function WorkTab({
  portfolioImages,
  availableWorks,
  soldWorks,
  collectionWorks,
  profileId,
  username,
  viewerRole,
  isOwner,
  hideSoldSection,
  galleryRowHeight,
  galleryGutter,
  seriesList = [],
}: Props) {
  // ── Selected work: featured works + featured series; when nothing is
  // curated yet, fall back to available works (the storefront default).
  const publicSeries = isOwner ? seriesList : seriesList.filter((s) => s.artworkCount > 0);
  const featuredWorks = portfolioImages.filter((w) => w.is_featured);
  const featuredSeries = publicSeries.filter((s) => s.is_featured);
  const hasCuration = featuredWorks.length > 0 || featuredSeries.length > 0;

  const selectedItems: GridItem[] = hasCuration
    ? ([...featuredSeries.map(toSeriesItem), ...featuredWorks] as GridItem[]).sort(byPosition)
    : (availableWorks.slice(0, 6) as unknown as GridItem[]);

  // Hero — the first selected work gets the full-width treatment, but only
  // when it's landscape: a full-width square or portrait work swallows a
  // whole screen before anything else is visible.
  const heroCandidate = selectedItems[0];
  const heroAR =
    heroCandidate && !("_kind" in heroCandidate)
      ? ((heroCandidate as PortfolioImage).natural_width ?? 0) /
        ((heroCandidate as PortfolioImage).natural_height ?? 1)
      : 0;
  const hero =
    heroCandidate &&
    !("_kind" in heroCandidate) &&
    (heroCandidate as PortfolioImage).url &&
    selectedItems.length > 1 &&
    heroAR >= 1.4
      ? (heroCandidate as PortfolioImage)
      : null;
  const selectedRest = hero ? selectedItems.slice(1) : selectedItems;

  // ── Available — the storefront. Featured works already carry their
  // AVAILABLE chip in Selected, and when nothing is curated Selected itself
  // falls back to available works — so this section shows only the for-sale
  // works not already on screen. Without it, a non-featured sale listing
  // (e.g. an edition hidden from the archive) was counted in "N works
  // available" but rendered nowhere.
  const selectedIds = new Set(selectedItems.map((i) => (i as { id: string }).id));
  const forSaleItems: GridItem[] = hasCuration
    ? (availableWorks.filter((w) => !selectedIds.has(w.id)) as unknown as GridItem[])
    : [];

  // ── Archive: everything, grouped by year (newest first, undated last)
  const archiveItems: GridItem[] = [
    ...publicSeries.map(toSeriesItem),
    ...portfolioImages,
  ];
  const groups = new Map<number | null, GridItem[]>();
  for (const item of archiveItems) {
    const year = (item as { year?: number | null }).year ?? null;
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(item);
  }
  const sortedYears = [...groups.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  });
  const archiveCount = archiveItems.length;

  return (
    <div className="space-y-16 py-8">

      {/* ── Selected work — curated portfolio ── */}
      {(selectedItems.length > 0 || isOwner) && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="t-section-label">Selected work</h2>
            {isOwner && (
              <div className="flex items-center gap-4">
                <Link
                  href="/studio/works/new"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Add work
                </Link>
                <Link
                  href="/studio?section=works"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Manage in Studio →
                </Link>
              </div>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing selected yet. Mark works as featured in your studio to
              curate this section — it&rsquo;s the first thing visitors see.
            </p>
          ) : (
            <div className="space-y-6">
              {hero && (
                <div>
                  <Link
                    href={`/${username}/works/${hero.slug ?? hero.id}`}
                    className="pin relative block overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      data-pin-img
                      src={gridImageSrc(hero.url!, hero.thumb_url ?? null)}
                      alt={hero.title ?? "Featured work"}
                      className="block h-auto w-full"
                    />
                    {hero.is_available && (
                      <span className="absolute left-2.5 top-2.5 bg-black px-[7px] py-[3px] font-mono text-[9px] font-semibold tracking-[0.04em] text-white">
                        AVAILABLE
                      </span>
                    )}
                  </Link>
                  {(hero.title || hero.year) && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {[hero.title, hero.year].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              )}
              {selectedRest.length > 0 && (
                <GalleryWithControls
                  images={selectedRest}
                  username={username}
                  viewerRole={viewerRole}
                  profileId={isOwner ? undefined : profileId}
                  isOwner={isOwner}
                  savedRowHeight={galleryRowHeight ?? 300}
                  savedGutter={galleryGutter}
                  noControls
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Available — for-sale works not already surfaced above ── */}
      {forSaleItems.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="t-section-label">Available</h2>
            {isOwner && (
              <Link
                href="/studio?section=works"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Manage in Studio →
              </Link>
            )}
          </div>
          <GalleryWithControls
            images={forSaleItems}
            username={username}
            viewerRole={viewerRole}
            profileId={isOwner ? undefined : profileId}
            isOwner={isOwner}
            savedRowHeight={galleryRowHeight ?? 300}
            savedGutter={galleryGutter}
            noControls
          />
        </section>
      )}

      {/* ── Archive — the complete record, an optional disclosure. Starts
             open when there's no Selected section (otherwise the profile
             would show no work at all until a click). ── */}
      {archiveCount > 0 && (
        <details className="group" open={selectedItems.length === 0}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-3 border border-border bg-card px-4 py-2.5 transition-colors hover:border-foreground [&::-webkit-details-marker]:hidden">
            <h2 className="t-section-label">Archive</h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              sorted by year
            </span>
            <svg
              aria-hidden
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"
              className="text-muted-foreground transition-transform group-open:rotate-180"
            >
              <path d="M1.5 3.5 L5 7 L8.5 3.5" />
            </svg>
          </summary>
          <div className="space-y-8 pt-6">
            {sortedYears.map((year) => {
              const items = groups.get(year)!.sort(byPosition);
              return (
                <div key={year ?? "undated"} className="space-y-3">
                  <div className="border-b border-border pb-1.5 font-mono text-[11px] text-muted-foreground">
                    {year ?? "Undated"} · {items.length} work{items.length !== 1 ? "s" : ""}
                  </div>
                  <GalleryWithControls
                    images={items}
                    username={username}
                    viewerRole={viewerRole}
                    profileId={isOwner ? undefined : profileId}
                    isOwner={isOwner}
                    savedRowHeight={320}
                    savedGutter={galleryGutter ?? 6}
                    noControls
                  />
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* ── Sold / In collection (market proof at the bottom) ── */}
      <SoldWorksSection
        initialWorks={soldWorks}
        isOwner={isOwner}
        hideSoldSection={hideSoldSection}
      />

      {/* ── Collection — works owned but not created by this artist ── */}
      {(isOwner || collectionWorks.some(w => w.collection_visible)) && (
        <CollectionSection
          initialWorks={collectionWorks}
          isOwner={isOwner}
          collectionPublic={true}
        />
      )}

    </div>
  );
}
