"use client";

import { Fragment, type KeyboardEvent, type MouseEvent } from "react";
import { linkify } from "@/lib/linkify";

interface Props {
  text: string;
  /**
   * Set when the text sits inside another link (a feed card). Anchors can't nest,
   * so links become keyboard-reachable spans that open on click without
   * triggering the card around them.
   */
  inert?: boolean;
  className?: string;
}

const LINK_CLASS = "underline underline-offset-2 decoration-current/40 hover:decoration-current break-words";

/** Plain text with its links made clickable, shown shortened like X does. */
export function LinkifiedText({ text, inert = false, className }: Props) {
  const segments = linkify(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <Fragment key={i}>{seg.text}</Fragment>;

        if (!inert) {
          return (
            <a
              key={i}
              href={seg.href}
              title={seg.text}
              {...(seg.internal ? {} : { target: "_blank", rel: "noopener noreferrer nofollow ugc" })}
              className={className ?? LINK_CLASS}
            >
              {seg.display}
            </a>
          );
        }

        const open = (e: MouseEvent | KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (seg.internal) window.location.assign(seg.href);
          else window.open(seg.href, "_blank", "noopener,noreferrer");
        };
        return (
          <span
            key={i}
            role="link"
            tabIndex={0}
            title={seg.text}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key === "Enter") open(e);
            }}
            className={`cursor-pointer ${className ?? LINK_CLASS}`}
          >
            {seg.display}
          </span>
        );
      })}
    </>
  );
}
