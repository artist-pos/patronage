"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  profileId: string;
  username: string;
  isOwner: boolean;
  role?: string | null;
  /** True for an unclaimed profile — lets PostHog split shadow from live pages. */
  unclaimed?: boolean;
}

export function ProfileViewLogger({ profileId, username, isOwner, role, unclaimed }: Props) {
  useEffect(() => {
    if (!isOwner) {
      trackEvent("profile_view", {
        profile_id: profileId,
        username,
        profile_role: role ?? "",
        unclaimed: unclaimed ? "true" : "false",
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
