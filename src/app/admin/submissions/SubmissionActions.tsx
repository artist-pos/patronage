"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSubmission, rejectSubmission } from "./actions";
import { Button } from "@/components/ui/button";

export function SubmissionActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        size="sm"
        disabled={isPending}
        className="text-xs h-7 px-3 bg-black text-white hover:bg-black/80"
        onClick={() => act(() => approveSubmission(id))}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        className="text-xs h-7 px-3 border-black"
        onClick={() => act(() => rejectSubmission(id))}
      >
        Reject
      </Button>
    </div>
  );
}
