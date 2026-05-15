import Link from "next/link";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
import { AvailableWorksSection } from "@/components/profile/AvailableWorksSection";
import { SoldWorksSection } from "@/components/profile/SoldWorksSection";
import type { PortfolioImage, Artwork } from "@/types/database";

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface Props {
  portfolioImages: PortfolioImage[];
  availableWorks: Artwork[];
  soldWorks: SoldWork[];
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
}

export function WorkTab({
  portfolioImages,
  availableWorks,
  soldWorks,
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
          initialRowH={worksRowH}
          initialHGap={worksHGap}
          initialVGap={worksVGap}
          initialLastRowAlign={worksLastRowAlign}
          noBorder
        />
      )}

      {/* ── Work — full body of work ── */}
      {(isOwner || portfolioImages.length > 0) && (
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
          {portfolioImages.length > 0 ? (
            <GalleryWithControls
              images={portfolioImages}
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
      )}

      {/* ── Sold / In collection (market proof at the bottom) ── */}
      <SoldWorksSection
        initialWorks={soldWorks}
        isOwner={isOwner}
        hideSoldSection={hideSoldSection}
      />

    </div>
  );
}
