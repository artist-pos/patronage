"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AvailableWorkCard, CARD_W, CARD_IMG_H } from "./AvailableWorkCard";
import { AddAvailableWorkModal } from "./AddAvailableWorkModal";
import type { Artwork } from "@/types/database";

// One-row height: image + text area + owner controls allowance
const CARD_H = CARD_IMG_H + 70;

interface Props {
  initialWorks: Artwork[];
  profileId: string;
  artistName: string;
  artistUsername: string;
  viewerRole: string | null;
  isOwner: boolean;
}

export function AvailableWorksSection({
  initialWorks,
  profileId,
  artistName,
  artistUsername,
  viewerRole,
  isOwner,
}: Props) {
  const [works, setWorks] = useState<Artwork[]>(initialWorks);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [contentH, setContentH] = useState(CARD_H);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track actual content height for smooth expand animation
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      setContentH(el.scrollHeight);
      setOverflows(el.scrollHeight > CARD_H + 8);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-expand and scroll when navigated from feed Works tab
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#artwork-")) return;

    setExpanded(true);

    // Wait for expand animation to complete before scrolling
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(hash);
      if (!el) return;
      const header = document.querySelector("header");
      const headerH = header ? header.getBoundingClientRect().height : 64;
      const top = el.getBoundingClientRect().top + window.scrollY - headerH - 24;
      window.scrollTo({ top, behavior: "smooth" });
    }, 420);

    return () => clearTimeout(timer);
  }, []);

  function handleWorkAdded(newWork: Artwork) {
    setWorks((prev) => [...prev, newWork]);
    router.refresh();
  }

  function handleWorkRemoved(id: string) {
    setWorks((prev) => prev.filter((w) => w.id !== id));
  }

  if (!isOwner && works.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Available Works
      </h2>

      {works.length === 0 && isOwner ? (
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">No works listed yet.</p>
          <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
        </div>
      ) : (
        <>
          <div
            style={{
              height: expanded ? contentH : CARD_H,
              overflow: "hidden",
              transition: "height 0.35s ease",
            }}
          >
            <div ref={contentRef} className="flex flex-wrap gap-4">
              {works.map((img) => (
                <div key={img.id} id={`artwork-${img.id}`}>
                  <AvailableWorkCard
                    img={img}
                    artistId={profileId}
                    artistName={artistName}
                    artistUsername={artistUsername}
                    viewerRole={viewerRole}
                    isOwner={isOwner}
                    onRemove={handleWorkRemoved}
                  />
                </div>
              ))}

              {isOwner && (
                <div
                  className="flex items-center justify-center border border-dashed border-border"
                  style={{ height: CARD_IMG_H, width: CARD_W }}
                >
                  <AddAvailableWorkModal profileId={profileId} onSuccess={handleWorkAdded} />
                </div>
              )}
            </div>
          </div>

          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? "Show less" : `Show all works (${works.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
