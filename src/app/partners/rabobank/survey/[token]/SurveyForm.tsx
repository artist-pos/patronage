"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { MOODS } from "@/lib/rabobank/survey";
import type { NameMode } from "@/lib/rabobank/settings";
import { submitSurvey } from "./actions";

const DONE_KEY = "rabobank_survey_done";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="block text-right text-xs text-muted-foreground" aria-hidden="true">
      {value.length}/{max}
    </span>
  );
}

export function SurveyForm({ token, nameMode }: { token: string; nameMode: NameMode }) {
  const loadedAt = useRef<number>(0);
  // Courtesy flag only. False on the server and until hydration.
  const alreadyDone = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return Boolean(localStorage.getItem(DONE_KEY));
      } catch {
        return false;
      }
    },
    () => false
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState<string[]>([]);
  const [q2Other, setQ2Other] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState<"yes" | "no" | "">("");

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  function toggleMood(m: string) {
    setQ2((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length >= 2 ? cur : [...cur, m]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const hp = (new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string) || "";
    const res = await submitSurvey({
      token,
      firstName,
      q1,
      q2,
      q2Other,
      q3,
      q4,
      q5,
      completionSeconds: (Date.now() - loadedAt.current) / 1000,
      [HONEYPOT_FIELD]: hp,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // Not security, just a courtesy flag.
    }
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="space-y-2 py-8">
        <h2 className="text-xl font-semibold">Thank you</h2>
        <p className="text-muted-foreground">Your answers have been received. You can close this page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {alreadyDone && (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          It looks like you have already submitted this survey on this device. You are welcome to
          send another response if you want to add something.
        </p>
      )}
      <HoneypotField />

      {nameMode !== "off" && (
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="block font-medium">
            First name{nameMode === "optional" && <span className="font-normal text-muted-foreground"> (optional)</span>}
          </label>
          <input
            id="firstName"
            className={field}
            maxLength={60}
            required={nameMode === "required"}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="q1" className="block font-medium">What is the event space used for day to day?</label>
        <input id="q1" className={field} maxLength={300} value={q1} onChange={(e) => setQ1(e.target.value)} />
        <Counter value={q1} max={300} />
      </div>

      <fieldset className="space-y-2">
        <legend className="font-medium">What feeling should the room give people when they walk in?</legend>
        <p className="text-sm text-muted-foreground">Choose up to two.</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const on = q2.includes(m);
            const blocked = !on && q2.length >= 2;
            return (
              <label
                key={m}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${
                  on ? "border-foreground bg-foreground text-background" : "border-input"
                } ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  disabled={blocked}
                  onChange={() => toggleMood(m)}
                />
                {m}
              </label>
            );
          })}
        </div>
        {q2.includes("Other") && (
          <div className="space-y-1">
            <label htmlFor="q2Other" className="block text-sm">What else?</label>
            <input id="q2Other" className={field} maxLength={100} value={q2Other} onChange={(e) => setQ2Other(e.target.value)} />
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="q3" className="block font-medium">Are there subjects from Te Puke or the region that matter to you?</label>
        <textarea id="q3" rows={3} className={field} maxLength={500} value={q3} onChange={(e) => setQ3(e.target.value)} />
        <Counter value={q3} max={500} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="q4" className="block font-medium">Is there anything you would want the artwork to avoid?</label>
        <textarea id="q4" rows={3} className={field} maxLength={500} value={q4} onChange={(e) => setQ4(e.target.value)} />
        <Counter value={q4} max={500} />
      </div>

      <fieldset className="space-y-2">
        <legend className="font-medium">Would you like to see the shortlisted artists and respond to their work?</legend>
        <div className="flex gap-2">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-5 text-sm ${
                q5 === v ? "border-foreground bg-foreground text-background" : "border-input"
              }`}
            >
              <input
                type="radio"
                name="q5"
                className="sr-only"
                checked={q5 === v}
                onChange={() => setQ5(v)}
              />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
