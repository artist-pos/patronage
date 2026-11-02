"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { deleteBoard, inviteToApply, setBoardItem, updateBoard } from "@/actions/boards";
import type { BoardTile } from "@/lib/boards";
import type { Board } from "@/types/database";

interface Props {
  board: Board;
  tiles: BoardTile[];
  shareUrl: string;
  isPartner: boolean;
  /** The organisation's open opportunities, for "Invite to apply". */
  opportunities: Array<{ id: string; title: string; deadline: string | null }>;
  invited: Array<{ opportunity_id: string; artist_id: string }>;
}

const TYPE_LABEL: Record<BoardTile["type"], string> = {
  artwork: "Work",
  update: "Studio update",
  artist: "Artist",
};

export function BoardView({ board, tiles: initialTiles, shareUrl, isPartner, opportunities, invited: initialInvited }: Props) {
  const router = useRouter();
  const [tiles, setTiles] = useState(initialTiles);
  const [title, setTitle] = useState(board.title);
  const [visibility, setVisibility] = useState<"private" | "link">(board.visibility === "link" ? "link" : "private");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Invite to apply
  const [oppId, setOppId] = useState(opportunities[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState(initialInvited);

  const artistTiles = tiles.filter((t) => t.type === "artist");
  const invitedFor = new Set(invited.filter((i) => i.opportunity_id === oppId).map((i) => i.artist_id));

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function saveTitle() {
    const t = title.trim();
    if (!t || t === board.title) return setTitle(board.title);
    startTransition(async () => {
      const res = await updateBoard(board.id, { title: t });
      flash(res.error ?? "Renamed.");
    });
  }

  function changeVisibility(next: "private" | "link") {
    setVisibility(next);
    startTransition(async () => {
      const res = await updateBoard(board.id, { visibility: next });
      if (res.error) {
        setVisibility(next === "link" ? "private" : "link");
        flash(res.error);
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => flash("Link copied."), () => flash(shareUrl));
  }

  function remove(tile: BoardTile) {
    setTiles((ts) => ts.filter((t) => !(t.type === tile.type && t.id === tile.id)));
    startTransition(async () => {
      const res = await setBoardItem(board.id, tile.type, tile.id, false);
      if (res.error) {
        setTiles((ts) => [tile, ...ts]);
        flash(res.error);
      }
    });
  }

  function removeBoard() {
    if (!confirm(`Delete "${board.title}"? The things on it aren't affected.`)) return;
    startTransition(async () => {
      const res = await deleteBoard(board.id);
      if (res.error) return flash(res.error);
      router.push("/boards");
    });
  }

  function toggleSelected(artistId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(artistId)) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
  }

  function invite() {
    const ids = [...selected].filter((id) => !invitedFor.has(id));
    if (!oppId || ids.length === 0) return;
    startTransition(async () => {
      const res = await inviteToApply(board.id, oppId, ids);
      if (res.error) return flash(res.error);
      setInvited((inv) => [...inv, ...ids.map((artist_id) => ({ opportunity_id: oppId, artist_id }))]);
      setSelected(new Set());
      flash(res.invited ? `Invited ${res.invited} artist${res.invited !== 1 ? "s" : ""}.` : "They've already been invited.");
    });
  }

  return (
    <div>
      <Link href="/boards" className="mb-6 inline-block font-mono text-xs text-muted-foreground hover:text-foreground">
        ← Your boards
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            maxLength={80}
            aria-label="Board name"
            className="w-full max-w-[640px] bg-transparent text-2xl font-semibold tracking-tight outline-none focus:underline"
          />
          <p className="mt-1 font-mono text-xs text-[color:var(--fg-subtle)]">
            {tiles.length} saved · {visibility === "link" ? "anyone with the link can view" : "only you can see this"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-border font-mono text-xs">
            {(["private", "link"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => v !== visibility && changeVisibility(v)}
                disabled={pending}
                className={`h-9 px-3 ${visibility === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "private" ? "Private" : "Share by link"}
              </button>
            ))}
          </div>
          {visibility === "link" && (
            <button type="button" onClick={copyLink} className="h-9 border border-border px-3 font-mono text-xs hover:border-foreground">
              Copy link
            </button>
          )}
          <button type="button" onClick={removeBoard} className="h-9 px-3 font-mono text-xs text-muted-foreground hover:text-foreground">
            Delete board
          </button>
        </div>
      </div>

      {/* Invite to apply — organisations, for artists on this board */}
      {isPartner && artistTiles.length > 0 && (
        <div className="mb-10 border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Invite to apply</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no open opportunities right now. <Link href="/partner/list-free" className="underline underline-offset-2">List one</Link> to invite these artists.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Pick artists below and an opportunity. They&rsquo;ll get an invitation, never this board.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={oppId}
                  onChange={(e) => {
                    setOppId(e.target.value);
                    setSelected(new Set());
                  }}
                  className="h-9 max-w-full border border-border bg-background px-2 text-sm"
                >
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={invite}
                  disabled={pending || selected.size === 0}
                  className="h-9 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-40"
                >
                  Invite {selected.size > 0 ? selected.size : ""}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing here yet. Use the bookmark on an update, a work or an artist&rsquo;s profile to add to this board.
        </p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tiles.map((t) => {
            const canPick = isPartner && opportunities.length > 0 && t.type === "artist";
            const wasInvited = canPick && invitedFor.has(t.id);
            return (
              <div key={`${t.type}:${t.id}`} className="group relative bg-card">
                <Link href={t.href} className="block">
                  {t.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted font-mono text-xs text-muted-foreground">
                      {TYPE_LABEL[t.type]}
                    </div>
                  )}
                  <div className="p-3">
                    <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">{TYPE_LABEL[t.type]}</p>
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>
                    {t.subtitle && <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>}
                  </div>
                </Link>
                {canPick && (
                  <label className="flex items-center gap-2 border-t border-border px-3 py-2 font-mono text-xs">
                    {wasInvited ? (
                      <span className="text-[color:var(--fg-subtle)]">Invited</span>
                    ) : (
                      <>
                        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} />
                        Select to invite
                      </>
                    )}
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => remove(t)}
                  aria-label="Remove from board"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 bg-foreground px-4 py-2 text-sm text-background sm:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
