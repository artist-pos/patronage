import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limit backed by the `rate_limit_hit` Postgres function
 * (migration 191). Fails open on infra errors — a limiter outage should
 * never be the reason a real signup or enquiry gets blocked.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed:", error.message);
    return true;
  }
  return data === true;
}
