"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Region filter on the noticeboard, kept in the URL like the kind chips. */
export function NoticeRegionSelect({ regions, value }: { regions: { id: string; name: string }[]; value: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(v: string) {
    const q = new URLSearchParams(searchParams.toString());
    if (v === "all") q.delete("region"); else q.set("region", v);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  return (
    <Select value={value ?? "all"} onValueChange={set}>
      <SelectTrigger className="h-9 w-full min-w-[160px] font-mono text-xs sm:w-auto" aria-label="Region">
        <SelectValue placeholder="Anywhere" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Anywhere</SelectItem>
        {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
