"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Share2 } from "lucide-react";
import type { SharePayload } from "@/types/share";

const ShareSheet = dynamic(() => import("./ShareSheet").then(m => ({ default: m.ShareSheet })), { ssr: false });

interface Props {
  payload: SharePayload;
  /** visual variant: 'icon' for icon-only, 'button' for labelled button */
  variant?: "icon" | "button";
  className?: string;
}

export function ShareTrigger({ payload, variant = "icon", className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          aria-label="Share"
          className={className ?? "w-11 h-11 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"}
        >
          <Share2 className="w-4 h-4 text-stone-500" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className={className ?? "flex items-center gap-1.5 text-sm border border-border px-3 py-2 min-h-[44px] hover:bg-muted transition-colors"}
        >
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Share</span>
        </button>
      )}

      {open && <ShareSheet payload={payload} onClose={() => setOpen(false)} />}
    </>
  );
}
