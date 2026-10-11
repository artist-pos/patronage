import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  SIGNUP_CONTEXT_COOKIE,
  SIGNUP_CONTEXT_MAX_AGE,
  encodeSignupContext,
  type SignupContext,
} from "@/lib/signup-context";

/**
 * A cohort's join link: patronage.nz/c/{code}.
 *
 * A school hands one link to a year group, a club to its members. Like the
 * organisation's open link it credits the organisation (invited_by_org_id) and
 * seeds its region, and additionally records the cohort so the organisation can
 * see how many have arrived. It grants the organisation nothing on the artist.
 *
 * Codes are not secret, only unguessable enough: all they can do is make
 * someone an artist on Patronage, tagged to a group.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const admin = createAdminClient();
  const [{ data: cohortRow }, { user }] = await Promise.all([
    admin
      .from("org_cohorts")
      .select("id, org_profile_id, name")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle(),
    getServerUser(),
  ]);

  const cohort = cohortRow as { id: string; org_profile_id: string; name: string } | null;
  if (!cohort) return to("/invite/invalid");

  const { data: orgRow } = await admin
    .from("profiles")
    .select("id, username, full_name, role, region_id, local_board_id")
    .eq("id", cohort.org_profile_id)
    .eq("is_active", true)
    .maybeSingle();

  const org = orgRow as {
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    region_id: string | null;
    local_board_id: string | null;
  } | null;

  if (!org || org.role !== "partner") return to("/invite/invalid");

  // Already on Patronage: an artist who opens the link joins the cohort now,
  // since opening it is the intent. Everyone else just sees the organisation.
  if (user) {
    const { data: me } = await admin.from("profiles").select("role, invited_by_org_id").eq("id", user.id).maybeSingle();
    const mine = me as { role: string | null; invited_by_org_id: string | null } | null;
    if (mine && (mine.role === "artist" || mine.role === "owner")) {
      await admin
        .from("profiles")
        .update({
          cohort_id: cohort.id,
          // Never overwrite an earlier attribution.
          ...(mine.invited_by_org_id ? {} : { invited_by_org_id: org.id }),
        })
        .eq("id", user.id);
    }
    return to(`/${org.username}`);
  }

  captureServerEvent("cohort_link_opened", org.id, { org_id: org.id, cohort_id: cohort.id }).catch(() => {});

  const ctx: SignupContext = {
    source: "cohort_code",
    explicitRole: "artist",
    invitedByOrgId: org.id,
    cohortId: cohort.id,
    ref: "cohort_code",
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
