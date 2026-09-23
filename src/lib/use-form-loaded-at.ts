"use client";

import { useRef } from "react";

/** Captures the timestamp the form mounted, for the server's isSubmittedTooFast check. */
export function useFormLoadedAt(): number {
  return useRef(Date.now()).current;
}
