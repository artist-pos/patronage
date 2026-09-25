"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const ROTATE_MS = 2200;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// The handle in "patronage.nz/⟨handle⟩", cycling through real verified artists
// so the URL reads as something people actually have. The first handle is what
// renders on the server, with reduced motion, and without JS. Natural width:
// the caller puts it last on its own line, so nothing follows it and nothing
// can be pushed around as the length changes.
export function RotatingHandle({ handles }: { handles: string[] }) {
  const [index, setIndex] = useState(0);
  // Server snapshot is "reduced" so the first paint is the still, first handle.
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true
  );

  useEffect(() => {
    if (reduced || handles.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % handles.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced, handles.length]);

  if (handles.length === 0) return <>yourname</>;

  return (
    <span key={index} className="inline-block animate-[pin-in_400ms_ease]" aria-live="off">
      {handles[index % handles.length]}
    </span>
  );
}
