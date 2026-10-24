/** Part two: shape, limits and validation. Shared by the form and the server. */

export const PROFILE_LIMITS = {
  name: 120,
  location: 120,
  bio: 1500,
  website: 300,
  instagram: 60,
  otherLinks: 500,
  staffPrompt: 500,
  workTitle: 200,
  workYear: 20,
  workMedium: 200,
  workSize: 100,
  workNote: 500,
} as const;

export const BIO_WORDS = { min: 80, max: 150 } as const;
export const WORKS = { min: 4, max: 8 } as const;

export interface WorkDraft {
  id: string;
  image_url: string;
  thumb_url: string | null;
  title: string;
  year: string;
  medium: string;
  size: string;
  note: string;
}

export interface ProfileDraft {
  photo_url: string;
  name: string;
  location: string;
  bio: string;
  website: string;
  instagram: string;
  other_links: string;
  staff_prompt_answer: string;
  visibility_choice: "" | "keep" | "private_only";
  consent: boolean;
}

export const EMPTY_PROFILE: ProfileDraft = {
  photo_url: "", name: "", location: "", bio: "", website: "", instagram: "", other_links: "",
  staff_prompt_answer: "", visibility_choice: "", consent: false,
};

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export type ProfileErrors = Partial<Record<keyof ProfileDraft | "works", string>>;

/** Codes for a complete profile: name, bio, works, choice, consent. */
export function validateProfile(p: ProfileDraft, workCount: number): ProfileErrors {
  const e: ProfileErrors = {};
  if (!p.name.trim()) e.name = "name";
  const w = wordCount(p.bio);
  if (w < BIO_WORDS.min || w > BIO_WORDS.max) e.bio = "bio";
  if (workCount < WORKS.min || workCount > WORKS.max) e.works = "works";
  if (!p.visibility_choice) e.visibility_choice = "choice";
  if (!p.consent) e.consent = "consent";
  return e;
}

export function cleanHandle(s: string): string {
  return s.trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "").slice(0, PROFILE_LIMITS.instagram);
}

export function cleanUrl(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, PROFILE_LIMITS.website) : null;
  } catch {
    return null;
  }
}
