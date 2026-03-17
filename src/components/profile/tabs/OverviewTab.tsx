import Link from "next/link";
import Image from "next/image";
import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import type { ExhibitionEntry, BibliographyEntry, PortfolioImage, ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  exhibitions: ExhibitionEntry[];
  bibliography: BibliographyEntry[];
  receivedGrants: string[];
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
  const selectedGrants = receivedGrants.slice(0, 3);
  const selectedUpdates = studioUpdates.slice(0, 3);

  const hasHighlights =
    selectedExhibitions.length > 0 ||
    selectedBib.length > 0 ||
    selectedGrants.length > 0;

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

          {selectedGrants.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
                Selected Grants
              </h3>
              <div className="space-y-1.5">
                {selectedGrants.map((grant, i) => (
                  <p key={i} className="text-sm">{grant}</p>
                ))}
              </div>
              {receivedGrants.length > 3 && (
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
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {selectedUpdates.map((u) => (
              <Link
                key={u.id}
                href={u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}`}
                className="flex-none block w-[200px] border border-border bg-background"
              >
                <div className="overflow-hidden bg-muted aspect-[4/3]">
                  {u.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.image_url}
                      alt={u.caption ?? "Studio update"}
                      className="w-full h-full object-cover"
                      style={{ display: "block" }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{u.content_type}</span>
                    </div>
                  )}
                </div>
                {u.caption && (
                  <div className="px-2 py-1.5 border-t border-border min-w-0">
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{u.caption}</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
