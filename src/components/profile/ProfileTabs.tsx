"use client";

import { useRouter } from "next/navigation";

const TABS = ["overview", "work", "cv", "support"] as const;
type Tab = typeof TABS[number];

interface Props {
  username: string;
  tab: string;
  artistName?: string | null;
}

export function ProfileTabs({ username, tab, artistName }: Props) {
  const router = useRouter();

  const TAB_LABELS: Record<Tab, string> = {
    overview: "Overview",
    work: "Work",
    cv: "CV & Press",
    support: artistName ? `Support ${artistName}` : "Support",
  };

  return (
    <nav className="overflow-x-auto border-b border-border -mx-4 sm:-mx-6 px-4 sm:px-6 mt-8">
      <div className="flex min-w-max">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.replace(`/${username}?tab=${t}`, { scroll: false })}
            className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
              tab === t
                ? "font-semibold border-b-2 border-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
    </nav>
  );
}
