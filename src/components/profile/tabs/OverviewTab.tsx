import Link from "next/link";
import Image from "next/image";
import { GalleryWithControls } from "@/components/profile/GalleryWithControls";
import { StudioUpdateTile } from "@/components/profile/StudioUpdateTile";
import type { ExhibitionEntry, BibliographyEntry, PortfolioImage, ProjectUpdateWithArtist, ProfileAchievement } from "@/types/database";

interface BlogPost {
  slug: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
}

interface Props {
  exhibitions: ExhibitionEntry[];
  bibliography: BibliographyEntry[];
  receivedGrants: string[];
  achievements: ProfileAchievement[];
  portfolioImages: PortfolioImage[];
  studioUpdates: ProjectUpdateWithArtist[];
  artistName: string;
  viewerRole: string | null;
  username: string;
  profileId?: string;
  isOwner?: boolean;
  galleryRowHeight?: number;
  galleryGutter?: number;
  featuredBlogPost?: BlogPost | null;
}

export function OverviewTab({
  exhibitions,
  bibliography,
  receivedGrants,
  achievements,
  portfolioImages,
  studioUpdates,
  artistName,
  viewerRole,
  username,
  profileId,
  isOwner,
  galleryRowHeight,
  galleryGutter,
  featuredBlogPost,
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
  const selectedUpdates = studioUpdates.slice(0, 3);

  const hasHighlights =
    selectedExhibitions.length > 0 ||
    selectedBib.length > 0 ||
    allGrantItems.length > 0;

  return (
    <div className="space-y-12 py-8">
      {/* Patronage feature backlink */}
      {featuredBlogPost && (
        <Link
          href={`/blog/${featuredBlogPost.slug}`}
          className="group flex items-center gap-4 border border-black px-5 py-4 hover:shadow-sm transition-shadow max-w-xl"
        >
          {featuredBlogPost.image_url && (
            <div className="relative w-14 h-14 shrink-0 overflow-hidden bg-stone-100">
              <Image
                src={featuredBlogPost.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              Featured on Patronage
            </p>
            <p className="text-sm font-semibold leading-snug group-hover:underline underline-offset-2 line-clamp-2">
              {featuredBlogPost.title}
            </p>
          </div>
          <span className="text-stone-400 shrink-0 text-sm group-hover:text-foreground transition-colors">→</span>
        </Link>
      )}

      {/* Highlights: exhibitions · press · grants */}
      {hasHighlights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {selectedExhibitions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
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
                  href={`/${username}?tab=cv`}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View full CV →
                </Link>
              )}
            </div>
          )}

          {selectedBib.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
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
                  href={`/${username}?tab=cv`}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View all press →
                </Link>
              )}
            </div>
          )}

          {allGrantItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
                Grants &amp; Awards
              </h3>
              <div className="space-y-1.5">
                {allGrantItems.map((item, i) =>
                  item.type === "achievement" ? (
                    <div key={item.data.id} className="flex items-baseline gap-2 flex-wrap text-sm">
                      <span className="font-semibold">{item.data.opportunity_title}</span>
                      <span className="text-muted-foreground">{item.data.organisation}</span>
                      {item.data.verified && (
                        <span className="text-[10px] uppercase tracking-widest text-emerald-600 border border-emerald-600/40 px-1.5 py-0.5 leading-none">
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
                  href={`/${username}?tab=cv`}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View all grants →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Portfolio preview — featured works first, fallback to first 9 */}
      {portfolioImages.length > 0 && (() => {
        const featured = portfolioImages.filter(i => i.is_featured);
        const displayImages = featured.length > 0 ? featured : portfolioImages;
        const isFiltered = featured.length > 0;
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
                Selected Work
              </h3>
              <Link
                href={`/${username}?tab=work`}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {isFiltered
                  ? `All ${portfolioImages.length} works →`
                  : portfolioImages.length > 9
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

      {/* Studio updates preview — up to 3 */}
      {selectedUpdates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
                Studio Updates
              </h3>
              <p className="text-sm text-gray-400 mt-0.5">Recent updates</p>
            </div>
            <Link
              href={`/${username}?tab=studio`}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-start">
            {selectedUpdates.map((u) => (
              <StudioUpdateTile key={u.id} u={u} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
