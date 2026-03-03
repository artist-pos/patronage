"use client";

import { useState } from "react";
import Link from "next/link";
import { updateWorkPrivacy, updateProfilePrivacy } from "@/app/profile/privacy-actions";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;
const META_W = 200;

interface CollectionWork extends PortfolioImage {
  creator_profile: { username: string; full_name: string | null } | null;
}

interface Props {
  initialWorks: CollectionWork[];
  isOwner: boolean;
  collectionPublic: boolean;
}

export function CollectionSection({ initialWorks, isOwner, collectionPublic }: Props) {
  const [works, setWorks] = useState<CollectionWork[]>(initialWorks);
  const [isPublic, setIsPublic] = useState(collectionPublic);
  const [toggling, setToggling] = useState<string | null>(null);

  // Non-owner sees nothing if private
  if (!isOwner && !isPublic) return null;
  // Non-owner sees nothing if no works
  if (!isOwner && works.length === 0) return null;

  async function toggleCollectionVisible(workId: string, current: boolean) {
    setToggling(workId);
    await updateWorkPrivacy(workId, "collection_visible", !current);
    setWorks((prev) =>
      prev.map((w) => (w.id === workId ? { ...w, collection_visible: !current } : w))
    );
    setToggling(null);
  }

  async function toggleCollectionPublic() {
    const next = !isPublic;
    setIsPublic(next);
    await updateProfilePrivacy("collection_public", next);
  }

  const visibleWorks = isOwner ? works : works.filter((w) => w.collection_visible);

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Collection
        </h2>
        {isOwner && (
          <button
            onClick={toggleCollectionPublic}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isPublic ? "Make collection private" : "Make collection public"}
          </button>
        )}
      </div>

      {visibleWorks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No works collected yet.</p>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ height: CARD_H }}
        >
          {visibleWorks.map((work) => {
            const creatorName = work.creator_profile?.full_name ?? work.creator_profile?.username;
            const creatorUsername = work.creator_profile?.username;

            return (
              <div
                key={work.id}
                className="flex-none flex flex-row border border-border bg-background snap-start"
                style={{ height: CARD_H }}
              >
                {/* Image */}
                <div className="overflow-hidden bg-muted flex-none" style={{ height: CARD_H }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={work.url}
                    alt={work.caption ?? "Collected work"}
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
                    {creatorName && creatorUsername && (
                      <Link
                        href={`/${creatorUsername}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Created by {creatorName}
                      </Link>
                    )}
                    {work.price && !work.hide_price && (
                      <p className="text-xs text-muted-foreground">{work.price}</p>
                    )}
                  </div>

                  {/* Owner-only: visibility toggle */}
                  {isOwner && (
                    <button
                      onClick={() => toggleCollectionVisible(work.id, work.collection_visible)}
                      disabled={toggling === work.id}
                      className="mt-auto text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {work.collection_visible ? "👁 Visible" : "🙈 Hidden"}
                    </button>
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
