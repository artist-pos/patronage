"use client";

import { useEffect, useState } from "react";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import {
  getResultsPreview,
  publishResults,
  saveResultsMessages,
  type ResultsMessages,
  type ResultsPreview,
} from "@/app/partner/dashboard/results-actions";

interface Props {
  opportunityId: string;
  /** Called after a publish so the board can refresh what artists can see. */
  onPublished: () => void;
}

const MESSAGE_KEY: Record<string, keyof ResultsMessages> = {
  selected: "selected",
  approved_pending_assets: "selected",
  shortlisted: "shortlisted",
  rejected: "rejected",
};

const SUGGESTED: Record<keyof ResultsMessages, string> = {
  selected: "Ngā mihi, and congratulations. We'll be in touch shortly with the next steps.",
  shortlisted: "Thank you for applying. Your application is through to the next round, and we'll be in touch once all decisions have been made.",
  rejected: "Thank you for the time and care you put into your application. We received many strong applications and weren't able to select yours this time. We'd encourage you to apply for future opportunities.",
};

const MESSAGE_HINT: Record<keyof ResultsMessages, string> = {
  selected: "A note added to every selection email, for example when to expect a call. Personal messages you wrote while selecting someone take priority.",
  shortlisted: "A note added to every shortlist email, for example what happens next and when.",
  rejected: "A note added to every “not selected” email. Individual feedback you wrote for someone is added as well.",
};

