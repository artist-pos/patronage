import type { DisciplineEnum } from "@/types/database";

/**
 * Signup attribution carried across the auth round-trip.
 *
 * It lives in a cookie rather than the `next` URL because the OAuth provider
 * mangles nested query params — the same reason auth/callback reads `role` as a
 * top-level param. A cookie survives the redirect out to Google and back, and
 * both the email/password and OAuth paths end up at /onboarding/role, which is
 * where it gets read and cleared.
 */
export const SIGNUP_CONTEXT_COOKIE = "patronage_signup_ctx";

/** One hour. Long enough to read a listing and finish signup, short enough
 *  that a stale context never attributes an unrelated account. */
export const SIGNUP_CONTEXT_MAX_AGE = 60 * 60;

export interface SignupContext {
  /** Surface that produced the signup, e.g. "opportunity_page". */
  source: string;
  /** A role the person actually declared — took an organisation invitation,
   *  picked an organisation type — not one inferred from what they were
   *  reading. Only this skips the role picker: role cannot be changed once
   *  set, and browsing an opportunity is something curators and gallery
   *  directors do constantly, so a passive signal must never decide it. */
  explicitRole?: "artist" | "patron" | "partner";
  /** Opportunity being viewed, where the surface was an opportunity page. */
  opportunityId?: string;
  /** Matching preferences to seed, taken from the listing they were reading. */
  disciplines?: string[];
  city?: string;
  country?: string;
  /** The ?ref= value on the session that led here, e.g. "share" or "digest". */
  ref?: string;
  /** Functional organisation category, when the partners page asked first.
   *  See lib/org-categories. */
  orgCategory?: string;
  /** Region the signup came from, so a regional CTA seeds the new profile's
   *  region rather than asking again. */
  regionId?: string;
  /** Organisation whose invitation brought them here (migration 187). Recorded
   *  as attribution on the new profile. It grants the organisation nothing. */
  invitedByOrgId?: string;
  /** The invitation row, so joining can be marked against it. */
  inviteToken?: string;
  /** Name the organisation had on file, offered as a default rather than
   *  written silently: it is their name and they may spell it differently. */
  fullName?: string;
}

/** Free-text listing disciplines → the constrained profile discipline enum.
 *  Anything unrecognised is dropped rather than forced into "other", which
 *  would make a seeded profile look deliberately miscategorised. */
const DISCIPLINE_MAP: Array<[RegExp, DisciplineEnum]> = [
  [/photograph/i, "photography"],
  [/film|video|moving image|screen|animation/i, "film"],
  [/music|sound|composition|audio/i, "music"],
  [/poet/i, "poetry"],
  [/writ|literat|publish|\btext\b/i, "writing"],
  [/dance|choreograph/i, "dance"],
  [/performance|theatre|theater|live art/i, "performance"],
  [/craft|ceramic|textile|jewell|weav|glass|wood|object/i, "craft"],
  [/paint|sculpt|install|drawing|print|visual|painting|multidisciplinary|mixed media/i, "visual_art"],
];

export function toDisciplineEnums(raw: string[] | null | undefined): DisciplineEnum[] {
  if (!raw?.length) return [];
  const out = new Set<DisciplineEnum>();
  for (const term of raw) {
    if (!term?.trim()) continue;
    for (const [pattern, value] of DISCIPLINE_MAP) {
      if (pattern.test(term)) {
        out.add(value);
        break;
      }
    }
  }
  return [...out];
}

export function encodeSignupContext(ctx: SignupContext): string {
  return encodeURIComponent(JSON.stringify(ctx));
}

export function decodeSignupContext(raw: string | undefined): SignupContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const ctx = parsed as SignupContext;
    if (typeof ctx.source !== "string" || !ctx.source) return null;
    return ctx;
  } catch {
    // Truncated or hand-edited cookie. Attribution is not worth an error page.
    return null;
  }
}
