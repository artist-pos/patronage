import Link from "next/link";
import Image from "next/image";
import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import { StudioUpdateTile } from "@/components/profile/StudioUpdateTile";
import type { ExhibitionEntry, BibliographyEntry, PortfolioImage, ProjectUpdateWithArtist, ProfileAchievement } from "@/types/database";

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
            <PortfolioGrid
              images={displayImages}
              username={username}
              viewerRole={viewerRole}
              profileId={profileId}
              limit={isFiltered ? undefined : 9}
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
