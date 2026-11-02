"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoard } from "@/actions/boards";

export function NewBoardForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createBoard(title);
      if (res.error || !res.id) return setError(res.error ?? "Couldn't make the board.");
      router.push(`/boards/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New board"
        maxLength={80}
        className="h-9 w-52 border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="h-9 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-40"
      >
        Create
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  );
}
