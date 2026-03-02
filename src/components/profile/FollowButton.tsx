"use client";

import { useState, useTransition } from "react";
import { followArtist, unfollowArtist } from "@/actions/follows";

interface Props {
  followingId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ followingId, initialIsFollowing }: Props) {
  const [following, setFollowing] = useState(initialIsFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (following) {
        await unfollowArtist(followingId);
      } else {
        await followArtist(followingId);
      }
      setFollowing((f) => !f);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`px-4 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        following
          ? "bg-white text-black border border-black hover:bg-muted/50"
          : "bg-black text-white hover:opacity-80"
      }`}
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
