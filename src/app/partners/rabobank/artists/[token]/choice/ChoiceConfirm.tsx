"use client";

import { useState } from "react";
import { COPY } from "@/lib/rabobank/artist-copy";
import { confirmDelete, confirmKeep } from "../actions";

export function ChoiceConfirm({ token, choice }: { token: string; choice: "keep" | "delete" }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const F = COPY.followup;

  if (state === "done") {
    return <p className="text-lg leading-relaxed" role="status">{choice === "keep" ? COPY.done.keepSent : F.deleted}</p>;
  }
  return (
    <div className="space-y-4">
      <p className="leading-relaxed">{choice === "keep" ? F.confirmKeep : F.confirmDelete}</p>
      <button
        type="button"
        disabled={state === "busy"}
        className={`inline-flex min-h-12 items-center justify-center rounded-lg px-6 font-medium disabled:opacity-50 ${
          choice === "keep" ? "bg-black text-white hover:opacity-85" : "border border-red-700 text-red-700 hover:bg-red-50"
        }`}
        onClick={async () => {
          setState("busy");
          const r = choice === "keep" ? await confirmKeep(token) : await confirmDelete(token);
          setState(r.ok ? "done" : "error");
        }}
      >
        {choice === "keep" ? F.keepButton : F.deleteButton}
      </button>
      {state === "error" && <p className="text-sm text-red-700" role="alert">{COPY.partTwo.errors.upload}</p>}
    </div>
  );
}
