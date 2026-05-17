import { randomBytes } from "crypto";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPriorHistory, type PriorHistoryEntry } from "@/lib/artwork-prior-history";

// 31-char pool — excludes ambiguous chars 0, O, 1, I, L
const LEDGER_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateLedgerId(): string {
  const year = new Date().getFullYear();
  const bytes = randomBytes(8);
  let seg = "";
  for (let i = 0; i < 8; i++) {
    seg += LEDGER_CHARS[bytes[i] % LEDGER_CHARS.length];
  }
  return `PTRN-${year}-${seg.slice(0, 4)}-${seg.slice(4, 8)}`;
}

export interface LedgerEntry {
  id: string;
  artwork_id: string;
  ledger_id: string;
  entry_type: "created" | "transferred" | "resold" | "selected";
  from_owner_id: string | null;
  to_owner_id: string;
  transfer_method: "listing" | "stripe" | "claim" | "direct" | "negotiated_sale" | "gift";
  transaction_ref: string | null;
  price: number | null;
  transferred_at: string;
  certificate_url: string | null;
  notes: string | null;
  campaign_id: string | null;
  source_opportunity_id: string | null;
}

export interface PendingClaim {
  id: string;
  artwork_id: string;
  claimer_name: string;
  claimer_email: string;
  status: "pending" | "approved" | "declined";
  claimed_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// ── Ledger ID management ──────────────────────────────────────────────────────

export async function ensureLedgerId(artworkId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, ledger_id, creator_id, created_at")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) throw new Error("Artwork not found");
  if (artwork.ledger_id) return artwork.ledger_id as string;

  // Generate a unique ledger ID
  let ledgerId = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateLedgerId();
    const { data: clash } = await admin
      .from("artworks")
      .select("id")
      .eq("ledger_id", candidate)
      .maybeSingle();
    if (!clash) { ledgerId = candidate; break; }
  }
  if (!ledgerId) throw new Error("Could not generate unique ledger ID");

  await admin.from("artworks").update({ ledger_id: ledgerId }).eq("id", artworkId);

  // Create the initial 'created' entry. Ignore unique-violation if another
  // path already inserted it (the partial unique index from migration 103
  // guarantees only one 'created' row per artwork).
  const { error: insertError } = await admin.from("artwork_provenance_ledger").insert({
    artwork_id: artworkId,
    ledger_id: ledgerId,
    entry_type: "created",
    from_owner_id: null,
    to_owner_id: artwork.creator_id,
    transfer_method: "listing",
    transferred_at: artwork.created_at,
  });
  if (insertError && insertError.code !== "23505") {
    console.error("[provenance] ensureLedgerId insert failed", insertError);
  }

  return ledgerId;
}

