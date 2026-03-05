"use client";

import { useEffect } from "react";

interface Props {
  opportunityId: string;
}

export function ViewTracker({ opportunityId }: Props) {
  useEffect(() => {
    // Fire-and-forget view increment
    fetch(`/api/opportunities/${opportunityId}/view`, { method: "POST" }).catch(() => {});
  }, [opportunityId]);

  return null;
}
