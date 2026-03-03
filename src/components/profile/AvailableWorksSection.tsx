"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvailableWorkCard } from "./AvailableWorkCard";
import { AddAvailableWorkModal } from "./AddAvailableWorkModal";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;

interface Props {
  initialWorks: PortfolioImage[];
  profileId: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
}

export function AvailableWorksSection({
  initialWorks,
  profileId,
  artistName,
  viewerRole,
  isOwner,
}: Props) {
  const [works, setWorks] = useState<PortfolioImage[]>(initialWorks);
  const router = useRouter();

  function handleWorkAdded(newWork: PortfolioImage) {
    setWorks((prev) => [...prev, newWork]);
    router.refresh();
  }

  function handleWorkRemoved(id: string) {
    setWorks((prev) => prev.filter((w) => w.id !== id));
  }

  // Non-owners only see this section if there are works to display
  if (!isOwner && works.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Available Works
      </h2>

      {works.length === 0 && isOwner ? (
        // Empty state: just show the add button inline
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            No works listed yet.
          </p>
          <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
        </div>
      ) : (
        // Carousel track
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ height: CARD_H }}
        >
          {works.map((img) => (
            <AvailableWorkCard
              key={img.id}
              img={img}
              artistId={profileId}
              artistName={artistName}
              viewerRole={viewerRole}
              isOwner={isOwner}
              onRemove={handleWorkRemoved}
            />
          ))}

          {/* Add button as a card at the end of the track (owner only) */}
          {isOwner && (
            <div
              className="flex-none flex items-center justify-center border border-dashed border-border snap-start"
              style={{ height: CARD_H, width: CARD_H }}
            >
              <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
