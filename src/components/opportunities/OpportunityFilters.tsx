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

export function OpportunityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") as OppTypeEnum | null;
  const currentCountry = searchParams.get("country") as CountryEnum | null;

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
        value={currentType ?? "all"}
        onValueChange={(v) => updateParam("type", v)}
      >
        <SelectTrigger className="w-40 text-sm">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {OPP_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
