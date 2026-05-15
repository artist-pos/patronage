"use client";

import { useState } from "react";
import type { ProjectUpdateWithArtist, Project } from "@/types/database";
import { StudioCarousel } from "@/components/profile/StudioCarousel";
import { ProjectsSection } from "@/components/profile/ProjectsSection";
import { ManageNotesList } from "@/components/profile/ManageNotesList";

type FeedTab = "updates" | "projects" | "notes";

interface Props {
  initialTab: FeedTab;
  artistUsername: string;
  profileId: string;
  studioUpdates: ProjectUpdateWithArtist[];
  studioProjects: Project[];
  feedArtworks: { id: string; label: string }[];
  feedNotes: Parameters<typeof ManageNotesList>[0]["initialNotes"];
}

export function FeedTabsClient({
  initialTab, artistUsername, profileId,
  studioUpdates, studioProjects, feedArtworks, feedNotes,
}: Props) {
  const [tab, setTab] = useState<FeedTab>(initialTab);

  function switchTab(t: FeedTab) {
    setTab(t);
    window.history.replaceState(null, "", `/studio?section=feed&ft=${t}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-0 border-b border-border">
        {(["updates", "projects", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-sm transition-colors whitespace-nowrap capitalize ${
              tab === t
                ? "font-medium border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "updates" ? "Updates" : t === "projects" ? "Projects" : "Notes"}
          </button>
        ))}
      </div>

      {tab === "updates" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Post works in progress, process shots, and studio moments. Updates appear in the public feed and on your profile.
          </p>
          <StudioCarousel
            updates={studioUpdates}
            artistUsername={artistUsername}
            isOwner={true}
            projects={studioProjects.map((p) => ({ id: p.id, title: p.title }))}
            artworks={feedArtworks}
            profileId={profileId}
          />
        </div>
      )}

      {tab === "projects" && (
        <ProjectsSection
          projects={studioProjects}
          updates={studioUpdates}
          isOwner={true}
        />
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Notes you&apos;ve left on studio updates across Patronage.</p>
          <ManageNotesList initialNotes={feedNotes} />
        </div>
      )}
    </div>
  );
}
