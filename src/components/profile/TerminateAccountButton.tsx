"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { terminateAccountAction } from "@/app/profile/terminate/actions";

const REASONS = [
  "I was just exploring",
  "I found it hard to use",
  "It wasn't what I expected",
  "I didn't find relevant opportunities",
  "I'll be back later",
  "Other",
];

const DETAILS_MAX = 500;

export function TerminateAccountButton() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  async function terminate(includeSurvey: boolean) {
    setIsPending(true);
    setError(null);
    const result = await terminateAccountAction(
      includeSurvey && reason ? { reason, details: details.trim() || null } : undefined
    );
    // On success the server redirects to "/". Only reached on error.
    if (result?.error) {
      setError(result.error);
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
          if (!next) {
            setReason(null);
            setDetails("");
            setError(null);
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="border-black text-destructive hover:bg-destructive/5"
          >
            Terminate Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border border-black max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Before you go</AlertDialogTitle>
            <AlertDialogDescription>
              Closing your account permanently deletes your profile and all
              uploaded images. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* ── Optional exit survey ── */}
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Would you mind sharing why you&apos;re leaving?
              </p>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2.5 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="termination-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      disabled={isPending}
                      className="accent-black"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="termination-details" className="text-sm font-medium">
                  Anything else you&apos;d like us to know?
                </label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {details.length}/{DETAILS_MAX}
                </span>
              </div>
              <textarea
                id="termination-details"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, DETAILS_MAX))}
                disabled={isPending}
                rows={3}
                placeholder="Optional"
                className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="border-black" disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              onClick={() => terminate(false)}
              disabled={isPending}
              className="text-sm px-4 py-2 border border-border hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {isPending ? "Closing…" : "Skip and close account"}
            </button>
            <button
              type="button"
              onClick={() => terminate(true)}
              disabled={isPending || !reason}
              className="text-sm px-4 py-2 bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-40"
            >
              {isPending ? "Closing…" : "Submit and close account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && !open && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
