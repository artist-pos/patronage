"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPP_TYPES, TYPE_LABELS, DISCIPLINES, COUNTRIES, CAREER_STAGE_TAGS } from "@/lib/opportunity-constants";

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" />
      <rect x="9" y="1" width="6" height="6" />
      <rect x="1" y="9" width="6" height="6" />
      <rect x="9" y="9" width="6" height="6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="4" x2="15" y2="4" />
      <line x1="1" y1="8" x2="15" y2="8" />
      <line x1="1" y1="12" x2="15" y2="12" />
    </svg>
  );
}

export function OpportunityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type");
  const currentCountry = searchParams.get("country");
  const currentDiscipline = searchParams.get("discipline");
  const currentCareerStage = searchParams.get("careerStage");
  const currentFreeEntry = searchParams.get("freeEntry") === "1";
  const currentView = searchParams.get("view") ?? "gallery";
  const currentSearch = searchParams.get("search") ?? "";

  // Debounced search input — don't push a new URL on every keystroke
  const [searchInput, setSearchInput] = useState(currentSearch);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync input if URL param changes externally
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      updateParam("search", value.trim() || null);
    }, 400);
  }

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

  return (
    <div className="space-y-2 pb-6 border-b border-border">
      <div className="flex items-center justify-between gap-4">
        <div className="flex overflow-x-auto gap-x-5 scrollbar-none shrink min-w-0 pb-0.5">
          <button
            onClick={() => updateParam("type", null)}
            className={`text-sm whitespace-nowrap transition-colors pb-0.5 shrink-0 ${
              !currentType ? "font-semibold border-b border-black" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {OPP_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`text-sm whitespace-nowrap transition-colors pb-0.5 shrink-0 ${
                currentType === t ? "font-semibold border-b border-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        <div className="flex items-center border border-black shrink-0">
          <button
            onClick={() => updateParam("view", "gallery")}
            aria-label="Gallery view"
            className={`p-2 transition-colors ${currentView === "gallery" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            <GridIcon />
          </button>
          <button
            onClick={() => updateParam("view", "list")}
            aria-label="List view"
            className={`p-2 border-l border-black transition-colors ${currentView === "list" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={currentCountry ?? "all"} onValueChange={(v) => updateParam("country", v)}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={currentDiscipline ?? "all"} onValueChange={(v) => updateParam("discipline", v)}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="All disciplines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All disciplines</SelectItem>
            {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={currentCareerStage ?? "all"} onValueChange={(v) => updateParam("careerStage", v)}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="All career stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All career stages</SelectItem>
            {CAREER_STAGE_TAGS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <button
          onClick={() => updateParam("freeEntry", currentFreeEntry ? null : "1")}
          className={`text-sm px-3 py-1.5 border transition-colors ${
            currentFreeEntry
              ? "bg-black text-white border-black"
              : "border-border text-muted-foreground hover:text-foreground hover:border-black"
          }`}
        >
          Free Entry
        </button>

        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search…"
          className="border border-border text-sm px-3 py-1.5 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-black w-40"
        />
      </div>
    </div>
  );
}
