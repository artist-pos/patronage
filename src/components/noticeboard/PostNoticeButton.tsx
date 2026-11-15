"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { postNotice } from "@/actions/noticeboard";
import { NOTICE_KINDS, NOTICE_MAX } from "@/lib/noticeboard-kinds";

interface Props {
  regions: { id: string; name: string }[];
  defaultRegionId: string | null;
  /** Signed out: the button sends people to sign in instead. */
  isLoggedIn: boolean;
  label?: string;
  className?: string;
}

function runsUntil(): string {
  return new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-NZ", { day: "numeric", month: "long" });
}

/** "Post a notice" and its form: kind, one or two lines, region. */
export function PostNoticeButton({ regions, defaultRegionId, isLoggedIn, label = "Post a notice", className = "btn btn-outline btn-sm" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [body, setBody] = useState("");
  const [regionId, setRegionId] = useState(defaultRegionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) { setError("Choose a kind first."); return; }
    if (!body.trim()) { setError("Write what you need or offer."); return; }
    startTransition(async () => {
      const res = await postNotice({ kind, body, regionId: regionId || null });
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      setKind(""); setBody(""); setError(null);
      router.push(`/noticeboard/${res.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (isLoggedIn ? setOpen(true) : router.push("/auth/login?next=/noticeboard"))}
        className={className}
      >
        {label}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:px-4" onClick={() => setOpen(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-notice-title"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="modal relative max-h-[92vh] w-full overflow-y-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:max-w-[460px] sm:p-6"
            noValidate
          >
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 p-2 text-[color:var(--fg-muted)] hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <h2 id="post-notice-title" className="t-heading mb-1">Post a notice</h2>
            <p className="t-body-sm mb-5">An ask or an offer for other artists. It runs for 30 days.</p>

            <span id="notice-kind-label" className="t-section-label mb-2.5 block">Kind</span>
            <div role="radiogroup" aria-labelledby="notice-kind-label" className="flex flex-wrap gap-1.5">
              {NOTICE_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => { setKind(k.value); setError(null); }}
                  className={`btn btn-sm ${kind === k.value ? "btn-outline bg-muted" : "btn-ghost"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <label htmlFor="notice-body" className="t-section-label mb-2.5 mt-5 block">What do you need or offer?</label>
            <textarea
              id="notice-body"
              value={body}
              onChange={(e) => { setBody(e.target.value.slice(0, NOTICE_MAX)); setError(null); }}
              placeholder="Need a framer for three 1.2m works on paper, before 1 December."
              rows={3}
              className="w-full resize-none border border-border bg-card px-3 py-2.5 text-[15px] leading-[1.55] outline-none transition-colors focus:border-foreground"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-[color:var(--fg-subtle)]">
              <span>One or two lines</span>
              <span>{body.length}/{NOTICE_MAX}</span>
            </div>

            <label htmlFor="notice-region" className="t-section-label mb-2.5 mt-5 block">Region</label>
            <select
              id="notice-region"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground"
            >
              <option value="">Anywhere</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {error && <p role="alert" className="mt-3 text-[13px] text-[color:var(--urgent)]">{error}</p>}

            <p className="mt-5 bg-muted px-3 py-2.5 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]">
              Runs until {runsUntil()}. Replies are public, and you&rsquo;re notified of each one. Mark it sorted any time.
            </p>

            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={pending} className="btn btn-primary flex-1">
                {pending ? "Posting…" : "Post notice"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
