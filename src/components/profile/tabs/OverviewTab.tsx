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
                Portfolio
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
            <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
              Studio
            </h3>
            {studioUpdates.length > 3 && (
              <Link
                href={`/${username}?tab=studio`}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                View all updates →
              </Link>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {selectedUpdates.map((u) => (
              <Link
                key={u.id}
                href={u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}`}
                className="flex-none"
              >
                <div
                  className="overflow-hidden border border-border bg-muted"
                  style={{ height: 180 }}
                >
                  {u.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.image_url}
                      alt={u.caption ?? "Studio update"}
                      style={{ height: 180, width: "auto", display: "block" }}
                    />
                  ) : (
                    <div className="h-full w-[180px] flex items-center justify-center">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{u.content_type}</span>
                    </div>
                  )}
                </div>
                {u.caption && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-1">
                    {u.caption}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
