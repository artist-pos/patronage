"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  activeTab: "for-you" | "all";
  matchCount: number;
}

export function OpportunitiesTabSwitch({ activeTab, matchCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTab(tab: "for-you" | "all") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Clear filters when switching to For You
    if (tab === "for-you") {
      ["type", "country", "discipline", "freeEntry", "eligibility", "careerStage", "search"].forEach(
        (k) => params.delete(k)
      );
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Segmented control — this is a MODE switch, not another filter row.
  // Solid fill for the active segment separates it from the underline
  // filter tabs beneath it.
  const segCls = (active: boolean) =>
    `px-5 py-2.5 font-mono text-[13px] transition-colors ${
      active
        ? "bg-foreground text-white"
        : "bg-card text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="inline-flex items-stretch self-start border border-border">
      <button type="button" onClick={() => switchTab("all")} className={segCls(activeTab === "all")}>
        All Opportunities
      </button>
      <button
        type="button"
        onClick={() => switchTab("for-you")}
        className={`border-l border-border ${segCls(activeTab === "for-you")}`}
      >
        For You
        {matchCount > 0 && (
          <span className={`ml-1.5 text-xs ${activeTab === "for-you" ? "text-white/60" : "text-[color:var(--fg-subtle)]"}`}>
            {matchCount}
          </span>
        )}
      </button>
    </div>
  );
}
