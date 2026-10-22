"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { saveSettings, createToken, deleteAllNames, deleteResponse, deleteToken, type ActionState } from "./actions";
import { RangeCalendar } from "./RangeCalendar";

const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const sectionTitle = "text-xs font-medium uppercase tracking-widest text-stone-400";
const quietLink = "text-xs text-stone-500 underline-offset-4 hover:underline";

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

/** "2026-11-03T00:00" → "Tue 3 Nov", adding the time only when it isn't the day's start or end. */
function fmtLocal(v: string, edge: "open" | "close") {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const plain = edge === "open" ? t === "00:00" : t === "23:59";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
    ...(plain ? {} : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(Date.UTC(y, m - 1, day, hh, mm))).replace(/^(\w+),/, "$1");
}

function SaveState({ pending, state }: { pending: boolean; state: ActionState }) {
  if (pending) return <span className="text-xs text-stone-500">Saving…</span>;
  if (state?.error) return <span className="text-xs text-destructive">{state.error}</span>;
  if (state?.ok) return <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Check className="size-3.5" /> Saved</span>;
  return null;
}

/**
 * Schedule and survey settings. Each window is one line until you open it;
 * every change saves on its own, and the intro saves when you leave the box.
 */
export function SettingsPanel({ values, status }: { values: SettingsFormValues; status: { survey: string; shortlist: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, null);
  const [survey, setSurvey] = useState<Win>({ open: values.survey_open_at, close: values.survey_close_at });
  const [shortlist, setShortlist] = useState<Win>({ open: values.shortlist_open_at, close: values.shortlist_close_at });
  const [nameMode, setNameMode] = useState(values.collect_first_name);
  const [intro, setIntro] = useState(values.shortlist_intro);
  const [savedIntro, setSavedIntro] = useState(values.shortlist_intro);
  const [editing, setEditing] = useState<"survey" | "shortlist" | null>(null);

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
    <>
      <section className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={sectionTitle}>Schedule</h2>
          <SaveState pending={pending} state={state} />
        </div>
        <div className="-mx-2 space-y-1">
          {windows.map((w) => {
            const open = editing === w.key;
            const live = w.status === "Open" || w.status.startsWith("Open until");
            return (
              <div key={w.key} className={`rounded-lg ${open ? "bg-stone-50" : ""}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setEditing(open ? null : w.key)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-stone-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {w.label}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-normal ${live ? "text-emerald-700" : "text-stone-500"}`}>
                        <span className={`size-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-stone-300"}`} />
                        {w.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-stone-600">
                      {w.value.open && w.value.close ? `${fmtLocal(w.value.open, "open")} → ${fmtLocal(w.value.close, "close")}` : "Set dates"}
                    </span>
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="px-2 pb-3 pt-1">
                    <RangeCalendar
                      start={w.value.open ? w.value.open.slice(0, 10) : null}
                      end={w.value.close ? w.value.close.slice(0, 10) : null}
                      onPick={(a, b) => {
                        const next = { open: `${a}T00:00`, close: `${b}T23:59` };
                        w.set(next);
                        save(w.key === "survey" ? { survey: next } : { shortlist: next });
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-stone-400">Opens at the start of the first day, closes at the end of the last.</p>
                      {(w.value.open || w.value.close) && (
                        <button
                          type="button"
                          className={quietLink}
                          onClick={() => {
                            const next = { open: "", close: "" };
                            w.set(next);
                            save(w.key === "survey" ? { survey: next } : { shortlist: next });
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 p-5">
        <h2 className={sectionTitle}>Settings</h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">First name</p>
          <div className="inline-flex rounded-lg bg-stone-100 p-0.5" role="radiogroup" aria-label="First name on the survey">
            {([["required", "Required"], ["optional", "Optional"], ["off", "Off"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={nameMode === v}
                onClick={() => { if (v !== nameMode) { setNameMode(v); save({ nameMode: v }); } }}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${nameMode === v ? "bg-white font-medium shadow-sm" : "text-stone-600 hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm">Shortlist intro <span className="text-stone-400">· blank uses the default</span></span>
          <textarea
            rows={2}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            onBlur={() => { if (intro !== savedIntro) { setSavedIntro(intro); save(); } }}
            className={input}
          />
        </label>
      </section>
    </>
  );
}

const LINK_TYPES = [
  ["survey", "Survey"],
  ["staff", "Staff shortlist"],
  ["client", "Client"],
] as const;

/** A label (optional) and one click per link type. */
export function TokenForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createToken, null);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <form action={action} className="space-y-2">
        <input name="label" placeholder="Label (optional), e.g. Te Puke team" className={input} maxLength={80} />
        <div className="flex flex-wrap gap-1.5">
          {LINK_TYPES.map(([type, label]) => (
            <button
              key={type}
              name="type"
              value={type}
              disabled={pending}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:border-stone-400 disabled:opacity-50"
            >
              + {label}
            </button>
          ))}
        </div>
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.link && (
        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Copy it now. Only a hash is stored, so it can’t be shown again.</p>
          <div className="flex gap-1.5">
            <input readOnly value={state.link} className={`${input} py-1.5 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-black px-3 text-xs text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(state.link!);
              }}
            >
              {copied === state.link ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A small text button that asks before its server action runs. */
function ConfirmAction({ action, id, message, children, className = quietLink }: {
  action: (fd: FormData) => Promise<void>;
  id?: string;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className="inline" onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {id && <input type="hidden" name="id" value={id} />}
      <button className={className}>{children}</button>
    </form>
  );
}

export function DeleteTokenButton({ id, live }: { id: string; live: boolean }) {
  return (
    <ConfirmAction
      action={deleteToken}
      id={id}
      message={live ? "Delete this link? Anyone who has it will no longer be able to open it." : "Delete this link from the list?"}
      className={`${quietLink} hover:text-destructive`}
    >
      Delete
    </ConfirmAction>
  );
}

export function DeleteResponseButton({ id, who }: { id: string; who: string }) {
  return (
    <ConfirmAction action={deleteResponse} id={id} message={`Delete ${who}’s response? This can’t be undone.`} className={`${quietLink} hover:text-destructive`}>
      Delete response
    </ConfirmAction>
  );
}

export function DeleteNamesButton() {
  return (
    <ConfirmAction
      action={deleteAllNames}
      message="Remove every first name from survey answers and shortlist reactions? This can’t be undone."
      className="text-xs text-destructive underline-offset-4 hover:underline"
    >
      Delete all names
    </ConfirmAction>
  );
}
