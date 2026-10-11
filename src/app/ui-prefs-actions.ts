"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { UI_PREFS_COOKIE, UI_PREFS_MAX_AGE, parseUiPrefs, serialiseUiPrefs, type UiPrefs } from "@/lib/ui-prefs";

/**
 * Remembers the display choice in a cookie (what renders the page) and, for a
 * signed-in user, on their profile so it follows them to another device.
 */
export async function saveUiPrefs(input: UiPrefs): Promise<{ error?: string }> {
  const prefs = parseUiPrefs(input);
  if (!prefs) return { error: "Invalid preferences." };

  const cookieStore = await cookies();
  cookieStore.set(UI_PREFS_COOKIE, serialiseUiPrefs(prefs), {
    path: "/",
    maxAge: UI_PREFS_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Best effort: the cookie already did the job, and the column may not exist yet.
    await supabase.from("profiles").update({ ui_prefs: prefs }).eq("id", user.id);
  }
  return {};
}
