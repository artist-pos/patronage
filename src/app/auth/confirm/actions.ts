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
    return `/onboarding/role?role=${encodeURIComponent(role)}`;
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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/auth/confirm?status=expired&resend=invalid-email");
  }

  const params = new URLSearchParams();
  if (role && VALID_ROLES.includes(role)) params.set("role", role);
  params.set("next", "/onboarding/role");
  const emailRedirectTo = `${siteUrl()}/auth/confirm?${params.toString()}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    redirect("/auth/confirm?status=expired&resend=error");
  }

  redirect("/auth/login?message=confirm-sent");
}
