import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import {
  SIGNUP_CONTEXT_COOKIE,
  SIGNUP_CONTEXT_MAX_AGE,
  encodeSignupContext,
  type SignupContext,
} from "@/lib/signup-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where an organisation's invitation email lands.
 *
 * It does not ask the artist to do anything here. The invitation already made
 * the ask; this route's only job is to carry what the organisation knew about
 * them into signup so they are not retyping their own city and discipline, then
 * get out of the way.
 *
 * The details ride in the signup cookie rather than the URL because the OAuth
 * round-trip drops nested params, and "continue with Google" has to work. A
 * route handler, not a page: Next.js refuses cookie writes during a page render.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!UUID.test(token)) return to("/invite/invalid");

  const admin = createAdminClient();
  const [{ data }, { user }] = await Promise.all([
    admin
      .from("artist_invitations")
      .select(
        "id, email, full_name, disciplines, city, region_id, local_board_id, status, org_profile_id, org:profiles!artist_invitations_org_profile_id_fkey(full_name, username)"
      )
      .eq("token", token)
      .maybeSingle(),
    getServerUser(),
  ]);

  const invite = data as {
    id: string;
    email: string;
    full_name: string | null;
    disciplines: string[] | null;
    city: string | null;
    region_id: string | null;
    local_board_id: string | null;
    status: string;
    org_profile_id: string;
    org: { full_name: string | null; username: string } | null;
  } | null;

  if (!invite) return to("/invite/invalid");

  // Someone already signed in does not need a signup funnel. Send them on
  // rather than seeding a context that would attribute their existing account.
  if (user) return to("/opportunities");

  // First open of the link. Recorded once so the organisation's funnel can tell
  // "never opened it" from "opened it and did not finish".
  if (invite.status === "sent" || invite.status === "pending") {
    await admin
      .from("artist_invitations")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  const ctx: SignupContext = {
    source: "org_invite",
    // They were invited by name, as an artist. Asking again would be asking
    // them to re-state what the invitation already settled.
    explicitRole: "artist",
    invitedByOrgId: invite.org_profile_id,
    inviteToken: token,
    ref: "invite",
    country: "NZ",
    ...(invite.full_name && { fullName: invite.full_name }),
    ...(invite.disciplines?.length && { disciplines: invite.disciplines }),
    ...(invite.city && { city: invite.city }),
    ...(invite.region_id && { regionId: invite.region_id }),
    ...(invite.local_board_id && { localBoardId: invite.local_board_id }),
  };

  const orgName = invite.org?.full_name ?? invite.org?.username ?? "An organisation";
  const res = to(
    `/auth/signup?role=artist&invited_by=${encodeURIComponent(orgName)}&email=${encodeURIComponent(invite.email)}`
  );
  res.cookies.set(SIGNUP_CONTEXT_COOKIE, encodeSignupContext(ctx), {
    path: "/",
    maxAge: SIGNUP_CONTEXT_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
