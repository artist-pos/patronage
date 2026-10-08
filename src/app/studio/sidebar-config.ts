type SidebarItem = { id: string; label: string; href: string };

// ── All possible sections ────────────────────────────────────────────────────

const ALL_PRIMARY: SidebarItem[] = [
  { id: "home",          label: "Home",              href: "/studio" },
  { id: "works",         label: "My Work",           href: "/studio/works" },
  { id: "opportunities", label: "Opportunities",     href: "/studio/opportunities" },
  { id: "feed",          label: "Studio Feed",       href: "/studio/feed" },
  { id: "messages",      label: "Messages",          href: "/messages" },
  { id: "collection",    label: "Collection",        href: "/dashboard/collection" },
  { id: "calls",         label: "Open Calls",        href: "/dashboard" },
  { id: "roster",        label: "Your Artists",      href: "/partner/roster" },
  { id: "qr-codes",      label: "QR Codes",          href: "/studio/qr-codes" },
];

const ALL_SECONDARY: SidebarItem[] = [
  { id: "profile",       label: "Profile & CV",       href: "/studio/profile" },
  { id: "provenance",    label: "Provenance",          href: "/studio/provenance" },
  { id: "support",       label: "Supporters",          href: "/studio/support" },
  { id: "exhibitions",   label: "Online Exhibitions",  href: "/studio/exhibitions" },
  { id: "my-support",    label: "My Support",          href: "/dashboard?tab=subscriptions" },
  { id: "earnings",      label: "Earnings & Payouts",  href: "/studio/earnings" },
  { id: "list-opp",      label: "List an Opportunity", href: "/list-an-opportunity" },
  { id: "account",       label: "Account",             href: "/studio/account" },
];

// ── Role-based filtering ─────────────────────────────────────────────────────

const ARTIST_PRIMARY  = ["home", "works", "opportunities", "feed", "messages", "collection", "qr-codes"];
const ARTIST_SECONDARY = ["profile", "provenance", "support", "exhibitions", "earnings", "account"];

const PATRON_PRIMARY  = ["home", "opportunities", "messages", "collection"];
const PATRON_SECONDARY = ["my-support", "account"];

const PARTNER_PRIMARY  = ["home", "roster", "messages"];
const PARTNER_SECONDARY = ["list-opp", "account"];

const OWNER_PRIMARY = [...ARTIST_PRIMARY, "calls", "roster"];
const OWNER_SECONDARY = [...ARTIST_SECONDARY, "my-support", "list-opp"];

function filterSections(items: SidebarItem[], ids: string[]): SidebarItem[] {
  return ids.map((id) => items.find((s) => s.id === id)).filter(Boolean) as SidebarItem[];
}

export function getSections(role: string): { primary: SidebarItem[]; secondary: SidebarItem[] } {
  switch (role) {
    case "owner":
    case "admin":
      return {
        primary: filterSections(ALL_PRIMARY, OWNER_PRIMARY),
        secondary: filterSections(ALL_SECONDARY, OWNER_SECONDARY),
      };
    case "artist":
      return {
        primary: filterSections(ALL_PRIMARY, ARTIST_PRIMARY),
        secondary: filterSections(ALL_SECONDARY, ARTIST_SECONDARY),
      };
    case "patron":
      return {
        primary: filterSections(ALL_PRIMARY, PATRON_PRIMARY),
        secondary: filterSections(ALL_SECONDARY, PATRON_SECONDARY),
      };
    case "partner":
      return {
        primary: filterSections(ALL_PRIMARY, PARTNER_PRIMARY),
        secondary: filterSections(ALL_SECONDARY, PARTNER_SECONDARY),
      };
    default:
      return {
        primary: filterSections(ALL_PRIMARY, PATRON_PRIMARY),
        secondary: filterSections(ALL_SECONDARY, PATRON_SECONDARY),
      };
  }
}

// ── Legacy exports (used by StudioNav and redirect handler) ──────────────────

export const PRIMARY_SECTIONS = ALL_PRIMARY;
export const SECONDARY_SECTIONS = ALL_SECONDARY;
export const SIDEBAR_SECTIONS = [...ALL_PRIMARY, ...ALL_SECONDARY];

export type Section = string;
export const VALID_SECTIONS = SIDEBAR_SECTIONS.map((s) => s.id);

export const LEGACY_SECTION_ALIASES: Record<string, string> = {
  "profile-cv":    "profile",
  "support-tiers": "support",
  campaigns:       "qr-codes",
  rooms:           "exhibitions",
  profile:         "profile",
  cv:              "profile",
  portfolio:       "works",
  available:       "works",
  sold:            "works",
  updates:         "feed",
  projects:        "feed",
  support:         "support",
  confirmations:   "works",
  works:           "works",
  commerce:        "support",
  analytics:       "home",
};

export function sectionFromPathname(pathname: string): string {
  const clean = pathname.replace(/\/$/, "") || "/studio";

  if (clean === "/studio") return "home";

  const match = clean.match(/^\/studio\/([^/]+)/);
  if (!match) {
    // Handle non-studio paths that appear in the unified sidebar
    if (clean.startsWith("/dashboard/collection")) return "collection";
    if (clean.startsWith("/dashboard")) return "my-support";
    if (clean.startsWith("/partner/roster")) return "roster";
    if (
      clean.startsWith("/opportunities") ||
      clean.startsWith("/dashboard") ||
      clean.startsWith("/partner/opportunities")
    ) return "calls";
    if (clean === "/messages" || clean.startsWith("/messages/")) return "messages";
    return "home";
  }

  const segment = match[1];

  const segmentToSection: Record<string, string> = {
    works:                "works",
    artworks:             "works",
    series:               "works",
    "pending-confirmations": "works",
    feed:                 "feed",
    opportunities:        "opportunities",
    "qr-codes":           "qr-codes",
    profile:              "profile",
    provenance:           "provenance",
    "provenance-settings": "provenance",
    support:              "support",
    exhibitions:          "exhibitions",
    collection:           "collection",
    earnings:             "earnings",
    analytics:            "home",
    account:              "account",
    connect:              "earnings",
  };

  return segmentToSection[segment] ?? "home";
}
