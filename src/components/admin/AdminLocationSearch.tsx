"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cityFullName, locationKey, searchCities } from "@/lib/regions";
import type { CityWithRegion } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  /** "city:<id>", "region:<id>" or "" when nothing is set. */
  value: string;
  /** What the artist typed themselves, offered as a hint when nothing is matched. */
  freeform: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  ariaLabel: string;
}

type Option =
  | { kind: "city"; id: string; label: string; sub: string }
  | { kind: "region"; id: string; label: string; sub: string }
  | { kind: "clear"; id: ""; label: string; sub: string };

/**
 * Compact type-to-search location field for a table row. Uses the same ranked
 * matcher as the onboarding picker, and adds "region only" rows for people in
 * a place the town list does not cover. The results list is fixed-positioned so
 * the table's horizontal scroll container does not clip it.
 */
export function AdminLocationSearch({ cities, value, freeform, disabled, onChange, ariaLabel }: Props) {
  const regions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of cities) if (c.region && !byId.has(c.region.id)) byId.set(c.region.id, c.region.name);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [cities]);

  const currentLabel = useMemo(() => {
    if (value.startsWith("city:")) {
      const c = cities.find((x) => x.id === value.slice(5));
      return c ? `${c.name}` : "";
    }
    if (value.startsWith("region:")) {
      const r = regions.find((x) => x.id === value.slice(7));
      return r ? `${r.name} (region only)` : "";
    }
    return "";
  }, [value, cities, regions]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options = useMemo<Option[]>(() => {
    if (!open) return [];
    const q = locationKey(query);
    const out: Option[] = [];
    if (q) {
      for (const r of regions) {
        if (locationKey(r.name).includes(q)) {
          out.push({ kind: "region", id: r.id, label: `${r.name} (region only)`, sub: "Region" });
        }
      }
    }
    for (const c of searchCities(cities, query, 8)) {
      out.push({ kind: "city", id: c.id, label: cityFullName(c), sub: c.region?.name ?? "" });
    }
    if (value) out.push({ kind: "clear", id: "", label: "Clear location", sub: "" });
    return out;
  }, [open, query, cities, regions, value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onScroll(e: Event) {
      // Scrolling the results list itself must not close it.
      if ((e.target as HTMLElement | null)?.closest?.("[data-loc-results]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function openList() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left });
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  function choose(o: Option) {
    setOpen(false);
    inputRef.current?.blur();
    onChange(o.kind === "city" ? `city:${o.id}` : o.kind === "region" ? `region:${o.id}` : "");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") openList();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(options.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % Math.max(options.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    }
  }

  const unset = !value;

  return (
    <div ref={wrapRef} className="w-44">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : currentLabel}
        placeholder={freeform ? `${freeform} (unmatched)` : "Search town or region"}
        title={freeform ? `They typed: ${freeform}` : undefined}
        onFocus={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className={`w-full border px-1.5 py-1 text-xs focus:border-black focus:outline-none disabled:opacity-50 ${
          unset ? "border-amber-300 bg-amber-50 placeholder:text-amber-700" : "border-border bg-background"
        }`}
      />
      {open && pos && (
        <ul
          data-loc-results
          id={listId}
          role="listbox"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 max-h-64 w-64 overflow-auto border border-border bg-background shadow-md"
        >
          {options.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-muted-foreground">No match</li>
          )}
          {options.map((o, i) => (
            <li key={`${o.kind}:${o.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex w-full flex-col items-start px-2.5 py-1.5 text-left ${
                  i === active ? "bg-stone-100" : ""
                } ${o.kind === "clear" ? "border-t border-border text-muted-foreground" : ""}`}
              >
                <span className="text-xs">{o.label}</span>
                {o.sub && <span className="font-mono text-[10px] text-stone-400">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
