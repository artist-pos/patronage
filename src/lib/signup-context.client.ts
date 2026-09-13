import {
  SIGNUP_CONTEXT_COOKIE,
  SIGNUP_CONTEXT_MAX_AGE,
  encodeSignupContext,
  type SignupContext,
} from "@/lib/signup-context";

/**
 * Parks signup context in a cookie for /onboarding/role to pick up.
 *
 * A cookie rather than query params because the OAuth provider mangles nested
 * ones, and every signup path converges on /onboarding/role regardless of
 * whether the person used a password or "Continue with Google".
 *
 * Browser only. Never throws: failing to record where a signup came from must
 * not stop the signup.
 */
export function stashSignupContext(ctx: SignupContext): void {
  try {
    document.cookie = [
      `${SIGNUP_CONTEXT_COOKIE}=${encodeSignupContext(ctx)}`,
      "path=/",
      `max-age=${SIGNUP_CONTEXT_MAX_AGE}`,
      "samesite=lax",
    ].join("; ");
  } catch {
    // Cookies disabled. Attribution is lost; the signup still works.
  }
}
