"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSubmission, rejectSubmission, requestPipelineFee } from "./actions";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  /** An open call that has neither paid nor had its fee waived. */
  needsFee?: boolean;
}

export function SubmissionActions({ id, needsFee = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  function act(fn: () => Promise<void>, done?: string) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      try {
        await fn();
        if (done) setNote(done);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2 w-72 shrink-0">
        <label className="text-xs font-medium" htmlFor={`reject-reason-${id}`}>
          Reason (sent to the organiser, optional)
        </label>
        <textarea
          id={`reject-reason-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full text-sm border border-black px-2 py-1.5 resize-none focus:outline-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending} className="text-xs h-7 px-3 bg-black text-white hover:bg-black/80"
            onClick={() => act(() => rejectSubmission(id, reason))}>
            {isPending ? "Rejecting…" : "Confirm reject"}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} className="text-xs h-7 px-3 border-black" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <div className="flex flex-wrap justify-end gap-2">
        {needsFee ? (
          <>
            <Button size="sm" disabled={isPending} className="text-xs h-7 px-3 bg-black text-white hover:bg-black/80"
              onClick={() => act(() => approveSubmission(id, { waiveFee: true }))}>
              {isPending ? "Working…" : "Approve, fee waived"}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} className="text-xs h-7 px-3 border-black"
              onClick={() => act(() => requestPipelineFee(id), "Fee request sent. It stays here until they pay.")}>
              Request $200 fee
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={isPending} className="text-xs h-7 px-3 bg-black text-white hover:bg-black/80"
            onClick={() => act(() => approveSubmission(id))}>
            {isPending ? "Approving…" : "Approve"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={isPending} className="text-xs h-7 px-3 border-black" onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      {note && <p className="text-xs text-emerald-700 max-w-xs text-right">{note}</p>}
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
