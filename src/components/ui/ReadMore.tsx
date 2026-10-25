"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Lines shown before the "Read more" toggle appears. */
  lines?: number;
  className?: string;
}

export function ReadMore({ children, lines = 6, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (expanded) return;
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, children]);

  return (
    <div>
      <div
        ref={ref}
        className={className}
        style={
          expanded
            ? undefined
            : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }
        }
      >
        {children}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 font-mono text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
