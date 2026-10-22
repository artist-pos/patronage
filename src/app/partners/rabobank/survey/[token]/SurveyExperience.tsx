"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import {
  LIMITS,
  QUESTIONS,
  type Question,
  type MultiField,
  type TextField,
} from "@/lib/rabobank/survey";
import type { NameMode } from "@/lib/rabobank/settings";
import { submitSurvey } from "./actions";
import { KiwiConfetti, prepareKiwiConfetti } from "./KiwiConfetti";
import "./survey.css";

const DONE_KEY = "rabobank_survey_done";
const WORK_URL = "https://patronage.nz/blakeaitken?utm_source=rabobank_survey&utm_medium=survey&utm_campaign=rabobank_te_puke";
const PARTING = "Thank you for helping shape an artwork about where you work, who you work with, and what you make possible together.";

type Answers = {
  artRelation: string;
  artNote: string;
  roomWants: string[];
  roomUses: string[];
} & Record<TextField, string> & { firstName: string };

const EMPTY: Answers = {
  artRelation: "", artNote: "", roomWants: [], roomUses: [],
  story: "", place: "", cooperation: "", meaning: "", artist: "", wrong: "", memory: "",
  firstName: "",
};

type Step = { kind: "intro" } | { kind: "q"; q: Question } | { kind: "name" } | { kind: "thanks" };

/* ---------- small helpers ---------- */

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function finePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

/** Eases a number toward a target, so the light and the path move rather than jump. */
function useTween(target: number, ms = 2400): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      from.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const origin = current.current;
    from.current = origin;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      current.current = origin + (target - origin) * e;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** De Casteljau: the part of a cubic Bezier from 0 to t. */
