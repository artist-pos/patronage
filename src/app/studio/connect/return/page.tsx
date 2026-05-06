import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncConnectStatus } from "@/app/studio/connect/actions";

/**
 * Stripe redirects here after the artist completes (or abandons) Connect
 * onboarding. Sync the account status from Stripe then send the artist
 * to the earnings page.
 */
export default async function ConnectReturnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  await syncConnectStatus();
  redirect("/studio/earnings");
}
