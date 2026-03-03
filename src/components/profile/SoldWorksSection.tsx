"use client";

import { useState } from "react";
import Link from "next/link";
import { updateWorkPrivacy, updateProfilePrivacy } from "@/app/profile/privacy-actions";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;
const META_W = 200;

interface SoldWork extends PortfolioImage {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface Props {
  initialWorks: SoldWork[];
  isOwner: boolean;
  hideSoldSection: boolean;
}

export function SoldWorksSection({ initialWorks, isOwner, hideSoldSection }: Props) {
  const [works, setWorks] = useState<SoldWork[]>(initialWorks);
  const [sectionHidden, setSectionHidden] = useState(hideSoldSection);
  const [toggling, setToggling] = useState<string | null>(null);

  // Non-owner: hide if section is set to hidden, or no works
  if (!isOwner && sectionHidden) return null;
  if (!isOwner && works.length === 0) return null;

  const visibleWorks = isOwner ? works : works.filter((w) => !w.hide_from_archive);

  async function toggleHideFromArchive(workId: string, current: boolean) {
    setToggling(workId);
    await updateWorkPrivacy(workId, "hide_from_archive", !current);
    setWorks((prev) =>
      prev.map((w) => (w.id === workId ? { ...w, hide_from_archive: !current } : w))
    );
    setToggling(null);
  }

  async function toggleHidePrice(workId: string, current: boolean) {
    setToggling(`price-${workId}`);
    await updateWorkPrivacy(workId, "hide_price", !current);
    setWorks((prev) =>
      prev.map((w) => (w.id === workId ? { ...w, hide_price: !current } : w))
    );
    setToggling(null);
  }

  async function toggleSectionVisibility() {
    const next = !sectionHidden;
    setSectionHidden(next);
    await updateProfilePrivacy("hide_sold_section", next);
  }

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Sold Works
        </h2>
        {isOwner && (
          <button
            onClick={toggleSectionVisibility}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {sectionHidden ? "Show sold section" : "Hide sold section"}
          </button>
        )}
      </div>

      {visibleWorks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sold works to display.</p>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ height: CARD_H }}
        >
          {visibleWorks.map((work) => {
            const ownerName = work.owner_profile?.full_name ?? work.owner_profile?.username;
            const ownerUsername = work.owner_profile?.username;

            return (
              <div
                key={work.id}
                className={`flex-none flex flex-row border border-border bg-background snap-start overflow-hidden ${
                  isOwner && work.hide_from_archive ? "opacity-50" : ""
                }`}
                style={{ height: CARD_H, boxSizing: "border-box" }}
              >
                {/* Image */}
                <div className="overflow-hidden bg-muted flex-none" style={{ height: CARD_H }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={work.url}
                    alt={work.caption ?? "Sold work"}
                    style={{ height: CARD_H, width: "auto", display: "block" }}
                  />
                </div>

                {/* Metadata */}
                <div
                  className="flex flex-col gap-2 p-4 border-l border-border"
                  style={{ width: META_W }}
                >
                  <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                    {work.caption && (
                      <p className="text-sm font-semibold leading-snug line-clamp-3">
                        {work.caption.slice(0, 140)}
                      </p>
                    )}
                    {ownerName && ownerUsername && (
                      <Link
                        href={`/${ownerUsername}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Owned by {ownerName}
                      </Link>
                    )}
                    {!work.hide_price && work.price && (
                      <p className="text-xs text-muted-foreground">{work.price}</p>
                    )}
                  </div>

                  {/* Owner-only controls */}
                  {isOwner && (
                    <div className="mt-auto flex flex-col gap-1">
                      <button
                        onClick={() => toggleHideFromArchive(work.id, work.hide_from_archive)}
                        disabled={toggling === work.id}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {work.hide_from_archive ? "Show in archive" : "Hide from archive"}
                      </button>
                      <button
                        onClick={() => toggleHidePrice(work.id, work.hide_price)}
                        disabled={toggling === `price-${work.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {work.hide_price ? "Show price" : "Hide price"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
