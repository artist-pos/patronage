import Link from "next/link";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
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

      {/* ── Work — full body of work (series + standalone) ── */}
      {(isOwner || portfolioImages.length > 0 || seriesList.length > 0) && (() => {
        const sortedImages = [...portfolioImages].sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return (a.position ?? 0) - (b.position ?? 0);
        });
        return (
        <section className="space-y-6">
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

          {/* Series cards */}
          {seriesList.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {seriesList.map(s => (
                <Link
                  key={s.id}
                  href={`/${username}/series/${s.slug}`}
                  className="shrink-0 group"
                >
                  <div className="w-[160px] space-y-1.5">
                    <div className="w-[160px] h-[120px] overflow-hidden bg-stone-100">
                      {s.hero_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.hero_image_url}
                          alt={s.title}
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-200" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.artworkCount} {s.artworkCount === 1 ? "work" : "works"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Standalone works gallery */}
          {sortedImages.length > 0 ? (
            <GalleryWithControls
              images={sortedImages}
              username={username}
              viewerRole={viewerRole}
              profileId={isOwner ? undefined : profileId}
              isOwner={isOwner}
              savedRowHeight={galleryRowHeight}
              savedGutter={galleryGutter}
              noControls
            />
          ) : seriesList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No work added yet. Your portfolio is how people discover your practice — even one or two pieces makes a difference.
            </p>
          ) : null}
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
