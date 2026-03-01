"use server";

import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.from("subscribers").insert({ email });

  if (error) {
    // Unique violation — already subscribed
    if (error.code === "23505") return { status: "success" };
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
