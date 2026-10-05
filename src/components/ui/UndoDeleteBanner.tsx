"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  /** What is being deleted, e.g. "Untitled" or the work's title */
  itemLabel: string;
  /** Seconds before the delete is finalised */
  duration?: number;
  /** Called when the countdown finishes — perform the actual deletion */
  onConfirm: () => void;
  /** Called if the user clicks Undo */
  onUndo: () => void;
}

/**
 * A banner that gives the user a grace period to undo a destructive action.
 * The real deletion happens only after the countdown expires.
 */
export function UndoDeleteBanner({
  itemLabel,
  duration = 30,
  onConfirm,
  onUndo,
}: Props) {
  const [remaining, setRemaining] = useState(duration);
  const confirmedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!confirmedRef.current) {
            confirmedRef.current = true;
            onConfirm();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onConfirm, duration]);

  function handleUndo() {
    confirmedRef.current = true;
    onUndo();
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 border border-stone-300 bg-stone-50 px-4 py-3 rounded-lg"
    >
      <div className="flex items-center gap-2 text-sm text-stone-700 min-w-0">
        <span className="shrink-0">
          &ldquo;{itemLabel}&rdquo; will be permanently deleted in{" "}
          <span className="font-mono tabular-nums">{remaining}s</span>.
        </span>
      </div>
      <button
        type="button"
        onClick={handleUndo}
        className="shrink-0 px-4 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}
