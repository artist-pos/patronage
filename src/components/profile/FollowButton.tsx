"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { followArtist, unfollowArtist } from "@/actions/follows";

interface Props {
  followingId: string;
  initialIsFollowing: boolean;
  /** When false, clicking routes to login instead of toggling */
  isAuthenticated?: boolean;
  /** "inline" sits beside a name (an opportunity's organiser) rather than in an action bar. */
  variant?: "default" | "inline";
}

export function FollowButton({ followingId, initialIsFollowing, isAuthenticated = true, variant = "default" }: Props) {
  const [following, setFollowing] = useState(initialIsFollowing);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    startTransition(async () => {
      if (following) {
        await unfollowArtist(followingId);
      } else {
        await followArtist(followingId);
      }
      setFollowing((f) => !f);
    });
  }

  if (variant === "inline") {
    return (
      <button
        onClick={toggle}
        disabled={pending}
        className={`inline-flex h-7 items-center border px-2.5 font-mono text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          following
            ? "border-border text-[color:var(--fg-muted)] hover:border-foreground hover:text-foreground"
            : "border-foreground text-foreground hover:bg-foreground hover:text-background"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`inline-flex h-9 items-center px-5 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        following
          ? "bg-white text-black border border-black hover:bg-muted/50"
          : "bg-black text-white hover:opacity-80"
      }`}
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
