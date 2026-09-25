"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  url: string;
}

/** The organisation's open onboarding link, one click to copy. */
export function OrgJoinLink({ url }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure context, permissions). The link is
      // selectable text, so they can still copy it by hand.
      return;
    }
    setCopied(true);
    trackEvent("org_link_copied");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="flex max-w-xl items-stretch border border-border bg-card">
      <input
        readOnly
        value={url}
        aria-label="Your onboarding link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 font-mono text-[13px] outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="flex shrink-0 items-center gap-1.5 border-l border-border px-4 text-sm font-medium transition-colors hover:bg-muted/50"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
