"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Check, X } from "lucide-react";
import {
  createBoard,
  listBoardsForItem,
  setBoardItem,
  type BoardOption,
} from "@/actions/boards";
import type { BoardItemType } from "@/types/database";

interface Props {
  itemType: BoardItemType;
  itemId: string;
  /** false sends straight to sign-in. Leave unset where the page doesn't know
   *  (cached public pages); the server then decides. */
  isAuthenticated?: boolean;
  /** "icon" for tiles and headers; "button" for a labelled action bar. */
  variant?: "icon" | "button";
  /** Icon colour context: tiles with a dark hover bar pass true. */
  onDark?: boolean;
  className?: string;
}

/**
 * Save something to one of your boards (224). A save is intent — a shortlist,
 * not applause — so it opens a small sheet to choose where it goes. With no
 * boards yet, it suggests "Saved" as a name and waits for the person to add it.
 */
export function SaveToBoard({ itemType, itemId, isAuthenticated, variant = "icon", onDark = false, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardOption[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function stop(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function openSheet(e: React.MouseEvent) {
    stop(e);
    if (isAuthenticated === false) {
      router.push("/auth/login");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await listBoardsForItem(itemType, itemId);
      if (res.error === "Not authenticated") {
        router.push("/auth/login");
        return;
      }
      setOpen(true);
      if (res.error) return setError(res.error);
      const list = res.boards ?? [];
      // No boards yet: suggest a name, but make nothing until they press Add.
      if (list.length === 0) setNewTitle("Saved");
      setBoards(list);
    });
  }

  function toggle(board: BoardOption) {
    const next = !board.contains;
    setBoards((bs) => bs?.map((b) => (b.id === board.id ? { ...b, contains: next } : b)) ?? null);
    startTransition(async () => {
      const res = await setBoardItem(board.id, itemType, itemId, next);
      if (res.error) {
        setError(res.error);
        setBoards((bs) => bs?.map((b) => (b.id === board.id ? { ...b, contains: !next } : b)) ?? null);
      }
    });
  }

  function addBoard(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const res = await createBoard(title, { itemType, itemId });
      if (res.error || !res.id) return setError(res.error ?? "Couldn't make the board.");
      setBoards((bs) => [{ id: res.id!, title, contains: true }, ...(bs ?? [])]);
      setNewTitle("");
    });
  }

  // Once the sheet has loaded, the boards are the truth.
  const saved = boards ? boards.some((b) => b.contains) : false;

  const trigger =
    variant === "button" ? (
      <button type="button" onClick={openSheet} aria-pressed={saved} className={className}>
        <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={openSheet}
        aria-label="Save to a board"
        title="Save to a board"
        className={
          className ??
          `flex h-7 w-7 shrink-0 items-center justify-center transition-colors ${
            onDark ? "text-white hover:bg-white/15" : "text-muted-foreground hover:bg-muted"
          }`
        }
      >
        <Bookmark className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} aria-hidden />
      </button>
    );

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
            onClick={(e) => {
              stop(e);
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-label="Save to a board"
              className="w-full max-w-sm bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Save to a board</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {boards === null && !error && <p className="py-4 text-sm text-muted-foreground">Loading…</p>}

              {boards && boards.length === 0 && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Name your first board. You can rename it or add more later.
                </p>
              )}

              {boards && boards.length > 0 && (
                <ul className="mb-4 max-h-64 overflow-y-auto border-y border-border">
                  {boards.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => toggle(b)}
                        disabled={pending}
                        className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left text-sm last:border-b-0 disabled:opacity-60"
                      >
                        <span className="truncate">{b.title}</span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                            b.contains ? "border-foreground bg-foreground text-background" : "border-border"
                          }`}
                        >
                          {b.contains && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={addBoard} className="flex gap-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="New board"
                  maxLength={80}
                  className="h-9 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
                />
                <button
                  type="submit"
                  disabled={pending || !newTitle.trim()}
                  className="h-9 shrink-0 bg-foreground px-4 text-xs font-medium text-background disabled:opacity-40"
                >
                  Add
                </button>
              </form>

              {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

              <Link href="/boards" className="mt-4 inline-block font-mono text-xs text-muted-foreground hover:text-foreground">
                Your boards →
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
