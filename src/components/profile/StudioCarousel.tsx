"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Music, Play, ExternalLink, FileText } from "lucide-react";
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

// Non-image tile size (audio, video, text, embed)
const CAROUSEL_H = 225;
const TILE_W = 200;
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
              style={{ width: TILE_W, height: TILE_W }}
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

// Sub-tile components for non-image content types

function AudioTileContent({ u }: { u: ProjectUpdateWithArtist }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 text-white">
      <Music className="w-8 h-8 opacity-50" />
      {u.caption && (
        <p className="text-xs text-center line-clamp-3 opacity-80 leading-snug">{u.caption}</p>
      )}
      {u.discipline && (
        <span className="text-[9px] uppercase tracking-widest opacity-40">
          {u.discipline.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}

function VideoTileContent({ u }: { u: ProjectUpdateWithArtist }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 text-white">
      <Play className="w-8 h-8 opacity-50" />
      {u.caption && (
        <p className="text-xs text-center line-clamp-3 opacity-80 leading-snug">{u.caption}</p>
      )}
    </div>
  );
}

function TextTileContent({ u }: { u: ProjectUpdateWithArtist }) {
  return (
    <div className="w-full h-full flex flex-col gap-2 p-3 bg-background overflow-hidden">
      {u.discipline && (
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          {u.discipline.replace(/_/g, " ")}
        </span>
      )}
      {u.text_content ? (
        <p className="text-xs leading-relaxed line-clamp-[9] text-foreground">{u.text_content}</p>
      ) : u.caption ? (
        <p className="text-xs leading-relaxed line-clamp-[9] text-foreground">{u.caption}</p>
      ) : (
        <FileText className="w-6 h-6 opacity-30 m-auto" />
      )}
    </div>
  );
}

function EmbedTileContent({ u }: { u: ProjectUpdateWithArtist }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-muted">
      <ExternalLink className="w-6 h-6 opacity-40" />
      {u.embed_provider && (
        <p className="text-xs text-muted-foreground">{u.embed_provider}</p>
      )}
      {u.caption && (
        <p className="text-xs text-center line-clamp-2 text-muted-foreground">{u.caption}</p>
      )}
    </div>
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

  const href = u.project_id
    ? `/threads/${u.project_id}`
    : from
    ? `/projects/${u.id}?from=${from}`
    : `/projects/${u.id}`;

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await deleteUpdate(u.id, {
        image_url: u.image_url,
        audio_url: u.audio_url,
        video_url: u.video_url,
      });
      onDeleted(u.id);
      router.refresh();
    });
  }

  const isImage = u.content_type === "image";

  // Seed width from stored dimensions so there's no layout shift on load.
  // onLoad fills it in for older images that don't have stored dimensions.
  const [cardWidth, setCardWidth] = useState<number | null>(() =>
    isImage && u.image_width && u.image_height
      ? Math.round(CAROUSEL_H * (u.image_width / u.image_height))
      : null
  );

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (cardWidth !== null) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setCardWidth(Math.round(CAROUSEL_H * (img.naturalWidth / img.naturalHeight)));
    }
  }

  // Non-image tiles (audio, video, text, embed) use a fixed square
  const tileStyle = fixed
    ? isImage
      ? cardWidth ? { width: cardWidth } : undefined
      : { width: TILE_W }
    : undefined;

  return (
    <div className="flex-none group border border-border bg-background" style={tileStyle}>
      {/* Media */}
      <div className="relative overflow-hidden bg-muted" style={{ height: CAROUSEL_H }}>
        <Link href={href} className="absolute inset-0">
          {isImage && u.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.image_url}
              alt={u.caption ?? "Studio update"}
              style={{ height: CAROUSEL_H, width: "auto", display: "block" }}
              onLoad={handleImgLoad}
            />
          ) : u.content_type === "audio" ? (
            <AudioTileContent u={u} />
          ) : u.content_type === "video" ? (
            <VideoTileContent u={u} />
          ) : u.content_type === "text" ? (
            <TextTileContent u={u} />
          ) : u.content_type === "embed" ? (
            <EmbedTileContent u={u} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Update
            </div>
          )}
        </Link>

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

      {/* Caption / timestamp — min-w-0 keeps text within card width */}
      {(u.caption || isOwner) && (
        <div className="px-2 py-1.5 border-t border-border min-w-0 overflow-hidden">
          {u.caption && (
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{u.caption}</p>
          )}
          {isOwner && (
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
              {formatTimestamp(u.created_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
