export const PRIMARY_SECTIONS = [
  { id: "home",         label: "Home"             },
  { id: "works",        label: "Works"            },
  { id: "opportunities",label: "Opportunities"    },
  { id: "feed",         label: "Studio Feed"      },
  { id: "messages",     label: "Messages"         },
  { id: "campaigns",    label: "Campaigns"        },
] as const;

export const SECONDARY_SECTIONS = [
  { id: "profile-cv",   label: "Profile & CV"     },
  { id: "provenance",   label: "Provenance"       },
  { id: "support-tiers",label: "Support Tiers"    },
  { id: "rooms",        label: "Viewing Rooms"    },
  { id: "earnings",     label: "Earnings & Payouts"},
  { id: "analytics",    label: "Analytics"        },
  { id: "account",      label: "Account"          },
] as const;

export const SIDEBAR_SECTIONS = [...PRIMARY_SECTIONS, ...SECONDARY_SECTIONS] as const;

export type Section = typeof SIDEBAR_SECTIONS[number]["id"];
export const VALID_SECTIONS = SIDEBAR_SECTIONS.map((s) => s.id) as string[];

// Legacy section IDs that existed before the IA consolidation
export const LEGACY_SECTION_ALIASES: Record<string, Section> = {
  profile:       "profile-cv",
  cv:            "profile-cv",
  portfolio:     "works",
  available:     "works",
  sold:          "works",
  collection:    "works",
  updates:       "feed",
  projects:      "feed",
  support:       "support-tiers",
  confirmations: "works",
  // dashboard tab aliases
  works:         "works",
  campaigns:     "campaigns",
  commerce:      "support-tiers",
  analytics:     "analytics",
};

export function getSectionHref(id: string): string {
  if (id === "provenance") return "/studio/provenance";
  if (id === "rooms")      return "/studio/rooms";
  if (id === "earnings")   return "/studio/earnings";
  if (id === "messages")   return "/messages";
  return `/studio?section=${id}`;
}
