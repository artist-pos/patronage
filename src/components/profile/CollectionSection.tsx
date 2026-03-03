"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
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

  if (!isOwner && !isPublic) return null;
  if (!isOwner && works.filter((w) => w.collection_visible).length === 0) return null;

  async function toggleVisible(workId: string, current: boolean) {
    setToggling(workId);
    await updateWorkPrivacy(workId, "collection_visible", !current);
    setWorks((prev) => prev.map((w) => w.id === workId ? { ...w, collection_visible: !current } : w));
    setToggling(null);
  }

  async function toggleHidePrice(workId: string, current: boolean) {
    setToggling(`price-${workId}`);
    await updateWorkPrivacy(workId, "hide_price", !current);
    setWorks((prev) => prev.map((w) => w.id === workId ? { ...w, hide_price: !current } : w));
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
        <p className="text-sm text-muted-foreground">No acquired works in collection.</p>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ height: CARD_H }}
        >
          {visibleWorks.map((work) => {
            const creatorName = work.creator_profile?.full_name ?? work.creator_profile?.username;
            const creatorUsername = work.creator_profile?.username;
            const isHidden = !work.collection_visible;

            return (
              <div
                key={work.id}
                className={`flex-none flex flex-row border border-border bg-background snap-start overflow-hidden ${isOwner && isHidden ? "opacity-50" : ""}`}
                style={{ height: CARD_H, boxSizing: "border-box" }}
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
                      <p className="text-sm font-semibold leading-snug line-clamp-2">
                        {work.caption.slice(0, 140)}
                      </p>
                    )}

                    {/* Always show creator attribution */}
                    {creatorName && creatorUsername && (
                      <Link
                        href={`/${creatorUsername}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Created by {creatorName}
                      </Link>
                    )}

                    {/* Price or "Private Collection" */}
                    {work.price && (
                      <p className="text-xs text-muted-foreground">
                        {work.hide_price ? "Private Collection" : work.price}
                      </p>
                    )}
                  </div>

                  {/* Owner-only toggles */}
                  {isOwner && (
                    <div className="mt-auto flex flex-col gap-1">
                      <button
                        onClick={() => toggleVisible(work.id, work.collection_visible)}
                        disabled={toggling === work.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {work.collection_visible
                          ? <><Eye className="w-3 h-3" /> Visible</>
                          : <><EyeOff className="w-3 h-3" /> Hidden</>
                        }
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
