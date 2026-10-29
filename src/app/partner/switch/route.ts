import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { ACTING_ORG_COOKIE, isOrgMember } from "@/lib/partner-org";

/**
 * Switch which organisation the signed-in user is managing, then land on its
 * dashboard. The cookie is only set for an organisation they belong to, and it
 * is re-checked on every request in getActingOrg, so it grants nothing by itself.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getServerUser();
  const url = new URL(request.url);

  if (!user) {
    const next = encodeURIComponent(`${url.pathname}${url.search}`);
    return NextResponse.redirect(new URL(`/auth/login?next=${next}`, request.url));
  }

  const org = url.searchParams.get("org");
  const response = NextResponse.redirect(new URL("/dashboard?view=org", request.url));
  if (org && (await isOrgMember(supabase, user.id, org))) {
    response.cookies.set(ACTING_ORG_COOKIE, org, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
