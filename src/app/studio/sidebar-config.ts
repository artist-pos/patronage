export const SIDEBAR_SECTIONS = [
  { id: "profile",    label: "Profile",        group: "Identity"  },
  { id: "cv",         label: "CV & History",   group: "Identity"  },
  { id: "portfolio",  label: "Portfolio",       group: "Work"      },
  { id: "available",  label: "Available",       group: "Work"      },
  { id: "sold",       label: "Sold",            group: "Work"      },
  { id: "updates",    label: "Studio Updates",  group: "Creative"  },
  { id: "projects",   label: "Projects",        group: "Creative"  },
  { id: "campaigns",  label: "Campaigns",       group: "Creative"  },
  { id: "support",    label: "Support Tiers",   group: "Commerce"  },
  { id: "provenance", label: "Provenance",      group: "Commerce"  },
] as const;

export type Section = typeof SIDEBAR_SECTIONS[number]["id"];
export const VALID_SECTIONS = SIDEBAR_SECTIONS.map((s) => s.id) as string[];
export const SIDEBAR_GROUPS = ["Identity", "Work", "Creative", "Commerce"] as const;

export const TAB_TO_SECTION: Record<string, Section> = {
  works:     "portfolio",
  campaigns: "campaigns",
  commerce:  "support",
  support:   "support",
  analytics: "profile",
};

export function getSectionHref(id: string): string {
  return id === "provenance" ? "/studio/provenance" : `/studio?section=${id}`;
}
