"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  mediumOptions: string[];
  currentSort: string;
  currentMedium: string | undefined;
}

export function WorksControls({ mediumOptions, currentSort, currentMedium }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "works");
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.push(`/feed?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={currentMedium ?? ""}
        onChange={(e) => update("medium", e.target.value)}
        className="text-sm border border-border bg-background px-3 py-1.5 rounded-sm focus:outline-none focus:ring-1 focus:ring-black"
      >
        <option value="">All mediums</option>
        {mediumOptions.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select
        value={currentSort}
        onChange={(e) => update("sort", e.target.value)}
        className="text-sm border border-border bg-background px-3 py-1.5 rounded-sm focus:outline-none focus:ring-1 focus:ring-black"
      >
        <option value="recent">Most recent</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>
    </div>
  );
}
