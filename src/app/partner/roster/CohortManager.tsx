"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { OrgJoinLink } from "./OrgJoinLink";
import { createCohort, setCohortActive } from "./cohort-actions";

export interface CohortView {
  id: string;
  name: string;
  year: number | null;
  url: string;
  isActive: boolean;
  memberCount: number;
  /** Null until the cohort has enough members to match without singling anyone out. */
  matches: Array<{ title: string; organiser: string; deadline: string | null; url: string }> | null;
  minMembers: number;
}

function blurbFor(c: CohortView): string {
  const lines = (c.matches ?? []).map((m) => `• ${m.title}${m.deadline ? ` (closes ${m.deadline})` : ""}\n  ${m.url}`);
  return ["Open for us on Patronage:", "", ...lines].join("\n");
}

export function CohortManager({ cohorts }: { cohorts: CohortView[] }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCohort({ name, year: year ? Number(year) : null });
      if (res.error) setError(res.error);
      else {
        setName("");
        setYear("");
      }
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await setCohortActive(id, active);
      if (res.error) setError(res.error);
    });
  }

  async function copyList(c: CohortView) {
    try {
      await navigator.clipboard.writeText(blurbFor(c));
    } catch {
      return;
    }
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 4000);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Cohort name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            placeholder="e.g. BFA 2026"
            className="h-10 w-64 border border-border bg-card px-3 text-base outline-none focus:border-foreground"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Year (optional)</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="2026"
            className="h-10 w-24 border border-border bg-card px-3 text-base outline-none focus:border-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="h-10 bg-black px-5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          Add cohort
        </button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {cohorts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cohorts yet.</p>
      ) : (
        <ul className="space-y-10">
          {cohorts.map((c) => (
            <li key={c.id} className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">
                    {c.name}
                    {c.year ? <span className="font-normal text-muted-foreground"> · {c.year}</span> : null}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {c.memberCount} joined{!c.isActive ? " · closed to new joiners" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c.id, !c.isActive)}
                  disabled={pending}
                  className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {c.isActive ? "Close to new joiners" : "Reopen"}
                </button>
              </div>

              {c.isActive && <OrgJoinLink url={c.url} />}

              {c.matches === null ? (
                <p className="text-sm text-muted-foreground">
                  Matched opportunities appear once {c.minMembers} people have joined, so a match never points at one
                  person.
                </p>
              ) : c.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing open for this group right now.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                    Open for this group
                  </p>
                  <ul className="space-y-2">
                    {c.matches.map((m) => (
                      <li key={m.url} className="text-sm">
                        <a href={m.url} className="font-medium underline-offset-2 hover:underline">
                          {m.title}
                        </a>
                        <span className="text-muted-foreground">
                          {" "}
                          · {m.organiser}
                          {m.deadline ? ` · closes ${m.deadline}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => copyList(c)}
                    className="flex items-center gap-1.5 border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                  >
                    {copiedId === c.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === c.id ? "Copied" : "Copy list to send to the group"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
