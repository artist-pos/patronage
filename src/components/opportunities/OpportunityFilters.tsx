"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPP_TYPES, TYPE_LABELS, DISCIPLINES, COUNTRIES, CAREER_STAGE_TAGS } from "@/lib/opportunity-constants";
import { OPP_SORTS, OPP_SORT_LABELS, type OppSort } from "@/lib/opportunity-sort";

/**
 * A single filter/sort panel — sorting, type, country, discipline, career
 * stage, free entry — rendered as a permanent left sidebar from lg up, and
 * behind a "Filters & Sort" trigger + slide-over below that. Previously this
 * was a horizontal tab row plus a second row of dropdowns, stacked directly
 * under the page's stat numbers with no visual container of its own — it
 * read as leftover chrome rather than one coherent control panel, and the
 * type tabs truncated with no scroll hint on mobile. A sidebar fixes both:
 * everything narrowing the grid lives in one place, and on mobile it's a
 * full-height panel instead of a horizontally-clipped row.
 */
export function OpportunityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentType = searchParams.get("type");
  const currentCountry = searchParams.get("country");
  const currentDiscipline = searchParams.get("discipline");
  const currentCareerStage = searchParams.get("careerStage");
  const currentFreeEntry = searchParams.get("freeEntry") === "1";
  const currentSort = (searchParams.get("sort") as OppSort | null) ?? "deadline";

  const activeCount = [currentType, currentCountry, currentDiscipline, currentCareerStage]
    .filter(Boolean).length + (currentFreeEntry ? 1 : 0);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function toggleType(type: string) {
    updateParam("type", currentType === type ? null : type);
  }

  function clearAll() {
    router.push(pathname);
  }

  // Body scroll lock while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const typeRowCls = (active: boolean) =>
    `block w-full border px-3 py-2 text-left font-mono text-xs transition-colors ${
      active
        ? "border-foreground bg-foreground text-white"
        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
    }`;

  const panel = (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Sort by
        </p>
        <Select value={currentSort} onValueChange={(v) => updateParam("sort", v === "deadline" ? null : v)}>
          <SelectTrigger className="w-full font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPP_SORTS.map((s) => (
              <SelectItem key={s} value={s}>{OPP_SORT_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Type
        </p>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => updateParam("type", null)} className={typeRowCls(!currentType)}>
            All
          </button>
          {OPP_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => toggleType(t)} className={typeRowCls(currentType === t)}>
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Refinement selects */}
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Country
          </p>
          <Select value={currentCountry ?? "all"} onValueChange={(v) => updateParam("country", v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Discipline
          </p>
          <Select value={currentDiscipline ?? "all"} onValueChange={(v) => updateParam("discipline", v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue placeholder="All disciplines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All disciplines</SelectItem>
              {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Career stage
          </p>
          <Select value={currentCareerStage ?? "all"} onValueChange={(v) => updateParam("careerStage", v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue placeholder="All career stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All career stages</SelectItem>
              {CAREER_STAGE_TAGS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Free entry */}
      <button
        type="button"
        onClick={() => updateParam("freeEntry", currentFreeEntry ? null : "1")}
        className={`w-full border px-3 py-2 text-left font-mono text-xs transition-colors ${
          currentFreeEntry
            ? "border-foreground bg-foreground text-white"
            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
        }`}
      >
        Free entry only
      </button>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="font-mono text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Permanent sidebar from lg up */}
      <div className="hidden lg:block">{panel}</div>

      {/* Trigger + slide-over below lg */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 border border-border px-3.5 py-2 font-mono text-xs text-foreground transition-colors hover:border-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters &amp; sort
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center bg-foreground px-1 text-[10px] text-white">
              {activeCount}
            </span>
          )}
        </button>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-white/20 backdrop-blur-md"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto border-r border-black bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="text-lg font-semibold">Filters &amp; sort</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close"
                  className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {panel}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
