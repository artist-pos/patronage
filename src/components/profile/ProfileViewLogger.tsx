"use client";

import { useEffect } from "react";
import { trackEvent } from "@/actions/trackEvent";

interface Props {
  profileId: string;
  username: string;
  isOwner: boolean;
}

export function ProfileViewLogger({ profileId, username, isOwner }: Props) {
  useEffect(() => {
    if (!isOwner) {
      trackEvent("profile_view", { profile_id: profileId, username });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
