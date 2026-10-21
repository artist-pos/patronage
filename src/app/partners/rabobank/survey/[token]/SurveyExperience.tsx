"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import {
  LIMITS,
  NOTHING_IN_PARTICULAR,
  QUESTIONS,
  type Question,
  type TextField,
} from "@/lib/rabobank/survey";
import type { NameMode } from "@/lib/rabobank/settings";
import { submitSurvey } from "./actions";
import "./survey.css";

const DONE_KEY = "rabobank_survey_done";
const PARTING = "The artwork should interpret Rabobank’s story, not illustrate its marketing.";

type Answers = {
  artRelation: string;
  artNote: string;
  roomWants: string[];
} & Record<TextField, string> & { firstName: string };

const EMPTY: Answers = {
  artRelation: "", artNote: "", roomWants: [],
  story: "", place: "", cooperation: "", wrong: "", memory: "", artist: "",
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
  const f = lerp(d, e);
  return { c1: a, c2: d, end: f };
}

const PATH: [number, number][] = [[40, 74], [41, 61], [58, 57], [50.1, 50.6]];

const MOTES = [
  [12, 62, 0], [24, 40, 6], [33, 78, 12], [47, 55, 3], [58, 30, 9], [66, 70, 15],
  [74, 48, 5], [82, 66, 11], [90, 36, 2], [18, 22, 14], [52, 86, 8], [8, 84, 17],
];

/** A leafy hedge top: points along a ray from the vanishing point, nudged sideways. */
function canopyEdge(side: 1 | -1): string {
  const pts: string[] = [];
  const ux = side * 0.857, uy = -0.514; // direction of the hedge top
  const nx = -uy * side, ny = ux * side; // perpendicular
  for (let i = 0; i <= 120; i++) {
    const d = i * 1.4;
    const r = Math.sin(i * 12.9898 + side * 4.1) * 43758.5453;
    const j = (r - Math.floor(r) - 0.5) * 2; // -1..1, stable across renders
    const amp = 0.018 * d * (i % 7 === 0 ? 2.2 : 1);
    pts.push(`${(50 + side * 0.7 + ux * d + nx * j * amp).toFixed(2)},${(49.4 + uy * d + ny * j * amp).toFixed(2)}`);
  }
  return pts.join(" ");
}
const LEFT_TOP = canopyEdge(-1);
const RIGHT_TOP = canopyEdge(1);
const POSTS = [3, 4.8, 7.4, 11, 16, 23, 33];

