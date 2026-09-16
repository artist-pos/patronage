"use client";

import { useEffect, useState } from "react";

// Second line only — "Find" stays put so the headline has one stable
// anchor and swapping the noun never shifts line count or line-height.
const PHRASES = ["an opportunity.", "an artist.", "your audience."];

const ROTATE_MS = 2800;

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPaused(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPaused(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <span className="relative block">
      <span key={index} aria-hidden="true" className="block animate-[pin-in_500ms_ease]">
        {PHRASES[index]}
      </span>
      {/* Screen readers get the full set once, statically — the visual
          rotation is decorative, not the only way this information is conveyed. */}
      <span className="sr-only">
        Find an opportunity, find an artist, or find your audience.
      </span>
    </span>
  );
}
