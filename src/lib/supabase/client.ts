import { createBrowserClient } from "@supabase/ssr";

// Default client — realtime disabled. Most client components only need REST queries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: { eventsPerSecond: -1 },
      },
    }
  );
}

// Realtime-enabled client — use only where live subscriptions are needed (e.g. ApplicationsTab).
export function createRealtimeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
