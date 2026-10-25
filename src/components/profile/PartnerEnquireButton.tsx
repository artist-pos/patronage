"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestPartnerIntroduction } from "@/app/partners/actions";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";
import { trackEvent } from "@/lib/analytics";
import { MessageButton } from "@/components/profile/MessageButton";

const SOLID =
  "inline-flex h-9 items-center bg-foreground text-background px-5 text-[13px] font-medium hover:opacity-85 transition-opacity";

interface Props {
  profileId: string;
  username: string;
  displayName: string;
  /** "member" opens a DM, "signed_out" goes to signup and back, "unclaimed" emails Patronage. */
  mode: "member" | "signed_out" | "unclaimed";
}

/**
 * "Enquire about a programme" on a partner page. What it does depends on who
 * is asking and whether anyone is home: a claimed partner gets a DM, a
 * signed-out visitor is sent to signup and returned here, and an unclaimed
 * (shadow) partner has no one to read a DM, so the request goes to Patronage.
 */
export function PartnerEnquireButton({ profileId, username, displayName, mode }: Props) {
  const track = (surface: string) =>
    trackEvent("partner_enquire_click", { profile_id: profileId, username, mode: surface });

  if (mode === "member") {
    return (
      <span onClickCapture={() => track("member")}>
        <MessageButton otherUserId={profileId} label="Enquire about a programme" variant="solid" />
      </span>
    );
  }

  if (mode === "signed_out") {
    return (
      <Link
        href={`/auth/signup?next=${encodeURIComponent(`/${username}`)}`}
        onClick={() => track("signed_out")}
        className={SOLID}
      >
        Enquire about a programme
      </Link>
    );
  }

  return (
    <>
      <RequestDialogButton
        kind="introduction"
        label="Enquire about a programme"
        className={SOLID}
        profileId={profileId}
        username={username}
        displayName={displayName}
        onOpen={() => track("unclaimed")}
      />
    </>
  );
}

/** "Is this your organisation? Claim this page" — shown on unclaimed partner pages. */
export function PartnerClaimPrompt({
  profileId,
  username,
  displayName,
}: Omit<Props, "mode">) {
  return (
    <p className="text-sm text-muted-foreground">
      Is this your organisation?{" "}
      <RequestDialogButton
        kind="claim"
        label="Claim this page"
        className="font-medium text-foreground underline underline-offset-2 hover:opacity-70"
        profileId={profileId}
        username={username}
        displayName={displayName}
        onOpen={() => trackEvent("partner_claim_click", { profile_id: profileId, username })}
      />
    </p>
  );
}

function RequestDialogButton({
  kind,
  label,
  className,
  profileId,
  username,
  displayName,
  onOpen,
}: Omit<Props, "mode"> & {
  kind: "introduction" | "claim";
  label: string;
  className: string;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isClaim = kind === "claim";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const loadedAt = useFormLoadedAt();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
    const result = await requestPartnerIntroduction({
      profileId, name, email, message, kind, turnstileToken, loadedAt, [HONEYPOT_FIELD]: honeypot,
    });
    setSending(false);
    if (result.error) { setError(result.error); return; }
    trackEvent(isClaim ? "partner_claim_requested" : "partner_introduction_requested", {
      profile_id: profileId,
      username,
    });
    setSent(true);
  }

  const field =
    "w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground";

  return (
    <>
      <button
        type="button"
        onClick={() => { onOpen(); setOpen(true); }}
        className={className}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isClaim ? `Claim ${displayName}` : `Request an introduction to ${displayName}`}
            </DialogTitle>
          </DialogHeader>

          {sent ? (
            <p className="pt-1 text-sm text-muted-foreground">
              {isClaim
                ? "Thanks — we'll check your details and email you a link to take over the page, usually within 48 hours."
                : `Thanks — we'll introduce you to ${displayName}. You'll hear from us by email, usually within 48 hours.`}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                {isClaim
                  ? `Tell us who you are and how you're connected to ${displayName}. Use your work email if you can, so we can confirm it quickly.`
                  : `${displayName} hasn't joined Patronage yet. Tell us what you're hoping to ask and we'll pass it on.`}
              </p>
              <div className="space-y-1">
                <label htmlFor="intro-name" className="text-xs font-medium">Name *</label>
                <input id="intro-name" value={name} onChange={(e) => setName(e.target.value)} required className={field} />
              </div>
              <div className="space-y-1">
                <label htmlFor="intro-email" className="text-xs font-medium">Email *</label>
                <input id="intro-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} />
              </div>
              <div className="space-y-1">
                <label htmlFor="intro-message" className="text-xs font-medium">
                  {isClaim ? "Your role at the organisation *" : "Your question *"}
                </label>
                <textarea
                  id="intro-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={3}
                  className={`${field} resize-none overflow-hidden`}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
                />
              </div>

              <HoneypotField />
              <TurnstileWidget onVerify={setTurnstileToken} />

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="border border-border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {sending ? "Sending…" : isClaim ? "Request to claim" : "Request introduction"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
