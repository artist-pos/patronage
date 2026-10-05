"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchCities, cityFullName } from "@/lib/regions";
import type { CityWithRegion, LocalBoard } from "@/types/database";

// Major AU cities with state, searched when the query doesn't match NZ results.
const AU_CITIES: Array<{ name: string; state: string }> = [
  { name: "Sydney", state: "NSW" },
  { name: "Melbourne", state: "VIC" },
  { name: "Brisbane", state: "QLD" },
  { name: "Perth", state: "WA" },
  { name: "Adelaide", state: "SA" },
  { name: "Hobart", state: "TAS" },
  { name: "Darwin", state: "NT" },
  { name: "Canberra", state: "ACT" },
  { name: "Gold Coast", state: "QLD" },
  { name: "Newcastle", state: "NSW" },
  { name: "Wollongong", state: "NSW" },
  { name: "Geelong", state: "VIC" },
  { name: "Townsville", state: "QLD" },
  { name: "Cairns", state: "QLD" },
  { name: "Ballarat", state: "VIC" },
  { name: "Bendigo", state: "VIC" },
  { name: "Launceston", state: "TAS" },
  { name: "Toowoomba", state: "QLD" },
  { name: "Sunshine Coast", state: "QLD" },
  { name: "Ipswich", state: "QLD" },
  { name: "Fremantle", state: "WA" },
  { name: "Broome", state: "WA" },
  { name: "Alice Springs", state: "NT" },
  { name: "Byron Bay", state: "NSW" },
  { name: "Lismore", state: "NSW" },
  { name: "Wagga Wagga", state: "NSW" },
  { name: "Tamworth", state: "NSW" },
  { name: "Dubbo", state: "NSW" },
  { name: "Orange", state: "NSW" },
  { name: "Mildura", state: "VIC" },
  { name: "Shepparton", state: "VIC" },
  { name: "Albury", state: "NSW" },
  { name: "Mackay", state: "QLD" },
  { name: "Rockhampton", state: "QLD" },
  { name: "Bunbury", state: "WA" },
];

function searchAuCities(q: string, limit = 3) {
  if (!q.trim()) return [];
  const lower = q.toLowerCase();
  return AU_CITIES.filter((c) => {
    const n = c.name.toLowerCase();
    return n.startsWith(lower) || n.includes(lower);
  }).slice(0, limit);
}

type PickedNz = { kind: "nz"; city: CityWithRegion };
type PickedAu = { kind: "au"; name: string; state: string };
type PickedOther = { kind: "other"; text: string; country: "NZ" | "AUS" | "Global" };
type Picked = PickedNz | PickedAu | PickedOther | null;

interface Props {
  cities: CityWithRegion[];
  defaultCityId?: string | null;
  defaultFreeform?: string | null;
  defaultCountry?: string | null;
  defaultRegionId?: string | null;
  boards?: LocalBoard[];
  defaultLocalBoardId?: string | null;
  required?: boolean;
  error?: string;
}

/**
 * Single type-to-search field for both NZ and AU cities.
 *
 * Typing "ham" surfaces Hamilton (Waikato · NZ). Typing "mel" brings up
 * Melbourne (VIC · AUS). Picking "Somewhere else" keeps the typed text and
 * shows three country chips so the artist can place themselves.
 *
 * Writes country, city, city_id, region_id (and optionally local_board_id)
 * as hidden inputs — same shape the saveOnboardingProfile action reads.
 */
