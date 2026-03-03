"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvailableWorkCard } from "./AvailableWorkCard";
import { AddAvailableWorkModal } from "./AddAvailableWorkModal";
import type { PortfolioImage } from "@/types/database";

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
    // Background server sync so subsequent page loads reflect the new row
    router.refresh();
  }

  // Non-owners only see this section if there are works to display
  if (!isOwner && works.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Available Works
        </h2>
        {isOwner && (
          <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
        )}
      </div>

      {works.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No works listed yet. Click &ldquo;+ Add Available Work&rdquo; to publish your first listing.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none items-start">
          {works.map((img) => (
            <AvailableWorkCard
              key={img.id}
              img={img}
              artistId={profileId}
              artistName={artistName}
              viewerRole={viewerRole}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}
