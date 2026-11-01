"use client";

import { useMemo, useState } from "react";
import type { SocialOpp } from "@/app/admin/social/page";

const MAX_PICKS = 5;

function currencyOf(opp: SocialOpp): string {
  return opp.country === "AUS" ? "AUD" : "NZD";
}

function formatDate(deadline: string | null): string {
  if (!deadline) return "date TBC";
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long" });
}

function formatValue(opp: SocialOpp): string {
  if (opp.funding_range) return opp.funding_range.toUpperCase();
  if (opp.funding_amount) return `UP TO ${currencyOf(opp)} ${opp.funding_amount.toLocaleString("en-NZ")}`;
  return "";
}

function isFree(opp: SocialOpp): boolean {
  return opp.entry_fee === null || opp.entry_fee === 0;
}

function discipline(opp: SocialOpp): string {
  return (opp.sub_categories?.[0] ?? opp.type).toUpperCase();
}

function firstSentence(text: string | null): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : clean).trim();
}

function summary(opp: SocialOpp, ai?: AiCopy): string {
  return ai?.summary || firstSentence(opp.caption) || firstSentence(opp.description) || `${opp.type} from ${opp.organiser}.`;
}

interface AiCopy {
  id: string;
  description: string;
  eligibility: string;
  summary: string;
}

function description(opp: SocialOpp, ai?: AiCopy): string {
  if (ai?.description) return ai.description;
  const raw = (opp.caption || opp.description || "").replace(/\s+/g, " ").trim();
  if (raw.length <= 220) return raw;
  return raw.slice(0, 220).replace(/\s+\S*$/, "") + "…";
}

function eligibility(opp: SocialOpp, ai?: AiCopy): string {
  if (ai?.eligibility) return ai.eligibility;
  const tag = opp.tags?.find((t) => /open to|eligible/i.test(t));
  if (tag) return tag;
  switch (opp.country) {
    case "NZ": return "Open to NZ artists";
    case "AUS": return "Open to Australian artists";
    case "Global": return "Open to international artists";
    default: return `Open to ${opp.country} artists`;
  }
}

function totalValue(opps: SocialOpp[]): number {
  return opps.reduce((sum, o) => sum + (o.funding_amount ?? 0), 0);
}

function buildCover(opps: SocialOpp[]): string {
  const total = totalValue(opps);
  const lines = [
    "LAST CALLS — NZ",
    "WEEKLY DIGEST",
    "",
    `${opps.length} CLOSING SOON.`,
    total > 0 ? `$${total.toLocaleString("en-NZ")}+ ON THE BOARD. →` : "→",
    "",
  ];
  for (const o of opps) {
    lines.push(o.title);
    lines.push(`${o.organiser} · ${o.type}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildSlide(opp: SocialOpp, ai?: AiCopy): string {
  const lines = [
    `${discipline(opp)} · ${isFree(opp) ? "FREE" : "ENTRY FEE"}`,
    "",
    opp.organiser,
    opp.title.toUpperCase(),
  ];
  const value = formatValue(opp);
  if (value) lines.push(value);
  lines.push("");
  const desc = description(opp, ai);
  if (desc) lines.push(desc);
  lines.push(eligibility(opp, ai));
  lines.push("");
  lines.push(`Closes ${formatDate(opp.deadline)}.`);
  return lines.join("\n");
}

function buildCaption(opps: SocialOpp[], copy: Record<string, AiCopy>): string {
  const lines = [`Here are ${opps.length} opportunities closing in the next few weeks:`];
  for (const o of opps) {
    lines.push(o.title);
    lines.push(summary(o, copy[o.id]));
  }
  lines.push("Find the complete list of 100+ active opportunities at patronage.nz (link in bio).");
  return lines.join("\n");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-stone-400">{title}</span>
        <CopyButton text={text} label="Copy" />
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{text}</pre>
    </div>
  );
}

export function LastCallsBuilder({ opportunities }: { opportunities: SocialOpp[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [copy, setCopy] = useState<Record<string, AiCopy>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opportunities;
    return opportunities.filter(
      (o) => o.title.toLowerCase().includes(q) || o.organiser.toLowerCase().includes(q)
    );
  }, [opportunities, query]);

  // Slides are always ordered by closing date, soonest first
  const picked = useMemo(
    () =>
      opportunities
        .filter((o) => selected.includes(o.id))
        .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")),
    [opportunities, selected]
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_PICKS ? prev : [...prev, id]
    );
  }

  const full = selected.length >= MAX_PICKS;
  const needsCopy = picked.some((o) => !copy[o.id]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/last-calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: picked.map((o) => o.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const next: Record<string, AiCopy> = {};
      for (const item of data.items as AiCopy[]) next[item.id] = item;
      setCopy((prev) => ({ ...prev, ...next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Pick up to {MAX_PICKS} ({selected.length}/{MAX_PICKS})
          </h2>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or organiser…"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white"
        />
        <div className="border border-border rounded-xl bg-white divide-y divide-border max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No open opportunities match.</p>
          )}
          {filtered.map((o) => {
            const isOn = selected.includes(o.id);
            const disabled = !isOn && full;
            return (
              <label
                key={o.id}
                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-stone-50 ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={disabled}
                  onChange={() => toggle(o.id)}
                  className="mt-1"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium leading-snug">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {o.organiser} · {o.type}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-stone-500">{formatDate(o.deadline)}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Generated post</h2>
          <button
            onClick={generate}
            disabled={picked.length === 0 || generating}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? "Writing…" : needsCopy ? "Write copy with Haiku" : "Rewrite copy"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {picked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select opportunities to generate the carousel and caption.</p>
        ) : (
          <>
            {needsCopy && (
              <p className="text-xs text-muted-foreground">
                Showing a quick draft from the stored text. Write copy with Haiku for tidier summaries.
              </p>
            )}
            <Block title="Caption" text={buildCaption(picked, copy)} />
            <Block title="Slide 1 — Cover" text={buildCover(picked)} />
            {picked.map((o, i) => (
              <Block key={o.id} title={`Slide ${i + 2}`} text={buildSlide(o, copy[o.id])} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
