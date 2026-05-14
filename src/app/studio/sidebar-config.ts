export const SIDEBAR_SECTIONS = [
  { id: "profile",     label: "Profile",        group: "Identity"  },
  { id: "cv",          label: "CV & History",   group: "Identity"  },
  { id: "portfolio",   label: "Portfolio",       group: "Work"      },
  { id: "available",   label: "Available",       group: "Work"      },
  { id: "sold",        label: "Sold",            group: "Work"      },
  { id: "collection",  label: "Collection",      group: "Work"      },
  { id: "updates",     label: "Studio Updates",  group: "Creative"  },
  { id: "projects",    label: "Projects",        group: "Creative"  },
  { id: "campaigns",   label: "Campaigns",       group: "Creative"  },
  { id: "support",     label: "Support Tiers",   group: "Commerce"  },
  { id: "earnings",    label: "Earnings",         group: "Commerce"  },
  { id: "provenance",  label: "Provenance",      group: "Commerce"  },
  { id: "confirmations", label: "Confirmations", group: "Commerce" },
  { id: "rooms",       label: "Viewing Rooms",   group: "Commerce"  },
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

// Collection lives under /dashboard/collection — it's role-agnostic, shared
// with patrons and partners. Surface it from the studio sidebar so artists
// who collect other artists' work can reach it from one place.
export function getSectionHref(id: string): string {
  if (id === "provenance")   return "/studio/provenance";
  if (id === "collection")   return "/dashboard/collection";
  if (id === "confirmations") return "/studio/pending-confirmations";
  if (id === "earnings")     return "/studio/earnings";
  if (id === "rooms")        return "/studio/rooms";
  return `/studio?section=${id}`;
}
