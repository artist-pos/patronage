/**
 * The Verified rule in one place: a bio, a profile photo and at least three
 * works. Commerce eligibility (`commerce/eligibility.ts`), the studio banner and
 * the activation nudge emails all read this, so the three can't drift apart.
 *
 * Pure: no server imports, safe in server and client components.
 */
export const VERIFIED_WORKS_REQUIRED = 3;

export interface VerifiedProgress {
  hasBio: boolean;
  hasAvatar: boolean;
  worksCount: number;
  worksNeeded: number;
  verified: boolean;
  /** Human-readable gaps ("a bio", "2 more works"). Empty when verified. */
  missing: string[];
}

export function computeVerifiedProgress(
  profile: { bio: string | null; avatar_url: string | null } | null,
  worksCount: number,
): VerifiedProgress {
  const hasBio = !!profile?.bio?.trim();
  const hasAvatar = !!profile?.avatar_url;
  const worksNeeded = Math.max(0, VERIFIED_WORKS_REQUIRED - worksCount);

  const missing: string[] = [];
  if (!hasBio) missing.push("a bio");
  if (!hasAvatar) missing.push("a profile photo");
  if (worksNeeded > 0) missing.push(`${worksNeeded} more work${worksNeeded === 1 ? "" : "s"}`);

  return { hasBio, hasAvatar, worksCount, worksNeeded, verified: missing.length === 0, missing };
}
