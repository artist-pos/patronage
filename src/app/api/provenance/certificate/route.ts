import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCertificatePdf } from "@/lib/pdf/transfer-certificate";
import { getLedgerByLedgerId } from "@/lib/provenance";
import { resolveTheme } from "@/lib/provenance-theme";
import { listDocPhotosWithUrls, DOC_PHOTO_TYPES } from "@/lib/artwork-documentation";
import { getTrustTier, TRUST_TIER_LABELS } from "@/lib/trust-tier";

const ROYALTY_STATEMENT =
  "A 5% artist royalty applies to all resales of this work facilitated through Patronage, paid to RRA under the Resale Right for Visual Artists Act 2023.";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const { searchParams } = new URL(req.url);
  const artworkId = searchParams.get("artworkId");
  if (!artworkId) return new NextResponse("artworkId required", { status: 400 });

  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select(
      "id, title, caption, url, year, medium, dimensions, edition, certificate_note, creator_id, current_owner_id, ledger_id, source, attributed_artist_id, attributed_artist_text, attributed_pending_artist_id",
    )
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return new NextResponse("Artwork not found", { status: 404 });

  // Only the artist or current owner may download. For holder_uploaded works
  // both fields point at the holder, so the holder downloads through this
  // same path; no separate gate needed.
  if (artwork.creator_id !== user.id && artwork.current_owner_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const isHolderUploaded = artwork.source === "holder_uploaded";

  const ledgerId = artwork.ledger_id;
  if (!ledgerId) return new NextResponse("No provenance record for this artwork", { status: 404 });

  // Fetch branding columns separately — the theme columns from migration 102 may
  // not exist in older deploys, and we don't want a missing-column error to take
  // down the entire certificate generation.
  const baseBrandingQ = admin
    .from("profiles")
    .select("provenance_logo_url, provenance_signature_url, provenance_template_theme")
    .eq("id", artwork.creator_id)
    .maybeSingle();
  const themeBrandingQ = admin
    .from("profiles")
    .select("provenance_primary_color, provenance_accent_color, provenance_font_pair, provenance_orientation")
    .eq("id", artwork.creator_id)
    .maybeSingle();

  const themeRes = await Promise.resolve(themeBrandingQ).then(
    r => r,
    () => ({ data: null as Record<string, unknown> | null }),
  );

  // For holder_uploaded works, creator_id points at the holder until the
  // artist confirms. The certificate's "ARTIST" should always show the
  // attributed artist (real profile or stub or free text), so we resolve
  // that here rather than relying on the creator_id lookup.
  const artistLookupId =
    isHolderUploaded && artwork.attributed_artist_id
      ? artwork.attributed_artist_id
      : artwork.creator_id;

  const [provenanceData, { data: artistProfile }, { data: baseBranding }, pendingArtistRes, membershipRes] = await Promise.all([
    getLedgerByLedgerId(ledgerId),
    admin.from("profiles").select("full_name, username").eq("id", artistLookupId).maybeSingle(),
    baseBrandingQ,
    isHolderUploaded && artwork.attributed_pending_artist_id
      ? admin
          .from("pending_artists")
          .select("name")
          .eq("id", artwork.attributed_pending_artist_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isHolderUploaded
      ? admin
          .from("collection_membership")
          .select("certificate_statement")
          .eq("artwork_id", artwork.id)
          .eq("holder_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Trust tier is derived per Phase 2 — not stored. Compute alongside the
  // other fetches; cheap (one count of holder_attribution_claims rows).
  const trustTier = isHolderUploaded ? await getTrustTier(artwork.id) : null;

  const branding = { ...(baseBranding ?? {}), ...(themeRes.data ?? {}) };

  const ownerNames = provenanceData?.ownerNames ?? {};
  const platformChain = (provenanceData?.entries ?? []).map(e => {
    const toName = ownerNames[e.to_owner_id] ?? "Unknown";
    const fromName = e.from_owner_id ? (ownerNames[e.from_owner_id] ?? "Unknown") : null;
    return {
      name: toName,
      fromName,
      date: new Date(e.transferred_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" }),
      type: e.entry_type,
    };
  });
  const priorChain = (provenanceData?.priorHistory ?? []).map(p => ({
    name: "",
    fromName: null,
    date: p.date_text ?? (p.year_int ? String(p.year_int) : ""),
    type: p.type,
    selfAttested: true,
    description: p.description,
  }));
  const chainOfCustody = [...priorChain, ...platformChain];

  // Reference photos for page 2 of the PDF — pulled with signed URLs since the
  // certificate is private (downloaded by the artist or current owner only).
  const docTypeLabels = Object.fromEntries(DOC_PHOTO_TYPES.map(t => [t.id, t.label]));
  const [docPhotos, sourceDocsResult] = await Promise.all([
    listDocPhotosWithUrls(artwork.id),
    // Collector source documents — image-format only (PDFs can't be embedded in react-pdf)
    admin.from("artwork_source_documents").select("*").eq("artwork_id", artwork.id).eq("uploaded_by", artwork.current_owner_id).order("created_at", { ascending: true }),
  ]);
  const artistDocRefs = docPhotos
    .filter(p => p.signedUrl)
    .map(p => ({ label: docTypeLabels[p.type] ?? p.type, url: p.signedUrl! }));

  // Only embed image-format source docs (JPEG, PNG, WebP) — PDF/Word can't be rendered
  const sourceDocImagePaths = (sourceDocsResult.data ?? [])
    .map((d: { storage_path: string; document_type: string }) => d.storage_path)
    .filter((p: string) => /\.(jpe?g|png|webp|gif)$/i.test(p));
  let collectorDocRefs: Array<{ label: string; url: string }> = [];
  if (sourceDocImagePaths.length > 0) {
    const { data: signed } = await admin.storage
      .from("artwork-source-documents")
      .createSignedUrls(sourceDocImagePaths, 3600);
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
    collectorDocRefs = (sourceDocsResult.data ?? [])
      .filter((d: { storage_path: string; document_type: string }) =>
        /\.(jpe?g|png|webp|gif)$/i.test(d.storage_path) && urlByPath.has(d.storage_path))
      .map((d: { storage_path: string; document_type: string }) => ({
        label: d.document_type === "certificate" ? "Collector: existing certificate"
          : d.document_type === "invoice" ? "Collector: invoice"
          : d.document_type === "receipt" ? "Collector: receipt"
          : "Collector: supporting document",
        url: urlByPath.get(d.storage_path)!,
      }));
  }

  const referencePhotos = [...artistDocRefs, ...collectorDocRefs];

  const currentOwnerName =
    ownerNames[artwork.current_owner_id] ??
    (artwork.current_owner_id === artwork.creator_id
      ? (artistProfile?.full_name ?? artistProfile?.username ?? "The artist")
      : "Unknown");

  // Signature is stored as a private-bucket path (e.g. "{userId}/signature.png").
  // Resolve it to a 1-hour signed URL for the PDF renderer.
  const rawSignaturePath = branding?.provenance_signature_url ?? null;
  let signatureUrl: string | null = null;
  if (rawSignaturePath) {
    if (rawSignaturePath.startsWith("http")) {
      signatureUrl = rawSignaturePath;
    } else {
      const { data: signedData } = await admin.storage
        .from("provenance-signatures")
        .createSignedUrl(rawSignaturePath, 3600);
      signatureUrl = signedData?.signedUrl ?? null;
    }
  }

  // Holder-uploaded works pull the artist name from the stub when no real
  // profile is linked, falling back to the holder's free-text attribution.
  const resolvedArtistName = isHolderUploaded
    ? (
        artistProfile?.full_name
        ?? artistProfile?.username
        ?? pendingArtistRes.data?.name
        ?? artwork.attributed_artist_text
        ?? "Unknown artist"
      )
    : (artistProfile?.full_name ?? artistProfile?.username ?? "The artist");

  // Holder-uploaded certificates show the holder's certificate_statement
  // from collection_membership in place of the artist's certificate_note.
  const resolvedCertificateNote = isHolderUploaded
    ? (membershipRes.data?.certificate_statement ?? null)
    : (artwork.certificate_note ?? null);

  const trustTierLabel = trustTier ? TRUST_TIER_LABELS[trustTier].label : null;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCertificatePdf({
    ledgerId,
    workTitle: artwork.title ?? artwork.caption ?? "Untitled",
    workImageUrl: artwork.url ?? null,
    artistName: resolvedArtistName,
    artistUsername: artistProfile?.username ?? null,
    patronName: currentOwnerName,
    yearCreated: artwork.year ?? null,
    medium: artwork.medium ?? null,
    dimensions: artwork.dimensions ?? null,
    edition: artwork.edition ?? null,
    certificateNote: resolvedCertificateNote,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl,
    chainOfCustody,
    referencePhotos,
    theme: resolveTheme(branding),
    isHolderUploaded,
    trustTierLabel,
    royaltyStatement: isHolderUploaded ? ROYALTY_STATEMENT : null,
    });
  } catch (err) {
    console.error("[certificate] PDF generation failed", err);
    return new NextResponse(
      `Certificate generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  }

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="provenance-${ledgerId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
