"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import type { WorksGridLayout } from "@/components/feed/WorksJustifiedGrid";

interface Props {
  mediumOptions: string[];
  currentSort: string;
  currentMedium: string | undefined;
  currentLayout: WorksGridLayout;
}

export function WorksControls({ mediumOptions, currentSort, currentMedium, currentLayout }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("tab");
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    const qs = next.toString();
    router.push(qs ? `/works?${qs}` : "/works", { scroll: false });
  }

  const selectCls =
    "text-sm border border-border bg-background px-3 py-1.5 rounded-sm focus:outline-none focus:ring-1 focus:ring-black";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={currentMedium ?? ""}
        onChange={(e) => update("medium", e.target.value)}
        className={selectCls}
      >
        <option value="">All mediums</option>
        {mediumOptions.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select
        value={currentSort}
        onChange={(e) => update("sort", e.target.value)}
        className={selectCls}
      >
        <option value="recent">Most recent</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>

      {/* Layout switcher — desktop only; mobile uses a fixed 2-column grid */}
      <div className="hidden sm:flex items-center border border-border rounded-sm overflow-hidden">
        <button
          onClick={() => update("wlayout", "justified")}
          className={`p-1.5 transition-colors ${
            currentLayout === "justified"
              ? "bg-black text-white"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Justified grid layout"
          title="Justified grid"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => update("wlayout", "list")}
          className={`p-1.5 transition-colors ${
            currentLayout === "list"
              ? "bg-black text-white"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
          aria-label="List layout"
          title="List"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
