"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const KEY = "patronage-post-selection";
const EVENT = "patronage-post-selection-change";
export const MAX_POST_PICKS = 5;

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — selection just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Admin-only selection of listings for a social post, shared across cards and the tray. */
export function usePostSelection() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    if (current.includes(id)) write(current.filter((x) => x !== id));
    else if (current.length < MAX_POST_PICKS) write([...current, id]);
  }, []);

  const clear = useCallback(() => write([]), []);

  return { ids, toggle, clear };
}

export function PostSelectToggle({ id }: { id: string }) {
  const { ids, toggle } = usePostSelection();
  const on = ids.includes(id);
  const full = !on && ids.length >= MAX_POST_PICKS;
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      disabled={full}
      aria-pressed={on}
      title={full ? `Up to ${MAX_POST_PICKS} per post` : on ? "Remove from post" : "Add to social post"}
      className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border text-sm shadow-sm transition-colors ${
        on ? "border-black bg-black text-white" : "border-stone-300 bg-white/90 text-transparent hover:text-stone-400"
      } ${full ? "cursor-not-allowed opacity-40" : ""}`}
    >
      ✓
    </button>
  );
}

const FORMATS = [
  { id: "weekly", label: "Weekly digest", max: 5 },
  { id: "recent", label: "Recently open", max: 5 },
  { id: "final", label: "Final call", max: 3 },
] as const;

export function AdminPostTray() {
  const { ids, clear } = usePostSelection();
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("weekly");
  if (ids.length === 0) return null;

  const max = FORMATS.find((f) => f.id === format)!.max;
  const over = ids.length > max;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-md">
        <span className="text-xs font-medium">{ids.length} selected</span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
          className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
        >
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} (up to {f.max})
            </option>
          ))}
        </select>
        {over ? (
          <span className="text-xs text-red-600">Deselect {ids.length - max} for this format</span>
        ) : (
          <Link
            href={`/admin/social?format=${format}&ids=${ids.join(",")}`}
            className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
          >
            Build post →
          </Link>
        )}
        <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
      </div>
    </div>
  );
}
