"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Email/password auth runs server-side so the browser only ever talks to our
// own origin. Direct browser→supabase.co fetches fail for users behind content
// blockers, DNS filtering, and some in-app browsers (surfacing as Safari's
// generic "Load failed"). Google OAuth stays client-side — it's a full-page
// navigation, not a fetch, so it doesn't share this failure mode.

interface AuthResult {
  error?: string;
  /** Sign-in only — where the client should navigate on success. */
  redirectTo?: string;
}

// Server→Supabase fetch failures produce messages like "fetch failed" —
// translate them rather than leaking raw network errors to the form.
function friendlyAuthError(message: string): string {
  return /fetch failed|load failed|failed to fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)
    ? "Couldn't reach the server. Check your connection and try again."
    : message;
}

// Only allow same-site relative paths as post-auth destinations, so a crafted
// ?next=https://evil.com link can't redirect users off-site after login.
function safeNext(next: string | undefined, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

// Prefer the request origin so email links point back at the deployment the
// user signed up on (previews included). Supabase validates redirect URLs
// against its allow-list, so a spoofed Origin header can't redirect elsewhere.
async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  return origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
}

export async function signUpAction(input: {
  email: string;
  password: string;
  role?: string;
  next?: string;
}): Promise<AuthResult> {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Carry the post-auth destination and chosen role through the confirmation
  // email. Email signup uses /auth/confirm (token_hash flow) so the link
  // survives email prefetch/scanners and works across devices.
  const params = new URLSearchParams();
  if (input.role) params.set("role", input.role);
  if (input.next) params.set("next", input.next);
  const emailRedirectTo = `${await siteOrigin()}/auth/confirm?${params.toString()}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return {};
}

export async function signInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const friendly = friendlyAuthError(error.message);
    return {
      // Bad credentials get the generic line; network failures keep theirs —
      // "wrong password" would mislead when the request never arrived.
      error: friendly !== error.message
        ? friendly
        : "That email and password combination didn't work. Try again or reset your password.",
    };
  }

  // No profile row means onboarding was never completed — route there first.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return { redirectTo: "/onboarding/role" };
  }

  return { redirectTo: safeNext(input.next, "/profile/edit") };
}
