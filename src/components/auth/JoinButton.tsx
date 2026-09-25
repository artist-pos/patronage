"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { JoinCity } from "@/components/auth/JoinModal";

// The popup (AuthForm, pickers, city search) loads only when someone taps.
const JoinModal = dynamic(() => import("@/components/auth/JoinModal"), { ssr: false });

interface Props {
  cities: JoinCity[];
  /** Attribution for the signup context, e.g. "explore_feed_band". */
  source: string;
  className?: string;
  children: React.ReactNode;
}

/** A button that opens the three-step join popup in place. */
export function JoinButton({ cities, source, className, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <JoinModal cities={cities} source={source} onClose={() => setOpen(false)} />}
    </>
  );
}
