import Link from "next/link";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
import type { GridItem, GridSeriesItem } from "@/components/profile/PortfolioGrid";
import { AvailableWorksSection } from "@/components/profile/AvailableWorksSection";
import { SoldWorksSection } from "@/components/profile/SoldWorksSection";
import { CollectionSection } from "@/components/profile/CollectionSection";
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

export function WorkTab({
  portfolioImages,
  availableWorks,
  soldWorks,
  collectionWorks,
  profileId,
  username,
  artistName,
  artistAvatarUrl,
  viewerRole,
  isOwner,
  hideSoldSection,
  displayName,
  galleryRowHeight,
  galleryGutter,
  worksRowH,
  worksHGap,
  worksVGap,
  worksLastRowAlign,
  seriesList = [],
}: Props) {
  return (
    <div className="space-y-16 py-8">

      {/* ── Available — works for sale (buyers see what's purchasable first) ── */}
      {(isOwner || availableWorks.length > 0) && (
        <AvailableWorksSection
          initialWorks={availableWorks}
          profileId={profileId}
          artistName={artistName}
          artistUsername={username}
          artistAvatarUrl={artistAvatarUrl}
          viewerRole={viewerRole}
          isOwner={isOwner}
          initialRowH={galleryRowHeight ?? worksRowH}
          initialHGap={worksHGap}
          initialVGap={worksVGap}
          initialLastRowAlign={worksLastRowAlign}
          noBorder
        />
      )}

      {/* ── Work — series + standalone works in one justified grid ── */}
      {(isOwner || portfolioImages.length > 0 || seriesList.length > 0) && (() => {
        const seriesItems: GridSeriesItem[] = seriesList.map(s => ({
          _kind: "series" as const,
          id: s.id,
          title: s.title,
          slug: s.slug,
          hero_image_url: s.hero_image_url,
          artworkCount: s.artworkCount,
          is_featured: s.is_featured,
          position: s.position,
          year: s.year,
        }));
        const allItems: GridItem[] = [...seriesItems, ...portfolioImages]
          .sort((a, b) => {
            const posA = (a as { position?: number | null }).position ?? 9999;
            const posB = (b as { position?: number | null }).position ?? 9999;
            return posA - posB;
          });

        return (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
              Work
            </h2>
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
          {allItems.length > 0 ? (
            <GalleryWithControls
              images={allItems}
              username={username}
              viewerRole={viewerRole}
              profileId={isOwner ? undefined : profileId}
              isOwner={isOwner}
              savedRowHeight={galleryRowHeight}
              savedGutter={galleryGutter}
              noControls
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No work added yet. Your portfolio is how people discover your practice — even one or two pieces makes a difference.
            </p>
          )}
        </section>
        );
      })()}

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
