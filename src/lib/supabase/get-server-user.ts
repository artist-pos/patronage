import { cache } from "react";
import { createClient } from "./server";

/**
 * React.cache() deduplicates auth.getUser() across all RSCs in a single
 * render pass — page.tsx, StudioPageShell, and any helper that calls this
 * all share one network round-trip to the Supabase auth server.
 */
export const getServerUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});
