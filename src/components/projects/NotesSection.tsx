"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { addNote, deleteNote } from "@/actions/notes";
import type { NoteWithSender } from "@/types/database";

const MAX = 140;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

interface Props {
  initialNotes: NoteWithSender[];
  updateId: string;
  artistId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  currentUserAvatarUrl?: string | null;
}

export function NotesSection({
  initialNotes,
  updateId,
  artistId,
  currentUserId,
  currentUserName,
  currentUserUsername,
  currentUserAvatarUrl,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, startPost] = useTransition();

  function canDelete(note: NoteWithSender) {
    if (!currentUserId) return false;
    return currentUserId === note.sender_id || currentUserId === artistId;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !currentUserId || !currentUserName) return;

    const trimmed = content.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: NoteWithSender = {
      id: tempId,
      update_id: updateId,
      artist_id: artistId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_username: currentUserUsername ?? "",
      sender_avatar_url: currentUserAvatarUrl ?? null,
      content: trimmed,
      is_visible: true,
      created_at: new Date().toISOString(),
    };

    setNotes((n) => [...n, optimistic]);
    setContent("");
    setError(null);

    startPost(async () => {
      try {
        const { id: realId, created_at } = await addNote(updateId, artistId, trimmed);
        setNotes((n) =>
          n.map((note) => (note.id === tempId ? { ...note, id: realId, created_at } : note))
        );
      } catch (err: any) {
        setNotes((n) => n.filter((note) => note.id !== tempId));
        setContent(trimmed);
        setError(err?.message ?? "Failed to post note.");
      }
    });
  }

  function handleDelete(noteId: string) {
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== noteId));
    deleteNote(noteId, updateId).catch(() => setNotes(prev));
  }

  const canPost = !!currentUserId && !!currentUserName;

  if (notes.length === 0 && !canPost) return null;

  return (
    <div className="space-y-4">
      {notes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Notes
          </h2>
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start gap-2.5">
                {/* Clickable avatar */}
                <Link href={`/${note.sender_username}`} className="shrink-0 mt-0.5">
                  {note.sender_avatar_url ? (
                    <div className="relative w-6 h-6 border border-black overflow-hidden">
                      <Image
                        src={note.sender_avatar_url}
                        alt={note.sender_name}
                        fill
                        className="object-cover"
                        sizes="24px"
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 border border-black bg-muted flex items-center justify-center text-[9px] font-semibold shrink-0">
                      {note.sender_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm leading-relaxed">
                    <Link
                      href={`/${note.sender_username}`}
                      className="font-semibold hover:underline underline-offset-2"
                    >
                      {note.sender_name}
                    </Link>
                    {": "}
                    <span>{note.content}</span>
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {formatTimestamp(note.created_at)}
                  </p>
                </div>

                {canDelete(note) && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    aria-label="Delete note"
                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canPost && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Leave a note
          </p>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX))}
              placeholder="Say something about this work…"
              rows={3}
              className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
            />
            <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground font-mono">
              {content.length}/{MAX}
            </span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={!content.trim() || posting}
            className="border border-black px-4 py-1.5 text-xs hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posting ? "Posting…" : "Post note"}
          </button>
        </form>
      )}
    </div>
  );
}
