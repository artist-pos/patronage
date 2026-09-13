import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVerificationEmail } from "@/lib/email";

/**
 * Verification we own, rather than Supabase's.
 *
 * Supabase's confirmation gate blocks the session entirely, which meant a new
 * artist had to leave for their inbox before seeing anything worth staying
 * for. Here the account works immediately and the address is proved afterwards
 * — unverified costs them applications and the digest, not access.
 *
 * Only the hash is stored (profiles is publicly readable), so the token in the
 * email is the only usable copy.
 */

/** Supabase used to throttle sends for us at one per minute. It no longer sees
 *  these, so the limit lives here. */
const RESEND_COOLDOWN_MS = 60_000;

export type IssueResult = "sent" | "rate_limited" | "already_verified" | "error";
export type VerifyStatus = "verified" | "already_verified" | "invalid";

export interface VerifyResult {
  status: VerifyStatus;
  /** The account that was just proved. Returned because the link is often
   *  opened on a different device from the one that signed up, where there is
   *  no session to read it from. */
  profile: { id: string; email: string | null; role: string | null; weekly_digest: boolean | null } | null;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Mint a token, store its hash, and send the email.
 *
 * Fire-and-forget at the call sites: a send that fails costs the artist a
 * banner they can retry from, not their account.
 */
export async function issueEmailVerification(
  userId: string,
  opts: { force?: boolean } = {}
): Promise<IssueResult> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, username, email_verified_at, email_verify_sent_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.email) return "error";
  if (profile.email_verified_at) return "already_verified";

  if (!opts.force && profile.email_verify_sent_at) {
    const since = Date.now() - new Date(profile.email_verify_sent_at).getTime();
    if (since < RESEND_COOLDOWN_MS) return "rate_limited";
  }

  const raw = randomBytes(32).toString("hex");

  const { error } = await admin
    .from("profiles")
    .update({
      email_verify_hash: hashToken(raw),
      email_verify_sent_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return "error";

  try {
    await sendVerificationEmail({
      email: profile.email,
      name: profile.full_name?.trim() || profile.username || "there",
      token: raw,
    });
  } catch {
    return "error";
  }

  return "sent";
}

/**
 * Consume a token from an email link.
 *
 * Unlike the old Supabase flow, a link scanner opening this first is not a
 * problem worth defending against: the scanner runs inside the recipient's own
 * mail infrastructure, so it proves the same thing the click would, and the
 * human arriving afterwards is told they are verified rather than shown an
 * expired-link dead end.
 */
export async function verifyEmailToken(raw: string): Promise<VerifyResult> {
  const invalid: VerifyResult = { status: "invalid", profile: null };
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return invalid;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, weekly_digest, email_verified_at")
    .eq("email_verify_hash", hashToken(raw))
    .maybeSingle();

  if (!profile) return invalid;

  const found = {
    id: profile.id as string,
    email: (profile.email ?? null) as string | null,
    role: (profile.role ?? null) as string | null,
    weekly_digest: (profile.weekly_digest ?? null) as boolean | null,
  };
  if (profile.email_verified_at) return { status: "already_verified", profile: found };

  const { error } = await admin
    .from("profiles")
    .update({
      email_verified_at: new Date().toISOString(),
      email_verify_hash: null,
    })
    .eq("id", profile.id);

  return error ? invalid : { status: "verified", profile: found };
}

/** Whether this account still owes us proof of its address. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.email_verified_at;
}
