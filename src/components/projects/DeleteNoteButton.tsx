"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { deleteNote } from "@/actions/notes";

interface Props {
  noteId: string;
  updateId: string;
  onDeleted: () => void;
}

export function DeleteNoteButton({ noteId, updateId, onDeleted }: Props) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteNote(noteId, updateId);
      onDeleted();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete note"
      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}
