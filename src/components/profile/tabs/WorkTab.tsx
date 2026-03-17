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
  username: string;
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
  username,
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

      {/* In Collection / Sold works */}
      <SoldWorksSection
        initialWorks={soldWorks}
        isOwner={isOwner}
        hideSoldSection={hideSoldSection}
      />
    </div>
  );
}
