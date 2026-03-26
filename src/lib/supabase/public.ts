import { createClient } from "@supabase/supabase-js";

/**
 * Public read-only client that does NOT call cookies() or headers().
 * Safe to use in the static pre-rendered shell of a PPR route.
 * Use only for queries on publicly accessible, unauthenticated data.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
