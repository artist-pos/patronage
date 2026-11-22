"use client";

import { useEffect, useRef, useState } from "react";
import programme from "@/data/here-together/programme.json";
import { INTEREST_EVENT } from "./HereTogetherContact";

interface Session {
  time: string;
  title: string;
  type: string;
  description: string;
  audience: string[];
  runBy: string;
  tags: string[];
}
interface Day {
  day: string;
  closed?: string;
  daytime?: Session[] | null;
  evening?: Session[] | null;
}
type Part = "daytime" | "evening";

const DAYS = programme.days as Day[];
const TYPES = programme.types as Record<string, { label: string; swatch: string }>;
const FILTERS = programme.filters as { key: string; label: string }[];
const PARTS: [Part, string][] = [
  ["daytime", "Daytime"],
  ["evening", "Evening"],
];

const sessionsOf = (d: Day) => [...(d.daytime ?? []), ...(d.evening ?? [])];

/** One line for the day button: the evening's headline, else the day's. */
function headline(d: Day) {
  if (d.closed) return "Closed";
  return d.evening?.[0]?.title ?? d.daytime?.[0]?.title ?? "Open";
}

const THURSDAY = 3;

const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "For everyone, especially collectors." / "For makers and students." */
function forWhom(audience: string[]) {
  const others = audience.filter((a) => a !== "Everyone").map((a) => a.toLowerCase());
  if (audience.includes("Everyone")) return others.length ? `For everyone, especially ${andList(others)}.` : "For everyone.";
  return `For ${andList(others)}.`;
}

export function WeekPlanner() {
  const [day, setDay] = useState(THURSDAY);
  const [filter, setFilter] = useState<string | null>(null);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);

  // On a phone the strip scrolls sideways: keep the chosen day in view
  // (moves the strip only, never the page).
  useEffect(() => {
    const strip = stripRef.current;
    const btn = dayRefs.current[day];
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    const left = btn.offsetLeft - strip.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [day]);

  const d = DAYS[day];
  const matches = (s: Session) => !filter || s.tags.includes(filter);
  const dayMatches = (x: Day) => !filter || sessionsOf(x).some(matches);

  // Choosing a filter moves to a day that has it (unless this day already does),
  // rather than only fading the rest.
  function changeFilter(f: string | null) {
    setFilter(f);
    if (!f) return;
    const has = (x: Day) => sessionsOf(x).some((s) => s.tags.includes(f));
    if (has(DAYS[day])) return;
    const n = DAYS.findIndex(has);
    if (n >= 0) setDay(n);
  }

  function interest(text: string) {
    window.dispatchEvent(new CustomEvent(INTEREST_EVENT, { detail: text }));
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  function onStripKey(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (day + step + 7) % 7;
    setDay(next);
    dayRefs.current[next]?.focus();
  }

  return (
    <div className="ht-planner">
      <div className="ht-controls">
        <div role="group" aria-label="Show only" className="ht-pebbles">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button key={f.key} type="button" aria-pressed={on} className="ht-pebble ht-pebble--sm" onClick={() => changeFilter(on ? null : f.key)}>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The seven days. Arrow keys move between them. */}
      <div ref={stripRef} className="ht-strip" role="tablist" aria-label="Days of the week" onKeyDown={onStripKey}>
        {DAYS.map((x, n) => (
          <button
            key={x.day}
            ref={(el) => {
              dayRefs.current[n] = el;
            }}
            type="button"
            role="tab"
            aria-selected={n === day}
            tabIndex={n === day ? 0 : -1}
            className="ht-daybtn"
            data-closed={x.closed ? "true" : undefined}
            data-dim={dayMatches(x) ? undefined : "true"}
            onClick={() => setDay(n)}
          >
            <span className="ht-daybtn-name">{x.day.slice(0, 3)}</span>
            <span className="ht-daybtn-sum">{headline(x)}</span>
            <span className="ht-daybtn-marks" aria-hidden>
              {sessionsOf(x).map((s) => (
                <span key={s.title + s.time} className="ht-swatch" style={{ background: TYPES[s.type]?.swatch }} />
              ))}
            </span>
          </button>
        ))}
      </div>

      {/* The chosen day */}
      <div className="ht-sheet" role="tabpanel" aria-label={d.day}>
        <div key={day} className="ht-sheet-body ht-fade">
          <h3 className="ht-sheet-day">{d.day}</h3>
          {d.closed ? (
            <p className="ht-help ht-sheet-closed">{d.closed}</p>
          ) : (
            PARTS.map(([part, label]) => {
              const list = d[part];
              return (
                <div key={part} className="ht-part-block">
                  <p className="ht-part-label">{label}</p>
                  {list === null || list === undefined ? (
                    <p className="ht-help">Closed.</p>
                  ) : list.length === 0 ? (
                    <div className="ht-session ht-session--open">
                      <p className="ht-session-title">Open for partner programming</p>
                      <p className="ht-help">Nothing planned yet. A workshop, a talk, a night for your community, or something nobody has tried.</p>
                      <button type="button" className="ht-textbtn" onClick={() => interest(`I'd like to programme a ${d.day} ${label.toLowerCase()}.\n\n`)}>
                        Propose something <span className="ht-arrow" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    list.map((s) => (
                      <div key={s.title + s.time} className="ht-session" data-dim={matches(s) ? undefined : "true"}>
                        <p className="ht-session-meta">
                          <span className="ht-swatch" style={{ background: TYPES[s.type]?.swatch }} aria-hidden />
                          {s.time} · {TYPES[s.type]?.label}
                        </p>
                        <p className="ht-session-title">{s.title}</p>
                        <p className="ht-help">{s.description}</p>
                        <p className="ht-session-who">
                          {forWhom(s.audience)} Run by {s.runBy.charAt(0).toLowerCase() + s.runBy.slice(1)}.
                        </p>
                        <button type="button" className="ht-textbtn" onClick={() => interest(`I'm interested in "${s.title}" (${d.day}).\n\n`)}>
                          Express interest <span className="ht-arrow" aria-hidden />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
