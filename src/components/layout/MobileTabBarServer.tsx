import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Server wrapper for the mobile bottom tab bar — resolves auth + role.
 * getServerUser + getProfileById are React.cache'd, so this shares the
 * Header's auth and profile fetches within the same request.
 */
export async function MobileTabBarServer() {
  const { user } = await getServerUser();
  const profile = user ? await getProfileById(user.id) : null;

  return (
    <MobileTabBar
      isLoggedIn={!!user}
      username={profile?.username ?? null}
      role={profile?.role ?? null}
    />
  );
}
