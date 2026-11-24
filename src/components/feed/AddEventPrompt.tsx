"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { JoinCity } from "@/components/auth/JoinModal";
import { submitEventTip } from "@/actions/event-tip";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";

const JoinModal = dynamic(() => import("@/components/auth/JoinModal"), { ssr: false });
const CAPTCHA_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const FIELD =
  "w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-foreground focus:outline-none placeholder:text-[color:var(--fg-subtle)]";
const LABEL = "t-section-label block";

interface Props {
  label: string;
  className: string;
  /** For the join popup. Empty when the viewer is signed in. */
  cities: JoinCity[];
  /** Signed-in people who can't post events themselves (under 18) only get the tip form. */
  canJoin: boolean;
}

/**
 * "Add an event" for anyone who can't post one as a studio update: signed out,
 * or an account that can't post events. They choose between joining (and
 * posting it themselves) or leaving a community tip that we add by hand.
 */
export function AddEventPrompt({ label, className, cities, canJoin }: Props) {
  const [stage, setStage] = useState<"closed" | "choose" | "tip" | "join">("closed");
  const close = () => setStage("closed");

  useEffect(() => {
    if (stage === "closed" || stage === "join") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [stage]);

  return (
    <>
      <button type="button" onClick={() => setStage(canJoin ? "choose" : "tip")} className={className}>
        {label}
      </button>

      {stage === "join" && <JoinModal cities={cities} source="explore_add_event" onClose={close} />}

      {(stage === "choose" || stage === "tip") &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add an event"
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[92vh] w-full overflow-y-auto border border-border bg-background p-5 shadow-lg sm:max-w-md sm:p-6"
            >
              <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-2 p-2.5 text-[color:var(--fg-muted)] transition-colors hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              {stage === "choose" ? (
                <Choose onJoin={() => setStage("join")} onTip={() => setStage("tip")} />
              ) : (
                <TipForm onDone={close} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Choose({ onJoin, onTip }: { onJoin: () => void; onTip: () => void }) {
  return (
    <div>
      <h2 className="t-heading pr-8">Add an event</h2>
      <p className="mt-1 text-sm text-[color:var(--fg-muted)]">Two ways to get it on the list.</p>
      <div className="mt-5 space-y-3">
        <button type="button" onClick={onJoin} className="block w-full border border-foreground bg-foreground p-4 text-left text-white transition-opacity hover:opacity-90">
          <span className="block text-sm font-medium">Join free and post it yourself</span>
          <span className="mt-0.5 block text-[13px] opacity-75">It shows on your profile and in Explore.</span>
        </button>
        <button type="button" onClick={onTip} className="block w-full border border-border bg-card p-4 text-left transition-colors hover:border-foreground">
          <span className="block text-sm font-medium">Leave a tip</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fg-muted)]">Know about something on? Tell us and we&rsquo;ll add it.</span>
        </button>
      </div>
    </div>
  );
}

function TipForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedAt = useFormLoadedAt();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
    const res = await submitEventTip({ title, date, venue, link, email, turnstileToken: token, loadedAt, [HONEYPOT_FIELD]: honeypot });
    setSending(false);
    setToken("");
    (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    if (res.error) setError(res.error);
    else setDone(true);
  }

  if (done) {
    return (
      <div>
        <h2 className="t-heading pr-8">Thanks, we&rsquo;ve got it.</h2>
        <p className="mt-1 text-sm text-[color:var(--fg-muted)]">We&rsquo;ll check it and add it to Events.</p>
        <button type="button" onClick={onDone} className="btn btn-outline mt-5">Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="t-heading pr-8">Leave an event tip</h2>
        <p className="mt-1 text-sm text-[color:var(--fg-muted)]">An opening, talk, workshop or open studio.</p>
      </div>
      {error && <p className="text-xs text-[color:var(--urgent)]">{error}</p>}
      <div className="space-y-1.5">
        <label htmlFor="evt-title" className={LABEL}>What is it</label>
        <input id="evt-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="e.g. Group show opening" className={FIELD} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="evt-date" className={LABEL}>Date</label>
          <input id="evt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="evt-venue" className={LABEL}>Where</label>
          <input id="evt-venue" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} placeholder="Venue, town" className={FIELD} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="evt-link" className={LABEL}>Link <span className="normal-case tracking-normal">(optional)</span></label>
        <input id="evt-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://…" className={FIELD} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="evt-email" className={LABEL}>Your email <span className="normal-case tracking-normal">(optional)</span></label>
        <input id="evt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="Only if we need to check something" className={FIELD} />
      </div>
      <HoneypotField />
      <TurnstileWidget onVerify={setToken} />
      <button type="submit" disabled={!title.trim() || sending || (CAPTCHA_CONFIGURED && !token)} className="btn btn-brand disabled:opacity-40">
        {sending ? "Sending…" : "Send the tip"}
      </button>
    </form>
  );
}
