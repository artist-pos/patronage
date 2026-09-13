"use server";

import { createClient } from "@/lib/supabase/server";
import { issueEmailVerification, type IssueResult } from "@/lib/email-verification";

/**
 * Resend the verification email to the signed-in account.
 *
 * Server Actions are public endpoints, so this authenticates itself rather
 * than trusting the surface that called it, and never accepts an address from
 * the caller — it always mails whatever is on the session's own profile.
 */
export async function resendVerificationEmail(): Promise<{ status: IssueResult }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error" };

  return { status: await issueEmailVerification(user.id) };
}
