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
      className="border border-black px-4 py-1.5 text-xs hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
