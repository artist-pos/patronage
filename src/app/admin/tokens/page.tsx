export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { TokenPanel } from "@/components/admin/TokenPanel";
import type { ClaimTokenKind, ClaimTokenRow } from "@/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim tokens — Patronage admin",
};

interface PageProps {
  searchParams: Promise<{
    kind?: string;
    status?: string;
  }>;
}

export default async function TokensPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect("/");
  const sp = await searchParams;

  const kindFilter = (
    ["opportunity", "provenance", "artist"] as const
  ).includes(sp.kind as ClaimTokenKind)
    ? (sp.kind as ClaimTokenKind)
    : null;

  const statusFilter =
    sp.status === "claimed" ? "claimed"
    : sp.status === "pending" ? "pending"
    : null;

  const admin = createAdminClient();
  let query = admin
    .from("vw_claim_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (kindFilter) query = query.eq("token_kind", kindFilter);
  if (statusFilter === "claimed") query = query.eq("is_claimed", true);
  if (statusFilter === "pending") query = query.eq("is_claimed", false);

  const { data: tokens } = await query;

  // Per-artist upload counts — ranks high-leverage outreach targets.
  const artistIds = (tokens ?? [])
    .filter((t) => t.token_kind === "artist")
    .map((t) => t.source_id);
  const uploadCounts = new Map<string, number>();
  if (artistIds.length > 0) {
    const { data } = await admin
      .from("artworks")
      .select("attributed_pending_artist_id")
      .in("attributed_pending_artist_id", artistIds);
    for (const row of data ?? []) {
      const id = row.attributed_pending_artist_id;
      if (!id) continue;
      uploadCounts.set(id, (uploadCounts.get(id) ?? 0) + 1);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Claim tokens</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Unified view across opportunity, provenance, and artist-stub tokens.
          Filter by kind/status; sort artist stubs by upload count to find the
          highest-leverage outreach targets first.
        </p>
      </div>

      <TokenPanel
        rows={(tokens ?? []) as ClaimTokenRow[]}
        uploadCounts={Object.fromEntries(uploadCounts)}
        kindFilter={kindFilter}
        statusFilter={statusFilter}
      />
    </div>
  );
}
