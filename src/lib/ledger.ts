import type { SupabaseClient } from "@supabase/supabase-js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateLedgerId(): string {
  const year = new Date().getFullYear();
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `PTRN-${year}-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`;
}

/**
 * Generate a unique ledger ID by retrying on collision. Mirrors the SQL
 * generate_ledger_id() from migration 099 — kept in app code so the holder-
 * upload path can mint the ID before INSERT (the SQL function is also fine
 * to call via .rpc, but going through the app keeps the value visible to
 * the caller for the immediately-following ledger row insert).
 */
export async function mintUniqueLedgerId(
  admin: SupabaseClient,
  maxAttempts = 20,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateLedgerId();
    const { data } = await admin
      .from("artworks")
      .select("id")
      .eq("ledger_id", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not mint a unique ledger ID after several attempts.");
}
