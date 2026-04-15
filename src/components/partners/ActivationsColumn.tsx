"use client";

import { useRef, useState, useTransition } from "react";
import { submitActivationEnquiry } from "@/app/partners/actions";

const ACTIVATION_TYPES = [
  {
    title: "Construction hoardings",
    description: "Commission artists for construction sites. 12–24 month visibility with QR-linked artist profiles.",
  },
  {
    title: "Billboards",
    description: "Rotate emerging artists through high-visibility billboard networks with full impact reporting.",
  },
  {
    title: "Truck curtains",
    description: "Turn fleet vehicles into moving galleries. Nationwide reach, artist commissions, impact tracked.",
  },
  {
    title: "Packaging",
    description: "Artist work on cups, bags, receipts, and branded products. High-frequency activations.",
  },
  {
    title: "Public art",
    description: "Permanent and temporary installations in civic spaces. Full pipeline from open call to reporting.",
  },
  {
    title: "Digital surfaces",
    description: "Screens, projections, and digital displays in retail, transit, and public spaces.",
  },
] as const;

const HOW_IT_WORKS = [
  "You brief us on the surface, timeline, and budget",
  "We run a targeted open call to our artist network",
  "You select artists through a shortlisting dashboard",
  "We manage production, printing, and installation",
  "QR codes on every surface link to artist profiles",
  "You receive a full impact report — scans, engagement, reach",
] as const;

const INTEREST_OPTIONS = [
  "Hoardings", "Billboards", "Truck curtains", "Packaging", "Public art", "Other",
] as const;

export function ActivationsColumn() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Enquiry form
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function toggleInterest(v: string) {
    setInterests(prev => {
      const n = new Set(prev);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });
  }

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  }

  async function handleEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    const result = await submitActivationEnquiry({
      name, organisation: org, email, interests: [...interests], message,
    });
    setSending(false);
    if (result.error) { setSendError(result.error); return; }
    setSent(true);
  }

  return (
    <div className="space-y-12">
      {/* Section header */}
      <div className="space-y-2 border-b border-black pb-6">
        <h2 className="text-xl font-semibold tracking-tight">Activations</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Partner with us to commission artists for surfaces you already own — hoardings,
          vehicles, packaging, screens — and turn existing budgets into public art with full
          impact reporting.
        </p>
      </div>

      {/* Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What we do
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:border-black hover:text-foreground transition-colors text-xs"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:border-black hover:text-foreground transition-colors text-xs"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-snap-x pb-2 scrollbar-none"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {ACTIVATION_TYPES.map(({ title, description }) => (
            <div
              key={title}
              className="shrink-0 w-56 border border-border p-4 space-y-2"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Placeholder image area */}
              <div className="w-full h-32 bg-stone-100" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <div className="space-y-0">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="flex gap-4 border-t border-border py-3.5">
              <span className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0 w-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Enquiry form */}
      <div className="border border-border p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Get in touch</p>
          <p className="text-xs text-muted-foreground">
            Tell us about your project. We&apos;ll be in touch within 48 hours.
          </p>
        </div>

        {sent ? (
          <p className="text-sm text-muted-foreground">
            Thanks — we&apos;ll be in touch. Usually within 48 hours.
          </p>
        ) : (
          <form onSubmit={handleEnquiry} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Organisation</label>
                <input
                  type="text"
                  value={org}
                  onChange={e => setOrg(e.target.value)}
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Interested in</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleInterest(v)}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      interests.has(v)
                        ? "bg-black text-white border-black"
                        : "border-border hover:border-black"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Tell us about your project *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={4}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
              />
            </div>

            {sendError && <p className="text-xs text-destructive">{sendError}</p>}

            <button
              type="submit"
              disabled={sending}
              className="text-sm border border-black bg-black text-white px-5 py-2.5 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send enquiry →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
