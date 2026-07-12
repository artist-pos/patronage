import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Server wrapper for the mobile bottom tab bar — resolves auth + role.
 * getProfileById is React.cache'd, so this shares the Header's fetch
 * within the same request.
 */
export async function MobileTabBarServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;

  return (
    <MobileTabBar
      isLoggedIn={!!user}
      username={profile?.username ?? null}
      role={profile?.role ?? null}
    />
  );
}
