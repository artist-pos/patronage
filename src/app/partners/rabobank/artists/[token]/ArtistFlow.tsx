"use client";

/**
 * The invited artist's page, built on the staff survey's own pieces (scene,
 * writing, pebbles, actions, transitions): a welcome page that explains the two
 * parts, then each part one question at a time, then "Start part 2".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { CONTACT_EMAIL, COPY, fill } from "@/lib/rabobank/artist-copy";
import { formatNzDate } from "@/lib/rabobank/time";
import { safeUrl } from "@/lib/rabobank/shortlist";
import type { ArtistInvite, PartStatus } from "@/lib/rabobank/invites";
import type { ProfileState, QuoteState } from "@/lib/rabobank/artist-data";
import { MAX_QUESTIONS, QUOTE_LIMITS, hasAnyAmount, numberQuestions, parseAmount, questionLines, type QuoteDraft, type QuoteErrors } from "@/lib/rabobank/quote";
import { BIO_WORDS, PROFILE_LIMITS, WORKS, wordCount, type ProfileDraft, type ProfileErrors, type WorkDraft } from "@/lib/rabobank/artist-profile";
import { WallViewer } from "@/components/rabobank/WallViewer";
import { Scene, Writing, prefersReducedMotion, useTween } from "../../survey/[token]/SurveyExperience";
import { KiwiConfetti, prepareKiwiConfetti } from "../../survey/[token]/KiwiConfetti";
import { removePhoto, removeWork, saveDeclineSuggestion, saveProfileDraft, saveQuoteDraft, submitProfile, submitQuote } from "./actions";
import { readBackup, uploadImage, useAutosave, type SaveStatus } from "./ui";
import "../../survey/[token]/survey.css";
import "./artist-flow.css";

type Mode = "home" | "one" | "oneDone" | "two" | "twoDone" | "declined";
const ONE = ["interested", "deliver", "scale", "approach", "quote", "framing", "install", "anythingElse"] as const;
const TWO = ["photo", "name", "bio", "links", "works", "prompt", "choice", "consent"] as const;
type OneKey = (typeof ONE)[number];
type TwoKey = (typeof TWO)[number];
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const C1 = COPY.partOne;
const C2 = COPY.partTwo;
const errText = (map: Record<string, string>, code?: string) => (code ? map[code] ?? COPY.partOne.errors.required : null);

/* ---------- small survey-styled inputs ---------- */

function Line({ id, value, onChange, label, placeholder, inputMode, type = "text", onEnter, maxLength, autoComplete }: {
  id: string; value: string; onChange: (v: string) => void; label: string; placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; type?: string; onEnter?: () => void; maxLength?: number; autoComplete?: string;
}) {
  return (
    <div className="rb-write">
      <input
        id={id}
        type={type}
        className="rb-textarea rb-textarea--small rb-input"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
      />
      <span className="rb-rule" aria-hidden="true" />
    </div>
  );
}

function Money({ id, value, onChange, label, onEnter }: { id: string; value: string; onChange: (v: string) => void; label: string; onEnter?: () => void }) {
  return (
    <div className="rb-money">
      <span className="rb-cur" aria-hidden="true">$</span>
      <Line id={id} value={value} onChange={(v) => onChange(v.replace(/[^\d.,]/g, ""))} label={label} inputMode="decimal" onEnter={onEnter} />
      <span className="rb-nzd">NZD</span>
    </div>
  );
}

/**
 * "Just some thoughts": one of Blake's takes at a time, crossfading every ~8s
 * from a random start. Pauses while the artist is writing (paused) or while the
 * panel is hovered or focused. With reduced motion it holds one thought still.
 * Changes are not announced to screen readers, so they never interrupt writing.
 */
function TakesPanel({ takes, paused }: { takes: string[]; paused: boolean }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const [held, setHeld] = useState(false);
  const step = useCallback(() => {
    if (takes.length < 2) return;
    setVisible(false);
    window.setTimeout(() => { setI((n) => (n + 1) % takes.length); setVisible(true); }, 450);
  }, [takes.length]);

  // A random starting thought, chosen after load so the server and browser agree on first paint.
  useEffect(() => {
    if (takes.length < 2) return;
    const id = requestAnimationFrame(() => setI(Math.floor(Math.random() * takes.length)));
    return () => cancelAnimationFrame(id);
  }, [takes.length]);

  useEffect(() => {
    if (paused || held || takes.length < 2 || prefersReducedMotion()) return;
    const t = window.setInterval(step, 8000);
    return () => window.clearInterval(t);
  }, [paused, held, step, takes.length]);

  if (!takes.length) return null;
  return (
    <aside
      className="rb-takes"
      aria-label={C1.q.takes.heading}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <p className="rb-takes-head">{C1.q.takes.heading}</p>
      <p className="rb-take" data-visible={visible} aria-live="off">{takes[i % takes.length]}</p>
    </aside>
  );
}

/**
 * "A couple of questions" as an auto-numbered list: Enter starts the next
 * question, Backspace on an empty line removes it.
 */
