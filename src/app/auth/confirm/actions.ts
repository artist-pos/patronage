"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = ["artist", "patron", "partner", "owner"];
const VALID_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "invite",
  "email_change",
  "magiclink",
];

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
}

/** Route a newly-confirmed user to their destination.
 *
 *  The onboarding modal (OnboardingGate) handles profile creation inline on
 *  whichever page the user lands on, so we skip the full-page /onboarding/role
 *  step and send them straight to the app. The fallback pages still exist for
 *  login-time routing and JS-off edge cases.
 */
function destinationFor(role: string | null, next: string | null): string {
  void role; // role pre-selection now handled by OnboardingGate via suggestedRoleForPath
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding")) {
    return next;
  }
  return "/opportunities";
}

/**
 * Exchange a PKCE code for a session. Like verifyEmail below, this runs only
 * on an explicit button click so email scanners can't consume the single-use
 * code before the human gets here. Unlike token_hash verification this DOES
 * need the code_verifier cookie, so opening the email on a different device
 * than signup will fail — the expired-link recovery path handles that.
 */
export async function exchangeCode(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const role = (formData.get("role") as string) || null;
  const next = (formData.get("next") as string) || null;

  if (!code) redirect("/auth/confirm?status=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const params = new URLSearchParams({ status: "expired" });
    if (role) params.set("role", role);
    redirect(`/auth/confirm?${params.toString()}`);
  }

  redirect(destinationFor(role, next));
}

/**
 * Verify the email confirmation token. This runs only on an explicit button
 * click (not on GET), so email link-scanners that prefetch the link can't
 * consume the single-use token before the human clicks. verifyOtp with a
 * token_hash also doesn't need the PKCE code_verifier cookie, so it works when
 * the email is opened on a different device than signup.
 */
export async function verifyEmail(formData: FormData): Promise<void> {
  const token_hash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const role = (formData.get("role") as string) || null;
  const next = (formData.get("next") as string) || null;

  if (!token_hash || !VALID_OTP_TYPES.includes(type)) {
    redirect("/auth/confirm?status=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    const params = new URLSearchParams({ status: "expired" });
    if (role) params.set("role", role);
    redirect(`/auth/confirm?${params.toString()}`);
  }

  redirect(destinationFor(role, next));
}

/**
 * Send a fresh confirmation email. Lets a user with an expired/consumed link
 * recover instead of being permanently locked out (they can't sign in until
 * the email is confirmed).
 */
export async function resendConfirmation(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = (formData.get("role") as string) || null;
  const validRole = role && VALID_ROLES.includes(role) ? role : null;

  // Error redirects land back on this page — keep the chosen role and the
  // typed email so retrying doesn't silently lose them.
  function retryUrl(resend: string): string {
    const p = new URLSearchParams({ status: "expired", resend });
    if (validRole) p.set("role", validRole);
    if (email) p.set("email", email);
    return `/auth/confirm?${p.toString()}`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(retryUrl("invalid-email"));
  }

  const params = new URLSearchParams();
  if (validRole) params.set("role", validRole);
  params.set("next", "/onboarding/role");
  const emailRedirectTo = `${siteUrl()}/auth/confirm?${params.toString()}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    const detail = `${error.code ?? ""} ${error.message}`;
    // Supabase allows one email per address per 60s — "try again" is the
    // wrong advice there, so tell the user to wait instead.
    if (/over_email_send_rate_limit|rate limit|security purposes|after \d+ seconds/i.test(detail)) {
      redirect(retryUrl("rate-limit"));
    }
    // Resend for an already-confirmed address fails every time — the user
    // is actually verified and just needs to sign in.
    if (/already|exists|confirmed/i.test(detail)) {
      redirect("/auth/login?message=already-confirmed");
    }
    redirect(retryUrl("error"));
  }

  redirect("/auth/login?message=confirm-sent");
}
