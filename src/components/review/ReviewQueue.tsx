"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { recuseFromApplication, saveScores } from "@/app/review/actions";
import { addNote, getNotes, type NoteDTO } from "@/app/partner/dashboard/review-actions";
import type { ReviewApp, ReviewCriterionDTO } from "./types";

interface Props {
  opportunityId: string;
  title: string;
  apps: ReviewApp[];
  criteria: ReviewCriterionDTO[];
  initialScores: Record<string, Record<string, number>>;
  canScore: boolean;
  blind?: boolean;
  backHref?: string;
}

const isImage = (url: string) => /\.(jpe?g|png|webp|gif|avif|tiff?)($|\?)/i.test(url);

function fileName(url: string): string {
  const raw = url.split("/").pop()?.split("?")[0] ?? "File";
  try { return decodeURIComponent(raw).replace(/^\d+-/, ""); } catch { return raw; }
}

export function ReviewQueue({ opportunityId, title, apps: allApps, criteria, initialScores, canScore, blind = false, backHref }: Props) {
  const [stepped, setStepped] = useState<Set<string>>(new Set());
  const [confirmStepBack, setConfirmStepBack] = useState(false);
  const apps = useMemo(() => allApps.filter((a) => !stepped.has(a.id)), [allApps, stepped]);
  const [scores, setScores] = useState(initialScores);
  const [saved, setSaved] = useState<Set<string>>(() =>
    new Set(apps.filter((a) => criteria.length > 0 && criteria.every((c) => initialScores[a.id]?.[c.id])).map((a) => a.id)),
  );
  const firstOpen = apps.findIndex((a) => !saved.has(a.id));
  const [index, setIndex] = useState(firstOpen >= 0 ? firstOpen : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<{ appId: string; list: NoteDTO[] } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [introSeen, setIntroSeen] = useState(true);
  useEffect(() => {
    Promise.resolve().then(() => {
      try { setIntroSeen(localStorage.getItem("review-intro-seen") === "1"); } catch { setIntroSeen(false); }
    });
  }, []);
  function dismissIntro() {
    setIntroSeen(true);
    try { localStorage.setItem("review-intro-seen", "1"); } catch { /* ignore */ }
  }

  const app = apps[index] ?? null;
  const mine = (app && scores[app.id]) ?? {};
  const allChosen = criteria.length > 0 && criteria.every((c) => mine[c.id]);
  const done = saved.size;
  const pct = apps.length > 0 ? Math.round((done / apps.length) * 100) : 0;

  const appId = app?.id;
  const notes = notesState && notesState.appId === appId ? notesState.list : [];

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    getNotes(appId).then((list) => { if (!cancelled) setNotesState({ appId, list }); });
    return () => { cancelled = true; };
  }, [appId]);

  const goTo = useCallback((i: number) => {
    setError(null);
    setNoteText("");
    setIndex(Math.max(0, Math.min(apps.length - 1, i)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [apps.length]);

  const nextOpenAfter = useCallback((from: number, savedSet: Set<string>) => {
    for (let step = 1; step <= apps.length; step++) {
      const i = (from + step) % apps.length;
      if (!savedSet.has(apps[i].id)) return i;
    }
    return -1;
  }, [apps]);

  function choose(criterionId: string, value: number) {
    if (!app || !canScore) return;
    setScores((prev) => ({ ...prev, [app.id]: { ...prev[app.id], [criterionId]: value } }));
    setSaved((prev) => { const next = new Set(prev); next.delete(app.id); return next; });
  }

  async function saveAndNext() {
    if (!app || !allChosen || saving) return;
    setSaving(true);
    setError(null);
    const result = await saveScores(opportunityId, app.id, scores[app.id] ?? {});
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    const nextSaved = new Set(saved).add(app.id);
    setSaved(nextSaved);
    const next = nextOpenAfter(index, nextSaved);
    if (next >= 0) goTo(next);
  }

  async function submitNote() {
    if (!app || !noteText.trim() || noteBusy) return;
    setNoteBusy(true);
    const result = await addNote(app.id, noteText);
    setNoteBusy(false);
    if (result.error) { setError(result.error); return; }
    setNoteText("");
    setNotesState({ appId: app.id, list: await getNotes(app.id) });
  }

  async function stepBack() {
    if (!app || saving) return;
    setSaving(true);
    setError(null);
    const result = await recuseFromApplication(opportunityId, app.id);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setConfirmStepBack(false);
    setStepped((prev) => new Set(prev).add(app.id));
    setIndex((i) => Math.max(0, Math.min(i, apps.length - 2)));
  }

  // Keys 1-9 (0 for 10) score the next unscored question, Enter saves and moves on.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !app || !canScore || confirmStepBack) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select")) return;
      if (/^[0-9]$/.test(e.key)) {
        const n = e.key === "0" ? 10 : Number(e.key);
        const c = criteria.find((x) => !mine[x.id]);
        if (c && n <= c.scaleMax) { e.preventDefault(); choose(c.id, n); }
      } else if (e.key === "Enter" && allChosen && !el?.closest("button, a")) {
        e.preventDefault();
        void saveAndNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const everythingDone = useMemo(() => apps.length > 0 && done === apps.length, [apps.length, done]);

  if (apps.length === 0) {
    return (
      <div className="ams-comfort mx-auto max-w-xl px-6 py-20 text-center space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-stone-500">There&apos;s nothing to review yet. New applications will appear here.</p>
      </div>
    );
  }

  return (
    <div className="ams-comfort mx-auto max-w-[1600px] px-4 sm:px-6 py-6">
      {/* Header + progress */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {backHref && <Link href={backHref} className="text-sm text-stone-500 hover:text-foreground">‹ All reviews</Link>}
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <p className="text-sm tabular-nums text-stone-500" aria-live="polite">
            {done} of {apps.length} scored
          </p>
        </div>
        <div className="h-1.5 bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Scoring progress">
          <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        {everythingDone && (
          <p role="status" className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            You&apos;ve scored everything assigned to you. Thank you. You can still revisit any application.
          </p>
        )}
        {blind && (
          <p className="border border-black/10 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            Blind review: applicant names, locations, profiles and CVs are hidden.
          </p>
        )}
        {!introSeen && canScore && criteria.length > 0 && (
          <div className="flex flex-wrap items-start justify-between gap-3 border border-black bg-white p-4">
            <div className="space-y-1">
              <p className="text-base font-semibold">How this works</p>
              <ol className="list-decimal pl-5 text-base text-stone-700 space-y-0.5">
                <li>Read the application on the left.</li>
                <li>Give each question on the right a score.</li>
                <li>Press <strong>Save and next</strong>. You can come back and change a score later.</li>
              </ol>
              <p className="text-sm text-stone-600">Tip: on a keyboard, press 1, 2, 3… to score each question in turn, then Enter to save.</p>
            </div>
            <button type="button" onClick={dismissIntro} className="border border-brand px-5 py-2 text-base font-medium hover:bg-brand hover:text-brand-foreground">Got it</button>
          </div>
        )}
        {!canScore && (
          <p className="border border-black/10 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            You have view-only access to this opportunity, so scoring is switched off.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        {/* Applicant list */}
        <nav aria-label="Applications" className="hidden lg:block max-h-[calc(100vh-12rem)] overflow-y-auto border border-black/10">
          {apps.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? "true" : undefined}
              className={`flex w-full items-center justify-between gap-2 border-b border-black/5 px-3 py-2.5 text-left text-sm ${i === index ? "bg-stone-100 font-medium" : "hover:bg-stone-50"}`}
            >
              <span className="truncate">{a.name}</span>
              {saved.has(a.id) && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Scored" />}
            </button>
          ))}
        </nav>

        {/* The application */}
        <article className="min-w-0 space-y-6" aria-label={`Application from ${app?.name}`}>
          {app && (
            <>
              <header className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  {app.careerStage && <span className="border border-black/20 px-2 py-0.5">{app.careerStage}</span>}
                  {app.medium.slice(0, 3).map((m) => <span key={m} className="border border-black/20 px-2 py-0.5">{m}</span>)}
                </div>
                <p className="text-sm text-stone-600">Application {index + 1} of {apps.length}</p>
                <h2 className="text-2xl font-semibold tracking-tight">{app.name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                  {app.location && <span>{app.location}</span>}
                  {app.username && (
                    <Link href={`/${app.username}`} target="_blank" className="inline-flex items-center gap-1 hover:text-foreground">
                      Public profile <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {app.cvUrl && (
                    <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      CV <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </header>

              {app.works.length > 0 && (
                <section aria-label="Submitted work" className="space-y-3">
                  <h3 className="text-sm font-medium uppercase tracking-widest text-stone-500">Work · {app.works.length}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {app.works.map((w) => (
                      <figure key={w.id} className="space-y-1.5">
                        <a href={w.url} target="_blank" rel="noopener noreferrer" className="block bg-stone-50 border border-black/10">
                          {/* Plain img: grid sizes vary, per the project's image rules. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={w.url} alt={w.title ?? "Submitted work"} className="max-h-72 w-full object-contain" />
                        </a>
                        {(w.title || w.description) && (
                          <figcaption className="space-y-0.5 text-sm">
                            {w.title && <p className="font-medium">{w.title}</p>}
                            {w.description && <p className="whitespace-pre-wrap text-stone-500">{w.description}</p>}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {app.statement && (
                <section className="space-y-1">
                  <h3 className="text-sm font-medium uppercase tracking-widest text-stone-500">Statement</h3>
                  <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-relaxed">{app.statement}</p>
                </section>
              )}

              {app.answers.map((ans) => (
                <section key={ans.label} className="space-y-1.5">
                  <h3 className="text-sm font-medium uppercase tracking-widest text-stone-500">{ans.label}</h3>
                  {ans.text && <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-relaxed">{ans.text}</p>}
                  {ans.files.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ans.files.filter(isImage).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block bg-stone-50 border border-black/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={ans.label} className="max-h-64 w-full object-contain" />
                        </a>
                      ))}
                      {ans.files.filter((u) => !isImage(u)).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
                          {fileName(url)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </article>

        {/* Scoring */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start" aria-label="Your scores">
          <div className="space-y-4 border border-black/10 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-stone-500">Your scores</h3>
            {criteria.length === 0 ? (
              <p className="text-sm text-stone-500">No scoring criteria have been set up for this opportunity.</p>
            ) : (
              criteria.map((c) => (
                <fieldset key={c.id} className="space-y-1.5">
                  <legend className="text-sm font-medium">
                    {c.label}
                  </legend>
                  {c.helper && <p className="text-sm text-stone-500">{c.helper}</p>}
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: c.scaleMax }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!canScore}
                        aria-pressed={mine[c.id] === n}
                        aria-label={`${c.label}: ${n} of ${c.scaleMax}`}
                        onClick={() => choose(c.id, n)}
                        className={`h-11 w-11 border text-base font-medium transition-colors disabled:opacity-50 ${mine[c.id] === n ? "border-brand bg-brand text-brand-foreground" : "border-brand/20 hover:border-brand"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm text-stone-600" aria-hidden>
                    <span>1 = Weak</span>
                    <span>{c.scaleMax} = Excellent</span>
                  </div>
                </fieldset>
              ))
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={saveAndNext}
                disabled={!canScore || !allChosen || saving}
                className="flex-1 bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-40"
              >
                {saving ? "Saving…" : saved.has(app?.id ?? "") ? "Saved. Next" : "Save and next"}
              </button>
            </div>
            {canScore && !allChosen && criteria.length > 0 && (
              <p className="text-sm text-stone-600">Give every question a score to save.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}
              className="inline-flex items-center gap-1 border border-black/20 px-3 py-2 text-sm hover:border-black disabled:opacity-30">
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-sm tabular-nums text-stone-500">{index + 1} / {apps.length}</span>
            <button type="button" onClick={() => goTo(index + 1)} disabled={index === apps.length - 1}
              className="inline-flex items-center gap-1 border border-black/20 px-3 py-2 text-sm hover:border-black disabled:opacity-30">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {canScore && app && (
            <div className="space-y-2">
              {confirmStepBack ? (
                <div className="space-y-2 border border-black/20 p-3 text-sm">
                  <p>Step back from this application? Your scores for it are removed and it won&apos;t be assigned to you again.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={stepBack} disabled={saving}
                      className="bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50">
                      {saving ? "Stepping back…" : "Step back"}
                    </button>
                    <button type="button" onClick={() => setConfirmStepBack(false)} className="border border-black/20 px-3 py-1.5 text-sm">
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmStepBack(true)}
                  className="text-sm text-stone-500 underline underline-offset-2 hover:text-foreground">
                  I have a conflict of interest
                </button>
              )}
            </div>
          )}

          <div className="space-y-3 border border-black/10 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-stone-500">Team notes</h3>
            {notes.length === 0 && <p className="text-sm text-stone-500">No notes yet.</p>}
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className="text-sm font-medium">{n.mine ? "You" : n.authorName}</span>
                  <p className="whitespace-pre-wrap text-stone-600">{n.body}</p>
                </li>
              ))}
            </ul>
            {canScore && (
              <div className="space-y-2">
                <label htmlFor="review-note" className="sr-only">Add a note for the team</label>
                <textarea
                  id="review-note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Add a note for the team"
                  className="w-full resize-none border border-black/20 px-2.5 py-2 text-sm focus:border-black focus:outline-none"
                />
                <button type="button" onClick={submitNote} disabled={!noteText.trim() || noteBusy}
                  className="border border-brand px-3 py-1.5 text-sm font-medium hover:bg-brand hover:text-brand-foreground disabled:opacity-40">
                  {noteBusy ? "Adding…" : "Add note"}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
