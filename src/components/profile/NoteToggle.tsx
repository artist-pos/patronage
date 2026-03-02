"use client";

import { useState, useTransition } from "react";
import { toggleNoteVisibility } from "@/actions/notes";

interface Props {
  noteId: string;
  initialVisible: boolean;
}

export function NoteToggle({ noteId, initialVisible }: Props) {
  const [visible, setVisible] = useState(initialVisible);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleNoteVisibility(noteId, !visible);
      setVisible((v) => !v);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`text-xs border px-2 py-0.5 transition-colors disabled:opacity-40 ${
        visible
          ? "border-black hover:bg-black hover:text-white"
          : "border-border text-muted-foreground hover:border-black hover:text-foreground"
      }`}
    >
      {pending ? "…" : visible ? "Hide" : "Show"}
    </button>
  );
}
