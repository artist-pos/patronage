"use client";

import { useState, useTransition } from "react";
import { addNote } from "@/actions/notes";

const MAX = 500;

interface Props {
  updateId: string;
  artistId: string;
}

export function AddNoteForm({ updateId, artistId }: Props) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addNote(updateId, artistId, content.trim());
        setContent("");
        setDone(true);
      } catch (err: any) {
        setError(err.message ?? "Failed to post note.");
      }
    });
  }

  if (done) {
    return (
      <p className="text-xs text-muted-foreground">
        Note posted.{" "}
        <button
          onClick={() => setDone(false)}
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Add another
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground text-xs">
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
        disabled={!content.trim() || pending}
        className="border border-black px-4 py-1.5 text-xs hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Posting…" : "Post note"}
      </button>
    </form>
  );
}
