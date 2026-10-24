"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COPY } from "@/lib/rabobank/artist-copy";
import type { PartStatus } from "@/lib/rabobank/invites";
import type { QuoteState, ProfileState } from "@/lib/rabobank/artist-data";
import type { QuoteDraft } from "@/lib/rabobank/quote";
import { saveDeclineSuggestion } from "./actions";
import { PartOneForm } from "./PartOneForm";
import { PartTwoForm } from "./PartTwoForm";
import { inputClass, quietButton, readBackup } from "./ui";

const STATUS_STYLE: Record<PartStatus, string> = {
  not_started: "bg-stone-100 text-stone-600",
  saved: "bg-amber-50 text-amber-800",
  done: "bg-emerald-50 text-emerald-800",
};

function Part({
  title,
  summary,
  status,
  open,
  onToggle,
  children,
  id,
}: {
  title: string;
  summary: string;
  status: PartStatus;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="flex w-full items-start gap-4 px-5 py-5 text-left sm:px-6">
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium">{title}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{COPY.landing.status[status]}</span>
          </span>
          <span className="block text-sm leading-relaxed text-stone-600">{summary}</span>
        </span>
        <ChevronDown className={`mt-1.5 size-5 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id={id} className="border-t border-stone-200 px-5 py-6 sm:px-6">{children}</div>}
    </section>
  );
}

export function ArtistParts({
  token,
  declined: declinedInitially,
  declineSuggestion,
  hasEmail,
  open,
  status,
  quote,
  profile,
}: {
  token: string;
  declined: boolean;
  declineSuggestion: string;
  hasEmail: boolean;
  open: { partOneOpen: boolean; partTwoOpen: boolean };
  status: { partOne: PartStatus; partTwo: PartStatus };
  quote: QuoteState;
  profile: ProfileState;
}) {
  const [declined, setDeclined] = useState(declinedInitially);
  const [expanded, setExpanded] = useState<"one" | "two" | null>(null);
  // Arriving from the thank-you page's "Part two" button opens that part.
  useEffect(() => {
    if (window.location.hash !== "#part-two") return;
    const raf = requestAnimationFrame(() => {
      setExpanded("two");
      window.setTimeout(() => document.getElementById("part-two")?.scrollIntoView({ block: "start" }), 50);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  // A newer copy in this browser (offline edits, or a save that never landed) wins.
  const [quoteInitial] = useState<QuoteDraft>(() => (typeof window === "undefined" ? quote.draft : readBackup<QuoteDraft>(`rb-quote-${token}`, quote.savedAt) ?? quote.draft));

  if (declined) return <Declined token={token} initial={declineSuggestion} onChangeMind={() => setDeclined(false)} />;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">{COPY.landing.partsHeading}</h2>
      <Part
        id="part-one"
        title={COPY.partOne.title}
        summary={COPY.partOne.summary}
        status={status.partOne}
        open={expanded === "one"}
        onToggle={() => setExpanded(expanded === "one" ? null : "one")}
      >
        {!open.partOneOpen && <p className="mb-6 text-sm text-stone-600">{COPY.partOne.errors.closed}</p>}
        <PartOneForm token={token} initial={quoteInitial} disabled={!open.partOneOpen} onDeclined={() => setDeclined(true)} />
      </Part>
      <Part
        id="part-two"
        title={COPY.partTwo.title}
        summary={COPY.partTwo.summary}
        status={status.partTwo}
        open={expanded === "two"}
        onToggle={() => setExpanded(expanded === "two" ? null : "two")}
      >
        <PartTwoForm token={token} initial={profile.draft} initialWorks={profile.works} hasEmail={hasEmail} disabled={!open.partTwoOpen} />
      </Part>
      <p className="text-sm text-stone-600">{COPY.landing.profileRequired}</p>
    </section>
  );
}

function Declined({ token, initial, onChangeMind }: { token: string; initial: string; onChangeMind: () => void }) {
  const D = COPY.partOne.declined;
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="text-2xl font-light tracking-tight">{D.heading}</h2>
      <p className="leading-relaxed text-stone-600">{D.body}</p>
      <div className="space-y-2">
        <label htmlFor="suggest" className="block font-medium">
          {D.suggestLabel}
          <span className="ml-2 text-xs font-normal text-stone-400">Optional</span>
        </label>
        <p className="text-sm text-stone-500">{D.suggestHelp}</p>
        <textarea id="suggest" rows={3} className={inputClass} maxLength={600} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} />
        <div className="flex items-center gap-4">
          <button type="button" className={quietButton} onClick={async () => { const r = await saveDeclineSuggestion(token, text); setSaved(r.ok); }}>
            {D.suggestSave}
          </button>
          {saved && <span className="text-sm text-stone-500" role="status">{D.suggestSaved}</span>}
        </div>
      </div>
      <button type="button" className="text-sm text-stone-500 underline underline-offset-4" onClick={onChangeMind}>
        {COPY.partOne.title}
      </button>
    </section>
  );
}