export function ResultsTab({ opportunityId, onPublished }: Props) {
  const [preview, setPreview] = useState<ResultsPreview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<ResultsMessages>({ selected: "", shortlisted: "", rejected: "" });
  const [showEmail, setShowEmail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    getResultsPreview(opportunityId).then((p) => {
      if (cancelled) return;
      if (!p) { setLoadError(true); return; }
      setPreview(p);
      setMessages(p.messages);
    });
    return () => { cancelled = true; };
  }, [opportunityId, reloadKey]);

  async function saveMessage() {
    const res = await saveResultsMessages(opportunityId, messages);
    if (res.error) setResult({ text: res.error, tone: "error" });
    else reload();
  }

  async function publish() {
    setBusy(true);
    setResult(null);
    await saveResultsMessages(opportunityId, messages);
    const res = await publishResults(opportunityId, confirm);
    setBusy(false);
    if (res.error) { setResult({ text: res.error, tone: "error" }); setChecking(false); return; }
    setChecking(false);
    setConfirm("");
    setResult({
      text: res.emailing
        ? `Sent. ${res.emailing} email${res.emailing === 1 ? " is" : "s are"} going out now.`
        : "Done. Artists can now see their results.",
      tone: "ok",
    });
    reload();
    onPublished();
  }

  if (loadError) return <p className="text-sm text-stone-500">Only the owner of this call can send results.</p>;
  if (!preview) return <p className="text-sm text-stone-500">Loading…</p>;

  const total = preview.groups.reduce((n, g) => n + g.people.length, 0);
  const nothingDue = total === 0;
  const canPublish = !nothingDue && confirm.trim().toUpperCase() === "SEND" && !busy;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Send results to artists</h2>
        <p className="text-base text-stone-600 leading-relaxed">
          Your decisions are private. Nobody is emailed, and artists keep seeing{" "}
          <strong className="text-foreground">Received</strong>, until you send the results from this page. Each person gets one email
          about the outcome, and a selection is added to their Patronage profile.
        </p>
      </div>

      {result && (
        <p role="status" className={`border px-3 py-2 text-sm ${result.tone === "error" ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {result.text}
        </p>
      )}

      {preview.applicationsOpen && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Applications are still open{preview.deadline ? ` until ${new Date(preview.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}` : ""}.
          You can send at any time, but close the call first if you have finished choosing.
        </p>
      )}
      {preview.undecided > 0 && (
        <p className="border border-black/10 bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {preview.undecided} application{preview.undecided === 1 ? " is" : "s are"} still at New. {preview.undecided === 1 ? "That person" : "Those people"} won&apos;t be told anything.
        </p>
      )}
      {preview.unsent > 0 && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {preview.unsent} published decision{preview.unsent === 1 ? " hasn't" : "s haven't"} reached an inbox yet. Sending again only sends those.
        </p>
      )}

      {nothingDue ? (
        <div className="border border-black/10 p-8 text-center space-y-1">
          <p className="text-sm font-medium">Nothing to send</p>
          <p className="text-sm text-stone-500">
            Mark applications as Shortlisted, Selected or Not selected on the Applications tab. They will appear here ready to send.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {preview.groups.map((g) => {
            const msgKey = MESSAGE_KEY[g.key];
            return (
              <section key={g.key} className="space-y-3 border border-black/10 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">{g.label}</h3>
                  <span className="text-sm tabular-nums text-stone-500">{g.people.length} email{g.people.length === 1 ? "" : "s"}</span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-stone-500 hover:text-foreground">Who</summary>
                  <ul className="mt-2 columns-1 gap-6 text-sm sm:columns-2">
                    {g.people.map((p) => (
                      <li key={p.id} className="break-inside-avoid py-0.5">
                        {p.name}
                        {p.note && <span className="ml-1 text-sm text-stone-500">· has a personal note</span>}
                      </li>
                    ))}
                  </ul>
                </details>
                {g.key !== "approved_pending_assets" && (
                  <div className="space-y-1">
                    <label htmlFor={`msg-${g.key}`} className="text-sm font-medium uppercase tracking-widest text-stone-500">
                      A message for everyone in this group (optional)
                    </label>
                    <textarea
                      id={`msg-${g.key}`}
                      rows={3}
                      value={messages[msgKey]}
                      onChange={(e) => setMessages((m) => ({ ...m, [msgKey]: e.target.value }))}
                      onBlur={saveMessage}
                      className="w-full resize-none border border-black/20 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                    <p className="text-sm text-stone-500">{MESSAGE_HINT[msgKey]}</p>
                    {!messages[msgKey].trim() && (
                      <button
                        type="button"
                        onClick={() => { setMessages((m) => ({ ...m, [msgKey]: SUGGESTED[msgKey] })); }}
                        className="text-sm underline underline-offset-2 text-stone-500 hover:text-foreground"
                      >
                        Use suggested wording
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowEmail(showEmail === g.key ? null : g.key)}
                  aria-expanded={showEmail === g.key}
                  className="text-sm underline underline-offset-2 text-stone-500 hover:text-foreground"
                >
                  {showEmail === g.key ? "Hide email preview" : "Preview the email"}
                </button>
                {showEmail === g.key && preview.samples[g.key] && (
                  <div className="space-y-1">
                    <p className="text-sm text-stone-500">Subject: <strong>{preview.samples[g.key].subject}</strong></p>
                    <iframe
                      title={`${g.label} email preview`}
                      sandbox=""
                      srcDoc={preview.samples[g.key].html}
                      className="h-[420px] w-full border border-black/10 bg-white"
                    />
                  </div>
                )}
              </section>
            );
          })}

          <div className="space-y-3 border border-black p-5">
            <p className="text-lg font-semibold">Ready to tell {total} {total === 1 ? "artist" : "artists"}?</p>
            <p className="text-base text-stone-600">
              Look through each group above first. When you are happy, press the button. You will get one more chance to check.
            </p>
            <button
              type="button"
              onClick={() => { setConfirm(""); setChecking(true); }}
              className="bg-brand px-6 py-3 text-base font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Check and send
            </button>
          </div>
        </div>
      )}

      <AccessibleDialog open={checking} onClose={() => !busy && setChecking(false)} labelledBy="send-title" closeOnBackdrop={false} className="bg-background w-full max-w-lg p-6 space-y-5 border border-black shadow-xl">
        <h2 id="send-title" className="text-xl font-semibold">Check before you send</h2>
        <ul className="divide-y divide-black/10 border border-black/10">
          {preview.groups.map((g) => (
            <li key={g.key} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="text-base">{g.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{g.people.length}</span>
            </li>
          ))}
        </ul>
        <p className="text-base text-stone-700 leading-relaxed">
          This emails <strong>{total} {total === 1 ? "person" : "people"}</strong> and shows them their result on Patronage. <strong>It cannot be undone or recalled.</strong>
        </p>
        <div className="space-y-1">
          <label htmlFor="confirm-send" className="block text-base font-medium">Type the word SEND to confirm</label>
          <input
            id="confirm-send"
            data-autofocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="w-48 border border-black/40 px-3 py-2 text-lg uppercase tracking-widest focus:border-black focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={publish}
            disabled={!canPublish}
            className="bg-brand px-6 py-3 text-base font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-30"
          >
            {busy ? "Sending…" : `Send ${total} ${total === 1 ? "email" : "emails"}`}
          </button>
          <button type="button" onClick={() => setChecking(false)} disabled={busy} className="border border-black/40 px-6 py-3 text-base hover:border-black disabled:opacity-40">
            Go back
          </button>
        </div>
      </AccessibleDialog>
    </div>
  );
}
