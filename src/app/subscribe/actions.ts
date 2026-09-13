"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubscribeState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function subscribeAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  // Someone with an account may well type their own address into the home page
  // form. Since 185 their profile flag is the subscription, so turning it on is
  // both the correct outcome and what stops a duplicate row reappearing in a
  // table that is meant to hold only addresses belonging to nobody.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { error: flagError } = await admin
      .from("profiles")
      .update({ weekly_digest: true })
      .eq("id", (existing as { id: string }).id);

    if (flagError) {
      return { status: "error", message: "Something went wrong. Please try again." };
    }
    return { status: "success" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("subscribers").insert({ email });

  if (error) {
    // Unique violation — already subscribed
    if (error.code === "23505") return { status: "success" };
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