function QuestionList({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const lines = questionLines(value);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusAt, setFocusAt] = useState<number | null>(null);
  useEffect(() => {
    if (focusAt === null) return;
    refs.current[focusAt]?.focus();
    const id = requestAnimationFrame(() => setFocusAt(null));
    return () => cancelAnimationFrame(id);
  }, [focusAt]);
  const update = (next: string[]) => onChange(numberQuestions(next));
  const room = lines.length < MAX_QUESTIONS;
  return (
    <div className="rb-qlist">
      <ol>
        {lines.map((line, i) => (
          <li key={i}>
            <span className="rb-qnum" aria-hidden="true">{i + 1}.</span>
            <div className="rb-write">
              <input
                ref={(el) => { refs.current[i] = el; }}
                className="rb-textarea rb-textarea--small rb-input"
                value={line}
                aria-label={C1.q.questions.line(i + 1)}
                placeholder={C1.q.questions.line(i + 1)}
                maxLength={Math.floor(QUOTE_LIMITS.questions / MAX_QUESTIONS) - 4}
                autoFocus={i === 0 && !line}
                onChange={(e) => update(lines.map((l, j) => (j === i ? e.target.value : l)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!line.trim()) return onDone();
                    if (i === lines.length - 1 && room) { update([...lines, ""]); setFocusAt(i + 1); }
                    else setFocusAt(Math.min(i + 1, lines.length - 1));
                  } else if (e.key === "Backspace" && !line && lines.length > 1) {
                    e.preventDefault();
                    update(lines.filter((_, j) => j !== i));
                    setFocusAt(Math.max(0, i - 1));
                  }
                }}
              />
              <span className="rb-rule" aria-hidden="true" />
            </div>
          </li>
        ))}
      </ol>
      {room && lines[lines.length - 1].trim() && (
        <button type="button" className="rb-link" onClick={() => { update([...lines, ""]); setFocusAt(lines.length); }}>
          + {C1.q.questions.add}
        </button>
      )}
    </div>
  );
}

