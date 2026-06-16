"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

interface TerminationSurvey {
  reason: string;
  details?: string | null;
}

const VALID_REASONS = [
  "I was just exploring",
  "I found it hard to use",
  "It wasn't what I expected",
  "I didn't find relevant opportunities",
  "I'll be back later",
  "Other",
];

export async function terminateAccountAction(
  survey?: TerminationSurvey
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Record the (optional) exit survey BEFORE deleting the account — once the
  // auth user is removed we lose the session, and we want the response kept.
  if (survey?.reason && VALID_REASONS.includes(survey.reason)) {
    const details = survey.details?.trim().slice(0, 500) || null;
    await admin.from("termination_surveys").insert({
      user_id: user.id,
      reason: survey.reason,
      details,
    });
    // Survey is optional feedback, not a gate — a failed insert must not block
    // the user from closing their account, so we deliberately ignore errors.
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect("/");
}
