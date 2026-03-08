import { StudioCarousel } from "@/components/profile/StudioCarousel";
import type { Project, ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  updates: ProjectUpdateWithArtist[];
  artistUsername: string;
  isOwner: boolean;
  projects: Project[];
  profileId: string;
}

export function StudioTab({ updates, artistUsername, isOwner, projects, profileId }: Props) {
  if (!isOwner && updates.length === 0) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">No studio updates yet.</p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <StudioCarousel
        updates={updates}
        artistUsername={artistUsername}
        isOwner={isOwner}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        profileId={profileId}
      />
    </div>
  );
}
