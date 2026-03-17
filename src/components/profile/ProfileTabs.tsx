"use client";

import { useRouter } from "next/navigation";

const TABS = ["overview", "work", "studio", "cv", "support"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  work: "Work",
  studio: "Studio",
  cv: "CV & Press",
  support: "Support",
};

interface Props {
  username: string;
  tab: string;
}

export function ProfileTabs({ username, tab }: Props) {
  const router = useRouter();

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
