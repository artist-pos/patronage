import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import { AvailableWorksSection } from "@/components/profile/AvailableWorksSection";
import { SoldWorksSection } from "@/components/profile/SoldWorksSection";
import { ProjectsSection } from "@/components/profile/ProjectsSection";
import { CreativeWorksPanel } from "@/components/profile/CreativeWorksPanel";
import { StudioCarousel } from "@/components/profile/StudioCarousel";
import type { PortfolioImage, Artwork, Project, ProjectUpdateWithArtist, CreativeWork } from "@/types/database";

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

type CollaboratedWork = {
  id: string;
  url: string | null;
  caption: string | null;
  creator_profile: { username: string; full_name: string | null } | null;
};

interface Props {
  portfolioImages: PortfolioImage[];
  availableWorks: Artwork[];
  soldWorks: SoldWork[];
  projects: Project[];
  studioUpdates: ProjectUpdateWithArtist[];
  creativeWorks: CreativeWork[];
  profileId: string;
  username: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
  hideSoldSection: boolean;
  displayName: string;
  collaboratedWorks?: CollaboratedWork[];
}

export function WorkTab({
  portfolioImages,
  availableWorks,
  soldWorks,
  projects,
  studioUpdates,
  creativeWorks,
  profileId,
  username,
  artistName,
  viewerRole,
  isOwner,
  hideSoldSection,
  displayName,
  collaboratedWorks = [],
}: Props) {
  const hasUpdates      = studioUpdates.length > 0;
  const hasCreativeWork = creativeWorks.length > 0;

  return (
    <div className="space-y-12 py-8">
      {/* Available works — top */}
      {(isOwner || availableWorks.length > 0) && (
        <AvailableWorksSection
          initialWorks={availableWorks}
          profileId={profileId}
          artistName={artistName}
          artistUsername={username}
          viewerRole={viewerRole}
          isOwner={isOwner}
        />
      )}

      {/* Projects */}
      <ProjectsSection
        projects={projects}
        updates={studioUpdates}
        isOwner={isOwner}
      />

      {/* Full portfolio */}
      {(portfolioImages.length > 0 || isOwner) && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Selected Work
          </h2>
          {portfolioImages.length > 0 ? (
            <PortfolioGrid
              images={portfolioImages}
              username={username}
              viewerRole={viewerRole}
              profileId={isOwner ? undefined : profileId}
              isOwner={isOwner}
            />
          ) : (
            isOwner ? (
              <p className="text-sm text-muted-foreground">No work added yet. Your portfolio is how people discover your practice — even one or two pieces makes a difference.</p>
            ) : (
              <p className="text-sm text-muted-foreground">{displayName} hasn&apos;t added work yet.</p>
            )
          )}
        </section>
      )}

      {/* Studio: creative works + updates (merged from old Studio tab) */}
      {(isOwner || hasUpdates || hasCreativeWork) && (
        <section className="space-y-6 border-t border-border pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Studio
          </h2>

          <CreativeWorksPanel
            initialWorks={creativeWorks}
            isOwner={isOwner}
            profileId={profileId}
          />

          {(isOwner || hasUpdates) && (
            <div className={hasCreativeWork ? "border-t border-border pt-8" : ""}>
              {hasCreativeWork && (
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                  Studio Updates
                </p>
              )}
              <StudioCarousel
                updates={studioUpdates}
                artistUsername={username}
                isOwner={isOwner}
                projects={projects.map((p) => ({ id: p.id, title: p.title }))}
                profileId={profileId}
              />
            </div>
          )}
        </section>
      )}

      {/* In Collection / Sold works */}
      <SoldWorksSection
        initialWorks={soldWorks}
        isOwner={isOwner}
        hideSoldSection={hideSoldSection}
      />

      {/* Collaborations — works by other artists that tag this artist */}
      {collaboratedWorks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Collaborations
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {collaboratedWorks.map(work => (
              <a
                key={work.id}
                href={work.creator_profile ? `/${work.creator_profile.username}?tab=work` : "#"}
                className="group block space-y-1.5"
              >
                <div className="aspect-square bg-stone-100 overflow-hidden">
                  {work.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={work.url}
                      alt={work.caption ?? ""}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                {work.creator_profile && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {work.creator_profile.full_name ?? `@${work.creator_profile.username}`}
                  </p>
                )}
                {work.caption && (
                  <p className="text-[11px] truncate">{work.caption}</p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
