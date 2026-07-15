import Link from "next/link";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
import type { GridItem, GridSeriesItem } from "@/components/profile/PortfolioGrid";
import { StudioUpdatesRow } from "@/components/profile/StudioUpdatesRow";
import type { CampaignForProfile } from "@/components/profile/CampaignsSection";
import type { ExhibitionEntry, BibliographyEntry, PortfolioImage, ProjectUpdateWithArtist, ProfileAchievement } from "@/types/database";

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

interface SeriesListItem {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
  position?: number;
  year?: number;
}

interface Props {
  exhibitions: ExhibitionEntry[];
  bibliography: BibliographyEntry[];
  receivedGrants: string[];
  achievements: ProfileAchievement[];
  portfolioImages: PortfolioImage[];
  /** Featured works the artist has sold — surfaced in the "Selected Work" strip only. */
  featuredSoldWorks?: PortfolioImage[];
  seriesList?: SeriesListItem[];
  studioUpdates: ProjectUpdateWithArtist[];
  artistName: string;
  viewerRole: string | null;
  username: string;
  profileId?: string;
  isOwner?: boolean;
  galleryRowHeight?: number;
  galleryGutter?: number;
  campaigns?: CampaignForProfile[];
}

export function OverviewTab({
  exhibitions,
  bibliography,
  receivedGrants,
  achievements,
  portfolioImages,
  featuredSoldWorks = [],
  seriesList = [],
  studioUpdates,
  artistName,
  viewerRole,
  username,
  profileId,
  isOwner,
  galleryRowHeight,
  galleryGutter,
  campaigns = [],
}: Props) {
  const selectedExhibitions = [...exhibitions]
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const selectedBib = bibliography.slice(0, 3);
  // Merge verified achievements + manual grants; show up to 3 in overview
  const allGrantItems = [
    ...achievements.map((a) => ({ type: "achievement" as const, data: a })),
    ...receivedGrants.map((g) => ({ type: "manual" as const, data: g })),
  ].slice(0, 3);
  const totalGrantCount = achievements.length + receivedGrants.length;

  const hasHighlights =
    selectedExhibitions.length > 0 ||
    selectedBib.length > 0 ||
    allGrantItems.length > 0;

  return (
    <div className="space-y-12 py-8">
      {/* Active campaigns — side-by-side slim horizontal cards */}
      {campaigns.length > 0 && (
        <div className={`grid gap-3 ${campaigns.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {campaigns.map((campaign) => {
            const dateRange = formatDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
            const href = campaign.landing_page_slug
              ? `/live/${campaign.landing_page_slug}/${username}`
              : null;
            return (
              <div
                key={campaign.id}
                className="flex items-stretch border border-border bg-background overflow-hidden"
              >
                {/* Slim hero image */}
                <div className="flex-none" style={{ width: 80 }}>
                  {campaign.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={campaign.hero_image_url}
                      alt={campaign.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-100" style={{ minHeight: 72 }} />
                  )}
                </div>
                {/* Card body */}
                <div className="flex flex-col justify-center gap-0.5 py-3 px-4 flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug truncate">{campaign.title}</p>
                  {dateRange && (
                    <p className="text-xs text-muted-foreground">{dateRange}</p>
                  )}
                  {campaign.location_address && (
                    <p className="text-xs text-muted-foreground truncate">{campaign.location_address}</p>
                  )}
                  {href && (
                    <Link
                      href={href}
                      className="text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-1 self-start"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Highlights: exhibitions · press · grants */}
      {hasHighlights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {selectedExhibitions.length > 0 && (
            <div className="space-y-3">
              <h3 className="t-section-label">
                Selected Exhibitions
              </h3>
              <div className="space-y-1.5">
                {selectedExhibitions.map((ex, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-mono text-muted-foreground">{ex.year}</span>
                    {" — "}
                    <span className="font-semibold">{ex.title}</span>
                    {ex.venue && `, ${ex.venue}`}
                  </p>
                ))}
              </div>
              {exhibitions.length > 3 && (
                <Link
                  href="#cv"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View full CV →
                </Link>
              )}
            </div>
          )}

          {selectedBib.length > 0 && (
            <div className="space-y-3">
              <h3 className="t-section-label">
                Selected Press
              </h3>
              <div className="space-y-1.5">
                {selectedBib.map((item, i) => (
                  <p key={i} className="text-sm leading-snug">
                    {item.title && (
                      <span className="font-semibold">&ldquo;{item.title}&rdquo;</span>
                    )}
                    {item.publication && (
                      <span className="text-muted-foreground italic">, {item.publication}</span>
                    )}
                    {item.date && (
                      <span className="text-muted-foreground">, {item.date}</span>
                    )}
                  </p>
                ))}
              </div>
              {bibliography.length > 3 && (
                <Link
                  href="#cv"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View all press →
                </Link>
              )}
            </div>
          )}

          {allGrantItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="t-section-label">
                Grants &amp; Awards
              </h3>
              <div className="space-y-1.5">
                {allGrantItems.map((item, i) =>
                  item.type === "achievement" ? (
                    <div key={item.data.id} className="flex items-baseline gap-2 flex-wrap text-sm">
                      <span className="font-semibold">{item.data.opportunity_title}</span>
                      <span className="text-muted-foreground">{item.data.organisation}</span>
                      {item.data.verified && (
                        <span className="badge badge-grant">
                          Verified
                        </span>
                      )}
                    </div>
                  ) : (
                    <p key={i} className="text-sm">{item.data as string}</p>
                  )
                )}
              </div>
              {totalGrantCount > 3 && (
                <Link
                  href="#cv"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View all grants →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Portfolio preview — featured works + featured series first, fallback to first 9 */}
      {(portfolioImages.length > 0 || seriesList.length > 0) && (() => {
        const featuredSeriesItems: GridSeriesItem[] = seriesList
          .filter(s => s.is_featured)
          .map(s => ({ _kind: "series" as const, id: s.id, title: s.title, slug: s.slug, hero_image_url: s.hero_image_url, artworkCount: s.artworkCount, is_featured: true, position: s.position, year: s.year }));
        const featuredArtworks = [...portfolioImages.filter(i => i.is_featured), ...featuredSoldWorks];
        const hasFeatured = featuredSeriesItems.length > 0 || featuredArtworks.length > 0;
        const allSeriesItems: GridSeriesItem[] = seriesList.map(s => ({ _kind: "series" as const, id: s.id, title: s.title, slug: s.slug, hero_image_url: s.hero_image_url, artworkCount: s.artworkCount, is_featured: s.is_featured, position: s.position, year: s.year }));
        const byPosition = (a: GridItem, b: GridItem) =>
          ((a as { position?: number }).position ?? 9999) - ((b as { position?: number }).position ?? 9999);
        const displayImages: GridItem[] = hasFeatured
          ? ([...featuredSeriesItems, ...featuredArtworks] as GridItem[]).sort(byPosition)
          : ([...allSeriesItems, ...portfolioImages] as GridItem[]).sort(byPosition);
        const isFiltered = hasFeatured;
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="t-section-label">
                Selected Work
              </h3>
              <Link
                href="#work"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {isFiltered
                  ? `All works →`
                  : portfolioImages.length + seriesList.length > 9
                    ? `View all ${portfolioImages.length} works →`
                    : null}
              </Link>
            </div>
            <GalleryWithControls
              images={displayImages}
              username={username}
              viewerRole={viewerRole}
              profileId={profileId}
              limit={isFiltered ? undefined : 9}
              isOwner={isOwner}
              savedRowHeight={galleryRowHeight}
              savedGutter={galleryGutter}
            />
          </div>
        );
      })()}

      {/* Studio updates — fills the row width, expand for the rest */}
      {studioUpdates.length > 0 && (
        <StudioUpdatesRow updates={studioUpdates} username={username} />
      )}
    </div>
  );
}
