"use client";

import { useCallback, useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  /** Height the box never shrinks below, in rows. */
  minRows?: number;
};

/**
 * A textarea that grows to fit what's in it, so a long answer stays readable in
 * full instead of scrolling inside a fixed window.
 *
 * It deliberately never scrolls internally — the surrounding form is the only
 * scroll container. Nested scrollbars are the thing that hides half of what
 * someone has written from them.
 */
export function AutoGrowTextarea({ minRows = 4, className = "", value, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // The rows-based height, measured once before we ever set an explicit one.
  const minHeight = useRef<number | null>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    if (minHeight.current === null) minHeight.current = el.offsetHeight;

    // scrollHeight only shrinks once the box is smaller than its content, so
    // collapse before measuring.
    el.style.height = "auto";

    // Tailwind's preflight makes this border-box, where style.height includes
    // the border but scrollHeight doesn't — without this the box sits a couple
    // of pixels short and clips the last line.
    const cs = getComputedStyle(el);
    const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

    el.style.height = `${Math.max(el.scrollHeight + borderY, minHeight.current)}px`;
  }, []);

  // Refit on every value change — typing, a restored draft, or a reset.
  useEffect(fit, [fit, value]);

  // A width change (rotation, resize) reflows the text and changes the height.
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
