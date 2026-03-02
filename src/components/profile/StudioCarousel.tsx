"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { deleteUpdate } from "@/actions/updates";
import type { ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  updates: ProjectUpdateWithArtist[];
  artistUsername: string;
  isOwner?: boolean;
}

// Portfolio grid height is h-[300px]; carousel is 75% = 225px
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

export function StudioCarousel({ updates, artistUsername, isOwner = false }: Props) {
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
        {visible.length > ROW_SIZE && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {expanded ? "Show less" : `View all ${visible.length}`}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {visible.map((u) => (
            <Tile
              key={u.id}
              u={u}
              isOwner={isOwner}
              from={`profile&u=${artistUsername}`}
              onDeleted={onDeleted}
              fixed={false}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {visible.slice(0, ROW_SIZE).map((u) => (
            <Tile
              key={u.id}
              u={u}
              isOwner={isOwner}
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
  from,
  onDeleted,
  fixed,
}: {
  u: ProjectUpdateWithArtist;
  isOwner: boolean;
  from?: string;
  onDeleted: (id: string) => void;
  fixed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const href = from ? `/projects/${u.id}?from=${from}` : `/projects/${u.id}`;

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await deleteUpdate(u.id, u.image_url);
      onDeleted(u.id);
      router.refresh();
    });
  }

  const style = fixed ? { width: CAROUSEL_H, height: CAROUSEL_H } : {};

  return (
    <div
      className={`group relative border border-border overflow-hidden bg-muted${fixed ? " shrink-0" : " aspect-square"}`}
      style={style}
    >
      <Link href={href} className="block w-full h-full">
        <Image
          src={u.image_url}
          alt={u.caption ?? "Studio update"}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes={fixed ? `${CAROUSEL_H}px` : "(max-width: 640px) 25vw, 12vw"}
        />
        {/* Caption + timestamp: always visible for owner, hover for visitors */}
        {(isOwner || u.caption) && (
          <div
            className={`absolute inset-0 bg-background/80 flex flex-col justify-end p-2 transition-opacity ${
              isOwner ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {isOwner && (
              <p className="text-[9px] font-mono text-muted-foreground leading-tight">
                {formatTimestamp(u.created_at)}
              </p>
            )}
            {u.caption && (
              <p className="text-[10px] line-clamp-2 leading-snug mt-0.5">{u.caption}</p>
            )}
          </div>
        )}
      </Link>

      {/* Owner delete button */}
      {isOwner && (
        <button
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete update"
          className="absolute top-1 right-1 w-5 h-5 bg-background border border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black hover:text-white disabled:opacity-40"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
