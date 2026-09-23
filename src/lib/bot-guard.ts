import { createAdminClient } from "@/lib/supabase/admin";

// Public exit list published by the Tor Project. Every bot signup seen so far
// arrived from a Tor exit and never reused an address, so per-IP rate limits
// can't stop them. Real artists and organisers essentially never sign up
// through Tor.
const TOR_EXIT_LIST_URL = "https://check.torproject.org/torbulkexitlist";
const TOR_LIST_TTL_MS = 60 * 60 * 1000;

let torExits: Set<string> | null = null;
let torFetchedAt = 0;
let torInflight: Promise<void> | null = null;

async function refreshTorExits(): Promise<void> {
  try {
    const res = await fetch(TOR_EXIT_LIST_URL, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const text = await res.text();
    const next = new Set(
      text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d{1,3}(\.\d{1,3}){3}$/.test(l))
    );
    if (next.size > 100) {
      torExits = next;
      torFetchedAt = Date.now();
    }
  } catch (err) {
    console.error("tor exit list fetch failed:", err);
  }
}

/** Fails open: an unreachable list must never block a real signup. */
export async function isTorExit(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  if (!torExits || Date.now() - torFetchedAt > TOR_LIST_TTL_MS) {
    torInflight ??= refreshTorExits().finally(() => { torInflight = null; });
    if (!torExits) await torInflight;
  }
  return torExits?.has(ip) ?? false;
}

/**
 * Random-string names like "YePbJVaBcqZLmmEueAbQUs": a single long word with
 * many capitals in the middle (that one has ten). Real names top out around
 * two or three ("McKinneyDeVries"), so the bar is five.
 */
export function looksLikeGibberishName(name: string): boolean {
  return name
    .split(/[\s'’-]+/)
    .some((token) => token.length >= 8 && (token.slice(1).match(/[A-Z]/g) ?? []).length >= 5);
}

/** Gmail ignores dots, so bots spin endless "different" addresses from one inbox. */
export function gmailCanonicalLocal(email: string): string | null {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || (domain !== "gmail.com" && domain !== "googlemail.com")) return null;
  return local.split("+")[0].replace(/\./g, "");
}

/** Four or more dots in a Gmail local part (e.g. "ufutol.i.d.e.q31") is the dot-trick, not a real address. */
export function hasDotTrickPattern(email: string): boolean {
  const [local, domain] = email.toLowerCase().split("@");
  if (domain !== "gmail.com" && domain !== "googlemail.com") return false;
  return (local?.match(/\./g) ?? []).length >= 4;
}

/** True when another account already exists under a dotted variant of this Gmail address. */
export async function gmailVariantExists(email: string): Promise<boolean> {
  const canon = gmailCanonicalLocal(email);
  if (!canon || canon.length < 4) return false;
  const admin = createAdminClient();
  const pattern = `${canon.split("").join("%")}%@%mail.com`;
  const { data } = await admin.from("profiles").select("email").ilike("email", pattern).limit(50);
  return (data ?? []).some((p) => {
    const other = p.email ? gmailCanonicalLocal(p.email) : null;
    return other === canon && p.email?.toLowerCase() !== email.toLowerCase();
  });
}
