"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateArtist, type SaveResult } from "./actions";

/** The artist details form, with a visible Saved / error after each save. */
export function ArtistForm({ className, children }: { className: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<SaveResult, FormData>(updateArtist, null);
  return (
    <form action={action} className={className}>
      {children}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {pending ? "Saving…" : "Save artist"}
        </button>
        {!pending && state?.ok && <span className="inline-flex items-center gap-1 text-sm text-stone-500"><Check className="size-4" /> Saved</span>}
        {!pending && state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
