"use client";

import { useState } from "react";
import { DeleteNoteButton } from "./DeleteNoteButton";
import type { NoteWithSender } from "@/types/database";

interface Props {
  notes: NoteWithSender[];
  currentUserId?: string;
}

export function NotesList({ notes: initialNotes, currentUserId }: Props) {
  const [notes, setNotes] = useState(initialNotes);

  function removeNote(id: string) {
    setNotes((n) => n.filter((note) => note.id !== id));
  }

  if (notes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Notes
      </h2>
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="flex items-start gap-2">
            <p className="text-sm leading-relaxed flex-1">
              <span className="font-semibold">From {note.sender_name}: </span>
              <span>{note.content}</span>
            </p>
            {currentUserId === note.sender_id && (
              <DeleteNoteButton
                noteId={note.id}
                updateId={note.update_id}
                onDeleted={() => removeNote(note.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
