"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchCities, cityFullName } from "@/lib/regions";
import type { CityWithRegion, LocalBoard } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  /** Currently saved city id, if the profile already has one. */
  defaultCityId?: string | null;
  /** The freeform text this profile has stored, shown when no city is matched. */
  defaultFreeform?: string | null;
  /** The saved region. May differ from the saved city's region, because the
   *  artist is allowed to choose. */
  defaultRegionId?: string | null;
  /** Sub-areas of regions (Auckland's local boards). A picker is offered only
   *  when the chosen region has some. */
  boards?: LocalBoard[];
  defaultLocalBoardId?: string | null;
  required?: boolean;
  error?: string;
}

/**
 * Type-to-search location field.
 *
 * Writes three hidden inputs so the server action gets the structured pair and
 * the freeform text in one submit:
 *   city_id   — the chosen taxonomy row, or "" when they picked Other
 *   region_id — follows the chosen city, but the artist can override it
 *   city      — the display text, which stays the record of what they typed
 *
 * "Other" is a real option rather than a dead end: artists live in places the
 * taxonomy does not list, and outside NZ entirely. Choosing it keeps their
 * typed text and leaves the structured columns null.
 *
 * The region is offered separately underneath because deriving it from the town
 * is right most of the time and wrong some of the time. Someone in a settlement
 * the taxonomy does not list would otherwise appear on no regional page at all,
 * and someone on a boundary may work with one region's scene while living in
 * the next. It is their call, and it is the only thing that decides which
 * regional page they appear on.
 */
export function LocationPicker({
  cities,
  defaultCityId,
  defaultFreeform,
  defaultRegionId,
  boards = [],
  defaultLocalBoardId,
  required,
  error,
}: Props) {
  const initialCity = defaultCityId
    ? cities.find((c) => c.id === defaultCityId) ?? null
    : null;

  const [query, setQuery] = useState(
    initialCity ? initialCity.name : defaultFreeform ?? ""
  );
  const [selected, setSelected] = useState<CityWithRegion | null>(initialCity);
  // Explicit region choice. Null means "follow the town", which is what most
  // people leave it as. Seeded from the saved value when it disagrees with the
  // saved town, so an artist's own choice survives a reload.
  const [regionOverride, setRegionOverride] = useState<string | null>(
    defaultRegionId && defaultRegionId !== initialCity?.region_id
      ? defaultRegionId
      : null
  );
  const [boardId, setBoardId] = useState<string>(defaultLocalBoardId ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The taxonomy's regions, derived from the cities already loaded rather than
  // fetched again.
  const regions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const c of cities) {
      if (c.region && !byId.has(c.region.id)) {
        byId.set(c.region.id, { id: c.region.id, name: c.region.name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cities]);

  const results = useMemo(
    () => (open ? searchCities(cities, query) : []),
    [cities, query, open]
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function choose(city: CityWithRegion) {
    setSelected(city);
    setQuery(city.name);
    setOpen(false);
    // A town carries its own region. Keeping a previous override here would
    // silently contradict the town they just picked.
    setRegionOverride(null);
  }

  function chooseOther() {
    setSelected(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    // The Other row sits after the results, so it is the last focusable index.
    const max = results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === max) chooseOther();
      else if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const effectiveRegionId = regionOverride ?? selected?.region_id ?? null;
  const regionBoards = boards.filter((b) => b.region_id === effectiveRegionId);
  // A board chosen under one region must not survive a switch to another.
  const effectiveBoardId = regionBoards.some((b) => b.id === boardId) ? boardId : "";

  return (
    <div className="space-y-2">
      <label htmlFor="location-search" className="text-sm font-medium">
        Where are you based{required && <span className="text-destructive"> *</span>}
      </label>

      <div ref={wrapRef} className="relative">
        <input
          id="location-search"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-results"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          required={required}
          placeholder="Start typing a town or city"
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full border border-black bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
        />

        {open && (
          <ul
            id="location-results"
            role="listbox"
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto border border-border bg-card shadow-[var(--shadow-md)]"
          >
            {results.map((city, i) => (
              <li key={city.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(city)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-[color:var(--tint)]" : ""
                  }`}
                >
                  <span className="text-sm">{cityFullName(city)}</span>
                  <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {city.region?.name}
                  </span>
                </button>
              </li>
            ))}

            <li role="option" aria-selected={active === results.length}>
              <button
                type="button"
                onMouseEnter={() => setActive(results.length)}
                onClick={chooseOther}
                className={`flex w-full flex-col items-start border-t border-border px-3 py-2 text-left transition-colors ${
                  active === results.length ? "bg-[color:var(--tint)]" : ""
                }`}
              >
                <span className="text-sm">Somewhere else</span>
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                  keep what I typed
                </span>
              </button>
            </li>
          </ul>
        )}
      </div>

      {/* What the server action reads. */}
      <input type="hidden" name="city_id" value={selected?.id ?? ""} />
      <input
        type="hidden"
        name="region_id"
        value={regionOverride ?? selected?.region_id ?? ""}
      />
      <input type="hidden" name="city" value={selected ? selected.name : query} />
      {boards.length > 0 && (
        <input type="hidden" name="local_board_id" value={effectiveBoardId} />
      )}

      {/* Region. Normally follows the town, always overridable. */}
      <div className="space-y-1.5">
        <label
          htmlFor="region-choice"
          className="block text-xs text-[color:var(--fg-muted)]"
        >
          Region
        </label>
        <select
          id="region-choice"
          value={regionOverride ?? selected?.region_id ?? ""}
          onChange={(e) => setRegionOverride(e.target.value || null)}
          className="w-full border border-border bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
        >
          <option value="">Not in Aotearoa, or rather not say</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {(() => {
        const effectiveRegionId = regionOverride ?? selected?.region_id ?? null;
        const regionName = regions.find((r) => r.id === effectiveRegionId)?.name ?? null;

        if (regionName) {
          const overridden =
            !!selected && !!regionOverride && regionOverride !== selected.region_id;
          return (
            <p className="text-xs text-muted-foreground">
              You will show on the {regionName} page.
              {overridden
                ? " That is your choice rather than the one your town would give you, which is fine."
                : " Change the region above if you would rather appear somewhere else."}
            </p>
          );
        }

        return (
          <p className="text-xs text-muted-foreground">
            No region set, so you will not appear on a regional page. That is
            right if you are based outside Aotearoa. If you are here, pick the
            region you work in even when your town is not on the list.
          </p>
        );
      })()}

      {regionBoards.length > 0 && (
        <div className="space-y-1.5">
          <label
            htmlFor="local-board-choice"
            className="block text-xs text-[color:var(--fg-muted)]"
          >
            Local board <span className="text-[color:var(--fg-subtle)]">(optional)</span>
          </label>
          <select
            id="local-board-choice"
            value={effectiveBoardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
          >
            <option value="">Not sure, or rather not say</option>
            {regionBoards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Helps your local board&apos;s arts team see who works in their area. It is
            not shown on your profile.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
