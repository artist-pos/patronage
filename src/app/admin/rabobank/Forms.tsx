"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { saveSettings, createToken, deleteAllNames, deleteToken, type ActionState } from "./actions";
import { RangeCalendar } from "./RangeCalendar";

const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const card = "rounded-xl border border-border bg-white p-5";

/** Dates arrive as Auckland wall-clock "YYYY-MM-DDTHH:mm" strings ("" when unset). */
export interface SettingsFormValues {
  survey_open_at: string;
  survey_close_at: string;
  shortlist_open_at: string;
  shortlist_close_at: string;
  collect_first_name: string;
  shortlist_intro: string;
}

type Win = { open: string; close: string };

/** "2026-11-03T00:00" → "Tue 3 Nov, 12:00 am", read as a wall-clock time. */
function fmtLocal(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(Date.UTC(y, m - 1, day, hh, mm))).replace(/^(\w+),/, "$1");
}

function SaveState({ pending, state }: { pending: boolean; state: ActionState }) {
  if (pending) return <span className="text-xs text-stone-500">Saving…</span>;
  if (state?.error) return <span className="text-xs text-destructive">{state.error}</span>;
  if (state?.ok) return <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Check className="size-3.5" /> Saved</span>;
  return null;
}

/**
 * Both windows, the name setting and the shortlist intro. Every change saves on
 * its own; the intro saves when you leave the box.
 */
export function ScheduleForm({ values, status }: { values: SettingsFormValues; status: { survey: string; shortlist: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, null);
  const [survey, setSurvey] = useState<Win>({ open: values.survey_open_at, close: values.survey_close_at });
  const [shortlist, setShortlist] = useState<Win>({ open: values.shortlist_open_at, close: values.shortlist_close_at });
  const [nameMode, setNameMode] = useState(values.collect_first_name);
  const [intro, setIntro] = useState(values.shortlist_intro);
  const [savedIntro, setSavedIntro] = useState(values.shortlist_intro);

  function save(next: Partial<{ survey: Win; shortlist: Win; nameMode: string; intro: string }> = {}) {
    const s = next.survey ?? survey;
    const l = next.shortlist ?? shortlist;
    const fd = new FormData();
    fd.set("survey_open_at", s.open);
    fd.set("survey_close_at", s.close);
    fd.set("shortlist_open_at", l.open);
    fd.set("shortlist_close_at", l.close);
    fd.set("collect_first_name", next.nameMode ?? nameMode);
    fd.set("shortlist_intro", next.intro ?? intro);
    startTransition(() => action(fd));
  }

  const windows = [
    { key: "survey", label: "Survey", value: survey, set: setSurvey, status: status.survey },
    { key: "shortlist", label: "Shortlist", value: shortlist, set: setShortlist, status: status.shortlist },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Click the first day, then the last. Opens at the start of the first day and closes at the end of the last, Auckland time.</p>
        <SaveState pending={pending} state={state} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {windows.map((w) => (
          <div key={w.key} className={card}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{w.label}</h3>
                <p className="mt-0.5 text-sm text-stone-600">
                  {w.value.open && w.value.close ? `${fmtLocal(w.value.open)} → ${fmtLocal(w.value.close)}` : "No dates set"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{w.status}</span>
            </div>
            <RangeCalendar
              start={w.value.open ? w.value.open.slice(0, 10) : null}
              end={w.value.close ? w.value.close.slice(0, 10) : null}
              onPick={(a, b) => {
                const next = { open: `${a}T00:00`, close: `${b}T23:59` };
                w.set(next);
                save(w.key === "survey" ? { survey: next } : { shortlist: next });
              }}
            />
            {(w.value.open || w.value.close) && (
              <button
                type="button"
                className="text-xs text-stone-500 underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  const next = { open: "", close: "" };
                  w.set(next);
                  save(w.key === "survey" ? { survey: next } : { shortlist: next });
                }}
              >
                Clear dates
              </button>
            )}
          </div>
        ))}
      </div>

      <div className={`${card} grid gap-5 md:grid-cols-2`}>
        <div className="space-y-2">
          <p className="text-sm font-medium">First name on the survey</p>
          <div className="inline-flex rounded-lg bg-stone-100 p-1" role="radiogroup" aria-label="First name on the survey">
            {([["required", "Required"], ["optional", "Optional"], ["off", "Not asked"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={nameMode === v}
                onClick={() => { if (v !== nameMode) { setNameMode(v); save({ nameMode: v }); } }}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${nameMode === v ? "bg-white font-medium shadow-sm" : "text-stone-600 hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Shortlist intro <span className="font-normal text-stone-500">(blank uses the default)</span></span>
          <textarea
            rows={2}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            onBlur={() => { if (intro !== savedIntro) { setSavedIntro(intro); save(); } }}
            className={input}
          />
        </label>
      </div>
    </div>
  );
}

const LINK_TYPES = [
  ["survey", "Survey"],
  ["staff", "Staff shortlist"],
  ["client", "Client"],
] as const;

/** One click per link type. The label is optional. */
export function TokenForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createToken, null);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="label" placeholder="Label, e.g. “Te Puke team” (optional)" className={`${input} sm:max-w-xs`} maxLength={80} />
        {LINK_TYPES.map(([type, label]) => (
          <button
            key={type}
            name="type"
            value={type}
            disabled={pending}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-85 disabled:opacity-50"
          >
            + {label} link
          </button>
        ))}
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.link && (
        <div className="space-y-2 rounded-xl border border-border bg-stone-50 p-4">
          <p className="text-xs text-stone-500">Copy this now. Only a hash is stored, so it can’t be shown again.</p>
          <div className="flex gap-2">
            <input readOnly value={state.link} className={`${input} font-mono`} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(state.link!);
              }}
            >
              {copied === state.link ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeleteTokenButton({ id, live }: { id: string; live: boolean }) {
  return (
    <form
      action={deleteToken}
      className="inline"
      onSubmit={(e) => {
        const msg = live ? "Delete this link? Anyone who has it will no longer be able to open it." : "Delete this link from the list?";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-stone-500 underline underline-offset-4 hover:text-destructive">Delete</button>
    </form>
  );
}

export function DeleteNamesButton() {
  return (
    <form
      action={deleteAllNames}
      onSubmit={(e) => {
        if (!confirm("Remove every first name from survey answers and shortlist reactions? This can’t be undone.")) e.preventDefault();
      }}
    >
      <button className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/5">Delete all names</button>
    </form>
  );
}