export async function createLedgerEntry(data: {
  artworkId: string;
  ledgerId: string;
  entryType: "created" | "transferred" | "resold";
  fromOwnerId: string | null;
  toOwnerId: string;
  transferMethod: "listing" | "stripe" | "claim" | "direct" | "negotiated_sale" | "gift";
  price?: number | null;
  notes?: string | null;
  campaignId?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data: entry, error } = await admin
    .from("artwork_provenance_ledger")
    .insert({
      artwork_id: data.artworkId,
      ledger_id: data.ledgerId,
      entry_type: data.entryType,
      from_owner_id: data.fromOwnerId,
      to_owner_id: data.toOwnerId,
      transfer_method: data.transferMethod,
      price: data.price ?? null,
      notes: data.notes ?? null,
      campaign_id: data.campaignId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Idempotency: if a duplicate 'created' or 'transferred' entry already
    // exists for this artwork (the partial unique index in migration 103),
    // return the existing entry's ID instead of throwing. 'resold' is not
    // constrained, so this only fires for the two unique types.
    if (error.code === "23505" && data.entryType !== "resold") {
      const { data: existing } = await admin
        .from("artwork_provenance_ledger")
        .select("id")
        .eq("artwork_id", data.artworkId)
        .eq("entry_type", data.entryType)
        .maybeSingle();
      if (existing?.id) return existing.id;
    }
    throw new Error(error.message);
  }
  return entry.id;
}

export async function updateLedgerEntryCertificate(entryId: string, certificateUrl: string) {
  const admin = createAdminClient();
  await admin
    .from("artwork_provenance_ledger")
    .update({ certificate_url: certificateUrl })
    .eq("id", entryId);
}

// ── Data queries ──────────────────────────────────────────────────────────────

export interface OwnerInfo {
  name: string;
  username: string | null;
  isShadow: boolean;
  collectionPublic: boolean;
}

export interface ProvenancePageData {
  artwork: {
    id: string;
    title: string | null;
    caption: string | null;
    url: string;
    year: number | null;
    medium: string | null;
    dimensions: string | null;
    edition: string | null;
    certificate_note: string | null;
    creator_id: string;
    current_owner_id: string;
    ledger_id: string;
    created_at: string;
    parent_artwork_id: string | null;
  };
  entries: LedgerEntry[];
  priorHistory: PriorHistoryEntry[];
  artist: { username: string; full_name: string | null; avatar_url: string | null };
  ownerNames: Record<string, string>; // userId → display name (legacy)
  owners: Record<string, OwnerInfo>;  // userId → linkable profile metadata
}

// Resolve a profile's display name. If full_name is missing, ambiguous, or matches the
// platform name, fall back to username so we never render "Patronage" as a recipient.
function resolveDisplayName(p: { full_name: string | null; username: string | null }): string {
  const full = (p.full_name ?? "").trim();
  const username = (p.username ?? "").trim();
  const isPlatformish = /^patronage$/i.test(full);
  if (full && !isPlatformish) return full;
  if (username) return username;
  return "Unknown";
}

export const getLedgerByLedgerId = cache(async function getLedgerByLedgerId(ledgerId: string): Promise<ProvenancePageData | null> {
  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, caption, url, year, medium, dimensions, edition, certificate_note, creator_id, current_owner_id, ledger_id, created_at, is_available, parent_artwork_id")
    .eq("ledger_id", ledgerId)
    .maybeSingle();

  if (!artwork) return null;

  let { data: entries } = await admin
    .from("artwork_provenance_ledger")
    .select("*")
    .eq("artwork_id", artwork.id)
    .order("transferred_at", { ascending: true });

  // Self-healing backfill: ensure a 'created' entry exists, and if ownership has
  // changed but no 'transferred' entry was recorded, synthesise one from the
  // current artwork state. The unique partial index added in migration 103
  // makes these inserts safe under concurrent reads — duplicate-key errors are
  // expected when another request beats us to the insert and we ignore them.
  const hasCreated = (entries ?? []).some(e => e.entry_type === "created");
  const hasTransfer = (entries ?? []).some(e => e.entry_type === "transferred" || e.entry_type === "resold");
  const ownershipChanged = artwork.current_owner_id !== artwork.creator_id;

  async function safeInsert(row: Record<string, unknown>) {
    const { error } = await admin.from("artwork_provenance_ledger").insert(row);
    // 23505 = unique_violation. Anything else is a real bug we want to surface.
    if (error && error.code !== "23505") {
      console.error("[provenance] backfill insert failed", error);
    }
  }

  if (!hasCreated) {
    await safeInsert({
      artwork_id: artwork.id,
      ledger_id: artwork.ledger_id,
      entry_type: "created",
      from_owner_id: null,
      to_owner_id: artwork.creator_id,
      transfer_method: "listing",
      transferred_at: artwork.created_at,
    });
  }

  if (ownershipChanged && !hasTransfer) {
    await safeInsert({
      artwork_id: artwork.id,
      ledger_id: artwork.ledger_id,
      entry_type: "transferred",
      from_owner_id: artwork.creator_id,
      to_owner_id: artwork.current_owner_id,
      transfer_method: "direct",
    });
  }

  if (!hasCreated || (ownershipChanged && !hasTransfer)) {
    const reread = await admin
      .from("artwork_provenance_ledger")
      .select("*")
      .eq("artwork_id", artwork.id)
      .order("transferred_at", { ascending: true });
    entries = reread.data;
  }

  const { data: artist } = await admin
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("id", artwork.creator_id)
    .maybeSingle();

  if (!artist) return null;

  // Resolve display names for all owner IDs in the chain
  const ownerIds = [...new Set([
    ...(entries ?? []).flatMap(e => [e.from_owner_id, e.to_owner_id].filter(Boolean) as string[]),
    artwork.current_owner_id,
    artwork.creator_id,
  ])];

  const ownerNames: Record<string, string> = {};
  const owners: Record<string, OwnerInfo> = {};
  if (ownerIds.length > 0) {
    const { data: ownerProfiles } = await admin
      .from("profiles")
      .select("id, full_name, username, account_status, collection_public")
      .in("id", ownerIds);

    for (const p of ownerProfiles ?? []) {
      const name = resolveDisplayName(p);
      ownerNames[p.id] = name;
      owners[p.id] = {
        name,
        username: p.username ?? null,
        isShadow: p.account_status === "shadow",
        collectionPublic: (p as { collection_public?: boolean }).collection_public ?? true,
      };
    }
  }

  const priorHistory = await listPriorHistory(artwork.id);

  return {
    artwork: artwork as ProvenancePageData["artwork"],
    entries: (entries ?? []) as LedgerEntry[],
    priorHistory,
    artist,
    ownerNames,
    owners,
  };
});

// ── Artist dashboard overview ─────────────────────────────────────────────────

export interface ArtworkProvenanceSummary {
  id: string;
  title: string | null;
  url: string;
  ledger_id: string | null;
  is_available: boolean;
  current_owner_id: string;
  creator_id: string;
  custody_count: number;
}

export async function getArtistProvenanceOverview(artistId: string): Promise<{
  artworks: ArtworkProvenanceSummary[];
  pendingClaims: (PendingClaim & { artwork_title: string | null; artwork_url: string })[];
  recentActivity: (LedgerEntry & { artwork_title: string | null })[];
}> {
  const admin = createAdminClient();

  const [{ data: artworks }, { data: allClaims }, { data: recentActivity }] = await Promise.all([
    admin
      .from("artworks")
      .select("id, title, url, ledger_id, is_available, current_owner_id, creator_id")
      .eq("creator_id", artistId)
      .order("created_at", { ascending: false }),
    admin
      .from("pending_ownership_claims")
      .select("*, artwork:artworks!inner(id, title, url, creator_id)")
      .eq("status", "pending")
      .order("claimed_at", { ascending: false }),
    admin
      .from("artwork_provenance_ledger")
      .select("*, artwork:artworks(title, creator_id)")
      .eq("artworks.creator_id", artistId)
      .order("transferred_at", { ascending: false })
      .limit(10),
  ]);

  // Get custody counts per artwork
  const artworkIds = (artworks ?? []).map(a => a.id);
  const custodyCounts: Record<string, number> = {};
  if (artworkIds.length > 0) {
    const { data: counts } = await admin
      .from("artwork_provenance_ledger")
      .select("artwork_id")
      .in("artwork_id", artworkIds);
    for (const row of counts ?? []) {
      custodyCounts[row.artwork_id] = (custodyCounts[row.artwork_id] ?? 0) + 1;
    }
  }

  const artworkSummaries: ArtworkProvenanceSummary[] = (artworks ?? []).map(a => ({
    ...a,
    custody_count: custodyCounts[a.id] ?? 0,
  }));

  const pendingClaims = ((allClaims ?? []) as any[])
    .filter(row => row.artwork?.creator_id === artistId)
    .map(row => ({
      id: row.id,
      artwork_id: row.artwork_id,
      claimer_name: row.claimer_name,
      claimer_email: row.claimer_email,
      status: row.status,
      claimed_at: row.claimed_at,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
      artwork_title: row.artwork?.title ?? null,
      artwork_url: row.artwork?.url ?? "",
    }));

  const activity = ((recentActivity ?? []) as any[])
    .filter(row => row.artwork?.creator_id === artistId)
    .map(row => ({
      ...row,
      artwork_title: row.artwork?.title ?? null,
    }));

  return { artworks: artworkSummaries, pendingClaims, recentActivity: activity };
}

// ── Shadow accounts ───────────────────────────────────────────────────────────

export async function createShadowAccount(
  email: string,
  name: string
): Promise<{ userId: string; isNew: boolean }> {
  const admin = createAdminClient();

  // Check if auth user already exists with this email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    // Ensure a profile row exists — if the auth user was created externally and never completed
    // onboarding, the FK on artworks.current_owner_id will reject the ownership update.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", existing.id)
      .maybeSingle();

    if (!existingProfile) {
      const prefix = existing.email!.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
      const suffix = randomBytes(2).toString("hex");
      const username = `${prefix}${suffix}`;
      await admin.from("profiles").insert({
        id: existing.id,
        username,
        full_name: name,
        role: "patron",
        account_status: "shadow",
      });
    }

    return { userId: existing.id, isNew: false };
  }

  // Create shadow auth user (no password — they claim via magic link)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: name },
  });

  if (error || !created.user) throw new Error(error?.message ?? "Failed to create shadow account");

  // Generate a unique username from email prefix
  const prefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const suffix = randomBytes(2).toString("hex");
  const username = `${prefix}${suffix}`;

  await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name: name,
    role: "patron",
    account_status: "shadow",
  });

  return { userId: created.user.id, isNew: true };
}
