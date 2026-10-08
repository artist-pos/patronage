"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Id of the element that names the dialog. */
  labelledBy: string;
  children: ReactNode;
  /** Tailwind classes for the panel (width, padding). */
  className?: string;
  /** Tailwind classes for the backdrop. */
  backdropClassName?: string;
  /** Close when the backdrop is clicked. Off for dialogs that guard a decision. */
  closeOnBackdrop?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal that behaves: focus moves in when it opens, Tab stays inside, Escape
 * closes it, and focus returns to what opened it. Screen readers get role=dialog.
 */
export function AccessibleDialog({
  open,
  onClose,
  labelledBy,
  children,
  className = "bg-background w-full max-w-md p-6 space-y-4 border border-black/10 shadow-xl",
  backdropClassName = "fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4",
  closeOnBackdrop = true,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={`ams-comfort ${backdropClassName}`} onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
