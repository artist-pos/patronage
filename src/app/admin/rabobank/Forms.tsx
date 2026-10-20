"use client";

import { useActionState, useState } from "react";
import { saveSettings, createToken, type ActionState } from "./actions";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export interface SettingsFormValues {
  survey_open_at: string;
  survey_close_at: string;
  shortlist_open_at: string;
  shortlist_close_at: string;
  collect_first_name: string;
  survey_intro: string;
  shortlist_intro: string;
}

export function SettingsForm({ values }: { values: SettingsFormValues }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, null);
  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-muted-foreground">All times are Pacific/Auckland.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["survey_open_at", "Survey opens"],
            ["survey_close_at", "Survey closes"],
            ["shortlist_open_at", "Shortlist opens"],
            ["shortlist_close_at", "Shortlist closes"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="space-y-1 text-sm">
            <span className="font-medium">{label}</span>
            <input type="datetime-local" name={name} defaultValue={values[name]} className={input} />
          </label>
        ))}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">First name on the survey</span>
        <select name="collect_first_name" defaultValue={values.collect_first_name} className={input}>
          <option value="required">Required</option>
          <option value="optional">Optional</option>
          <option value="off">Not asked</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Survey intro (leave blank for the default)</span>
        <textarea name="survey_intro" rows={4} defaultValue={values.survey_intro} className={input} />
        <span className="text-xs text-muted-foreground">{"{close_date}"} is replaced with the close date.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Shortlist intro (leave blank for the default)</span>
        <textarea name="shortlist_intro" rows={2} defaultValue={values.shortlist_intro} className={input} />
      </label>
      <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.ok && <span className="ml-3 text-sm text-success">Saved.</span>}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createToken, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <select name="type" className={input} defaultValue="survey" aria-label="Link type">
          <option value="survey">Survey link</option>
          <option value="staff">Staff shortlist link</option>
          <option value="client">Client link</option>
        </select>
        <input name="label" placeholder="Label (optional)" className={input} maxLength={80} />
        <input type="datetime-local" name="expires_at" className={input} aria-label="Expires (optional, Auckland time)" />
        <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          Generate
        </button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.link && (
        <div className="space-y-1 rounded-md border border-border bg-muted p-3">
          <p className="text-xs text-muted-foreground">Copy this now. For safety only a hash is stored, so it cannot be shown again.</p>
          <div className="flex gap-2">
            <input readOnly value={state.link} className={`${input} font-mono`} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="rounded-md border border-input px-3 text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
