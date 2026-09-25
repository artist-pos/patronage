"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const ROTATE_MS = 3200;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

interface Props {
  prefix: string;
  phrases: string[];
}

// "Find ⟨an opportunity. / an artist. / your audience.⟩" — the prefix holds
// still while the object rolls upward out of a clipped line and the next rises
// in. Deliberately a different motion (and a slower beat) from RotatingHandle's
// in-place fade, so the two never pulse together.
//
// Every phrase sits in the same grid cell, so the slot is always as wide as the
// longest one and nothing around it moves. Server, no-JS and reduced motion all
// show the first phrase, still. Screen readers get one plain sentence.
export function RollingHeadline({ prefix, phrases }: Props) {
  const [index, setIndex] = useState(0);
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true
  );

  useEffect(() => {
    if (reduced || phrases.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced, phrases.length]);

  const spoken = `${prefix} ${phrases
    .map((p) => p.replace(/\.$/, ""))
    .join(", ")
    .replace(/, ([^,]*)$/, ", or $1")}.`;

  return (
    <>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden>
        {prefix}{" "}
        {/* Padding + negative margin give descenders room inside the clip. */}
        <span className="-mb-[0.14em] inline-grid overflow-hidden pb-[0.14em] align-bottom">
          {phrases.map((p, i) => {
            const prev = (index - 1 + phrases.length) % phrases.length;
            const state = i === index ? "in" : i === prev ? "out" : "wait";
            return (
              <span
                key={p}
                className={`whitespace-nowrap [grid-area:1/1] ${
                  state === "in"
                    ? "translate-y-0 opacity-100"
                    : state === "out"
                      ? "-translate-y-full opacity-0"
                      : "translate-y-full opacity-0"
                } ${
                  // Only the two phrases on screen animate; a waiting phrase
                  // snaps back below without being seen.
                  state === "wait" || reduced
                    ? "transition-none"
                    : "transition-[transform,opacity] duration-[650ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                }`}
              >
                {p}
              </span>
            );
          })}
        </span>
      </span>
    </>
  );
}
