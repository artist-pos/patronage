"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/app/messages/actions";

export function FollowerMessageButton({ followerId, followerName }: { followerId: string; followerName?: string }) {
  const [isPending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(false);
  const router = useRouter();

  const displayName = followerName || "this user";

  function handleClick() {
    setBlocked(false);
    startTransition(async () => {
      const result = await getOrCreateConversation(followerId);
      if ("id" in result) {
        router.push(`/messages/${result.id}`);
      } else if ("error" in result && result.error === "not_following") {
        setBlocked(true);
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isPending}
        aria-label={blocked ? `Cannot message ${displayName}` : "Message this follower"}
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
      {blocked && (
        <p className="absolute right-0 top-full mt-1 w-56 rounded-md bg-stone-100 px-3 py-2 text-[11px] text-muted-foreground shadow-sm z-10">
          Message {displayName} once they follow you, or save/apply to their opportunities.
        </p>
      )}
    </div>
  );
}
