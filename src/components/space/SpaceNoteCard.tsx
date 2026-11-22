"use client";

import { Heart } from "lucide-react";
import type { SpaceNote } from "@/lib/space-board";

// Three papers, white to yellow, chosen by id so a note keeps its look.
const PAPERS = ["#FFFFFF", "#FFF8DA", "#FFF3B5"];
const TILTS = [-1.6, 0.9, -0.5, 1.4, -1.1, 0.4];

function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  note: SpaceNote;
  appreciated: boolean;
  pending: boolean;
  onAppreciate: () => void;
  isAdmin: boolean;
  onToggleHidden: () => void;
  fresh?: boolean;
}

export function SpaceNoteCard({ note, appreciated, pending, onAppreciate, isAdmin, onToggleHidden, fresh }: Props) {
  const s = seed(note.id);
  const paper = PAPERS[s % PAPERS.length];
  const tilt = TILTS[s % TILTS.length];
  const count = note.appreciation_count;
  const label = appreciated ? "Take back your appreciation" : "Appreciate this note";

  return (
    <article
      className={`relative flex flex-col mb-4 min-h-[8.5rem] break-inside-avoid px-4 pb-3 pt-5 shadow-[0_1px_2px_rgba(28,25,23,0.1),0_8px_18px_-10px_rgba(28,25,23,0.4)] transition-transform sm:mb-4 sm:px-5 ${
        note.hidden ? "opacity-45" : ""
      } ${fresh ? "outline outline-2 outline-[#ED2100]" : ""}`}
      style={{ backgroundColor: paper, transform: `rotate(${tilt}deg)` }}
    >
      <p className="whitespace-pre-line break-words text-[15px] leading-[1.45] sm:text-[16px]">{note.body}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <p className="min-w-0 truncate text-[13px] text-[#57534e]">{note.author_name}</p>
        <button
          type="button"
          onClick={onAppreciate}
          disabled={pending || note.hidden}
          aria-pressed={appreciated}
          aria-label={`${label}${count ? ` (${count})` : ""}`}
          title={label}
          className="group inline-flex h-8 min-w-8 shrink-0 items-center justify-end gap-1.5 text-[13px] tabular-nums text-[#57534e] disabled:opacity-60"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              appreciated ? "text-[#ED2100]" : "text-[#78716c] group-hover:text-[#1c1917]"
            }`}
            fill={appreciated ? "currentColor" : "none"}
            aria-hidden
          />
          {count > 0 && <span>{count}</span>}
        </button>
      </div>
      {isAdmin && (
        <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-[11px] text-[#78716c]">
          <span>{note.hidden ? "Hidden from the board" : new Date(note.created_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}</span>
          <button type="button" onClick={onToggleHidden} className="underline underline-offset-2 hover:text-[#ED2100]">
            {note.hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      )}
    </article>
  );
}
