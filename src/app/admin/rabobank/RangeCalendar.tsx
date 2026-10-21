"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Dates are plain "YYYY-MM-DD" wall dates in Auckland; no time zones in here. */
type Day = string;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number): Day => `${y}-${pad(m + 1)}-${pad(d)}`;

export function todayInNz(): Day {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
}

interface Props {
  start: Day | null;
  end: Day | null;
  /** Called once both ends are picked, earliest first. */
  onPick: (start: Day, end: Day) => void;
}

/** Click a first day, then a last day. Hovering shows the range before the second click. */
export function RangeCalendar({ start, end, onPick }: Props) {
  const anchor = start ?? todayInNz();
  const [view, setView] = useState({ y: +anchor.slice(0, 4), m: +anchor.slice(5, 7) - 1 });
  const [first, setFirst] = useState<Day | null>(null);
  const [hover, setHover] = useState<Day | null>(null);
  const today = todayInNz();

  // While picking, preview from the first click to the hovered day; otherwise show the saved range.
  const [lo, hi] = first
    ? [first, hover ?? first].sort()
    : [start, end];

  const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (Day | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => iso(view.y, view.m, i + 1))];

  const shift = (by: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + by) / 12), m: (((m + by) % 12) + 12) % 12 }));

  function click(d: Day) {
    if (!first) return setFirst(d);
    const [a, b] = [first, d].sort();
    setFirst(null);
    setHover(null);
    onPick(a, b);
  }

  return (
    <div className="select-none" onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-foreground" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-medium">{MONTHS[view.m]} {view.y}</p>
        <button type="button" onClick={() => shift(1)} className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-foreground" aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-stone-400">
        {WEEKDAYS.map((w, i) => <span key={i} className="pb-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const edge = d === lo || d === hi;
          const inside = lo && hi && d > lo && d < hi;
          return (
            <span
              key={d}
              className={`flex justify-center ${inside ? "bg-stone-100" : ""} ${lo && hi && lo !== hi && d === lo ? "bg-gradient-to-r from-transparent from-50% to-stone-100 to-50%" : ""} ${lo && hi && lo !== hi && d === hi ? "bg-gradient-to-l from-transparent from-50% to-stone-100 to-50%" : ""}`}
            >
              <button
                type="button"
                onClick={() => click(d)}
                onMouseEnter={() => first && setHover(d)}
                aria-pressed={edge}
                aria-label={d}
                className={`flex size-9 items-center justify-center rounded-full text-sm transition-colors ${
                  edge ? "bg-black text-white" : "hover:bg-stone-200"
                } ${d === today && !edge ? "font-semibold underline underline-offset-4" : ""}`}
              >
                {+d.slice(8)}
              </button>
            </span>
          );
        })}
      </div>
      <p className="mt-2 h-4 text-xs text-stone-500">{first ? "Now click the last day." : ""}</p>
    </div>
  );
}
