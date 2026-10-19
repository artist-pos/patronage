import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type TokenType = "survey" | "staff" | "client";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * True when the raw token matches a live (not revoked, not expired) token of
 * the given type. The lookup is by hash, so nothing secret is compared in JS.
 */
export async function verifyToken(token: string, type: TokenType): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("rabobank_access_token")
    .select("type, revoked, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.type !== type || data.revoked) return false;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return false;
  return true;
}
