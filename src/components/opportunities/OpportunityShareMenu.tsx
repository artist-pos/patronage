"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ImageIcon, Link2, Send } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { SharePayload } from "@/types/share";

const ShareSheet = dynamic(() => import("@/components/share/ShareSheet").then((m) => ({ default: m.ShareSheet })), {
  ssr: false,
});

interface Props {
  opportunityId: string;
  title: string;
  /** Absolute canonical URL, no query string. */
  url: string;
  location?: string | null;
  type?: string | null;
  value?: string | null;
  deadline?: string | null;
  /** Payload for the Instagram story/post card generator. */
  payload: SharePayload;
  className?: string;
}

// The device share sheet (Messages, WhatsApp, DMs, AirDrop…). Absent in some
// desktop browsers, notably Firefox, where "Send" is simply not offered.
const noop = () => () => {};
const canNativeShare = () => typeof navigator.share === "function";

/**
 * "Send to a friend": one control for passing an opportunity on. Person-to-
 * person routes come first (the device share sheet, then copy link), since
 * sending a listing to someone who should apply is the common case; the
 * Instagram card generator is the last item.
 *
 * Keeps the send-to-friend analytics events so the funnel stays comparable.
 */
export function OpportunityShareMenu({
  opportunityId,
  title,
  url,
  location,
  type,
  value,
  deadline,
  payload,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Server snapshot false: the item appears after hydration where supported.
  const nativeShare = useSyncExternalStore(noop, canNativeShare, () => false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shareUrl = `${url}?ref=share`;

  async function handleSend() {
    setOpen(false);
    const facts = [location, type, value].filter(Boolean).join(" · ");
    const text = [title, ...(facts ? [facts] : []), ...(deadline ? [`Closes ${deadline}`] : [])].join("\n");
    try {
      await navigator.share({ title, text, url: shareUrl });
      trackEvent("opportunity_send_to_friend_native", { opportunity_id: opportunityId });
    } catch {
      // Cancelled (AbortError) or refused — nothing to do.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard blocked (insecure context, permissions): a selectable prompt
      // rather than silently doing nothing.
      window.prompt("Copy this link", shareUrl);
    }
    trackEvent("opportunity_send_to_friend_copy_link", { opportunity_id: opportunityId });
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const item = "flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors hover:bg-[color:var(--tint)]";

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          if (!open) trackEvent("opportunity_share_menu_open", { opportunity_id: opportunityId });
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        className={className}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        <span className="max-sm:sr-only">{copied ? "Link copied" : "Send to a friend"}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-[230px] border border-border bg-card shadow-[var(--shadow-md)]">
          {nativeShare && (
            <button role="menuitem" type="button" onClick={handleSend} className={item}>
              <Send className="h-4 w-4 shrink-0 text-[color:var(--fg-muted)]" aria-hidden />
              Send
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              handleCopy();
              setOpen(false);
            }}
            className={`${item} ${nativeShare ? "border-t border-border" : ""}`}
          >
            <Link2 className="h-4 w-4 shrink-0 text-[color:var(--fg-muted)]" aria-hidden />
            Copy link
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              trackEvent("opportunity_share_card_open", { opportunity_id: opportunityId });
              setOpen(false);
              setSheet(true);
            }}
            className={`${item} border-t border-border`}
          >
            <ImageIcon className="h-4 w-4 shrink-0 text-[color:var(--fg-muted)]" aria-hidden />
            Make a story or post
          </button>
        </div>
      )}

      {sheet && <ShareSheet payload={payload} onClose={() => setSheet(false)} />}
    </div>
  );
}
