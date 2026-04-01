"use client";

import { useState } from "react";
import type { SocialOpp } from "@/app/admin/social/page";

type View = "new" | "closing-soon" | "final-call";

function getDefaultView(): View {
  const day = new Date().getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  if (day === 5) return "final-call";
  if (day === 2) return "closing-soon";
  return "new";
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Open deadline";
  const d = new Date(deadline + "T00:00:00");
  return `Closes ${d.toLocaleDateString("en-NZ", { month: "long", day: "numeric" })}.`;
}

function formatValue(opp: SocialOpp): string {
  if (opp.funding_range) return opp.funding_range.toUpperCase();
  if (opp.funding_amount) {
    const currency = opp.country === "AUS" ? "AUD" : "NZD";
    return `UP TO ${currency} ${opp.funding_amount.toLocaleString()}`;
  }
  return "";
}

function formatEntry(opp: SocialOpp): string {
  if (opp.entry_fee === null || opp.entry_fee === 0) return "Free Entry";
  if (opp.entry_fee_local && opp.entry_fee_currency) {
    return `~${opp.entry_fee_currency} ${opp.entry_fee_local}`;
  }
  return `~NZD ${opp.entry_fee}`;
}

function formatEligibility(opp: SocialOpp): string {
  const eligibilityTag = opp.tags?.find(
    (t) => t.toLowerCase().includes("open to") || t.toLowerCase().includes("eligible")
  );
  if (eligibilityTag) return eligibilityTag;
  switch (opp.country) {
    case "NZ": return "Open to NZ artists";
    case "AUS": return "Open to Australian artists";
    case "Global": return "Open to international artists";
    default: return `Open to ${opp.country} artists`;
  }
}

function buildCopyText(opp: SocialOpp): string {
  const lines: string[] = [];
  lines.push(opp.type.toUpperCase());
  lines.push("");
  lines.push(opp.title.toUpperCase());
  lines.push(opp.organiser);
  lines.push("");
  const value = formatValue(opp);
  if (value) lines.push(value);
  const desc = opp.caption || opp.description || "";
  if (desc) lines.push(desc);
  lines.push(formatEligibility(opp));
  lines.push(formatEntry(opp));
  lines.push("");
  lines.push(formatDeadline(opp.deadline));
  if (opp.slug) {
    lines.push(`patronage.art/opportunities/${opp.slug}`);
  } else if (opp.url) {
    lines.push(opp.url);
  }
  return lines.join("\n");
}

function OppCard({ opp, today }: { opp: SocialOpp; today: string }) {
  const [copied, setCopied] = useState(false);
  const copyText = buildCopyText(opp);

  async function handleCopy() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const value = formatValue(opp);

  return (
    <div className="border border-border rounded-xl p-5 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            {opp.type}
          </span>
          <p className="font-semibold text-sm leading-snug">{opp.title}</p>
          <p className="text-xs text-muted-foreground">{opp.organiser}</p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {value && (
        <p className="text-xs font-semibold text-emerald-700">{value}</p>
      )}

      {(opp.caption || opp.description) && (
        <p className="text-xs text-foreground leading-relaxed line-clamp-3">
          {opp.caption || opp.description}
        </p>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{formatEligibility(opp)}</p>
        <p>{formatEntry(opp)}</p>
      </div>

      <p className="text-xs font-medium">{formatDeadline(opp.deadline)}</p>

      <pre className="text-[10px] text-stone-400 font-mono bg-stone-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
        {copyText}
      </pre>
    </div>
  );
}

function OppGrid({ opps, today, emptyMessage }: {
  opps: SocialOpp[];
  today: string;
  emptyMessage: string;
}) {
  if (opps.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {opps.map((o) => <OppCard key={o.id} opp={o} today={today} />)}
    </div>
  );
}

export function SocialContentPanel({
  newThisWeek,
  closingSoon,
  finalCall,
  today,
}: {
  newThisWeek: SocialOpp[];
  closingSoon: SocialOpp[];
  finalCall: SocialOpp[];
  today: string;
}) {
  const [view, setView] = useState<View>(getDefaultView);
  const [allCopied, setAllCopied] = useState(false);

  const closingToday = finalCall.filter((o) => o.deadline === today);
  const closingNext3 = finalCall.filter((o) => o.deadline !== today);

  const currentOpps =
    view === "new" ? newThisWeek
    : view === "closing-soon" ? closingSoon
    : finalCall;

  async function copyAll() {
    const text = currentOpps.map(buildCopyText).join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  const VIEWS: { id: View; label: string }[] = [
    { id: "new", label: "New This Week" },
    { id: "closing-soon", label: "Closing Soon" },
    { id: "final-call", label: "Final Call" },
  ];

  return (
    <div className="space-y-6">
      {/* Toggle row */}
      <div className="flex items-center gap-2 flex-wrap">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
              view === id
                ? "bg-black text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}

        <button
          onClick={copyAll}
          disabled={currentOpps.length === 0}
          className="ml-auto text-xs font-medium px-4 py-2 rounded-lg border border-border hover:bg-stone-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allCopied ? "Copied!" : `Copy All (${currentOpps.length})`}
        </button>
      </div>

      {/* View: New This Week */}
      {view === "new" && (
        <OppGrid
          opps={newThisWeek}
          today={today}
          emptyMessage="No new opportunities published in the last 7 days."
        />
      )}

      {/* View: Closing Soon (7–14 days) */}
      {view === "closing-soon" && (
        <OppGrid
          opps={closingSoon}
          today={today}
          emptyMessage="No opportunities closing in 7–14 days."
        />
      )}

      {/* View: Final Call — split into today vs next 3 days */}
      {view === "final-call" && (
        <div className="space-y-8">
          {finalCall.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No opportunities closing in the next 3 days.
            </p>
          )}

          {closingToday.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-stone-400">
                Closing Today ({closingToday.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {closingToday.map((o) => <OppCard key={o.id} opp={o} today={today} />)}
              </div>
            </section>
          )}

          {closingNext3.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-stone-400">
                Closing Soon ({closingNext3.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {closingNext3.map((o) => <OppCard key={o.id} opp={o} today={today} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
