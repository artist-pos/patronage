"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { deleteMyNote } from "@/actions/notes";
import type { NoteIWrote } from "@/lib/notes";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ManageNotesList({ initialNotes }: { initialNotes: NoteIWrote[] }) {
  const [notes, setNotes] = useState(initialNotes);

  function handleDelete(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    deleteMyNote(noteId).catch(() => {
      // re-fetch on error would require a router.refresh() but keep simple
    });
  }

  if (notes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">You haven't left any notes yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const artistName = note.artist_full_name ?? note.artist_username;
        return (
          <div
            key={note.id}
            className="flex items-start gap-4 p-4 border border-border"
          >
            {/* Update thumbnail */}
            {note.update_image_url && (
              <Link
                href={`/projects/${note.update_id}`}
                className="shrink-0"
              >
                <div className="relative w-14 h-14 border border-black overflow-hidden bg-muted">
                  <Image
                    src={note.update_image_url}
                    alt="Update"
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              </Link>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm leading-relaxed">{note.content}</p>
              <p className="text-xs text-muted-foreground">
                on{" "}
                <Link
                  href={`/${note.artist_username}`}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {artistName}
                </Link>
                {note.update_caption && (
                  <span className="text-muted-foreground"> — {note.update_caption.slice(0, 60)}{note.update_caption.length > 60 ? "…" : ""}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {formatDate(note.created_at)}
              </p>
            </div>

            {/* Delete button */}
            <button
              onClick={() => handleDelete(note.id)}
              aria-label="Delete note"
              className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
