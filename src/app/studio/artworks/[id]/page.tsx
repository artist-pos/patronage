import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArtworkProvenancePanel } from "./ArtworkProvenancePanel";
import { WorkDetailsEditor } from "./WorkDetailsEditor";
import { AcquisitionModeEditor } from "./AcquisitionModeEditor";
import { DocumentationPhotosEditor } from "./DocumentationPhotosEditor";
import { PriorHistoryEditor } from "./PriorHistoryEditor";
import { listDocPhotosWithUrls } from "@/lib/artwork-documentation";
import { listPriorHistory } from "@/lib/artwork-prior-history";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Artwork — Studio — Patronage" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArtworkProvenancePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/studio");
  }

  const admin = createAdminClient();

  const [{ data: artwork }, { data: claims }, { data: entries }] = await Promise.all([
    admin
      .from("artworks")
      .select("id, title, caption, url, year, medium, medium_category, surface_or_substrate, dimensions, edition, certificate_note, ledger_id, is_available, creator_id, current_owner_id, created_at")
      .eq("id", id)
      .eq("creator_id", user.id)
      .maybeSingle(),
    admin
      .from("pending_ownership_claims")
      .select("id, claimer_name, claimer_email, status, claimed_at")
      .eq("artwork_id", id)
      .eq("status", "pending")
      .order("claimed_at", { ascending: false }),
    admin
      .from("artwork_provenance_ledger")
      .select("id, entry_type, transfer_method, transferred_at, to_owner_id")
      .eq("artwork_id", id)
      .order("transferred_at", { ascending: true }),
  ]);

  if (!artwork) notFound();

  const [docPhotos, priorHistory] = await Promise.all([
    listDocPhotosWithUrls(artwork.id),
    listPriorHistory(artwork.id),
  ]);

  // Resolve display names for owners in the ledger
  const ownerIds = [...new Set((entries ?? []).map(e => e.to_owner_id))];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ownerIds);
    for (const p of profiles ?? []) {
      ownerNames[p.id] = p.full_name ?? p.username;
    }
  }

  const displayTitle = artwork.title ?? artwork.caption ?? "Untitled";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/studio?section=available" className="hover:text-foreground transition-colors">
          Studio
        </Link>
        <span>/</span>
        <Link href="/studio?section=available" className="hover:text-foreground transition-colors">
          Available works
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{displayTitle}</span>
      </div>

      {/* Artwork header */}
      <div className="flex items-start gap-5 mb-10">
        {artwork.url && (
          <img
            src={artwork.url}
            alt={displayTitle}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-stone-100"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{displayTitle}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {[artwork.medium, artwork.year, artwork.dimensions].filter(Boolean).join(" · ")}
          </p>
          {artwork.ledger_id && (
            <Link
              href={`/provenance/${artwork.ledger_id}`}
              className="inline-flex items-center gap-1 mt-2 text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {artwork.ledger_id}
            </Link>
          )}
        </div>
      </div>

      <ArtworkProvenancePanel
        artwork={{
          id: artwork.id,
          title: displayTitle,
          url: artwork.url ?? null,
          certificate_note: artwork.certificate_note ?? null,
          ledger_id: artwork.ledger_id ?? null,
          is_available: artwork.is_available,
          current_owner_id: artwork.current_owner_id,
          creator_id: artwork.creator_id,
        }}
        pendingClaims={(claims ?? []).map(c => ({
          id: c.id,
          claimer_name: c.claimer_name,
          claimer_email: c.claimer_email,
          claimed_at: c.claimed_at,
        }))}
        ledgerEntries={(entries ?? []).map(e => ({
          id: e.id,
          entry_type: e.entry_type,
          transfer_method: e.transfer_method,
          transferred_at: e.transferred_at,
          owner_name: ownerNames[e.to_owner_id] ?? "Unknown",
        }))}
      />

      <div className="mt-8 space-y-4">
        <AcquisitionModeEditor
          artworkId={artwork.id}
          initialMode={((artwork as { acquisition_mode?: string }).acquisition_mode ?? "enquire_first") as "buy_now" | "make_offer" | "enquire_first"}
        />
        <WorkDetailsEditor
          artworkId={artwork.id}
          initial={{
            title: artwork.title ?? null,
            medium: artwork.medium ?? null,
            medium_category: (artwork.medium_category as string[] | null) ?? null,
            surface_or_substrate: (artwork.surface_or_substrate as string | null) ?? null,
            dimensions: artwork.dimensions ?? null,
            year: artwork.year ?? null,
            edition: artwork.edition ?? null,
          }}
        />
        <DocumentationPhotosEditor
          artworkId={artwork.id}
          initialPhotos={docPhotos.map(p => ({
            id: p.id,
            type: p.type,
            caption: p.caption,
            signedUrl: p.signedUrl,
          }))}
        />
        <PriorHistoryEditor
          artworkId={artwork.id}
          initialEntries={priorHistory}
        />
      </div>
    </div>
  );
}