function bezierTo(p: [number, number][], t: number) {
  const lerp = (a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = lerp(p[0], p[1]), b = lerp(p[1], p[2]), c = lerp(p[2], p[3]);
  const d = lerp(a, b), e = lerp(b, c);
  return { c1: a, c2: d, end: lerp(d, e) };
}

// A single line across the foot of the page, 1000 wide by 100 high.
const TRAIL: [number, number][] = [[0, 78], [260, 8], [560, 122], [1000, 30]];

/** A soft light that warms as you go, and the line that grows with you. */
function Scene({ p }: { p: number }) {
  const t = Math.max(0.002, Math.min(1, p));
  const { c1, c2, end } = bezierTo(TRAIL, t);
  const d = `M ${TRAIL[0][0]} ${TRAIL[0][1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${end[0]} ${end[1]}`;
  return (
    <div className="rb-scene" aria-hidden="true">
      <div className="rb-glow" />
      <div className="rb-trail">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" focusable="false">
          <path d={d} fill="none" stroke="#ff6700" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="rb-trail-dot" style={{ left: `${end[0] / 10}%`, top: `${end[1]}%` }} />
      </div>
    </div>
  );
}

function Writing({
  id, value, onChange, limit, label, small, onEnter, autoFocus, placeholder,
}: {
  id: string; value: string; onChange: (v: string) => void; limit: number; label: string;
  small?: boolean; onEnter: () => void; autoFocus?: boolean; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    if (autoFocus && finePointer()) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const left = limit - value.length;
  return (
    <div className="rb-write">
      <textarea
        ref={ref}
        id={id}
        className={`rb-textarea${small ? " rb-textarea--small" : ""}`}
        rows={small ? 1 : 2}
        maxLength={limit}
        value={value}
        placeholder={placeholder ?? "Start writing…"}
        aria-label={label}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      <span className="rb-rule" aria-hidden="true" />
      <span className="rb-left" data-show={left <= Math.max(20, limit * 0.15)} aria-live="polite">
        {left <= Math.max(20, limit * 0.15) ? `${left} left` : ""}
      </span>
    </div>
  );
}

/* ---------- the experience ---------- */

export function SurveyExperience({
  token,
  nameMode,
  closeDate,
  state,
  message,
  preview = false,
}: {
  token: string;
  nameMode: NameMode;
  closeDate: string;
  state: "open" | "closed";
  message?: string;
  /** Admin walk-through: everything works except that nothing is sent or remembered. */
  preview?: boolean;
}) {
  const steps: Step[] = [
    { kind: "intro" },
    ...QUESTIONS.map((q) => ({ kind: "q", q }) as Step),
    ...(nameMode === "off" ? [] : [{ kind: "name" } as Step]),
    { kind: "thanks" },
  ];
  const last = steps.length - 1;

  const [idx, setIdx] = useState(0);
  const [dest, setDest] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [a, setA] = useState<Answers>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [burst, setBurst] = useState(0); // 0 until sent; bumping it replays the confetti
  const loadedAt = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLDivElement>(null);

  const remembered = useSyncExternalStore(
    () => () => {},
    () => {
      try { return Boolean(localStorage.getItem(DONE_KEY)); } catch { return false; }
    },
    () => false
  );
  const alreadyDone = remembered && !preview;

  useEffect(() => { loadedAt.current = Date.now(); }, []);

  const step = steps[idx];
  const progress = state === "closed" ? 0.12 : dest / last;
  const p = useTween(progress, 1800);

  const go = useCallback((to: number) => {
    if (phase === "out") return;
    setError(null);
    setDest(to);
    setPhase("out");
    const wait = prefersReducedMotion() ? 0 : 700;
    window.setTimeout(() => {
      setIdx(to);
      setPhase("in");
      window.scrollTo({ top: 0 });
    }, wait);
  }, [phase]);

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    if (phase === "in") titleRef.current?.focus({ preventScroll: true });
  }, [idx, phase]);

  // On the sent screen, drift slowly down so the closing line, sign-off and
  // wordmark come into view as they fade in. Any scroll or touch of their own wins.
  const onThanks = step.kind === "thanks" && phase === "in";
  useEffect(() => {
    if (!onThanks || prefersReducedMotion()) return;
    const root = document.scrollingElement ?? document.documentElement;
    let raf = 0;
    let cancelled = false;
    // Only a deliberate scroll of their own takes over: a wheel that actually
    // moves, a swipe, or a scrolling key. Clicks and taps don't.
    const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);
    const stop = () => { cancelled = true; cancelAnimationFrame(raf); detach(); };
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 2) stop(); };
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) stop(); };
    const detach = () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey);
    };
    // Next frame, or ~50ms later if the browser is holding frames back (some
    // windows and embeds pause requestAnimationFrame entirely).
    const frame = (cb: (now: number) => void) => {
      let done = false;
      const run = () => { if (!done) { done = true; cb(performance.now()); } };
      raf = requestAnimationFrame(run);
      window.setTimeout(run, 50);
    };
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      // Listen only from here, so momentum left over from reaching Send can't cancel it.
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchmove", stop, { passive: true });
      window.addEventListener("keydown", onKey);
      const from = root.scrollTop;
      const end = () => root.scrollHeight - window.innerHeight; // re-measured each frame
      if (end() <= from + 4) return;
      const duration = Math.min(8000, Math.max(5500, (end() - from) * 14)); // slow on purpose
      const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const k = Math.min(1, (now - t0) / duration);
        root.scrollTop = from + (end() - from) * ease(k);
        if (k < 1) frame(tick);
        else detach();
      };
      frame(tick);
    }, 1200);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [onThanks]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((cur) => ({ ...cur, [k]: v }));

  async function finish() {
    if (sending) return;
    setError(null);
    if (nameMode === "required" && !a.firstName.trim()) {
      setError("Please add your first name so we can tell responses apart.");
      return;
    }
    setSending(true);
    prepareKiwiConfetti(); // draw the fruit now, while the answers are on their way
    if (preview) {
      await new Promise((r) => setTimeout(r, 400)); // roughly what a real send feels like
      setSending(false);
      setBurst(1);
      go(last);
      return;
    }
    const hp = (honeypot.current?.querySelector("input") as HTMLInputElement | null)?.value ?? "";
    const res = await submitSurvey({
      token,
      firstName: a.firstName,
      artRelation: a.artRelation,
      artNote: a.artNote,
      story: a.story,
      place: a.place,
      cooperation: a.cooperation,
      meaning: a.meaning,
      roomWants: a.roomWants,
      roomUses: a.roomUses,
      wrong: a.wrong,
      memory: a.memory,
      artist: a.artist,
      completionSeconds: (Date.now() - loadedAt.current) / 1000,
      [HONEYPOT_FIELD]: hp,
    });
    setSending(false);
    if (!res.ok) { setError(res.error); return; }
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* a courtesy flag, nothing more */ }
    setBurst(1);
    go(last);
  }

  const next = () => (idx === last - 1 ? void finish() : go(idx + 1));
  const back = () => go(Math.max(0, idx - 1));

  /** Up to `max` picks; an `exclusive` option (e.g. "I haven't seen it") stands alone. */
  function toggleMulti(field: MultiField, option: string, max: number, exclusive?: string) {
    setA((cur) => {
      const list = cur[field];
      if (list.includes(option)) return { ...cur, [field]: list.filter((w) => w !== option) };
      if (option === exclusive) return { ...cur, [field]: [option] };
      const base = list.filter((w) => w !== exclusive);
      return base.length >= max ? cur : { ...cur, [field]: [...base, option] };
    });
  }

  const dataPhase = step.kind === "intro" ? "intro" : step.kind === "thanks" ? "thanks" : "questions";
  const stepName = step.kind === "q" ? "q" : step.kind;

  /* ----- content for the current step ----- */
  let body: React.ReactNode = null;
  let canSkip = false;
  // Enter and Next only move on once there's an answer; skipping is its own quieter link.
  const enter = () => { if (!canSkip || idx === last - 1) next(); };

  if (state === "closed") {
    body = (
      <>
        <p className="rb-eyebrow">Rabobank Te Puke &middot; Event Space Artwork</p>
        <h1 className="rb-title" ref={titleRef} tabIndex={-1}>Kia ora.</h1>
        <p className="rb-copy">{message}</p>
      </>
    );
  } else if (step.kind === "intro") {
    body = (
      <div className="rb-intro">
        <div>
        <p className="rb-eyebrow">Rabobank Te Puke &middot; Event Space Artwork</p>
        <h1 className="rb-title" ref={titleRef} tabIndex={-1}>Kia ora,</h1>
        <p className="rb-copy">I&rsquo;m Blake, an artist and architectural graduate, and the founder of Patronage. I&rsquo;m working with Rabobank on an artwork for the Te Puke event space, where colleagues, clients and community come together.</p>
        <p className="rb-copy">I spent the first years of my schooling at Paengaroa Primary School, so this part of the Bay of Plenty has a connection to my own story, too.</p>
        <p className="rb-copy">I&rsquo;m interested in the stories, places and relationships that make this part of the world what it is. You don&rsquo;t need to know anything about art to take part. There are no right answers, and a sentence or two is plenty.</p>
        <p className="rb-copy">Your answers will help shape the brief and the artists invited to respond to it. It takes about five minutes, and the survey closes {closeDate}. In early November, you&rsquo;ll be invited back to see the shortlisted artists and respond to their work.</p>
        {alreadyDone && (
          <p className="rb-already" role="status">It looks like you&rsquo;ve already shared your answers from this device. You&rsquo;re welcome to add more.</p>
        )}
        <div className="rb-actions">
          <button type="button" className="rb-next" onClick={() => go(1)}>Begin <span className="rb-arrow" aria-hidden="true" /></button>
        </div>
        </div>
        <figure className="rb-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rabobank-pilot/room.webp" alt="A render of the Te Puke event space, with a table at its centre and the focal wall on the left" width={684} height={384} />
          <div className="rb-figmeta">
            <figcaption>The event space</figcaption>
            {/* The official Rabobank wordmark, unaltered. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rb-mark" src="/rabobank-pilot/rabobank-wordmark.png" alt="Rabobank" width={401} height={76} />
          </div>
        </figure>
      </div>
    );
  } else if (step.kind === "q") {
    const q = step.q;
    const n = QUESTIONS.indexOf(q) + 1;
    const long = q.title.length > 90;
    const heading = (
      <>
        <p className="rb-eyebrow">{q.eyebrow}{q.optional ? " · optional" : ""}</p>
        <h2 className="rb-title" id="rb-q" data-long={long} ref={titleRef} tabIndex={-1}>
          <span className="rb-sr">Question {n} of {QUESTIONS.length}. </span>{q.title}
        </h2>
        {q.help && <p className="rb-help" id="rb-help">{q.help}</p>}
      </>
    );
    if (q.kind === "text") {
      const value = a[q.field];
      canSkip = !value.trim();
      body = (
        <>
          {heading}
          <div className="rb-body">
            <Writing id="rb-field" value={value} onChange={(v) => set(q.field, v)} limit={q.limit} label={q.title} autoFocus onEnter={enter} />
          </div>
        </>
      );
    } else if (q.kind === "single") {
      canSkip = !a.artRelation && !a.artNote.trim();
      body = (
        <>
          {heading}
          <fieldset className="rb-pebbles rb-body" aria-labelledby="rb-q" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enter(); } }}>
            {q.options.map((o) => (
              <label key={o} className="rb-pebble">
                <input type="radio" name="artRelation" checked={a.artRelation === o} onChange={() => set("artRelation", o)} />
                <span style={{ ["--lvl" as string]: 1 }}>{o}</span>
              </label>
            ))}
          </fieldset>
          <div className="rb-note">
            <Writing id="rb-note" small value={a.artNote} onChange={(v) => set("artNote", v)} limit={q.note.limit} label={q.note.label} placeholder={`${q.note.label}…`} onEnter={enter} />
          </div>
        </>
      );
    } else {
      const chosen = a[q.field];
      canSkip = chosen.length === 0;
      // An exclusive pick never locks the others: tapping one swaps it out (see toggleMulti).
      const full = chosen.length >= q.max;
      body = (
        <>
          <p className="rb-eyebrow">{q.eyebrow}</p>
          <h2 className="rb-title" id="rb-q" data-long={long} ref={titleRef} tabIndex={-1}>
            <span className="rb-sr">Question {n} of {QUESTIONS.length}. </span>{q.title}
          </h2>
          <p className="rb-help" id="rb-help" aria-live="polite">
            {chosen.length >= q.max ? "That’s three. Put one back if you’d like to choose another." : q.help}
          </p>
          <fieldset className="rb-pebbles rb-body" aria-labelledby="rb-q" aria-describedby="rb-help" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enter(); } }}>
            {q.options.map((o) => {
              const order = chosen.indexOf(o);
              return (
                <label key={o} className="rb-pebble">
                  <input
                    type="checkbox"
                    checked={order >= 0}
                    disabled={order < 0 && full}
                    onChange={() => toggleMulti(q.field, o, q.max, q.exclusive)}
                  />
                  <span style={{ ["--lvl" as string]: order >= 0 ? order + 1 : 1 }}>{o}</span>
                </label>
              );
            })}
          </fieldset>
        </>
      );
    }
  } else if (step.kind === "name") {
    canSkip = nameMode === "optional" && !a.firstName.trim();
    body = (
      <>
        <p className="rb-eyebrow">Last thing</p>
        <h2 className="rb-title" id="rb-q" ref={titleRef} tabIndex={-1}>
          <span className="rb-sr">Final question. </span>
          First name{nameMode === "optional" ? "" : ""}
        </h2>
        <p className="rb-help" id="rb-help">
          Your first name will be visible to Patronage only and won&rsquo;t be included in the summary shared with Rabobank. Responses will be deleted when the commission is complete, or within 90 days of its completion, whichever comes first.
        </p>
        <div className="rb-body">
          <div className="rb-write">
            <input
              id="rb-field"
              className="rb-textarea"
              type="text"
              autoComplete="given-name"
              maxLength={LIMITS.firstName}
              value={a.firstName}
              aria-label="First name"
              aria-describedby="rb-help"
              aria-required={nameMode === "required"}
              placeholder="Your first name"
              onChange={(e) => set("firstName", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
              ref={(el) => { if (el && phase === "in" && finePointer() && document.activeElement !== el && idx === last - 1) el.focus({ preventScroll: true }); }}
            />
            <span className="rb-rule" aria-hidden="true" />
          </div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rb-hero" src="/rabobank-pilot/room.webp" alt="" width={684} height={384} />
        <p className="rb-eyebrow">Sent</p>
        <h2 className="rb-title" ref={titleRef} tabIndex={-1}>Your responses are in.</h2>
        <p className="rb-copy">In early November, you&rsquo;ll be invited to see the shortlisted artists and respond to their work.</p>
        <p className="rb-parting" aria-label={PARTING}>
          {PARTING.split(" ").map((w, i) => (
            <span key={i} aria-hidden="true">
              <span className="rb-word" style={{ animationDelay: `${1.9 + i * 0.18}s` }}>{w}</span>{" "}
            </span>
          ))}
        </p>
        <div className="rb-signoff">
          <p className="rb-sign">&mdash; Blake Aitken</p>
          <a className="rb-work" href={WORK_URL} target="_blank" rel="noopener">
            View his work <span className="rb-arrow" aria-hidden="true" />
          </a>
        </div>
        {!prefersReducedMotion() && (
          <button type="button" className="rb-replay" onClick={() => setBurst((n) => n + 1)}>
            <span className="rb-replay-dot" aria-hidden="true" /> Replay kiwi-fetti
          </button>
        )}
        <p className="rb-patronage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Favicon_Bleed_512.png" alt="" width={22} height={22} />
          Patronage
        </p>
      </>
    );
  }

  const showActions = state === "open" && (step.kind === "q" || step.kind === "name");
  const isFinal = idx === last - 1;

  return (
    <div className="rb" data-step={stepName} data-phase={dataPhase} style={{ ["--p" as string]: p }}>
      <Scene p={p} />
      {burst > 0 && <KiwiConfetti key={burst} />}
      {preview && <p className="rb-preview" role="note">Preview · answers aren&rsquo;t saved</p>}
      <div className="rb-stage">
        <div className={`rb-col rb-${phase}${step.kind === "intro" ? " rb-col--wide" : ""}${step.kind === "thanks" ? " rb-col--thanks" : ""}`} key={`${state}-${idx}`}>
          <div ref={honeypot} aria-hidden="true">{showActions && <HoneypotField />}</div>
          {body}
          {showActions && (
            <>
              {error && <p className="rb-error" role="alert">{error}</p>}
              <div className="rb-actions">
                <button type="button" className="rb-next" disabled={sending || (canSkip && !isFinal)} onClick={next}>
                  {sending ? "Sending…" : isFinal ? "Send my answers" : "Next"}
                  <span className="rb-arrow" aria-hidden="true" />
                </button>
                <span className="rb-hint" aria-hidden="true">or press Enter</span>
                <span className="rb-quiet">
                  <button type="button" className="rb-link" onClick={back}>Back</button>
                  {!isFinal && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button type="button" className="rb-link" onClick={next}>Skip</button>
                    </>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
