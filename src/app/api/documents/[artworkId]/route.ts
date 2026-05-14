import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateCoaPdf,
  generateTearSheetPdf,
  generateWallLabelPdf,
  generateConsignmentPdf,
  type ArtworkDocumentData,
} from "@/lib/pdf/artwork-documents";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ artworkId: string }> }
) {
  const { artworkId } = await params;
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "coa";

  // Auth — must be the artwork creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Fetch artwork + profile with admin client to get provenance fields regardless of RLS
  const admin = createAdminClient();
  const { data: artwork } = await admin
    .from("artworks")
    .select(`
      id, url, title, caption, medium, year_created, dimensions,
      edition, edition_number, edition_total, edition_type,
      price_cents, price_currency, is_poa, location_text,
      creator_id, ledger_id
    `)
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the creator can generate documents
  if (artwork.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name, bio, provenance_logo_url, provenance_signature_url")
    .eq("id", artwork.creator_id)
    .maybeSingle();

  // Resolve signature URL — may be stored as a private bucket path
  let signatureUrl: string | null = profile?.provenance_signature_url ?? null;
  if (signatureUrl && !signatureUrl.startsWith("http")) {
    const { data: signed } = await admin.storage
      .from("provenance-signatures")
      .createSignedUrl(signatureUrl, 3600);
    signatureUrl = signed?.signedUrl ?? null;
  }

  const docData: ArtworkDocumentData = {
    artworkId: artwork.id,
    title: (artwork.title ?? artwork.caption) || "Untitled",
    imageUrl: artwork.url ?? null,
    artistName: profile?.full_name ?? profile?.username ?? "Unknown",
    artistUsername: profile?.username ?? null,
    medium: artwork.medium ?? null,
    yearCreated: (artwork as { year_created?: number | null }).year_created ?? null,
    dimensions: artwork.dimensions ?? null,
    edition: artwork.edition ?? null,
    editionNumber: (artwork as { edition_number?: number | null }).edition_number ?? null,
    editionTotal: (artwork as { edition_total?: number | null }).edition_total ?? null,
    editionType: (artwork as { edition_type?: string | null }).edition_type ?? null,
    priceCents: artwork.price_cents ?? null,
    priceCurrency: artwork.price_currency ?? "NZD",
    isPoa: artwork.is_poa ?? false,
    locationText: artwork.location_text ?? null,
    bio: profile?.bio ?? null,
    ledgerId: artwork.ledger_id ?? null,
    logoUrl: profile?.provenance_logo_url ?? null,
    signatureUrl,
  };

  let pdfBuffer: Buffer;
  let filename: string;

  try {
    if (type === "tearsheet") {
      pdfBuffer = await generateTearSheetPdf(docData);
      filename = `tear-sheet-${artworkId}.pdf`;
    } else if (type === "wall-label") {
      const includeQr = searchParams.get("include_qr") === "true";
      const qrTarget = searchParams.get("qr_target") === "provenance" ? "provenance" : "profile";
      pdfBuffer = await generateWallLabelPdf(docData, { includeQr, qrTarget });
      filename = `wall-label-${artworkId}.pdf`;
    } else if (type === "consignment") {
      const consigneeName = searchParams.get("consignee_name") ?? "";
      const consigneeAddress = searchParams.get("consignee_address") ?? "";
      const startDate = searchParams.get("start_date") ?? "";
      const endDate = searchParams.get("end_date") ?? "";
      const commissionPct = Math.min(100, Math.max(0, Number(searchParams.get("commission") ?? "30")));
      pdfBuffer = await generateConsignmentPdf({
        ...docData,
        consigneeName,
        consigneeAddress,
        startDate,
        endDate,
        commissionPct,
      });
      filename = `consignment-${artworkId}.pdf`;
    } else {
      // Default: COA
      pdfBuffer = await generateCoaPdf(docData);
      filename = `coa-${artworkId}.pdf`;
    }
  } catch (err) {
    console.error("[documents] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
