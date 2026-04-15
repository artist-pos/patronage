"use client";

import { useEffect } from "react";
import { trackClaimOpen } from "@/app/admin/opportunities/claim-actions";

export function TrackClaimOpen({ token }: { token: string }) {
  useEffect(() => {
    trackClaimOpen(token).catch(() => {});
  }, [token]);
  return null;
}
