"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchCities, cityFullName } from "@/lib/regions";
import type { CityWithRegion } from "@/types/database";

/** The slice of the city taxonomy the location search needs. */
export type JoinCity = Pick<CityWithRegion, "id" | "name" | "name_maori" | "aliases" | "is_major" | "region_id"> & {
  region: { id: string; name: string } | null;
};

export type Place = { city: string; regionId?: string; country?: string };

// ── Location: type-to-search over the NZ taxonomy, or free text ──────────────

export function PlaceField({
  cities,
  value,
  onChange,
}: {
  cities: JoinCity[];
  value: Place | null;
  onChange: (v: Place | null) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(value?.city ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const results = useMemo(
    () => searchCities(cities as unknown as CityWithRegion[], query, 6),
    [cities, query]
  );

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        Where are you based?
      </label>
      <input
        id={inputId}
        value={query}
        autoComplete="off"
        placeholder="Town or city"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          setOpen(true);
          // Typed text stands until a town is picked; blank clears it.
          onChange(q.trim() ? { city: q.trim() } : null);
        }}
        className="w-full border border-border bg-background px-3 py-2.5 text-[16px] transition-colors focus:border-foreground focus:outline-none sm:text-sm"
      />
      {value?.regionId && (
        <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">
          {cities.find((c) => c.region_id === value.regionId)?.region?.name}, Aotearoa
        </p>
      )}
      {open && query.trim() && (
        <div className="absolute inset-x-0 z-10 mt-1 border border-border bg-card shadow-[var(--shadow-md)]">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setQuery(c.name);
                setOpen(false);
                onChange({ city: c.name, regionId: c.region_id ?? undefined, country: "NZ" });
              }}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[color:var(--tint)]"
            >
              <span>{cityFullName(c)}</span>
              <span className="shrink-0 text-[12px] text-[color:var(--fg-muted)]">{c.region?.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange({ city: query.trim() });
            }}
            className="w-full border-t border-border px-3 py-2 text-left text-[13px] text-[color:var(--fg-muted)] hover:bg-[color:var(--tint)]"
          >
            Use &ldquo;{query.trim()}&rdquo;{results.length === 0 ? "" : " (somewhere else)"}
          </button>
        </div>
      )}
    </div>
  );
}
