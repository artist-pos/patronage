"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { updateApplicationStatus } from "@/app/partner/dashboard/actions";
import type { EnrichedApp } from "@/components/partner/types";
import type { StageDef } from "@/lib/pipeline-stages";
import { transitionError } from "@/lib/decisions";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";

type Status = Parameters<typeof updateApplicationStatus>[1];

interface Options {
  apps: EnrichedApp[];
  stages: StageDef[];
  /** Optimistic update owned by the shell, so every view and the panel agree. */
  onStatusChange: (appId: string, status: string) => void;
}

interface PendingRequest {
  ids: string[];
  status: string;
}

const NEEDS_CONFIRMATION = new Set(["rejected", "selected"]);

/**
 * Single route for every status change made from the board (table, kanban,
 * triage, bulk). It:
 *  - skips applicants already in the target status, so nothing is re-sent;
 *  - ignores an applicant while their previous change is still saving;
 *  - asks for confirmation (and an optional reason or message) before a
 *    rejection or selection, because those email the artist;
 *  - reverts the optimistic change if the server refuses it.
 */
export function useStatusChange({ apps, stages, onStatusChange }: Options) {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<PendingRequest | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const label = useCallback(
    (val: string) => stages.find((s) => s.val === val)?.label ?? val,
    [stages],
  );

  function showToast(text: string, tone: "ok" | "error") {
    clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const run = useCallback(
    async (ids: string[], status: string, reason?: string, message?: string) => {
      const targets = ids.filter((id) => !inFlight.current.has(id));
      if (targets.length === 0) return;

      targets.forEach((id) => inFlight.current.add(id));
      setPending(new Set(inFlight.current));

      let changed = 0;
      let failed = 0;
      const warnings = new Set<string>();
      let firstError: string | null = null;

      // One at a time: each call is cheap on its own, and the server treats
      // the status change as the single source of truth for what gets emailed.
      for (const id of targets) {
        const previous = apps.find((a) => a.id === id)?.status ?? "pending";
        onStatusChange(id, status);
        const result = await updateApplicationStatus(id, status as Status, reason, message);
        if (result.error) {
          onStatusChange(id, previous);
          failed++;
          firstError ??= result.error;
        } else {
          if (!result.unchanged) changed++;
          if (result.warning) warnings.add(result.warning);
        }
        inFlight.current.delete(id);
        setPending(new Set(inFlight.current));
      }

      if (failed > 0) {
        showToast(`${failed} could not be moved${firstError ? `: ${firstError}` : "."}`, "error");
      } else if (warnings.size > 0) {
        showToast([...warnings].join(" "), "error");
      } else if (changed > 0) {
        showToast(`${changed} moved to ${label(status)}. Artists aren't told until you send results.`, "ok");
      }
    },
    [apps, onStatusChange, label],
  );

  const request = useCallback(
    (ids: string[], status: string) => {
      let blockedReason: string | null = null;
      const eligible = ids.filter((id) => {
        const app = apps.find((a) => a.id === id);
        if (!app || app.status === status || inFlight.current.has(id)) return false;
        // A published result is final: say why, rather than letting the server refuse.
        const reason = transitionError(app.released_status ?? "pending", status);
        if (reason) { blockedReason ??= reason; return false; }
        return true;
      });
      if (eligible.length === 0) {
        if (blockedReason) showToast(blockedReason, "error");
        return;
      }
      if (NEEDS_CONFIRMATION.has(status)) {
        setNote("");
        setConfirming({ ids: eligible, status });
      } else {
        void run(eligible, status);
      }
    },
    [apps, run],
  );

  function confirm() {
    if (!confirming) return;
    const { ids, status } = confirming;
    const text = note.trim() || undefined;
    setConfirming(null);
    void run(ids, status, status === "rejected" ? text : undefined, status === "selected" ? text : undefined);
  }

  const isRejection = confirming?.status === "rejected";
  const count = confirming?.ids.length ?? 0;

  const dialog: ReactNode = (
    <>
      <AccessibleDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        labelledBy="decision-dialog-title"
        backdropClassName="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
        className="bg-background border border-black/10 shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div data-decision-dialog className="space-y-4">
          <h2 id="decision-dialog-title" className="text-lg font-semibold">
            {isRejection
              ? count === 1 ? "Mark this application as not selected?" : `Mark ${count} applications as not selected?`
              : count === 1 ? "Select this applicant?" : `Select ${count} applicants?`}
          </h2>
          <p className="text-base text-stone-600 leading-relaxed">
            {isRejection
              ? "This stays private. Nobody is emailed until you press Send results, and until then you can change your mind."
              : "This stays private. Nobody is emailed until you press Send results. The achievement is added to their Patronage profile only when you send."}
          </p>
          <label className="block space-y-1">
            <span className="text-base font-medium">
              {isRejection ? "Feedback for the artist (optional)" : "A personal message to them (optional)"}
            </span>
            <span className="block text-sm text-stone-600">It is sent with their result.</span>
            <textarea
              data-autofocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full text-base border border-black/30 px-3 py-2 resize-none focus:outline-none focus:border-black"
            />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={confirm} className="flex-1 text-base px-4 py-2 bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors">
              {isRejection ? "Mark as not selected" : "Select"}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className="flex-1 text-base px-4 py-2 border border-black/30 hover:border-black transition-colors">
              Go back
            </button>
          </div>
        </div>
      </AccessibleDialog>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[80] max-w-sm text-base px-5 py-3 text-brand-foreground ${toast.tone === "error" ? "bg-red-700" : "bg-brand"}`}
        >
          {toast.text}
        </div>
      )}
    </>
  );

  return { request, dialog, pending, dialogOpen: confirming !== null };
}
