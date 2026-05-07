"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import type { ArtworkForGrid } from "@/components/feed/WorksJustifiedGrid";
import { AddAvailableWorkModal } from "./AddAvailableWorkModal";
import { unlistWork, toggleHideAvailable } from "@/app/profile/available-work-actions";
import type { Artwork } from "@/types/database";

interface Props {
  initialWorks: Artwork[];
  profileId: string;
  artistName: string;
  artistUsername: string;
  artistAvatarUrl?: string | null;
  viewerRole: string | null;
  isOwner: boolean;
}

function AvailableWorksSectionInner({
  initialWorks,
  profileId,
  artistName,
  artistUsername,
  artistAvatarUrl,
  viewerRole: _viewerRole,
  isOwner,
}: Props) {
  const [works, setWorks] = useState<Artwork[]>(initialWorks);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(initialWorks.filter((w) => w.hide_available).map((w) => w.id))
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);

  const initialOpenArtworkId = searchParams.get("artwork") ?? undefined;

  // Auto-scroll to this section when arriving via a direct artwork URL
  useEffect(() => {
    if (!initialOpenArtworkId || !sectionRef.current) return;
    const timer = setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timer);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWorkAdded(newWork: Artwork) {
    setWorks((prev) => [...prev, newWork]);
    router.refresh();
  }

  // Convert Artwork[] → ArtworkForGrid[]
  const artworksForGrid: ArtworkForGrid[] = (
    isOwner ? works : works.filter((w) => !w.hide_available)
  ).map((w) => ({
    id: w.id,
    url: w.url ?? "",
    title: w.title,
    caption: w.caption,
    price_cents: w.price_cents,
    is_poa: w.is_poa ?? false,
    price_currency: (w.price_currency as "NZD" | "AUD") ?? "NZD",
    medium: w.medium ?? null,
    hide_price: w.hide_price ?? false,
    hide_available: w.hide_available ?? false,
    listing_mode: (w.listing_mode as "direct_sale" | "enquire_first") ?? "enquire_first",
    profile: {
      id: profileId,
      username: artistUsername,
      full_name: artistName || null,
      avatar_url: artistAvatarUrl ?? null,
    },
  }));

  // Owner action callbacks
  const ownerActions = isOwner
    ? {
        onUnlist: async (id: string) => {
          setWorks((prev) => prev.filter((w) => w.id !== id));
          await unlistWork(id);
        },
        onToggleHide: async (id: string, hidden: boolean) => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            if (hidden) {
              next.add(id);
            } else {
              next.delete(id);
            }
            return next;
          });
          await toggleHideAvailable(id, hidden);
        },
        onMarkCollected: (id: string) => {
          setWorks((prev) => prev.filter((w) => w.id !== id));
          router.refresh();
        },
        hiddenIds,
      }
    : undefined;

  if (!isOwner && works.filter((w) => !w.hide_available).length === 0) return null;

  return (
    <section ref={sectionRef} className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Available Works
        </h2>
        {isOwner && works.length > 0 && (
          <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
        )}
      </div>

      {works.length === 0 && isOwner ? (
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">No works listed yet.</p>
          <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
        </div>
      ) : (
        <WorksJustifiedGrid
          artworks={artworksForGrid}
          layout="justified"
          initialOpenArtworkId={initialOpenArtworkId}
          ownerActions={ownerActions}
        />
      )}
    </section>
  );
}

// Wrap in Suspense because WorksJustifiedGrid uses useSearchParams
export function AvailableWorksSection(props: Props) {
  return (
    <Suspense>
      <AvailableWorksSectionInner {...props} />
    </Suspense>
  );
}
