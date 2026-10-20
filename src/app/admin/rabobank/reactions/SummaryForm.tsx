"use client";

import { useActionState } from "react";
import { saveSummary, type ActionState } from "../actions";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function SummaryForm({ summary, showRaw }: { summary: string; showRaw: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSummary, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Comment summary for the client</span>
        <textarea name="comment_summary" rows={8} defaultValue={summary} className={input} />
        <span className="text-xs text-muted-foreground">
          Written by you. Do not attribute comments to individuals.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="show_raw_comments_to_client" defaultChecked={showRaw} className="mt-1" />
        <span>
          Also show the raw comments on the client link (without names).
          <span className="block text-xs text-muted-foreground">Off by default.</span>
        </span>
      </label>
      <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.ok && <span className="ml-3 text-sm text-success">Saved.</span>}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
