"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { track } from "@vercel/analytics";
import { trackEvent } from "@/lib/analytics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CountryEnum, CareerStageEnum, DisciplineEnum } from "@/types/database";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";

const COUNTRIES: CountryEnum[] = ["NZ", "AUS", "Global"];
const STAGES: CareerStageEnum[] = ["Emerging", "Mid-Career", "Established", "Open"];

export function ArtistFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCountry = searchParams.get("country") as CountryEnum | null;
  const currentStage = searchParams.get("stage") as CareerStageEnum | null;
  const currentDiscipline = searchParams.get("discipline") as DisciplineEnum | null;
  const commissionsOnly = searchParams.get("commissions") === "1";

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

  function toggleDiscipline(discipline: DisciplineEnum) {
    if (currentDiscipline !== discipline) {
      track("filter_discipline", { discipline });
      trackEvent("discipline_filter", { discipline });
    }
    updateParam("discipline", currentDiscipline === discipline ? null : discipline);
  }

  // v2 discipline tab — mono 12px, black underline active (per Artists mockup)
  const tabCls = (active: boolean) =>
    `-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2 font-mono text-xs transition-colors ${
      active
        ? "border-foreground text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div>
      {/* Discipline tab row */}
      <div className="flex items-stretch overflow-x-auto border-b border-border scrollbar-hide">
        <button onClick={() => updateParam("discipline", null)} className={tabCls(!currentDiscipline)}>
          All
        </button>
        {DISCIPLINE_OPTIONS.map(({ value, label }) => (
          <button key={value} onClick={() => toggleDiscipline(value)} className={tabCls(currentDiscipline === value)}>
            {label}
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="flex items-center justify-between gap-3 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={currentCountry ?? "all"}
            onValueChange={(v) => updateParam("country", v)}
          >
            <SelectTrigger className="w-40 font-mono text-xs">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentStage ?? "all"}
            onValueChange={(v) => updateParam("stage", v)}
          >
            <SelectTrigger className="w-44 font-mono text-xs">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Commission availability — green = the artist's status colour */}
          <button
            onClick={() => updateParam("commissions", commissionsOnly ? null : "1")}
            className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-xs transition-colors ${
              commissionsOnly
                ? "border-[color:var(--success)] text-[color:var(--success)]"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${commissionsOnly ? "bg-success" : "bg-border"}`} />
            Open for commissions
          </button>
        </div>

      </div>
    </div>
  );
}
