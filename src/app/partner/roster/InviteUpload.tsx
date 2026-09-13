"use client";

import { useRef, useState, useTransition } from "react";
import { previewArtistInvites, sendArtistInvites } from "./invite-actions";
import type { InvitePreview, InviteOutcome } from "@/lib/artist-invites";
import { trackEvent } from "@/lib/analytics";

interface Props {
  orgName: string;
  regionName: string | null;
  /** Seeded preview, used only by the dev-only design preview route so the
   *  confirmation table can be reviewed without uploading a real file. */
  demoPreview?: InvitePreview;
}

const OUTCOME_LABEL: Record<InviteOutcome, string> = {
  invite: "Will be invited",
  existing: "Already on Patronage",
  already_invited: "You have invited them before",
  invalid: "Cannot be used",
};

/**
 * CSV upload, preview, then send.
 *
 * Deliberately two steps. An organisation is about to put its own name in front
 * of hundreds of artists it has a relationship with, and a mistake costs it
 * their trust rather than ours. So nothing sends until it has seen the numbers,
 * including the rows we cannot use and why.
 *
 * The file text is held here and posted again on confirm. The server re-derives
 * the decision from it rather than trusting the reviewed rows back.
 */
export function InviteUpload({ orgName, regionName, demoPreview }: Props) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(demoPreview ?? null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCsvText(null);
    setFilename(null);
    setPreview(null);
    setShowAll(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onerror = () => setError("That file could not be read.");
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      setFilename(file.name);
      start(async () => {
        const p = await previewArtistInvites(text);
        setPreview(p);
        trackEvent("org_invite_csv_previewed", {
          rows: String(p.total),
          to_invite: String(p.counts.invite),
          already_here: String(p.counts.existing),
        });
      });
    };
    reader.readAsText(file);
  }

  function confirm() {
    if (!csvText) return;
    setError(null);
    start(async () => {
      const r = await sendArtistInvites(csvText, filename);
      if (r.error) {
        setError(r.error);
        return;
      }
      trackEvent("org_invite_csv_sent", { sent: String(r.sent) });
      setResult(
        `${r.sent} invitation${r.sent !== 1 ? "s" : ""} sent from ${orgName}.`
      );
      reset();
    });
  }

  const rowsToShow = preview
    ? showAll
      ? preview.rows
      : preview.rows.slice(0, 12)
    : [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label
          htmlFor="invite-csv"
          className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]"
        >
          Upload a CSV
        </label>
        <input
          ref={inputRef}
          id="invite-csv"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={onFile}
          className="block w-full max-w-md text-sm file:mr-3 file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium"
        />
        <p className="text-xs text-[color:var(--fg-muted)]">
          One row per artist. An email column is required. Name, discipline and
          city are used to pre-fill their profile if you have them.
        </p>
      </div>

      {pending && !preview && (
        <p className="text-sm text-muted-foreground">Reading your file…</p>
      )}

      {preview?.error && (
        <p className="text-sm text-destructive">{preview.error}</p>
      )}

      {preview && preview.total > 0 && (
        <div className="space-y-4 border border-border bg-card p-5">
          <div>
            <p className="text-[15px] leading-[1.5]">
              You are about to invite{" "}
              <strong>
                {preview.counts.invite} artist
                {preview.counts.invite !== 1 ? "s" : ""}
              </strong>
              {regionName ? ` to the ${regionName} directory` : ""}.
            </p>
            <p className="mt-1 text-[13.5px] text-[color:var(--fg-muted)]">
              {describeRest(preview)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>What happens</Th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.map((r) => (
                  <tr key={r.line} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-[12px]">
                      {r.email || <span className="text-[color:var(--fg-subtle)]">empty</span>}
                    </td>
                    <td className="py-2 pr-3">{r.fullName ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={
                          r.outcome === "invalid"
                            ? "text-destructive"
                            : r.outcome === "invite"
                              ? "text-foreground"
                              : "text-[color:var(--fg-muted)]"
                        }
                      >
                        {r.outcome === "invalid" && r.problem
                          ? r.problem
                          : OUTCOME_LABEL[r.outcome]}
                        {r.outcome === "existing" && r.existingUsername
                          ? ` as @${r.existingUsername}`
                          : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > rowsToShow.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Show all {preview.rows.length} rows
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={confirm}
              disabled={pending || preview.counts.invite === 0}
              className="bg-brand px-[22px] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {pending
                ? "Sending…"
                : `Send ${preview.counts.invite} invitation${preview.counts.invite !== 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <p aria-live="polite" className="text-sm text-[color:var(--fg-muted)]">
          {result}
        </p>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 pr-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
      {children}
    </th>
  );
}

/** The honest account of the rows that are not being invited. */
function describeRest(preview: InvitePreview): string {
  const parts: string[] = [];
  if (preview.counts.existing > 0) {
    parts.push(`${preview.counts.existing} already have a Patronage profile`);
  }
  if (preview.counts.already_invited > 0) {
    parts.push(`${preview.counts.already_invited} you have invited before`);
  }
  if (preview.counts.invalid > 0) {
    parts.push(`${preview.counts.invalid} cannot be used`);
  }
  if (parts.length === 0) return `All ${preview.total} rows are new.`;
  return `Of ${preview.total} rows, ${parts.join(", ")}. Nobody is emailed twice.`;
}
