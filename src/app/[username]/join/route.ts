import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  SIGNUP_CONTEXT_COOKIE,
  SIGNUP_CONTEXT_MAX_AGE,
  encodeSignupContext,
  type SignupContext,
} from "@/lib/signup-context";

/**
 * An organisation's open onboarding link: patronage.nz/{org}/join.
 *
 * The spreadsheet invite reaches the artists an organisation has emails for;
 * this reaches everyone else, pasted into a newsletter, a group chat or a bio.
 * Same landing as an emailed invitation, minus what only a named invite knows
 * (their name, email, discipline). Joining through it credits the organisation
 * (invited_by_org_id) and seeds its region, and grants it nothing else.
 *
 * Built on the public username rather than a secret: anyone could type it, and
 * all it can do is make someone an artist on Patronage in that region.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const db = createPublicClient();
  const [{ data }, { user }] = await Promise.all([
    db
      .from("profiles")
      .select("id, username, full_name, role, region_id, local_board_id")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle(),
    getServerUser(),
  ]);

  const org = data as {
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    region_id: string | null;
    local_board_id: string | null;
  } | null;

  if (!org || org.role !== "partner") return to("/invite/invalid");

  // Already on Patronage: show them the organisation instead of a signup form.
  if (user) return to(`/${org.username}`);

  captureServerEvent("org_link_opened", org.id, { org_id: org.id }).catch(() => {});

  const ctx: SignupContext = {
    source: "org_link",
    // The link says "for our artists", so it settles the role the way a named
    // invitation does.
    explicitRole: "artist",
    invitedByOrgId: org.id,
    ref: "org_link",
    ...(org.region_id && { regionId: org.region_id, country: "NZ" }),
    ...(org.local_board_id && { localBoardId: org.local_board_id }),
  };

  const orgName = org.full_name ?? org.username;
  const res = to(`/auth/signup?role=artist&invited_by=${encodeURIComponent(orgName)}`);
  res.cookies.set(SIGNUP_CONTEXT_COOKIE, encodeSignupContext(ctx), {
    path: "/",
    maxAge: SIGNUP_CONTEXT_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
