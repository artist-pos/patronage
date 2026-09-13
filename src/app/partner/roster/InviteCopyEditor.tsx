"use client";

import { useState, useTransition } from "react";
import { saveInviteCopy, renderInvitePreview } from "./invite-actions";

export interface InviteCopyValues {
  subject: string;
  headline: string;
  subhead: string;
  message: string;
  replyTo: string;
}

interface Props {
  /** What is stored. Empty strings where the organisation has chosen nothing. */
  initial: InviteCopyValues;
  /** The Patronage wording, shown as placeholder and restored by "reset". */
  defaults: { subject: string; headline: string; subhead: string };
}

const LIMITS = { subject: 150, headline: 200, subhead: 300, message: 600 };

/**
 * Editing the words in the invitation.
 *
 * Fields, not a template. The link, the paragraph telling the artist their
 * profile is their own, and the line saying they can ignore it are all fixed,
 * and the note below says so, because an organisation should know what it
 * cannot change before it wonders why.
 *
 * Every field is optional. Blank means our copy, which is what the placeholder
 * shows, so an organisation that opens this and closes it again has changed
 * nothing.
 */
export function InviteCopyEditor({ initial, defaults }: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<InviteCopyValues>(initial);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof InviteCopyValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setPreview(null);
  }

  function save() {
    setError(null);
    start(async () => {
      const result = await saveInviteCopy(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      setToast("Saved.");
      setTimeout(() => setToast(null), 3000);
    });
  }

  function showPreview() {
    setError(null);
    start(async () => {
      const result = await renderInvitePreview(values);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function reset() {
    setValues({ subject: "", headline: "", subhead: "", message: "", replyTo: values.replyTo });
    setPreview(null);
  }

  const usingDefaults =
    !values.subject.trim() && !values.headline.trim() && !values.subhead.trim() && !values.message.trim();

  return (
    <div className="border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span>
          <span className="block text-[15px] font-medium">
            What your invitation says
          </span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fg-muted)]">
            {usingDefaults
              ? "Using the standard wording. Edit it to sound like you."
              : "You have written your own wording."}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
          {open ? "Close" : "Edit"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-border p-5">
          <Field
            id="invite-subject"
            label="Subject line"
            value={values.subject}
            placeholder={defaults.subject}
            max={LIMITS.subject}
            onChange={(v) => set("subject", v)}
          />
          <Field
            id="invite-headline"
            label="Opening sentence"
            value={values.headline}
            placeholder={defaults.headline}
            max={LIMITS.headline}
            onChange={(v) => set("headline", v)}
          />
          <Field
            id="invite-subhead"
            label="The line under it"
            value={values.subhead}
            placeholder={defaults.subhead}
            max={LIMITS.subhead}
            onChange={(v) => set("subhead", v)}
          />
          <Field
            id="invite-message"
            label="Anything else you want to say"
            hint="Optional. Left blank, it is left out."
            value={values.message}
            placeholder="We are building a picture of who is making work in the region, and we would like you in it."
            max={LIMITS.message}
            rows={4}
            onChange={(v) => set("message", v)}
          />
          <Field
            id="invite-reply-to"
            label="Replies go to"
            hint="An artist who replies reaches you rather than a no-reply address."
            value={values.replyTo}
            placeholder="hello@yourorganisation.nz"
            max={254}
            onChange={(v) => set("replyTo", v)}
          />

          <p className="border-t border-border pt-4 text-[12.5px] leading-[1.6] text-[color:var(--fg-muted)]">
            The button, the note telling the artist their profile is their own,
            and the line saying they can ignore the email are always included.
            They are what makes an artist comfortable receiving this.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="bg-brand px-[22px] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={showPreview}
              disabled={pending}
              className="border border-border px-[22px] py-2.5 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
            >
              Preview
            </button>
            {!usingDefaults && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Back to the standard wording
              </button>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {toast && (
            <p aria-live="polite" className="text-xs text-[color:var(--fg-muted)]">
              {toast}
            </p>
          )}

          {preview && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
                Subject
              </p>
              <p className="text-[14px]">{preview.subject}</p>
              {/* Rendered in an iframe so the email's own styles cannot reach
                  the page around it. srcDoc keeps it same-origin-free. */}
              <iframe
                title="Invitation preview"
                srcDoc={preview.html}
                sandbox=""
                className="h-[420px] w-full border border-border bg-white"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  placeholder,
  max,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  placeholder: string;
  max: number;
  rows?: number;
  onChange: (v: string) => void;
}) {
  const over = value.length > max;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {hint && <p className="text-[12px] text-[color:var(--fg-subtle)]">{hint}</p>}
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-border bg-card px-3 py-2.5 text-[15px] outline-none focus:border-foreground"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-border bg-card px-3 py-2.5 text-[15px] outline-none focus:border-foreground"
        />
      )}
      <p
        className={
          over
            ? "text-[11px] text-destructive"
            : "text-[11px] text-[color:var(--fg-subtle)]"
        }
      >
        {value.length > 0 ? `${value.length} of ${max}` : "Blank uses the standard wording"}
      </p>
    </div>
  );
}
