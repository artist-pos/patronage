"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveOutcome, type OutcomeInput, type OutcomeResult } from "@/actions/outcomes";

interface Props {
  opportunityId: string;
  opportunityHref: string;
  initial: OutcomeInput | null;
}

const RESULT_OPTIONS: Array<{ value: OutcomeResult; label: string }> = [
  { value: "selected", label: "I was selected" },
  { value: "shortlisted", label: "Shortlisted, not selected" },
  { value: "unsuccessful", label: "Told I was unsuccessful" },
  { value: "no_response", label: "Never heard back" },
];

const radio = "flex cursor-pointer items-center gap-3 border border-border px-4 py-3 text-sm has-[:checked]:border-foreground";

export function OutcomeForm({ opportunityId, opportunityHref, initial }: Props) {
  const [applied, setApplied] = useState<boolean | null>(initial?.applied ?? null);
  const [result, setResult] = useState<OutcomeResult | null>(initial?.result ?? null);
  const [weeks, setWeeks] = useState<string>(initial?.responseWeeks != null ? String(initial.responseWeeks) : "");
  const [tip, setTip] = useState(initial?.tip ?? "");
  const [privateNote, setPrivateNote] = useState(initial?.privateNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const heardBack = result && result !== "no_response";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (applied === null) return setError("Let us know whether you applied.");
    if (applied && !result) return setError("Let us know how it went.");
    setError(null);
    startTransition(async () => {
      const res = await saveOutcome(opportunityId, {
        applied,
        result: applied ? result : null,
        responseWeeks: applied && heardBack && weeks !== "" ? Number(weeks) : null,
        tip,
        privateNote,
      });
      if (res.error) return setError(res.error);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-base font-medium">Thank you.</p>
        <p className="text-sm text-muted-foreground">
          Your answers are added to the figures other artists see, once enough people have reported that no one can be
          identified. {tip.trim() ? "Your tip will appear, without your name, after a quick check." : ""}
        </p>
        <Link href={opportunityHref} className="inline-block font-mono text-xs underline underline-offset-2">
          Back to the opportunity
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Did you apply?</legend>
        <label className={radio}>
          <input type="radio" name="applied" checked={applied === true} onChange={() => setApplied(true)} />
          Yes
        </label>
        <label className={radio}>
          <input type="radio" name="applied" checked={applied === false} onChange={() => { setApplied(false); setResult(null); }} />
          No, I didn&rsquo;t apply in the end
        </label>
      </fieldset>

      {applied && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">How did it go?</legend>
          {RESULT_OPTIONS.map((o) => (
            <label key={o.value} className={radio}>
              <input type="radio" name="result" checked={result === o.value} onChange={() => setResult(o.value)} />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      {applied && heardBack && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Roughly how many weeks after the deadline did you hear?</span>
          <input
            type="number"
            min={0}
            max={52}
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            className="h-10 w-28 border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-semibold">A tip for artists applying next time (optional)</span>
        <span className="block text-xs text-muted-foreground">
          Shown without your name, after a quick check. Keep it useful: what they look for, what you&rsquo;d do differently.
        </span>
        <textarea
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
        />
        <span className="block text-right font-mono text-[10px] text-[color:var(--fg-subtle)]">{tip.length}/280</span>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Anything Patronage should know? (optional, private)</span>
        <span className="block text-xs text-muted-foreground">
          Only the Patronage team reads this. It&rsquo;s the place for problems with how a round was run.
        </span>
        <textarea
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-foreground px-6 text-sm font-medium text-background disabled:opacity-50"
      >
        {initial ? "Update my report" : "Send my report"}
      </button>
    </form>
  );
}
