import { StudioCarousel } from "@/components/profile/StudioCarousel";
import { CreativeWorksPanel } from "@/components/profile/CreativeWorksPanel";
import type { Project, ProjectUpdateWithArtist, CreativeWork } from "@/types/database";

interface Props {
  updates: ProjectUpdateWithArtist[];
  artistUsername: string;
  isOwner: boolean;
  projects: Project[];
  profileId: string;
  creativeWorks: CreativeWork[];
}

export function StudioTab({ updates, artistUsername, isOwner, projects, profileId, creativeWorks }: Props) {
  const hasUpdates      = updates.length > 0;
  const hasCreativeWork = creativeWorks.length > 0;

  if (!isOwner && !hasUpdates && !hasCreativeWork) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">Nothing here yet. Studio updates are for works in progress, process shots, thoughts — whatever you&apos;re working on right now.</p>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-12">
      {/* Multi-discipline creative works (images, audio, video, writing) */}
      <CreativeWorksPanel
        initialWorks={creativeWorks}
        isOwner={isOwner}
        profileId={profileId}
      />

      {/* Studio updates (image posts) */}
      {(isOwner || hasUpdates) && (
        <section className={hasCreativeWork ? "border-t border-border pt-12" : ""}>
          {hasCreativeWork && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              Studio Updates
            </p>
          )}
          <StudioCarousel
            updates={updates}
            artistUsername={artistUsername}
            isOwner={isOwner}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
            profileId={profileId}
          />
        </section>
      )}
    </div>
  );
}
