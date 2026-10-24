"use client";

import { useState } from "react";
import { COPY } from "@/lib/rabobank/artist-copy";
import { confirmDelete, confirmKeep } from "../actions";

export function ChoiceConfirm({ token, choice }: { token: string; choice: "keep" | "delete" }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const F = COPY.followup;

  if (state === "done") {
    return <p className="rb-copy" role="status">{choice === "keep" ? COPY.done.keepSent : F.deleted}</p>;
  }
  return (
    <>
      <p className="rb-copy">{choice === "keep" ? F.confirmKeep : F.confirmDelete}</p>
      {state === "error" && <p className="rb-error" role="alert">{COPY.partTwo.errors.upload}</p>}
      <div className="rb-actions">
        <button
          type="button"
          className="rb-next"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const r = choice === "keep" ? await confirmKeep(token) : await confirmDelete(token);
            setState(r.ok ? "done" : "error");
          }}
        >
          {state === "busy" ? COPY.saving.saving : choice === "keep" ? F.keepButton : F.deleteButton}
        </button>
      </div>
    </>
  );
}
