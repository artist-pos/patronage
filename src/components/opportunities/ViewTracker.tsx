"use client";

import { useEffect } from "react";

interface Props {
  opportunityId: string;
}

export function ViewTracker({ opportunityId }: Props) {
  useEffect(() => {
    // Defer the analytics call until the browser is idle so it doesn't compete
    // with hydration and first-interaction setup (INP)
    const fire = () => fetch(`/api/opportunities/${opportunityId}/view`, { method: "POST" }).catch(() => {});
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(fire, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(fire, 1000);
    return () => clearTimeout(t);
  }, [opportunityId]);

  return null;
}
