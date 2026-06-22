"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import type { ArtworkForGrid, EditionOption } from "@/components/feed/WorksJustifiedGrid";
import { AddAvailableWorkModal } from "./AddAvailableWorkModal";
import type { Artwork } from "@/types/database";

interface Props {
  initialWorks: Artwork[];
  profileId: string;
  artistName: string;
  artistUsername: string;
  artistAvatarUrl?: string | null;
  viewerRole: string | null;
  isOwner: boolean;
  initialRowH?: number;
  initialHGap?: number;
  initialVGap?: number;
  initialLastRowAlign?: "left" | "center" | "right";
  noBorder?: boolean;
}

function AvailableWorksSectionInner({
  initialWorks,
  profileId,
  artistName,
  artistUsername,
  artistAvatarUrl,
  viewerRole: _viewerRole,
  isOwner,
  initialRowH,
  initialHGap,
  initialVGap,
  initialLastRowAlign,
  noBorder,
}: Props) {
  const [works, setWorks] = useState<Artwork[]>(initialWorks);
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
    description: w.description ?? w.caption,
    year: w.year ?? null,
    dimensions: w.dimensions ?? null,
    width_mm: w.width_mm ?? null,
    height_mm: w.height_mm ?? null,
    ledger_id: w.ledger_id ?? null,
    price_cents: w.price_cents,
    is_poa: w.is_poa ?? false,
    price_currency: (w.price_currency as "NZD" | "AUD") ?? "NZD",
    medium: w.medium ?? null,
    hide_price: w.hide_price ?? false,
    hide_available: w.hide_available ?? false,
    listing_mode: (w.listing_mode as "direct_sale" | "enquire_first") ?? "enquire_first",
    acquisition_mode: (w.acquisition_mode as "buy_now" | "make_offer" | "enquire_first" | null) ?? null,
    edition: w.edition ?? null,
    editions: ((w as unknown as { editions?: EditionOption[] }).editions ?? []),
    location_text: w.location_text ?? null,
    show_location_publicly: w.show_location_publicly ?? false,
    profile: {
      id: profileId,
      username: artistUsername,
      full_name: artistName || null,
      avatar_url: artistAvatarUrl ?? null,
    },
  }));

  if (!isOwner && works.filter((w) => !w.hide_available).length === 0) return null;

  return (
    <section ref={sectionRef} className={`space-y-4 ${noBorder ? "pt-0" : "border-t border-border pt-10"}`}>
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
          initialRowH={initialRowH}
          initialHGap={initialHGap}
          initialVGap={initialVGap}
          initialLastRowAlign={initialLastRowAlign}
          initialOpenArtworkId={initialOpenArtworkId}
          hideProfileLink
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
