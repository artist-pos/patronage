"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CountryEnum, OppTypeEnum } from "@/types/database";

const OPP_TYPES: OppTypeEnum[] = [
  "Grant",
  "Residency",
  "Commission",
  "Open Call",
  "Prize",
  "Display",
];
const COUNTRIES: CountryEnum[] = ["NZ", "AUS", "Global"];

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

  const currentType = searchParams.get("type") as OppTypeEnum | null;
  const currentCountry = searchParams.get("country") as CountryEnum | null;
  const currentView = searchParams.get("view") ?? "gallery";

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
    <div className="space-y-4 pb-6 border-b border-border">
      {/* Type pills + view switcher */}
      <div className="flex items-center justify-between gap-4">
        {/* Type filter pills — horizontal scroll */}
        <div className="flex overflow-x-auto gap-x-5 scrollbar-none shrink min-w-0 pb-0.5">
          <button
            onClick={() => updateParam("type", null)}
            className={`text-sm whitespace-nowrap transition-colors pb-0.5 shrink-0 ${
              !currentType
                ? "font-semibold border-b border-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {OPP_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`text-sm whitespace-nowrap transition-colors pb-0.5 shrink-0 ${
                currentType === t
                  ? "font-semibold border-b border-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* View switcher */}
        <div className="flex items-center border border-black shrink-0">
          <button
            onClick={() => updateParam("view", "gallery")}
            aria-label="Gallery view"
            className={`p-2 transition-colors ${
              currentView === "gallery" ? "bg-black text-white" : "hover:bg-muted"
            }`}
          >
            <GridIcon />
          </button>
          <button
            onClick={() => updateParam("view", "list")}
            aria-label="List view"
            className={`p-2 border-l border-black transition-colors ${
              currentView === "list" ? "bg-black text-white" : "hover:bg-muted"
            }`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {/* Secondary: country filter */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={currentCountry ?? "all"}
          onValueChange={(v) => updateParam("country", v)}
        >
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
