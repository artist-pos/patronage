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
import type { CountryEnum, CareerStageEnum } from "@/types/database";

const COUNTRIES: CountryEnum[] = ["NZ", "AUS", "Global"];
const STAGES: CareerStageEnum[] = ["Emerging", "Mid-Career", "Established", "Open"];

export function ArtistFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCountry = searchParams.get("country") as CountryEnum | null;
  const currentStage = searchParams.get("stage") as CareerStageEnum | null;

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

  return (
    <div className="flex flex-wrap gap-3 pb-6 border-b border-border">
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

      <Select
        value={currentStage ?? "all"}
        onValueChange={(v) => updateParam("stage", v)}
      >
        <SelectTrigger className="w-44 text-sm">
          <SelectValue placeholder="All stages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
