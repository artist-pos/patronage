"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { track } from "@vercel/analytics";
import { trackEvent } from "@/actions/trackEvent";

// ── Structured description renderer ───────────────────────────────────────────

/** Lines matching these patterns are rendered as bold section headings */
const HEADING_RE = /^(#{1,3}\s+.+|.{3,60}:\s*$|[A-Z][A-Za-z /&'-]{2,50}:)$/;

/** Render inline **bold** and _italic_ markdown tokens */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|_[^_\n]+_)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        if (part.startsWith("_") && part.endsWith("_"))
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        return part;
      })}
    </>
  );
}

export function StructuredDescription({ text }: { text: string }) {
  if (!text?.trim()) return null;

  // Split on every newline — each line is its own visual block so a single
  // Enter in the textarea creates visible spacing between sections.
  const lines = text.split("\n");

  // Group consecutive bullet lines into a single <ul> block.
  type Block =
    | { type: "heading"; text: string }
    | { type: "bullet"; items: string[] }
    | { type: "text"; text: string }
    | { type: "spacer" };

  const blocks: Block[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length) {
      blocks.push({ type: "bullet", items: [...bulletBuffer] });
      bulletBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      // Blank lines become spacers only if last block isn't already a spacer
      if (blocks.length && blocks[blocks.length - 1].type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bulletBuffer.push(line.replace(/^[-*] /, ""));
      continue;
    }
    flushBullets();
    if (HEADING_RE.test(line)) {
      blocks.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "").replace(/:$/, "") });
    } else {
      blocks.push({ type: "text", text: line });
    }
  }
  flushBullets();

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "spacer") return <div key={i} className="h-1" />;
        if (block.type === "heading") return (
          <p key={i} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-1">
            {block.text}
          </p>
        );
        if (block.type === "bullet") return (
          <ul key={i} className="list-disc pl-4 space-y-0.5">
            {block.items.map((item, j) => (
              <li key={j} className="text-xs text-foreground leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
        return (
          <p key={i} className="text-xs text-foreground leading-relaxed">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  fullDescription: string | null;
  opportunityId?: string;
  title?: string;
  organiser?: string;
}

export function DescriptionAccordion({ fullDescription, opportunityId, title, organiser }: Props) {
  const [open, setOpen] = useState(false);

  if (!fullDescription?.trim()) return null;

  function handleOpen() {
    setOpen(true);
    if (opportunityId) {
      track("read_more", { title: title ?? "", organiser: organiser ?? "" });
      trackEvent("opportunity_engagement", {
        opportunity_id: opportunityId,
        title: title ?? "",
        organiser: organiser ?? "",
      });
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Read more — only shown when collapsed */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Read more</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {/* Smooth CSS grid accordion — no CLS (user-interaction triggered) */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pt-0.5 pb-1">
            <StructuredDescription text={fullDescription} />
            {/* Read less — at the bottom of the expanded box */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Read less</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
