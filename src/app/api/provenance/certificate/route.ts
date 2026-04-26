import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCertificatePdf } from "@/lib/pdf/transfer-certificate";
import { getLedgerByLedgerId } from "@/lib/provenance";
import { resolveTheme } from "@/lib/provenance-theme";
import { listDocPhotosWithUrls, DOC_PHOTO_TYPES } from "@/lib/artwork-documentation";

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
    .select("id, title, caption, url, year, medium, dimensions, edition, certificate_note, creator_id, current_owner_id, ledger_id")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return new NextResponse("Artwork not found", { status: 404 });

  // Only the artist or current owner may download
  if (artwork.creator_id !== user.id && artwork.current_owner_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

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

  const [provenanceData, { data: artistProfile }, { data: baseBranding }] = await Promise.all([
    getLedgerByLedgerId(ledgerId),
    admin.from("profiles").select("full_name, username").eq("id", artwork.creator_id).maybeSingle(),
    baseBrandingQ,
  ]);

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
  const docPhotos = await listDocPhotosWithUrls(artwork.id);
  const referencePhotos = docPhotos
    .filter(p => p.signedUrl)
    .map(p => ({ label: docTypeLabels[p.type] ?? p.type, url: p.signedUrl! }));

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

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCertificatePdf({
    ledgerId,
    workTitle: artwork.title ?? artwork.caption ?? "Untitled",
    workImageUrl: artwork.url ?? null,
    artistName: artistProfile?.full_name ?? artistProfile?.username ?? "The artist",
    artistUsername: artistProfile?.username ?? null,
    patronName: currentOwnerName,
    yearCreated: artwork.year ?? null,
    medium: artwork.medium ?? null,
    dimensions: artwork.dimensions ?? null,
    edition: artwork.edition ?? null,
    certificateNote: artwork.certificate_note ?? null,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl,
    chainOfCustody,
    referencePhotos,
    theme: resolveTheme(branding),
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
