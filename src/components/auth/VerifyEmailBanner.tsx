import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { VerifyEmailBannerClient } from "./VerifyEmailBannerClient";

/**
 * Sits under the header on every page until the address is proved.
 *
 * Not dismissible: it is the only standing reminder, and an artist who hides
 * it would discover the gate at the worst possible moment — halfway into an
 * application. Both auth calls are React.cache'd and already made by the
 * Header, so this renders on the request's existing round-trips.
 */
export async function VerifyEmailBanner() {
  const { user } = await getServerUser();
  if (!user) return null;

  const profile = await getProfileById(user.id);
  if (!profile || profile.email_verified_at) return null;

  const isArtist = profile.role === "artist" || profile.role === "owner";
  return <VerifyEmailBannerClient email={profile.email ?? ""} isArtist={isArtist} />;
}
