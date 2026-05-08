"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateWorkPrivacy, updateProfilePrivacy } from "@/app/profile/privacy-actions";
import { removeFromArtistProfile, requestArtworkDeletion } from "@/app/profile/artwork-delete-actions";
import type { Artwork } from "@/types/database";

const TILE_H = 260;

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface Props {
  initialWorks: SoldWork[];
  isOwner: boolean;
  hideSoldSection: boolean;
}

export function SoldWorksSection({ initialWorks, isOwner, hideSoldSection }: Props) {
  const router = useRouter();
  const [works, setWorks] = useState<SoldWork[]>(initialWorks);
  const [sectionHidden, setSectionHidden] = useState(hideSoldSection);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  if (!isOwner && sectionHidden) return null;
  if (!isOwner && works.length === 0) return null;

  const visibleWorks = isOwner ? works : works.filter((w) => !w.hide_from_archive);

  async function toggleHideFromArchive(workId: string, current: boolean) {
    setToggling(workId);
    await updateWorkPrivacy(workId, "hide_from_archive", !current);
    setWorks((prev) => prev.map((w) => (w.id === workId ? { ...w, hide_from_archive: !current } : w)));
    setToggling(null);
  }

  async function toggleHidePrice(workId: string, current: boolean) {
    setToggling(`price-${workId}`);
    await updateWorkPrivacy(workId, "hide_price", !current);
    setWorks((prev) => prev.map((w) => (w.id === workId ? { ...w, hide_price: !current } : w)));
    setToggling(null);
  }

  async function handleRemoveFromProfile(workId: string) {
    setDeleting(workId);
    const result = await removeFromArtistProfile(workId);
    if (!result.error) setWorks((prev) => prev.filter((w) => w.id !== workId));
    setDeleting(null);
  }

  async function handleRequestDeletion(workId: string) {
    setDeleting(workId);
    const result = await requestArtworkDeletion(workId);
    setDeleting(null);
    setConfirmDelete(null);
    if (result.error) return;
    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`);
    } else {
      setWorks((prev) => prev.filter((w) => w.id !== workId));
    }
  }

  async function toggleSectionVisibility() {
    const next = !sectionHidden;
    setSectionHidden(next);
    await updateProfilePrivacy("hide_sold_section", next);
  }

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
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
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ height: TILE_H }}
        >
          {visibleWorks.map((work) => {
            const ownerName = work.owner_profile?.full_name ?? work.owner_profile?.username;
            const ownerUsername = work.owner_profile?.username;
            const isHovered = hoveredId === work.id;
            const isHidden = isOwner && work.hide_from_archive;

            return (
              <div
                key={work.id}
                className="relative flex-none overflow-hidden"
                style={{
                  height: TILE_H,
                  width: "auto",
                  opacity: isHidden ? 0.45 : 1,
                  cursor: "default",
                }}
                onMouseEnter={() => setHoveredId(work.id)}
                onMouseLeave={() => {
                  setHoveredId(null);
                  if (confirmDelete === work.id) setConfirmDelete(null);
                }}
              >
                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={work.url}
                  alt={work.caption ?? "Sold work"}
                  style={{
                    height: TILE_H,
                    width: "auto",
                    display: "block",
                    objectFit: "contain",
                    background: "#FAFAF9",
                    transition: "transform 0.3s ease",
                    transform: isHovered ? "scale(1.02)" : "scale(1)",
                  }}
                />

                {/* Hover gradient */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
                    pointerEvents: "none",
                  }}
                />

                {/* "Sold" badge — top-left, always visible */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    pointerEvents: "none",
                  }}
                >
                  <span className="flex items-center gap-1 bg-white/90 text-[10px] font-medium text-stone-700 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                    Sold
                  </span>
                </div>

                {/* Hover info — bottom */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "10px 12px",
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    pointerEvents: isHovered ? "auto" : "none",
                  }}
                >
                  {work.caption && (
                    <p className="text-xs font-semibold text-white leading-snug line-clamp-2 mb-1">
                      {work.caption}
                    </p>
                  )}
                  {ownerName && ownerUsername && (
                    <Link
                      href={`/${ownerUsername}`}
                      className="text-[10px] text-white/75 hover:text-white transition-colors"
                    >
                      Collection of {ownerName}
                    </Link>
                  )}
                  {!work.hide_price && (work.is_poa || work.price_cents) && (
                    <p className="text-[10px] text-white/60 mt-0.5">
                      {work.is_poa
                        ? "POA"
                        : `${work.price_currency} ${((work.price_cents ?? 0) / 100).toLocaleString("en-NZ")}`}
                    </p>
                  )}

                  {/* Owner controls */}
                  {isOwner && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {confirmDelete === work.id ? (
                        <>
                          <span className="text-[10px] text-white/70 w-full">Request patron approval via DM?</span>
                          <button
                            onClick={() => handleRequestDeletion(work.id)}
                            disabled={deleting === work.id}
                            className="text-[10px] text-red-300 hover:text-red-200 transition-colors"
                          >
                            {deleting === work.id ? "Sending…" : "Yes, send request"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[10px] text-white/50 hover:text-white/80 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleHideFromArchive(work.id, work.hide_from_archive)}
                            disabled={toggling === work.id}
                            className="text-[10px] text-white/60 hover:text-white transition-colors"
                          >
                            {work.hide_from_archive ? "Show" : "Hide"}
                          </button>
                          <button
                            onClick={() => toggleHidePrice(work.id, work.hide_price)}
                            disabled={toggling === `price-${work.id}`}
                            className="text-[10px] text-white/60 hover:text-white transition-colors"
                          >
                            {work.hide_price ? "Show price" : "Hide price"}
                          </button>
                          <button
                            onClick={() => handleRemoveFromProfile(work.id)}
                            disabled={deleting === work.id}
                            className="text-[10px] text-white/60 hover:text-white transition-colors"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmDelete(work.id)}
                            className="text-[10px] text-red-300/70 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
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
