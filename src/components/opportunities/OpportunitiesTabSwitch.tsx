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

  return (
    <div className="inline-flex items-center gap-1 bg-stone-100 rounded-full p-1">
      <button
        type="button"
        onClick={() => switchTab("for-you")}
        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
          activeTab === "for-you"
            ? "bg-white text-foreground shadow-sm"
            : "text-stone-500 hover:text-foreground"
        }`}
      >
        For You
        {matchCount > 0 && (
          <span className={`ml-1.5 text-xs ${
            activeTab === "for-you" ? "text-stone-400" : "text-stone-400"
          }`}>
            {matchCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => switchTab("all")}
        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
          activeTab === "all"
            ? "bg-white text-foreground shadow-sm"
            : "text-stone-500 hover:text-foreground"
        }`}
      >
        All Opportunities
      </button>
    </div>
  );
}
