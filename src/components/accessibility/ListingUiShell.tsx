import { cookies } from "next/headers";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { DEFAULT_UI_PREFS, UI_PREFS_COOKIE, parseUiPrefs, type UiPrefs } from "@/lib/ui-prefs";
import { ListingUiRoot } from "./ListingUiRoot";

/**
 * Wraps the opportunity-listing screens in the scope the display modes style.
 *
 * Reads the choice from the cookie first so the right view renders on the first
 * paint with no flash. With no cookie (a new device) it falls back to the
 * signed-in user's saved preference.
 */
export async function ListingUiShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const fromCookie = parseUiPrefs(cookieStore.get(UI_PREFS_COOKIE)?.value);

  let prefs: UiPrefs = fromCookie ?? DEFAULT_UI_PREFS;
  if (!fromCookie) {
    const { supabase, user } = await getServerUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("ui_prefs").eq("id", user.id).maybeSingle();
      prefs = parseUiPrefs((data as { ui_prefs?: unknown } | null)?.ui_prefs) ?? DEFAULT_UI_PREFS;
    }
  }

  return <ListingUiRoot initial={prefs}>{children}</ListingUiRoot>;
}