function Pebbles<T extends string>({ name, value, options, onChange, label }: {
  name: string; value: T | ""; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <fieldset className="rb-pebbles" aria-label={label}>
      {options.map(([v, text]) => (
        <label key={v} className="rb-pebble">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}

const Sub = ({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) => (
  <label htmlFor={htmlFor} className="rb-sublabel">{children}{optional && <em> · optional</em>}</label>
);

function SaveText({ s }: { s: SaveStatus }) {
  const t = s === "saving" ? COPY.saving.saving : s === "saved" ? COPY.saving.saved : s === "offline" ? COPY.saving.offline : "";
  return <span className="rb-save" role="status" aria-live="polite">{t}</span>;
}

/* ---------- the experience ---------- */

export function ArtistFlow({
  token,
  invite,
  deadlineAt,
  open,
  quote,
  profile,
  takes,
  hasDirection,
  preview = false,
}: {
  token: string;
  invite: ArtistInvite;
  deadlineAt: string | null;
  open: { partOneOpen: boolean; partTwoOpen: boolean };
  quote: QuoteState;
  profile: ProfileState;
  /** Blake's active thoughts for Q4, in order. Empty hides the panel. */
  takes: string[];
  /** Whether a creative direction PDF has been uploaded. */
  hasDirection: boolean;
  /** Admin walk-through: everything works except that nothing is saved or uploaded. */
  preview?: boolean;
}) {
  const [burst, setBurst] = useState(0); // bumps to fire the kiwi-fetti
  const [writingApproach, setWritingApproach] = useState(false);
  const [status, setStatus] = useState<{ one: PartStatus; two: PartStatus }>(() => ({
    one: quote.status === "submitted" && !quote.unsubmitted ? "done" : quote.status === "none" ? "not_started" : "saved",
    two: profile.state && ["complete", "private_only", "kept"].includes(profile.state) ? "done" : profile.exists ? "saved" : "not_started",
  }));
  const [mode, setMode] = useState<Mode>(invite.declined_at ? "declined" : "home");
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [q, setQ] = useState<QuoteDraft>(quote.draft);
  const [p, setP] = useState<ProfileDraft>(profile.draft);
  const [works, setWorks] = useState<WorkDraft[]>(profile.works);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keepSent, setKeepSent] = useState(false);
  const [suggestion, setSuggestion] = useState(invite.decline_suggestion ?? "");
  const [suggestSaved, setSuggestSaved] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // A newer copy kept in this browser (offline edits, a save that never landed) wins, once.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const backup = readBackup<QuoteDraft>(`rb-quote-${token}`, quote.savedAt);
    if (backup) requestAnimationFrame(() => setQ({ ...quote.draft, ...backup }));
  }, [token, quote.draft, quote.savedAt]);

  const quoteSave = useAutosave(q, `rb-quote-${token}`, (v) => saveQuoteDraft(token, v), !preview && open.partOneOpen && mode === "one");
  const snapshot = useMemo(() => ({ p, works }), [p, works]);
  const profileSave = useAutosave(snapshot, `rb-profile-${token}`, (v) => saveProfileDraft(token, v.p, v.works), !preview && open.partTwoOpen && mode === "two");

  const setQf = <K extends keyof QuoteDraft>(k: K, v: QuoteDraft[K]) => setQ((c) => ({ ...c, [k]: v }));
  const setPf = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setP((c) => ({ ...c, [k]: v }));
  const setWork = (id: string, k: keyof WorkDraft, v: string) => setWorks((ws) => ws.map((w) => (w.id === id ? { ...w, [k]: v } : w)));

  /* ----- moving between screens, with the survey's lift-away and settle ----- */
  const go = useCallback((nextMode: Mode, nextIdx = 0) => {
    if (phase === "out") return;
    setError(null);
    setPhase("out");
    window.setTimeout(() => {
      setMode(nextMode);
      setIdx(nextIdx);
      setPhase("in");
      window.scrollTo({ top: 0 });
    }, prefersReducedMotion() ? 0 : 650);
  }, [phase]);

  useEffect(() => {
    if (phase === "in" && mode !== "home") titleRef.current?.focus({ preventScroll: true });
  }, [mode, idx, phase]);

  const progress =
    mode === "home" ? 0.04 :
    mode === "one" ? 0.04 + ((idx + 1) / ONE.length) * 0.46 :
    mode === "oneDone" || mode === "declined" ? 0.5 :
    mode === "two" ? 0.5 + ((idx + 1) / TWO.length) * 0.46 : 1;
  const tp = useTween(progress, 1600);

  /* ----- part one ----- */
  const fee1800 = parseAmount(q.fee_1800x900);
  const amountOk = (s: string) => { const v = parseAmount(s); return v === null || (!Number.isNaN(v) && v >= 0); };
  const oneCanNext: Record<OneKey, boolean> = {
    // "Yes, with a couple of questions" needs at least one question typed.
    interested: !!q.interested && (q.interested !== "yes_with_questions" || questionLines(q.questions_text).some((l) => l.trim())),
    deliver: q.deliver_by === "yes" || (q.deliver_by === "date" && !!q.deliver_date),
    scale: !!q.scale_experience,
    approach: !!q.approach_text.trim() && q.approach_text.length <= QUOTE_LIMITS.approach,
    quote: fee1800 !== null && !Number.isNaN(fee1800) && fee1800 > 0 && amountOk(q.fee_1600x800) && !!q.gst_treatment,
    framing: !!q.framing_option && amountOk(q.framing_cost),
    install: !!q.install_option && amountOk(q.install_cost),
    anythingElse: true,
  };
  const oneOptional = new Set<OneKey>(["framing", "install", "anythingElse"]);
  const oneField: Partial<Record<keyof QuoteDraft, number>> = {
    interested: 0, questions_text: 0, deliver_by: 1, deliver_date: 1, scale_experience: 2, approach_text: 3, fee_1800x900: 4, fee_1600x800: 4,
    gst_treatment: 4, framing_cost: 5, install_cost: 6,
  };

  async function sendPartOne() {
    setSending(true);
    setError(null);
    prepareKiwiConfetti(); // draw the fruit while the answers are on their way
    const r = preview
      ? await new Promise<{ ok: true; declined: boolean }>((done) => window.setTimeout(() => done({ ok: true, declined: q.interested === "no" }), 400))
      : await submitQuote(token, q);
    setSending(false);
    if (!r.ok) {
      const first = r.fields && (Object.keys(r.fields) as (keyof QuoteErrors)[])[0];
      setError(r.error === "closed" ? C1.errors.closed : errText(C1.errors as Record<string, string>, first ? r.fields![first] : "required"));
      if (first && oneField[first] !== undefined && oneField[first] !== idx) go("one", oneField[first]);
      return;
    }
    try { localStorage.removeItem(`rb-quote-${token}`); } catch { /* fine */ }
    setStatus((s) => ({ ...s, one: "done" }));
    if (!r.declined) setBurst((n) => n + 1); // kiwi-fetti for a sent quote
    go(r.declined ? "declined" : "oneDone");
  }

  /* ----- part two ----- */
  const words = wordCount(p.bio);
  const twoCanNext: Record<TwoKey, boolean> = {
    photo: !!p.photo_url,
    name: !!p.name.trim(),
    bio: words >= BIO_WORDS.min && words <= BIO_WORDS.max,
    links: !!(p.website.trim() || p.instagram.trim() || p.other_links.trim()),
    works: works.length >= WORKS.min && works.length <= WORKS.max,
    prompt: !!p.staff_prompt_answer.trim(),
    choice: !!p.visibility_choice && (p.visibility_choice !== "keep" || !!invite.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
    consent: p.consent,
  };
  const twoOptional = new Set<TwoKey>(["photo", "links", "prompt"]);
  const twoField: Partial<Record<keyof ProfileErrors | "email", number>> = { name: 1, bio: 2, works: 4, visibility_choice: 6, email: 6, consent: 7 };

  async function sendPartTwo() {
    setSending(true);
    setError(null);
    const r = preview
      ? await new Promise<{ ok: true; keepSent: boolean }>((done) => window.setTimeout(() => done({ ok: true, keepSent: p.visibility_choice === "keep" }), 400))
      : await submitProfile(token, p, works, email);
    setSending(false);
    if (!r.ok) {
      const first = r.fields && (Object.keys(r.fields) as (keyof typeof twoField)[])[0];
      setError(r.error === "closed" ? C2.errors.closed : errText(C2.errors as Record<string, string>, first ? r.fields![first as keyof typeof r.fields] : "name"));
      if (first && twoField[first] !== undefined && twoField[first] !== idx) go("two", twoField[first]);
      return;
    }
    try { localStorage.removeItem(`rb-profile-${token}`); } catch { /* fine */ }
    setKeepSent(r.keepSent);
    setStatus((s) => ({ ...s, two: "done" }));
    go("twoDone");
  }

  async function addUpload(kind: "photo" | "work", files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    if (preview) {
      // Nothing leaves the device in a preview: show the chosen images from memory.
      if (kind === "photo") setPf("photo_url", URL.createObjectURL(files[0]));
      else {
        const add = Array.from(files).slice(0, WORKS.max - works.length).map((f, n) => {
          const url = URL.createObjectURL(f);
          return { id: `preview-${Date.now()}-${n}`, image_url: url, thumb_url: url, title: "", year: "", medium: "", size: "", note: "" };
        });
        setWorks((ws) => [...ws, ...add]);
      }
      setUploading(false);
      return;
    }
    if (kind === "work") {
      for (const f of Array.from(files).slice(0, WORKS.max - works.length)) {
        const r = await uploadImage<{ work: WorkDraft }>(token, "work", f);
        if (r.ok) setWorks((ws) => [...ws, r.data.work]);
        else { setError(r.error); break; }
      }
    } else {
      const r = await uploadImage(token, kind, files[0]);
      if (!r.ok) setError(r.error);
      else setPf("photo_url", r.data.url);
    }
    setUploading(false);
  }

  /* ----- the current screen ----- */
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  const stepActions = (canNext: boolean, optional: boolean, last: boolean, onNext: () => void, onBack: () => void, save: SaveStatus) => (
    <>
      {error && <p className="rb-error" role="alert">{error}</p>}
      <div className="rb-actions">
        <button type="button" className="rb-next" disabled={sending || (!canNext && !(last && optional))} onClick={onNext}>
          {sending ? COPY.saving.saving : last ? (mode === "one" ? C1.submit : C2.submit) : COPY.flow.next}
          <span className="rb-arrow" aria-hidden="true" />
        </button>
        <span className="rb-hint" aria-hidden="true">{COPY.flow.hint}</span>
        <span className="rb-quiet">
          <SaveText s={save} />
          <button type="button" className="rb-link" onClick={onBack}>{COPY.flow.back}</button>
          {optional && !last && (
            <>
              <span aria-hidden="true">·</span>
              <button type="button" className="rb-link" onClick={onNext}>{COPY.flow.skip}</button>
            </>
          )}
        </span>
      </div>
    </>
  );

  if (mode === "home") {
    const featured = safeUrl(invite.featured_image_url);
    const source = safeUrl(invite.featured_source_url);
    const site = safeUrl(invite.site_url);
    const oneLabel = status.one === "saved" ? COPY.landing.continueOne : COPY.landing.startOne;
    const twoLabel = status.two === "saved" ? COPY.landing.continueTwo : status.two === "done" ? COPY.landing.editTwo : COPY.landing.startTwo;
    const nextIsOne = status.one !== "done" && open.partOneOpen;
    body = (
      <div className="rb-home">
        {/* As on the staff survey: the letter beside the room, with the Rabobank wordmark. */}
        <div className="rb-intro">
          <div>
            <p className="rb-eyebrow">{COPY.landing.eyebrow}</p>
            <h1 className="rb-title">{COPY.landing.greeting(invite.first_name)}</h1>
            {invite.why_paragraph?.split(/\n{2,}/).map((para, i) => <p key={i} className="rb-copy">{para}</p>)}
          </div>
          <figure className="rb-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rabobank-pilot/room.webp" alt="A render of the Te Puke event space, with a table at its centre and the focal wall on the left" width={684} height={384} />
            <div className="rb-figmeta">
              <figcaption>{COPY.landing.roomCaption}</figcaption>
              {/* The official Rabobank wordmark, unaltered. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rb-mark" src="/rabobank-pilot/rabobank-wordmark.png" alt="Rabobank" width={401} height={76} />
            </div>
          </figure>
        </div>

        {featured && (
          <figure className="rb-feature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured} alt={invite.featured_title ?? ""} />
            <figcaption>
              {invite.featured_title && <strong>{invite.featured_title}</strong>}
              {invite.featured_caption && <>{invite.featured_title ? ". " : ""}{invite.featured_caption}</>}
              {source && <><br />{COPY.landing.featuredCredit} <a href={source} target="_blank" rel="noopener noreferrer">{source.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></>}
              {site && <><br /><a href={site} target="_blank" rel="noopener noreferrer">{COPY.landing.siteLink}</a></>}
            </figcaption>
          </figure>
        )}
        {!featured && site && <a href={site} target="_blank" rel="noopener noreferrer" className="rb-sitelink">{COPY.landing.siteLink}</a>}

        <section className="rb-section">
          <p className="rb-eyebrow">{COPY.landing.briefHeading}</p>
          {COPY.landing.briefBody.split(/\n{2,}/).map((para, i) => <p key={i} className="rb-copy">{para}</p>)}
          {deadlineAt && <p className="rb-deadline">{COPY.landing.deadline(formatNzDate(deadlineAt))}</p>}
          {hasDirection && (
            <div className="rb-direction">
              <a className="rb-work" href={`/partners/rabobank/artists/${token}/direction`} target="_blank" rel="noopener">
                {COPY.landing.directionButton} <span className="rb-arrow" aria-hidden="true" />
              </a>
            </div>
          )}
        </section>

        <section className="rb-section">
          <p className="rb-eyebrow">{COPY.landing.wallHeading}</p>
          <WallViewer />
        </section>

        <section className="rb-section">
          <p className="rb-eyebrow">{COPY.landing.partsHeading}</p>
          <div className="rb-parts">
            {([[1, C1.title.replace(/^Part one: /, ""), C1.summary, status.one, C1.duration], [2, C2.title.replace(/^Part two: /, ""), C2.summary, status.two, C2.duration]] as const).map(([n, title, summary, s, duration]) => (
              <div key={n} className="rb-part">
                <p className="rb-part-n">
                  {COPY.landing.stageLabel(n)}
                  <span className="rb-status" data-s={s}>{COPY.landing.status[s]}</span>
                  {duration && <span className="rb-status rb-time"><Clock aria-hidden="true" />{duration}</span>}
                </p>
                <h3>{title}</h3>
                <p>{summary}</p>
              </div>
            ))}
          </div>
          <div className="rb-actions">
            {nextIsOne ? (
              <button type="button" className="rb-next" onClick={() => go("one", 0)}>{oneLabel} <span className="rb-arrow" aria-hidden="true" /></button>
            ) : open.partTwoOpen ? (
              <button type="button" className="rb-next" onClick={() => go("two", 0)}>{twoLabel} <span className="rb-arrow" aria-hidden="true" /></button>
            ) : null}
            {!nextIsOne && status.one === "done" && open.partOneOpen && (
              <button type="button" className="rb-link" onClick={() => go("one", 0)}>{COPY.landing.editOne}</button>
            )}
          </div>
          {!open.partOneOpen && status.one !== "done" && <p className="rb-small">{C1.errors.closed}</p>}
          <p className="rb-small">{COPY.landing.profileRequired}</p>
        </section>
      </div>
    );
  } else if (mode === "one") {
    const key = ONE[idx];
    const last = idx === ONE.length - 1;
    const next = () => {
      if (key === "interested" && q.interested === "no") return void sendPartOne();
      if (last) return void sendPartOne();
      if (!oneCanNext[key] && !oneOptional.has(key)) return;
      go("one", idx + 1);
    };
    const enter = () => { if (oneCanNext[key] || last) next(); };
    const back = () => (idx === 0 ? go("home") : go("one", idx - 1));
    const Q = C1.q;
    const titles: Record<OneKey, [string, string | undefined]> = {
      interested: [Q.interested.label, Q.interested.help],
      deliver: [Q.deliver.label, Q.deliver.help],
      scale: [Q.scale.label, Q.scale.help],
      approach: [Q.approach.label, Q.approach.help],
      quote: [Q.quote.label, Q.quote.help],
      framing: [Q.framing.label, Q.framing.help],
      install: [Q.install.label, Q.install.help],
      anythingElse: [Q.anythingElse.label, Q.anythingElse.help],
    };
    const [title, help] = titles[key];
    let input: React.ReactNode = null;
    switch (key) {
      case "interested":
        input = (
          <>
            <Pebbles name="interested" label={title} value={q.interested} options={C1.options.interested} onChange={(v) => setQf("interested", v)} />
            {q.interested === "yes_with_questions" && (
              <div className="rb-note">
                <Sub>{Q.questions.label}</Sub>
                <QuestionList value={q.questions_text} onChange={(v) => setQf("questions_text", v)} onDone={enter} />
              </div>
            )}
          </>
        );
        break;
      case "deliver":
        input = (
          <>
            <Pebbles name="deliver" label={title} value={q.deliver_by} options={C1.options.deliver} onChange={(v) => setQf("deliver_by", v)} />
            {q.deliver_by === "date" && (
              <div className="rb-note" style={{ maxWidth: "16rem" }}>
                <Line id="rb-date" type="date" value={q.deliver_date} onChange={(v) => setQf("deliver_date", v)} label={title} onEnter={enter} />
              </div>
            )}
          </>
        );
        break;
      case "scale":
        input = (
          <>
            <Pebbles name="scale" label={title} value={q.scale_experience} options={C1.options.scale} onChange={(v) => setQf("scale_experience", v)} />
          </>
        );
        break;
      case "approach":
        input = (
          <>
            <TakesPanel takes={takes} paused={writingApproach} />
            <div onFocusCapture={() => setWritingApproach(true)} onBlurCapture={() => setWritingApproach(false)}>
              <Writing id="rb-approach" value={q.approach_text} onChange={(v) => setQf("approach_text", v)} limit={QUOTE_LIMITS.approach} label={title} onEnter={enter} />
            </div>
          </>
        );
        break;
      case "quote":
        input = (
          <>
            <div className="rb-fields rb-fields--2">
              <div>
                <Sub htmlFor="rb-fee1800">{Q.quote.fee1800}</Sub>
                <Money id="rb-fee1800" value={q.fee_1800x900} onChange={(v) => setQf("fee_1800x900", v)} label={Q.quote.fee1800} onEnter={enter} />
              </div>
              <div>
                <Sub htmlFor="rb-fee1600" optional>{Q.quote.fee1600}</Sub>
                <Money id="rb-fee1600" value={q.fee_1600x800} onChange={(v) => setQf("fee_1600x800", v)} label={Q.quote.fee1600} onEnter={enter} />
              </div>
            </div>
            {/* Required once any amount is entered. */}
            {hasAnyAmount(q) && (
              <div className="rb-note">
                <Sub>{Q.quote.gst.label}</Sub>
                <Pebbles name="gst" label={Q.quote.gst.label} value={q.gst_treatment} options={Q.quote.gst.options} onChange={(v) => setQf("gst_treatment", v)} />
              </div>
            )}
            <div className="rb-note" style={{ marginTop: "2rem" }}>
              <Sub htmlFor="rb-alt" optional>{Q.quote.altSize}</Sub>
              <Writing id="rb-alt" small value={q.alt_size_note} onChange={(v) => setQf("alt_size_note", v)} limit={QUOTE_LIMITS.altSize} label={Q.quote.altSize} onEnter={enter} />
            </div>
          </>
        );
        break;
      case "framing":
      case "install": {
        const isF = key === "framing";
        const cq = isF ? Q.framing : Q.install;
        input = (
          <>
            <Pebbles
              name={key}
              label={title}
              value={isF ? q.framing_option : q.install_option}
              options={C1.options.who}
              onChange={(v) => setQf(isF ? "framing_option" : "install_option", v)}
            />
            <div className="rb-fields rb-fields--2">
              <div>
                <Sub htmlFor={`rb-${key}-cost`} optional>{cq.cost}</Sub>
                <Money id={`rb-${key}-cost`} value={isF ? q.framing_cost : q.install_cost} onChange={(v) => setQf(isF ? "framing_cost" : "install_cost", v)} label={cq.cost} onEnter={enter} />
              </div>
              <div>
                <Sub htmlFor={`rb-${key}-rec`} optional>{cq.recommendation}</Sub>
                <Line id={`rb-${key}-rec`} value={isF ? q.framing_recommendation : q.install_recommendation} onChange={(v) => setQf(isF ? "framing_recommendation" : "install_recommendation", v)} label={cq.recommendation} maxLength={QUOTE_LIMITS.recommendation} onEnter={enter} />
              </div>
              {!isF && (
                <div>
                  <Sub htmlFor="rb-based" optional>{Q.install.basedIn}</Sub>
                  <Line id="rb-based" value={q.based_in} onChange={(v) => setQf("based_in", v)} label={Q.install.basedIn} maxLength={QUOTE_LIMITS.basedIn} onEnter={enter} />
                </div>
              )}
            </div>
          </>
        );
        break;
      }
      case "anythingElse":
        input = <Writing id="rb-else" value={q.anything_else} onChange={(v) => setQf("anything_else", v)} limit={QUOTE_LIMITS.anythingElse} label={title} onEnter={enter} autoFocus />;
        break;
    }
    body = (
      <>
        <p className="rb-eyebrow">{COPY.flow.stepOf(C1.short, idx + 1, ONE.length)}</p>
        <h2 className="rb-title" data-long={title.length > 70} ref={titleRef} tabIndex={-1}>{title}</h2>
        {help && <p className="rb-help">{help}</p>}
        <div className="rb-body">{input}</div>
      </>
    );
    const declining = key === "interested" && q.interested === "no";
    actions = stepActions(oneCanNext[key], oneOptional.has(key), last || declining, next, back, quoteSave);
  } else if (mode === "two") {
    const key = TWO[idx];
    const last = idx === TWO.length - 1;
    const next = () => {
      if (last) return void sendPartTwo();
      if (!twoCanNext[key] && !twoOptional.has(key)) return;
      go("two", idx + 1);
    };
    const enter = () => { if (twoCanNext[key]) next(); };
    const back = () => (idx === 0 ? go("home") : go("two", idx - 1));
    const Q = C2.q;
    const titles: Record<TwoKey, [string, string | undefined]> = {
      photo: [Q.photo.label, Q.photo.help],
      name: [Q.name.label, Q.name.help],
      bio: [Q.bio.label, Q.bio.help],
      links: [Q.website.label, undefined],
      works: [Q.works.label, Q.works.help],
      prompt: [Q.staffPrompt.label, Q.staffPrompt.help],
      choice: [Q.choice.label, undefined],
      consent: [Q.consent.label, undefined],
    };
    const [title, help] = titles[key];
    let input: React.ReactNode = null;
    switch (key) {
      case "photo":
        input = (
          <div className="rb-photo">
            <span className="rb-photo-ring">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.photo_url && <img src={p.photo_url} alt="" />}
            </span>
            <label className="rb-add" aria-disabled={uploading}>
              {uploading ? COPY.saving.saving : Q.photo.button}
              <input type="file" accept={ACCEPT} onChange={(e) => { void addUpload("photo", e.target.files); e.target.value = ""; }} />
            </label>
            {p.photo_url && <button type="button" className="rb-link" onClick={() => { setPf("photo_url", ""); if (!preview) void removePhoto(token); }}>{C2.work.remove}</button>}
          </div>
        );
        break;
      case "name":
        input = (
          <div className="rb-fields rb-fields--2">
            <div>
              <Sub htmlFor="rb-name">{Q.name.label}</Sub>
              <Line id="rb-name" value={p.name} onChange={(v) => setPf("name", v)} label={Q.name.label} maxLength={PROFILE_LIMITS.name} autoComplete="name" onEnter={enter} />
            </div>
            <div>
              <Sub htmlFor="rb-location" optional>{Q.location.label}</Sub>
              <Line id="rb-location" value={p.location} onChange={(v) => setPf("location", v)} label={Q.location.label} maxLength={PROFILE_LIMITS.location} onEnter={enter} />
            </div>
          </div>
        );
        break;
      case "bio":
        input = (
          <div style={{ position: "relative" }}>
            <Writing id="rb-bio" value={p.bio} onChange={(v) => setPf("bio", v)} limit={PROFILE_LIMITS.bio} label={title} onEnter={() => {}} autoFocus />
            <span className="rb-words" data-ok={!words || (words >= BIO_WORDS.min && words <= BIO_WORDS.max)}>{C2.words(words)}</span>
          </div>
        );
        break;
      case "links":
        input = (
          <div className="rb-fields rb-fields--2">
            <div>
              <Sub htmlFor="rb-web" optional>{Q.website.label}</Sub>
              <Line id="rb-web" value={p.website} onChange={(v) => setPf("website", v)} label={Q.website.label} inputMode="url" autoComplete="url" maxLength={PROFILE_LIMITS.website} onEnter={enter} />
            </div>
            <div>
              <Sub htmlFor="rb-ig" optional>{Q.instagram.label}</Sub>
              <Line id="rb-ig" value={p.instagram} onChange={(v) => setPf("instagram", v)} label={Q.instagram.label} maxLength={PROFILE_LIMITS.instagram + 30} onEnter={enter} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Sub htmlFor="rb-other" optional>{Q.otherLinks.label}</Sub>
              <Writing id="rb-other" small value={p.other_links} onChange={(v) => setPf("other_links", v)} limit={PROFILE_LIMITS.otherLinks} label={Q.otherLinks.label} onEnter={enter} />
            </div>
          </div>
        );
        break;
      case "works":
        input = (
          <>
            <p className="rb-count">{C2.worksCount(works.length, WORKS.min, WORKS.max)}</p>
            <div className="rb-works">
              {works.map((w, i) => (
                <div key={w.id} className="rb-workcard">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.thumb_url ?? w.image_url} alt="" />
                  <div>
                    <div className="rb-fields rb-fields--2">
                      <Line id={`w-${i}-t`} value={w.title} onChange={(v) => setWork(w.id, "title", v)} label={`${C2.work.title} ${i + 1}`} placeholder={C2.work.title} maxLength={PROFILE_LIMITS.workTitle} />
                      <Line id={`w-${i}-y`} value={w.year} onChange={(v) => setWork(w.id, "year", v)} label={`${C2.work.year} ${i + 1}`} placeholder={C2.work.year} inputMode="numeric" maxLength={PROFILE_LIMITS.workYear} />
                      <Line id={`w-${i}-m`} value={w.medium} onChange={(v) => setWork(w.id, "medium", v)} label={`${C2.work.medium} ${i + 1}`} placeholder={C2.work.medium} maxLength={PROFILE_LIMITS.workMedium} />
                      <Line id={`w-${i}-s`} value={w.size} onChange={(v) => setWork(w.id, "size", v)} label={`${C2.work.size} ${i + 1}`} placeholder={C2.work.size} maxLength={PROFILE_LIMITS.workSize} />
                    </div>
                    <div style={{ marginTop: "0.9rem" }}>
                      <Line id={`w-${i}-n`} value={w.note} onChange={(v) => setWork(w.id, "note", v)} label={`${C2.work.note} ${i + 1}`} placeholder={C2.work.note} maxLength={PROFILE_LIMITS.workNote} />
                    </div>
                    <button type="button" className="rb-link" onClick={() => { setWorks((ws) => ws.filter((x) => x.id !== w.id)); if (!preview) void removeWork(token, w.id); }}>{C2.work.remove}</button>
                  </div>
                </div>
              ))}
            </div>
            {works.length < WORKS.max && (
              <label className="rb-add" aria-disabled={uploading}>
                {uploading ? COPY.saving.saving : C2.work.add}
                <input type="file" accept={ACCEPT} multiple onChange={(e) => { void addUpload("work", e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </>
        );
        break;
      case "prompt":
        input = <Writing id="rb-prompt" value={p.staff_prompt_answer} onChange={(v) => setPf("staff_prompt_answer", v)} limit={PROFILE_LIMITS.staffPrompt} label={title} onEnter={enter} autoFocus />;
        break;
      case "choice":
        input = (
          <>
            <Pebbles name="choice" label={title} value={p.visibility_choice} options={C2.choices} onChange={(v) => setPf("visibility_choice", v)} />
            {p.visibility_choice === "keep" && !invite.email && (
              <div className="rb-note" style={{ maxWidth: "24rem" }}>
                <Sub htmlFor="rb-email">{Q.keepEmail.label}</Sub>
                <Line id="rb-email" type="email" value={email} onChange={setEmail} label={Q.keepEmail.label} autoComplete="email" onEnter={enter} />
              </div>
            )}
          </>
        );
        break;
      case "consent":
        input = (
          <>
            <div className="rb-consent">{fill(Q.consent.body, { contactEmail: CONTACT_EMAIL }).split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
            <label className="rb-check rb-check--block">
              <input type="checkbox" checked={p.consent} onChange={(e) => setPf("consent", e.target.checked)} />
              <span>{Q.consent.tick}</span>
            </label>
          </>
        );
        break;
    }
    body = (
      <>
        <p className="rb-eyebrow">{COPY.flow.stepOf(C2.short, idx + 1, TWO.length)}</p>
        <h2 className="rb-title" data-long={title.length > 70} ref={titleRef} tabIndex={-1}>{title}</h2>
        {help && <p className="rb-help">{help}</p>}
        <div className="rb-body">{input}</div>
      </>
    );
    actions = stepActions(twoCanNext[key], twoOptional.has(key), last, next, back, profileSave);
  } else if (mode === "oneDone") {
    body = (
      <>
        <p className="rb-eyebrow">{C1.short}</p>
        <h2 className="rb-title" ref={titleRef} tabIndex={-1}>{COPY.thanks.heading}</h2>
        <p className="rb-copy">{COPY.thanks.body}</p>
        <p className="rb-copy">{COPY.thanks.next}</p>
        <p className="rb-copy">{COPY.thanks.partTwoWhy}</p>
      </>
    );
    actions = (
      <div className="rb-actions">
        {open.partTwoOpen && status.two !== "done" && (
          <button type="button" className="rb-next" onClick={() => go("two", 0)}>{COPY.landing.startTwo} <span className="rb-arrow" aria-hidden="true" /></button>
        )}
        <span className="rb-quiet"><button type="button" className="rb-link" onClick={() => go("home")}>{COPY.flow.back}</button></span>
      </div>
    );
  } else if (mode === "twoDone") {
    body = (
      <>
        <p className="rb-eyebrow">{C2.short}</p>
        <h2 className="rb-title" ref={titleRef} tabIndex={-1}>{COPY.done.heading}</h2>
        <p className="rb-copy">{COPY.done.body}</p>
        <p className="rb-copy">{COPY.done.next}</p>
        {keepSent && <p className="rb-already">{COPY.done.keepSent}</p>}
        <p className="rb-patronage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Favicon_Bleed_512.png" alt="" width={22} height={22} />
          Patronage
        </p>
      </>
    );
    actions = (
      <div className="rb-actions">
        {status.one !== "done" && open.partOneOpen && (
          <button type="button" className="rb-next" onClick={() => go("one", 0)}>{COPY.landing.startOne} <span className="rb-arrow" aria-hidden="true" /></button>
        )}
        <span className="rb-quiet"><button type="button" className="rb-link" onClick={() => go("home")}>{COPY.flow.back}</button></span>
      </div>
    );
  } else {
    const D = C1.declined;
    body = (
      <>
        <p className="rb-eyebrow">{C1.short}</p>
        <h2 className="rb-title" ref={titleRef} tabIndex={-1}>{D.heading}</h2>
        <p className="rb-copy">{D.body}</p>
        <div className="rb-body">
          <Sub htmlFor="rb-suggest" optional>{D.suggestLabel}</Sub>
          {D.suggestHelp && <p className="rb-help">{D.suggestHelp}</p>}
          <Writing id="rb-suggest" small value={suggestion} onChange={(v) => { setSuggestion(v); setSuggestSaved(false); }} limit={QUOTE_LIMITS.suggestion} label={D.suggestLabel} onEnter={() => {}} />
        </div>
      </>
    );
    actions = (
      <div className="rb-actions">
        <button type="button" className="rb-next" disabled={!suggestion.trim()} onClick={async () => { const r = await saveDeclineSuggestion(token, suggestion); setSuggestSaved(r.ok); }}>
          {D.suggestSave}
        </button>
        {suggestSaved && <span className="rb-save" role="status">{D.suggestSaved}</span>}
        <span className="rb-quiet">
          {open.partOneOpen && <button type="button" className="rb-link" onClick={() => { setQf("interested", ""); go("one", 0); }}>{C1.title}</button>}
        </span>
      </div>
    );
  }

  const wide = mode === "home";
  return (
    <div className="rb" data-step={mode === "home" ? "home" : mode} data-phase={mode === "home" ? "intro" : "questions"} style={{ ["--p" as string]: tp }}>
      <Scene p={tp} />
      {burst > 0 && <KiwiConfetti key={burst} />}
      {preview && <p className="rb-preview" role="note">Preview · answers aren&rsquo;t saved</p>}
      <div className="rb-stage">
        <div className={`rb-col rb-${phase}${wide ? " rb-col--wide" : ""}`} key={`${mode}-${idx}`}>
          {body}
          {actions}
        </div>
      </div>
    </div>
  );
}

