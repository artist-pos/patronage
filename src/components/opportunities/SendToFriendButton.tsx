"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Link2, Send, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  opportunityId: string;
  title: string;
  /** Absolute canonical URL, no query string. */
  url: string;
  location?: string | null;
  type?: string | null;
  value?: string | null;
  deadline?: string | null;
  className?: string;
}

/**
 * "Send to a friend" — the share action aimed at a person, not a platform.
 *
 * Deliberately separate from the existing ShareTrigger, which generates a
 * social card for Instagram and the like. This one is for passing a listing to
 * someone who should apply for it, so both routes end in a human inbox.
 *
 * Anonymous visitors can use it; nothing here touches auth.
 */
export function SendToFriendButton({
  opportunityId,
  title,
  url,
  location,
  type,
  value,
  deadline,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click and on Escape, the way the rest of the app's
  // lightweight popovers behave.
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

  const mailto = (() => {
    const facts = [location, type, value].filter(Boolean).join(" · ");
    const body = [
      "I thought this might be up your alley.",
      "",
      title,
      ...(facts ? [facts] : []),
      ...(deadline ? [`Closes ${deadline}`] : []),
      "",
      shareUrl,
      "",
      "via Patronage",
    ].join("\n");
    return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  })();

  function handleEmail() {
    trackEvent("opportunity_send_to_friend_email", { opportunity_id: opportunityId });
    setHasShared(true);
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard blocked (insecure context, permissions). Fall back to a
      // selectable prompt rather than silently doing nothing.
      window.prompt("Copy this link", shareUrl);
    }
    trackEvent("opportunity_send_to_friend_copy_link", { opportunity_id: opportunityId });
    setCopied(true);
    setHasShared(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={
          className ??
          "inline-flex items-center gap-2 border border-border px-[22px] py-3 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
        }
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Send to a friend
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-[220px] border border-border bg-card shadow-[var(--shadow-md)]"
        >
          <a
            role="menuitem"
            href={mailto}
            onClick={handleEmail}
            className="flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-[color:var(--tint)]"
          >
            <Mail className="h-4 w-4 shrink-0 text-[color:var(--fg-muted)]" aria-hidden="true" />
            Email
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-sm transition-colors hover:bg-[color:var(--tint)]"
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-[color:var(--brand)]" aria-hidden="true" />
            ) : (
              <Link2 className="h-4 w-4 shrink-0 text-[color:var(--fg-muted)]" aria-hidden="true" />
            )}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}

      {/* Subtle nudge once they have sent one. Text only, never a modal. */}
      <p
        aria-live="polite"
        className={`mt-1.5 font-mono text-[11px] text-[color:var(--fg-subtle)] transition-opacity ${
          hasShared ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {copied ? "link copied. know someone else?" : hasShared ? "know someone else?" : " "}
      </p>
    </div>
  );
}
