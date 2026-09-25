/** Session key naming the surface (and role) that started a signup. Set by
 *  AuthForm when a signup begins, read once by PostHogSignupCompleted so
 *  signup_completed says where it came from. Its own module so the root
 *  PostHog provider can import it without pulling in the auth form. */
export const SIGNUP_SOURCE_SESSION_KEY = "patronage_signup_source";