function Scene({ p }: { p: number }) {
  const t = Math.max(0.001, Math.min(1, p));
  const { c1, c2, end } = bezierTo(PATH, t);
  const d = `M ${PATH[0][0]} ${PATH[0][1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${end[0]} ${end[1]}`;
  return (
    <div className="rb-scene" aria-hidden="true">
      <div className="rb-sky" />
      <div className="rb-glow" />
      <div className="rb-world">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id="rb-ground" x1="0" y1="50" x2="0" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f3ecd9" />
              <stop offset="0.3" stopColor="#e6dcc2" />
              <stop offset="1" stopColor="#cdbf9b" />
            </linearGradient>
            <radialGradient id="rb-hedge" cx="50" cy="50" r="80" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#eef1e2" />
              <stop offset="0.25" stopColor="#d9e1c8" />
              <stop offset="0.7" stopColor="#bfcbab" />
              <stop offset="1" stopColor="#a9b995" />
            </radialGradient>
            <radialGradient id="rb-ridge" cx="50" cy="50" r="70" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#dde2d4" />
              <stop offset="1" stopColor="#c3cdb9" />
            </radialGradient>
          </defs>
          <path d="M -120 50.2 L -120 46 Q -90 43 -60 46.5 T -10 45.5 Q 20 42.2 36 46.8 T 49 48 L 51 48 Q 66 44 80 46.6 T 120 44.5 Q 150 42 170 46 L 220 50.2 Z" fill="url(#rb-ridge)" opacity="0.8" />
          <rect x="-150" y="50" width="400" height="130" fill="url(#rb-ground)" />
          {/* hedgerows either side of the row, with leafy tops */}
          <polygon points={`${LEFT_TOP} -90,170 49.3,50.5`} fill="url(#rb-hedge)" />
          <polygon points={`${RIGHT_TOP} 190,170 50.7,50.5`} fill="url(#rb-hedge)" />
          {/* where hedge meets ground */}
          <polygon points="49.3,50.5 -90,170 -90,150 49.2,50.2" fill="#8c9c78" opacity="0.28" />
          <polygon points="50.7,50.5 190,170 190,150 50.8,50.2" fill="#8c9c78" opacity="0.28" />
          {/* trellis posts marking the rows you pass */}
          <g stroke="#8a7650" strokeOpacity="0.45" strokeLinecap="round" fill="none">
            {POSTS.flatMap((z) => [-1, 1].map((side) => (
              <line key={`${z}${side}`} x1={50 + side * z * 0.42} y1={50 + z} x2={50 + side * z * 0.42} y2={50 + z - z * 0.55} strokeWidth={Math.max(1, z * 0.14)} vectorEffect="non-scaling-stroke" />
            )))}
          </g>
          {/* furrows */}
          <g stroke="#8a7650" strokeOpacity="0.16" fill="none">
            {[-60, -40, -22, -8, 8, 22, 40, 60].map((dx) => (
              <line key={dx} x1="50" y1="50.5" x2={50 + dx * 1.6} y2="150" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {/* the path: the line that grows as you answer */}
          <path d={d} fill="none" stroke="#ff6700" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" />
          <circle cx={end[0]} cy={end[1]} r="1.3" fill="#ff6700" opacity="0.22" />
          <circle cx={end[0]} cy={end[1]} r="0.5" fill="#ff6700" />
        </svg>
      </div>
      <div className="rb-haze" />
      <div className="rb-aperture" />
      <div className="rb-arrival" />
      <div className="rb-wash" />
      <div className="rb-motes">
        {MOTES.map(([x, y, delay], i) => (
          <span key={i} className="rb-mote" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-delay}s` }} />
        ))}
      </div>
      <div className="rb-grain" />
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
}: {
  token: string;
  nameMode: NameMode;
  closeDate: string;
  state: "open" | "closed";
  message?: string;
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
  const loadedAt = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLDivElement>(null);

  const alreadyDone = useSyncExternalStore(
    () => () => {},
    () => {
      try { return Boolean(localStorage.getItem(DONE_KEY)); } catch { return false; }
    },
    () => false
  );

  useEffect(() => { loadedAt.current = Date.now(); }, []);

  const step = steps[idx];
  const progress = state === "closed" ? 0.12 : dest / last;
  const p = useTween(progress);

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

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((cur) => ({ ...cur, [k]: v }));

  async function finish() {
    if (sending) return;
    setError(null);
    if (nameMode === "required" && !a.firstName.trim()) {
      setError("Please add your first name so we can tell responses apart.");
      return;
    }
    setSending(true);
    const hp = (honeypot.current?.querySelector("input") as HTMLInputElement | null)?.value ?? "";
    const res = await submitSurvey({
      token,
      firstName: a.firstName,
      artRelation: a.artRelation,
      artNote: a.artNote,
      story: a.story,
      place: a.place,
      cooperation: a.cooperation,
      roomWants: a.roomWants,
      wrong: a.wrong,
      memory: a.memory,
      artist: a.artist,
      completionSeconds: (Date.now() - loadedAt.current) / 1000,
      [HONEYPOT_FIELD]: hp,
    });
    setSending(false);
    if (!res.ok) { setError(res.error); return; }
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* a courtesy flag, nothing more */ }
    go(last);
  }

  const next = () => (idx === last - 1 ? void finish() : go(idx + 1));
  const back = () => go(Math.max(0, idx - 1));

  function toggleWant(option: string, max: number) {
    setA((cur) => {
      const on = cur.roomWants.includes(option);
      if (on) return { ...cur, roomWants: cur.roomWants.filter((w) => w !== option) };
      if (option === NOTHING_IN_PARTICULAR) return { ...cur, roomWants: [option] };
      const base = cur.roomWants.filter((w) => w !== NOTHING_IN_PARTICULAR);
      return base.length >= max ? cur : { ...cur, roomWants: [...base, option] };
    });
  }

  const dataPhase = step.kind === "intro" ? "intro" : step.kind === "thanks" ? "thanks" : "questions";
  const stepName = step.kind === "q" ? "q" : step.kind;

  /* ----- content for the current step ----- */
  let body: React.ReactNode = null;
  let canSkip = false;

  if (state === "closed") {
    body = (
      <>
        <p className="rb-eyebrow">Te Puke event space</p>
        <h1 className="rb-title" ref={titleRef} tabIndex={-1}>Kia ora.</h1>
        <p className="rb-copy">{message}</p>
      </>
    );
  } else if (step.kind === "intro") {
    body = (
      <>
        <p className="rb-eyebrow">Te Puke event space</p>
        <h1 className="rb-title" ref={titleRef} tabIndex={-1}>Kia ora,</h1>
        <p className="rb-copy">I&rsquo;m Blake, an artist and architectural graduate, and the founder of Patronage. I&rsquo;m working with Rabobank on an artwork for the Te Puke event space, where colleagues, clients and community come together.</p>
        <p className="rb-copy">I spent the first years of my schooling at Paengaroa Primary School, so this part of the Bay of Plenty has a connection to my own story, too.</p>
        <p className="rb-copy">I&rsquo;m interested in the stories, places and relationships that make this part of the world what it is. You don&rsquo;t need to know anything about art to take part. There are no right answers, and a sentence or two is plenty.</p>
        <p className="rb-copy">Your answers will help shape the brief and the artists invited to respond to it. It takes about five minutes. The survey closes {closeDate}.</p>
        {alreadyDone && (
          <p className="rb-already" role="status">It looks like you&rsquo;ve already shared your answers from this device. You&rsquo;re welcome to add more.</p>
        )}
        <div className="rb-actions">
          <button type="button" className="rb-next" onClick={() => go(1)}>Begin <span className="rb-arrow" aria-hidden="true" /></button>
        </div>
      </>
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
            <Writing id="rb-field" value={value} onChange={(v) => set(q.field, v)} limit={q.limit} label={q.title} autoFocus onEnter={next} />
          </div>
        </>
      );
    } else if (q.kind === "single") {
      canSkip = !a.artRelation && !a.artNote.trim();
      body = (
        <>
          {heading}
          <fieldset className="rb-pebbles rb-body" aria-labelledby="rb-q" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}>
            {q.options.map((o) => (
              <label key={o} className="rb-pebble">
                <input type="radio" name="artRelation" checked={a.artRelation === o} onChange={() => set("artRelation", o)} />
                <span style={{ ["--lvl" as string]: 1 }}>{o}</span>
              </label>
            ))}
          </fieldset>
          <div className="rb-note">
            <Writing id="rb-note" small value={a.artNote} onChange={(v) => set("artNote", v)} limit={q.note.limit} label={q.note.label} placeholder={`${q.note.label}…`} onEnter={next} />
          </div>
        </>
      );
    } else {
      const chosen = a.roomWants;
      canSkip = chosen.length === 0;
      const full = chosen.length >= q.max || chosen.includes(NOTHING_IN_PARTICULAR);
      body = (
        <>
          <p className="rb-eyebrow">{q.eyebrow}</p>
          <h2 className="rb-title" id="rb-q" data-long={long} ref={titleRef} tabIndex={-1}>
            <span className="rb-sr">Question {n} of {QUESTIONS.length}. </span>{q.title}
          </h2>
          <p className="rb-help" id="rb-help" aria-live="polite">
            {chosen.length >= q.max ? "That’s three. Put one back if you’d like to choose another." : q.help}
          </p>
          <fieldset className="rb-pebbles rb-body" aria-labelledby="rb-q" aria-describedby="rb-help" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}>
            {q.options.map((o) => {
              const order = chosen.indexOf(o);
              return (
                <label key={o} className="rb-pebble">
                  <input
                    type="checkbox"
                    checked={order >= 0}
                    disabled={order < 0 && full && o !== NOTHING_IN_PARTICULAR}
                    onChange={() => toggleWant(o, q.max)}
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
        <p className="rb-eyebrow">Thank you</p>
        <h2 className="rb-title" ref={titleRef} tabIndex={-1}>Thank you</h2>
        <p className="rb-copy">Thanks for sharing a little of what makes this place and its people distinctive. Your answers will help shape the brief the artist receives.</p>
        <p className="rb-copy">In early November, you&rsquo;ll be invited to see the shortlisted artists and respond to their work.</p>
        <p className="rb-parting" aria-label={PARTING}>
          {PARTING.split(" ").map((w, i) => (
            <span key={i} aria-hidden="true">
              <span className="rb-word" style={{ animationDelay: `${3.2 + i * 0.22}s` }}>{w}</span>{" "}
            </span>
          ))}
        </p>
      </>
    );
  }

  const showActions = state === "open" && (step.kind === "q" || step.kind === "name");
  const isFinal = idx === last - 1;

  return (
    <div className="rb" data-step={stepName} data-phase={dataPhase} style={{ ["--p" as string]: p }}>
      <Scene p={p} />
      <div className="rb-stage">
        <div className={`rb-col rb-${phase}${step.kind === "intro" ? " rb-col--wide" : ""}`} key={`${state}-${idx}`}>
          <div ref={honeypot} aria-hidden="true">{showActions && <HoneypotField />}</div>
          {body}
          {showActions && (
            <>
              {error && <p className="rb-error" role="alert">{error}</p>}
              <div className="rb-actions">
                <button type="button" className="rb-next" data-quiet={canSkip && !isFinal ? "true" : "false"} disabled={sending} onClick={next}>
                  {sending ? "Sending…" : isFinal ? (canSkip ? "Finish without a name" : "Send my answers") : canSkip ? "Skip" : "Continue"}
                  <span className="rb-arrow" aria-hidden="true" />
                </button>
                <button type="button" className="rb-back" onClick={back}>Back</button>
                <span className="rb-hint" aria-hidden="true">or press Enter</span>
              </div>
            </>
          )}
        </div>
      </div>
      {step.kind === "intro" && state === "open" && (
        <div className="rb-corner">
          {/* The official Rabobank wordmark, unaltered. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rb-mark" src="/rabobank-pilot/rabobank-wordmark.png" alt="Rabobank" width={401} height={76} />
        </div>
      )}
      {step.kind === "thanks" && (
        <div className="rb-corner">
          <span className="rb-patronage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon_white_512.png" alt="" width={24} height={24} />
            Patronage
          </span>
        </div>
      )}
    </div>
  );
}
