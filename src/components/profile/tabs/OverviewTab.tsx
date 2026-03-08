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
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
                  href={`/${username}?tab=press`}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View all press →
                </Link>
              )}
            </div>
          )}

          {selectedGrants.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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

      {/* Portfolio preview — up to 9 images */}
      {portfolioImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Portfolio
            </h3>
            {portfolioImages.length > 9 && (
              <Link
                href={`/${username}?tab=work`}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                View all {portfolioImages.length} works →
              </Link>
            )}
          </div>
          <PortfolioGrid
            images={portfolioImages}
            artistName={artistName}
            viewerRole={viewerRole}
            profileId={profileId}
            limit={9}
          />
        </div>
      )}

      {/* Studio updates preview — up to 3 */}
      {selectedUpdates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
                  className="relative overflow-hidden border border-border bg-muted"
                  style={{ width: 180, height: 180 }}
                >
                  <Image
                    src={u.image_url}
                    alt={u.caption ?? "Studio update"}
                    fill
                    unoptimized
                    className="object-cover hover:opacity-90 transition-opacity"
                  />
                </div>
                {u.caption && (
                  <p
                    className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-1"
                    style={{ maxWidth: 180 }}
                  >
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
