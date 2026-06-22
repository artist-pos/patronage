import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_ROLES = ["artist", "patron", "partner", "owner"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  const nextParam = searchParams.get("next");

  // When a role was chosen at signup (e.g. "Continue with Google" from
  // /auth/signup?role=artist), route through the role-onboarding step so the
  // profile is created with that role and the user lands on /studio?welcome=1.
  // Role is read as a top-level param: nesting it inside `next` got mangled
  // through the OAuth provider round-trip, dropping the user on the homepage.
  const next =
    role && VALID_ROLES.includes(role)
      ? `/onboarding/role?role=${encodeURIComponent(role)}${
          nextParam && nextParam.startsWith("/")
            ? `&next=${encodeURIComponent(nextParam)}`
            : ""
        }`
      : nextParam ?? "/onboarding/role";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback`);
}
