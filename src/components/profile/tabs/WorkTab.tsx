import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import { AvailableWorksSection } from "@/components/profile/AvailableWorksSection";
import { SoldWorksSection } from "@/components/profile/SoldWorksSection";
import { ProjectsSection } from "@/components/profile/ProjectsSection";
import type { PortfolioImage, Artwork, Project, ProjectUpdateWithArtist } from "@/types/database";

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface Props {
  portfolioImages: PortfolioImage[];
  availableWorks: Artwork[];
  soldWorks: SoldWork[];
  projects: Project[];
  studioUpdates: ProjectUpdateWithArtist[];
  profileId: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
  hideSoldSection: boolean;
  displayName: string;
}

export function WorkTab({
  portfolioImages,
  availableWorks,
  soldWorks,
  projects,
  studioUpdates,
  profileId,
  artistName,
  viewerRole,
  isOwner,
  hideSoldSection,
  displayName,
}: Props) {
  return (
    <div className="space-y-12 py-8">
      {/* Available works — top */}
      {(isOwner || availableWorks.length > 0) && (
        <AvailableWorksSection
          initialWorks={availableWorks}
          profileId={profileId}
          artistName={artistName}
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
            Portfolio
          </h2>
          {portfolioImages.length > 0 ? (
            <PortfolioGrid
              images={portfolioImages}
              artistName={displayName}
              viewerRole={viewerRole}
              profileId={isOwner ? undefined : profileId}
              isOwner={isOwner}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio works yet.</p>
          )}
        </section>
      )}

      {/* In Collection / Sold works */}
      <SoldWorksSection
        initialWorks={soldWorks}
        isOwner={isOwner}
        hideSoldSection={hideSoldSection}
      />
    </div>
  );
}
