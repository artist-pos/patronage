"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/app/messages/actions";

export function FollowerMessageButton({ followerId }: { followerId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await getOrCreateConversation(followerId);
      if ("id" in result) router.push(`/messages/${result.id}`);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="Message this follower"
      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 shrink-0"
    >
      {isPending ? (
        <span className="block w-4 h-4 border border-current rounded-full border-t-transparent animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
        </svg>
      )}
    </button>
  );
}
