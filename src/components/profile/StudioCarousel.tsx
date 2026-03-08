"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { deleteUpdate } from "@/actions/updates";
import { AssignProjectButton } from "./AssignProjectButton";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import type { ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  updates: ProjectUpdateWithArtist[];
  artistUsername: string;
  isOwner?: boolean;
  projects?: { id: string; title: string }[];
  profileId?: string;
}

// Portfolio height is h-[300px]; carousel is 75% = 225px
const CAROUSEL_H = 225;
const ROW_SIZE = 8;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

export function StudioCarousel({ updates, artistUsername, isOwner = false, projects = [], profileId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visible = updates.filter((u) => !deletedIds.has(u.id));

  if (visible.length === 0) return null;

  function onDeleted(id: string) {
    setDeletedIds((s) => new Set([...s, id]));
  }

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Studio Updates
        </h2>
        <div className="flex items-center gap-3">
          {visible.length > ROW_SIZE && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              {expanded ? "Show less" : `View all ${visible.length}`}
            </button>
          )}
          {isOwner && profileId && (
            <CreateUpdateModal
              profileId={profileId}
              label="+"
              projects={projects}
              className="bg-black text-white px-3 py-1 text-xs hover:opacity-80 transition-opacity"
            />
          )}
        </div>
      </div>

      {expanded ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {visible.map((u) => (
            <Tile
              key={u.id}
              u={u}
              isOwner={isOwner}
              projects={projects}
              from={`profile&u=${artistUsername}`}
              onDeleted={onDeleted}
              fixed={false}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-start">
          {visible.slice(0, ROW_SIZE).map((u) => (
            <Tile
              key={u.id}
              u={u}
              isOwner={isOwner}
              projects={projects}
              from={`profile&u=${artistUsername}`}
              onDeleted={onDeleted}
              fixed
            />
          ))}
          {visible.length > ROW_SIZE && (
            <button
              onClick={() => setExpanded(true)}
              style={{ width: CAROUSEL_H, height: CAROUSEL_H }}
              className="shrink-0 border border-dashed border-black flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              +{visible.length - ROW_SIZE} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({
  u,
  isOwner,
  projects,
  from,
  onDeleted,
  fixed,
}: {
  u: ProjectUpdateWithArtist;
  isOwner: boolean;
  projects: { id: string; title: string }[];
  from?: string;
  onDeleted: (id: string) => void;
  fixed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Project updates → thread; standalone updates → single update page
  const href = u.project_id
    ? `/threads/${u.project_id}`
    : from
    ? `/projects/${u.id}?from=${from}`
    : `/projects/${u.id}`;

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await deleteUpdate(u.id, u.image_url);
      onDeleted(u.id);
      router.refresh();
    });
  }

  return (
    <div className="flex-none flex flex-col gap-1">
      {/*
        Carousel (fixed=true): natural width at CAROUSEL_H — variable-width tiles suit horizontal scroll.
        Expanded grid (fixed=false): fill container with object-cover for a clean aligned grid.
      */}
      <div
        className="group relative border border-border overflow-hidden bg-muted"
        style={fixed
          ? { height: CAROUSEL_H, alignSelf: "flex-start" }
          : { height: CAROUSEL_H }}
      >
        <Link href={href} className={fixed ? "flex h-full" : "absolute inset-0"}>
          {fixed ? (
            // Plain <img> so the browser uses the actual image's intrinsic aspect ratio
            // (Next.js Image with width/height props bakes in a fixed ratio, breaking width: auto)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.image_url}
              alt={u.caption ?? "Studio update"}
              style={{ height: CAROUSEL_H, width: "auto", display: "block" }}
            />
          ) : (
            <Image
              src={u.image_url}
              alt={u.caption ?? "Studio update"}
              fill
              unoptimized
              className="object-cover"
            />
          )}
        </Link>

        {/* Owner controls: assign to project (top-left) + delete (top-right) */}
        {isOwner && (
          <>
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <AssignProjectButton
                updateId={u.id}
                currentProjectId={u.project_id}
                projects={projects}
              />
            </div>
            <button
              onClick={handleDelete}
              disabled={pending}
              aria-label="Delete update"
              className="absolute top-1 right-1 w-5 h-5 bg-background border border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black hover:text-white disabled:opacity-40"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Caption + timestamp */}
      {(u.caption || isOwner) && (
        <div className="space-y-0.5">
          {u.caption && (
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
              {u.caption}
            </p>
          )}
          {isOwner && (
            <p className="text-[9px] font-mono text-muted-foreground">
              {formatTimestamp(u.created_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
