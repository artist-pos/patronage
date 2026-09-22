import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import {
  SIGNUP_CONTEXT_COOKIE,
  SIGNUP_CONTEXT_MAX_AGE,
  encodeSignupContext,
  type SignupContext,
} from "@/lib/signup-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You have been invited — Patronage",
  // An invitation link is private to one artist. It must never be indexed.
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where an organisation's invitation email lands.
 *
 * It does not ask the artist to do anything here. The invitation already made
 * the ask; this page's only job is to carry what the organisation knew about
 * them into signup so they are not retyping their own city and discipline, then
 * get out of the way.
 *
 * The details ride in the signup cookie rather than the URL because the OAuth
 * round-trip drops nested params, and "continue with Google" has to work.
 */
export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  if (!UUID.test(token)) return <Invalid />;

  const admin = createAdminClient();
  const { data } = await admin
    .from("artist_invitations")
    .select(
      "id, email, full_name, disciplines, city, region_id, local_board_id, status, org_profile_id, org:profiles!artist_invitations_org_profile_id_fkey(full_name, username)"
    )
    .eq("token", token)
    .maybeSingle();

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

  if (!invite) return <Invalid />;

  // Someone already signed in does not need a signup funnel. Send them home
  // rather than seeding a context that would attribute their existing account.
  const user = await getServerUser();
  if (user) redirect("/opportunities");

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

  const store = await cookies();
  store.set(SIGNUP_CONTEXT_COOKIE, encodeSignupContext(ctx), {
    path: "/",
    maxAge: SIGNUP_CONTEXT_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });

  const orgName = invite.org?.full_name ?? invite.org?.username ?? "An organisation";

  redirect(
    `/auth/signup?role=artist&invited_by=${encodeURIComponent(orgName)}&email=${encodeURIComponent(invite.email)}`
  );
}

function Invalid() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          This invitation link is not valid
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been mistyped or already used. You can still create a free
          profile yourself.
        </p>
        <Link
          href="/auth/signup?role=artist"
          className="inline-flex items-center bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Create your profile →
        </Link>
      </div>
    </div>
  );
}
