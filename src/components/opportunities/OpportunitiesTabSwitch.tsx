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
    <div className="flex gap-0 border border-black w-fit">
      <button
        type="button"
        onClick={() => switchTab("for-you")}
        className={`px-5 py-2 text-sm font-medium transition-colors ${
          activeTab === "for-you"
            ? "bg-black text-white"
            : "bg-white text-foreground hover:bg-stone-50"
        }`}
      >
        For You
        {matchCount > 0 && (
          <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
            activeTab === "for-you" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
          }`}>
            {matchCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => switchTab("all")}
        className={`px-5 py-2 text-sm font-medium border-l border-black transition-colors ${
          activeTab === "all"
            ? "bg-black text-white"
            : "bg-white text-foreground hover:bg-stone-50"
        }`}
      >
        All Opportunities
      </button>
    </div>
  );
}
