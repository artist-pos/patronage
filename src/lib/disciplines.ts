import type { DisciplineEnum } from "@/types/database";

// Plain data, no "use client" — imported by both server (artists/page.tsx)
// and client (DisciplineInput, ArtistFilters, etc.) modules. Importing a
// named export from a "use client" file into a Server Component fails at
// runtime in this build, so this must stay a neutral, directive-free module.
export const DISCIPLINE_OPTIONS: { value: DisciplineEnum; label: string }[] = [
  { value: "visual_art",  label: "Visual Art" },
  { value: "music",       label: "Music" },
  { value: "photography", label: "Photography" },
  { value: "film",        label: "Film" },
  { value: "writing",     label: "Writing" },
  { value: "poetry",      label: "Poetry" },
  { value: "dance",       label: "Dance" },
  { value: "performance", label: "Performance" },
  { value: "craft",       label: "Craft" },
  { value: "other",       label: "Other" },
];

// Maps enum value → human label used for the legacy `medium` field
export const DISCIPLINE_TO_MEDIUM: Record<DisciplineEnum, string> = {
  visual_art:  "Visual Art",
  music:       "Music / Sound",
  photography: "Photography",
  film:        "Film / Video",
  writing:     "Writing",
  poetry:      "Poetry",
  dance:       "Dance",
  performance: "Performance",
  craft:       "Craft",
  other:       "Other",
};
