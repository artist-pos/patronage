"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSubmission, rejectSubmission, requestPipelineFee } from "./actions";
import { REJECTION_REASONS } from "@/lib/listing-rejection";

interface Props {
  id: string;
  /** An open call that has neither paid nor had its fee waived. */
  needsFee?: boolean;
  /** Why it can't be approved yet, e.g. missing outreach details. */
  blockedReason?: string | null;
  onEdit?: () => void;
  editing?: boolean;
}

const PRIMARY = "rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-40";
const SECONDARY = "rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs transition-colors hover:border-black disabled:opacity-40";

export function SubmissionActions({ id, needsFee = false, blockedReason = null, onEdit, editing = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonKeys, setReasonKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  function act(fn: () => Promise<{ error?: string } | void>, done?: string) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && result.error) { setError(result.error); return; }
        if (done) setNote(done);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (rejecting) {
    const canSend = reasonKeys.length > 0 || reason.trim().length > 0;
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-stone-50 p-3 sm:w-80 sm:shrink-0">
        <p className="text-xs font-medium">Reasons (sent to the organiser)</p>
        <div className="flex flex-col gap-1.5">
          {REJECTION_REASONS.map((r) => (
            <label key={r.key} className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={reasonKeys.includes(r.key)}
                onChange={() =>
                  setReasonKeys((prev) => (prev.includes(r.key) ? prev.filter((k) => k !== r.key) : [...prev, r.key]))
                }
              />
              <span>
                {r.label}
                {r.terms && <span className="text-muted-foreground"> (Terms §10)</span>}
              </span>
            </label>
          ))}
        </div>
        <label className="text-xs font-medium" htmlFor={`reject-reason-${id}`}>
          Your own message (optional)
        </label>
        <textarea
          id={`reject-reason-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-black focus:outline-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button disabled={isPending || !canSend} className={PRIMARY}
            onClick={() => act(() => rejectSubmission(id, { reasonKeys, message: reason }))}>
            {isPending ? "Rejecting…" : "Confirm reject"}
          </button>
          <button disabled={isPending} className={SECONDARY} onClick={() => setRejecting(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end sm:shrink-0">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {needsFee ? (
          <>
            <button disabled={isPending || !!blockedReason} title={blockedReason ?? undefined} className={PRIMARY}
              onClick={() => act(() => approveSubmission(id, { waiveFee: true }))}>
              {isPending ? "Working…" : "Approve, fee waived"}
            </button>
            <button disabled={isPending} className={SECONDARY}
              onClick={() => act(() => requestPipelineFee(id), "Fee request sent. It stays here until they pay.")}>
              Request $200 fee
            </button>
          </>
        ) : (
          <button disabled={isPending || !!blockedReason} title={blockedReason ?? undefined} className={PRIMARY}
            onClick={() => act(() => approveSubmission(id))}>
            {isPending ? "Approving…" : "Approve"}
          </button>
        )}
        {onEdit && (
          <button disabled={isPending} className={SECONDARY} onClick={onEdit}>
            {editing ? "Close editor" : "Edit"}
          </button>
        )}
        <button disabled={isPending} className={SECONDARY} onClick={() => setRejecting(true)}>
          Reject
        </button>
      </div>
      {note && <p className="max-w-xs text-xs text-emerald-700 sm:text-right">{note}</p>}
      {error && <p className="max-w-xs text-xs text-red-600 sm:text-right">{error}</p>}
    </div>
  );
}