export function CombinedLocationPicker({
  cities,
  defaultCityId,
  defaultFreeform,
  defaultCountry,
  defaultRegionId,
  boards = [],
  defaultLocalBoardId,
  required,
  error,
}: Props) {
  const initialNzCity = defaultCityId
    ? cities.find((c) => c.id === defaultCityId) ?? null
    : null;

  function initialPicked(): Picked {
    if (initialNzCity) return { kind: "nz", city: initialNzCity };
    if (defaultCountry === "AUS" && defaultFreeform) {
      const match = AU_CITIES.find((c) => c.name === defaultFreeform);
      return match
        ? { kind: "au", name: match.name, state: match.state }
        : { kind: "other", text: defaultFreeform, country: "AUS" };
    }
    if (defaultFreeform) {
      const c = (defaultCountry ?? "NZ") as "NZ" | "AUS" | "Global";
      return { kind: "other", text: defaultFreeform, country: c };
    }
    return null;
  }

  const [query, setQuery] = useState(
    initialNzCity ? initialNzCity.name : defaultFreeform ?? ""
  );
  const [picked, setPicked] = useState<Picked>(initialPicked);
  const [regionOverride, setRegionOverride] = useState<string | null>(
    defaultRegionId && defaultRegionId !== initialNzCity?.region_id
      ? defaultRegionId
      : null
  );
  const [boardId, setBoardId] = useState<string>(defaultLocalBoardId ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const nzResults = useMemo(
    () => (open ? searchCities(cities, query, 5) : []),
    [cities, query, open]
  );
  const auResults = useMemo(
    () => (open ? searchAuCities(query, 3) : []),
    [query, open]
  );
  const totalResults = nzResults.length + auResults.length;

  const regions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const c of cities) {
      if (c.region && !byId.has(c.region.id)) byId.set(c.region.id, c.region);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cities]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function chooseNz(city: CityWithRegion) {
    setQuery(city.name);
    setPicked({ kind: "nz", city });
    setRegionOverride(null);
    setOpen(false);
  }

  function chooseAu(c: { name: string; state: string }) {
    setQuery(c.name);
    setPicked({ kind: "au", name: c.name, state: c.state });
    setOpen(false);
  }

  function chooseOther() {
    setPicked({ kind: "other", text: query.trim(), country: "NZ" });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") { setOpen(true); setActive(0); }
      return;
    }
    const max = totalResults;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === totalResults) { chooseOther(); return; }
      if (active < nzResults.length) { chooseNz(nzResults[active]); return; }
      const au = auResults[active - nzResults.length];
      if (au) chooseAu(au);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Values written to hidden inputs
  const country =
    picked?.kind === "nz" ? "NZ"
    : picked?.kind === "au" ? "AUS"
    : picked?.kind === "other" ? picked.country
    : "";
  const cityText =
    picked?.kind === "nz" ? picked.city.name
    : picked?.kind === "au" ? picked.name
    : picked?.kind === "other" ? picked.text
    : query.trim();
  const cityId = picked?.kind === "nz" ? picked.city.id : "";
  const effectiveRegionId =
    picked?.kind === "nz"
      ? (regionOverride ?? picked.city.region_id ?? "")
      : "";
  const regionBoards = boards.filter((b) => b.region_id === effectiveRegionId);
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
            setPicked(null);
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
            {nzResults.map((city, i) => (
              <li key={city.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => chooseNz(city)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    i === active ? "bg-[color:var(--tint)]" : ""
                  }`}
                >
                  <span>{cityFullName(city)}</span>
                  <span className="shrink-0 font-mono text-xs text-[color:var(--fg-subtle)]">
                    {city.region?.name} · NZ
                  </span>
                </button>
              </li>
            ))}

            {auResults.map((city, i) => {
              const idx = nzResults.length + i;
              return (
                <li key={`au-${city.name}`} role="option" aria-selected={idx === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => chooseAu(city)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      idx === active ? "bg-[color:var(--tint)]" : ""
                    }`}
                  >
                    <span>{city.name}</span>
                    <span className="shrink-0 font-mono text-xs text-[color:var(--fg-subtle)]">
                      {city.state} · AUS
                    </span>
                  </button>
                </li>
              );
            })}

            <li role="option" aria-selected={active === totalResults}>
              <button
                type="button"
                onMouseEnter={() => setActive(totalResults)}
                onClick={chooseOther}
                className={`flex w-full flex-col items-start border-t border-border px-3 py-2 text-left transition-colors ${
                  active === totalResults ? "bg-[color:var(--tint)]" : ""
                }`}
              >
                <span className="text-sm">Somewhere else</span>
                <span className="font-mono text-xs text-[color:var(--fg-subtle)]">
                  keep what I typed
                </span>
              </button>
            </li>
          </ul>
        )}
      </div>

      {/* Hidden inputs — same shape as LocationPicker + country select combined. */}
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="city" value={cityText} />
      <input type="hidden" name="city_id" value={cityId} />
      <input type="hidden" name="region_id" value={effectiveRegionId} />
      {boards.length > 0 && (
        <input type="hidden" name="local_board_id" value={effectiveBoardId} />
      )}

      {/* "Somewhere else" — artist picks which country they belong to. */}
      {picked?.kind === "other" && (
        <div className="flex gap-1.5">
          {(["NZ", "AUS", "Global"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPicked({ ...picked, country: c })}
              className={`border px-3 py-1.5 text-xs transition-colors ${
                picked.country === c
                  ? "border-foreground bg-foreground text-white"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {c === "Global" ? "Other" : c}
            </button>
          ))}
        </div>
      )}

      {/* Region picker — NZ picks only. */}
      {picked?.kind === "nz" && (
        <div className="space-y-1.5">
          <label
            htmlFor="region-choice"
            className="block text-xs text-[color:var(--fg-muted)]"
          >
            Region
          </label>
          <select
            id="region-choice"
            value={regionOverride ?? picked.city.region_id ?? ""}
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
          {(() => {
            const rId = regionOverride ?? picked.city.region_id ?? null;
            const rName = regions.find((r) => r.id === rId)?.name ?? null;
            if (!rName) return null;
            const overridden = !!regionOverride && regionOverride !== picked.city.region_id;
            return (
              <p className="text-xs text-muted-foreground">
                You will show on the {rName} page.
                {overridden
                  ? " That is your choice rather than the one your town would give you, which is fine."
                  : " Change the region above if you would rather appear somewhere else."}
              </p>
            );
          })()}
        </div>
      )}

      {/* Local board — Auckland only. */}
      {regionBoards.length > 0 && (
        <div className="space-y-1.5">
          <label
            htmlFor="local-board-choice"
            className="block text-xs text-[color:var(--fg-muted)]"
          >
            Local board{" "}
            <span className="text-[color:var(--fg-subtle)]">(optional)</span>
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
            Helps your local board&apos;s arts team see who works in their area. It
            is not shown on your profile.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
