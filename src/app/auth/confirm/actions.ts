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

/** Mirror the callback's role-aware routing so a verified user lands in the
 *  right onboarding step. */
function destinationFor(role: string | null, next: string | null): string {
  if (role && VALID_ROLES.includes(role)) {
    const params = new URLSearchParams({ role });
    // Carry next through onboarding so post-signup flows (e.g. a free listing
    // started while logged out) can resume where the user left off.
    if (next && next.startsWith("/")) params.set("next", next);
    return `/onboarding/role?${params.toString()}`;
  }
  return next || "/onboarding/role";
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
