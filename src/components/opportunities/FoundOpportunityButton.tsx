"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { submitOpportunityTip } from "@/app/opportunities/tip-action";

const FIELD = "w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground";

export function FoundOpportunityButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(""); setSourceLink(""); setEmail("");
    setSuccess(false); setError(null);
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitOpportunityTip(name, sourceLink, email);
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 transition-colors hover:border-black"
      >
        Found an opportunity? +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-background border border-black w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest">Share an Opportunity</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Know of a listing we've missed? We'll review and add it.
                </p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground ml-4 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="px-6 py-10 text-center space-y-2">
                <p className="text-sm font-medium">Thank you —</p>
                <p className="text-sm text-muted-foreground">
                  We'll review it and add it to the listings if it's a good fit.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-4 text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="divide-y divide-black">
                {error && <p className="px-6 py-3 text-xs text-destructive">{error}</p>}

                <div className="px-6 py-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Opportunity Name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Creative NZ Project Development Fund"
                    required
                    className={FIELD}
                  />
                </div>

                <div className="px-6 py-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Source Link *
                  </label>
                  <input
                    value={sourceLink}
                    onChange={(e) => setSourceLink(e.target.value)}
                    type="url"
                    placeholder="https://…"
                    required
                    className={FIELD}
                  />
                  <p className="text-[11px] text-muted-foreground">Where did you find it?</p>
                </div>

                <div className="px-6 py-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Your Email <span className="font-normal normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="so we can follow up if needed"
                    className={FIELD}
                  />
                </div>

                <div className="px-6 py-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-xs border border-black px-4 py-2 hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || !sourceLink.trim() || submitting}
                    className="text-xs bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
