"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  children?: React.ReactNode;
}

/**
 * Sticky mini-header for artist profiles. A zero-height sentinel marks the
 * mount point (directly after the action bar); once it scrolls behind the
 * 52px site header, a fixed bar with the artist's name + patron actions
 * slides in so Follow/Support never leave reach on a long profile.
 */
export function ProfileStickyBar({ name, children }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { rootMargin: "-56px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        aria-hidden={!show}
        className={`fixed inset-x-0 top-[52px] z-40 border-b border-border bg-background/95 backdrop-blur-lg transition-all duration-200 ${
          show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <span className="truncate text-sm font-semibold tracking-[-0.01em]">{name}</span>
          {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
        </div>
      </div>
    </>
  );
}
