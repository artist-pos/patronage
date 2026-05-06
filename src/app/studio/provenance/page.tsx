import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCompletionProfile, getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { ProvenanceList } from "./ProvenanceList";
import { SectionLockGate } from "@/components/studio/SectionLockGate";
import { StudioPageShell } from "../StudioPageShell";
import type { TransferredWork } from "./ProvenanceList";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provenance — Studio — Patronage",
};

export default async function StudioProvenancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/dashboard");
  }

  const completionProfile = await fetchCompletionProfile(user.id);
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  if (!profileComplete) {
    const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
    return (
      <StudioPageShell username={profileRow.username} activeSection="provenance">
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Provenance</h2>
            <p className="text-sm text-muted-foreground">
              Manage certificates of ownership for works you have transferred to collectors.
            </p>
          </div>
          <SectionLockGate featureName="Provenance" missingFields={missingFields} />
        </div>
      </StudioPageShell>
    );
  }

  const admin = createAdminClient();

  // Fetch all artworks this artist has transferred to someone else
  const [{ data: artworks }, { data: provenanceSettings }] = await Promise.all([
    admin
      .from("artworks")
      .select("id, title, caption, url, medium, dimensions, year, certificate_note, ledger_id, current_owner_id, created_at")
      .eq("creator_id", user.id)
      .neq("current_owner_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("provenance_logo_url, provenance_signature_url, provenance_template_theme")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const artworkList = artworks ?? [];

  // Batch-resolve buyer display names
  const buyerIds = [...new Set(artworkList.map(a => a.current_owner_id))];
  const buyerMap: Record<string, string> = {};
  if (buyerIds.length > 0) {
    const { data: buyers } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", buyerIds);
    for (const b of buyers ?? []) {
      const full = (b.full_name ?? "").trim();
      const username = (b.username ?? "").trim();
      const isPlatformish = /^patronage$/i.test(full);
      buyerMap[b.id] = full && !isPlatformish ? full : (username || "Unknown");
    }
  }

  // Batch-resolve most recent transfer date per artwork from the ledger
  const artworkIds = artworkList.map(a => a.id);
  const transferDates: Record<string, string> = {};
  if (artworkIds.length > 0) {
    const { data: ledgerEntries } = await admin
      .from("artwork_provenance_ledger")
      .select("artwork_id, transferred_at, entry_type")
      .in("artwork_id", artworkIds)
      .eq("entry_type", "transferred")
      .order("transferred_at", { ascending: false });

    for (const e of ledgerEntries ?? []) {
      if (!transferDates[e.artwork_id]) {
        transferDates[e.artwork_id] = e.transferred_at;
      }
    }
  }

  // Documentation photo counts per artwork — drives the per-row "n/4 photos"
  // hint without leaking the photos themselves.
  const docCounts: Record<string, number> = {};
  if (artworkIds.length > 0) {
    const { data: docs } = await admin
      .from("artwork_documentation_photos")
      .select("artwork_id")
      .in("artwork_id", artworkIds);
    for (const d of docs ?? []) {
      docCounts[d.artwork_id] = (docCounts[d.artwork_id] ?? 0) + 1;
    }
  }

  const works: TransferredWork[] = artworkList.map(a => ({
    id: a.id,
    title: a.title ?? a.caption ?? null,
    url: a.url,
    medium: a.medium,
    dimensions: a.dimensions,
    year: a.year,
    certificate_note: a.certificate_note,
    ledger_id: a.ledger_id,
    buyer_name: buyerMap[a.current_owner_id] ?? "Unknown",
    transfer_date: transferDates[a.id] ?? null,
    created_at: a.created_at,
    doc_photo_count: docCounts[a.id] ?? 0,
  }));

  const hasSettings =
    !!provenanceSettings?.provenance_logo_url ||
    !!provenanceSettings?.provenance_signature_url ||
    !!provenanceSettings?.provenance_template_theme;

  return (
    <StudioPageShell username={profileRow.username} activeSection="provenance">
      <div className="space-y-8">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Provenance</h2>
          <p className="text-sm text-muted-foreground">
            Manage certificates of ownership for works you have transferred to collectors.
          </p>
        </div>

        {/* Configure banner */}
        <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
          hasSettings ? "border-stone-200 bg-stone-50" : "border-amber-200 bg-amber-50"
        }`}>
          <div className="space-y-0.5">
            <p className={`text-sm font-medium ${hasSettings ? "text-stone-700" : "text-amber-800"}`}>
              {hasSettings ? "Certificate settings configured" : "Configure your certificate"}
            </p>
            <p className={`text-xs ${hasSettings ? "text-stone-500" : "text-amber-700"}`}>
              {hasSettings
                ? "Your logo, signature, and theme are set. Update them any time."
                : "Add your logo and signature to personalise the provenance certificates sent to buyers."}
            </p>
          </div>
          <Link
            href="/studio/provenance-settings"
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              hasSettings
                ? "border border-stone-200 text-stone-700 hover:bg-stone-100"
                : "bg-amber-800 text-white hover:bg-amber-900"
            }`}
          >
            Configure →
          </Link>
        </div>

        {/* Works list */}
        <ProvenanceList works={works} />
      </div>
    </StudioPageShell>
  );
}
