"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { answerEventRecord } from "@/actions/events";

interface Props {
  updateId: string;
  /** Private save total for the artist, from board_save_counts (224). */
  saves?: number;
}

/**
 * Shown only to the artist, on their own event once the day has passed:
 * one tap turns the event into an exhibitions line on their CV.
 */
export function EventRecordPrompt({ updateId, saves }: Props) {
  const [state, setState] = useState<"ask" | "added" | "dismissed">("ask");
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function answer(choice: "Solo" | "Group" | "dismiss") {
    setError(null);
    startTransition(async () => {
      const res = await answerEventRecord(updateId, choice);
      if (res.error) { setError(res.error); return; }
      if (choice === "dismiss") setState("dismissed");
      else {
        setState("added");
        if (res.entry) setAdded(`${res.entry.type}: ${res.entry.title}, ${res.entry.venue}, ${res.entry.year}`);
      }
    });
  }

  if (state === "dismissed") return null;

  return (
    <div className="mt-3 bg-muted p-3 text-[13px] leading-[1.5]" onClick={(e) => e.preventDefault()}>
      <p className="t-section-label mb-2">{state === "added" ? "Added to your exhibitions" : "Only you see this"}</p>
      {state === "added" ? (
        <p>
          {added}.{" "}
          <Link href="/profile/edit#cv" className="font-medium text-brand hover:underline underline-offset-2">Edit</Link>
        </p>
      ) : (
        <>
          {saves ? <p className="text-[color:var(--fg-muted)]">{saves} {saves === 1 ? "person" : "people"} saved it.</p> : null}
          <p className="mb-2 mt-1 font-medium">Add it to your exhibitions?</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" disabled={pending} onClick={(e) => { e.stopPropagation(); answer("Solo"); }} className="btn btn-primary btn-sm">Solo</button>
            <button type="button" disabled={pending} onClick={(e) => { e.stopPropagation(); answer("Group"); }} className="btn btn-outline btn-sm">Group</button>
            <button type="button" disabled={pending} onClick={(e) => { e.stopPropagation(); answer("dismiss"); }} className="px-1.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)] hover:text-foreground">Not this one</button>
          </div>
          {error && <p role="alert" className="mt-2 text-[color:var(--urgent)]">{error}</p>}
        </>
      )}
    </div>
  );
}
