import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const PX = 44; // page padding x
const PY = 44; // page padding y
const CW = 595 - PX * 2; // content width

const base = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingTop: PY,
    paddingBottom: PY,
    paddingLeft: PX,
    paddingRight: PX,
    fontFamily: "Helvetica",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  logo: { height: 28, width: 100, objectFit: "contain" },
  brand: { fontSize: 12, fontFamily: "Helvetica-Bold", letterSpacing: 3 },
  heading: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginBottom: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#000000", borderBottomStyle: "solid", marginBottom: 20 },
  hrThin: { borderBottomWidth: 0.5, borderBottomColor: "#dddddd", borderBottomStyle: "solid", marginBottom: 14 },
  row: { flexDirection: "row", paddingTop: 6, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#eeeeee", borderBottomStyle: "solid" },
  rowLast: { flexDirection: "row", paddingTop: 6, paddingBottom: 6 },
  label: { width: 100, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#999999", letterSpacing: 1.5, paddingTop: 2 },
  value: { flex: 1, fontSize: 10, color: "#111111", lineHeight: 1.4 },
  imgWrap: { alignItems: "center", marginBottom: 20 },
  img: { maxHeight: 280, maxWidth: CW, objectFit: "contain" },
  footer: { marginTop: "auto", paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#cccccc", borderTopStyle: "solid" },
  footerText: { fontSize: 7.5, color: "#999999", textAlign: "center", letterSpacing: 0.5 },
  sigBlock: { marginTop: "auto", paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sigImg: { height: 36, width: 120, objectFit: "contain", marginBottom: 4 },
  sigLabel: { fontSize: 7, color: "#999999", letterSpacing: 1.2 },
  qrImg: { width: 56, height: 56, marginBottom: 4 },
  qrLabel: { fontSize: 7, color: "#888888", textAlign: "right" },
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function Logo({ url }: { url: string | null }) {
  if (url) return <Image src={url} style={base.logo} />;
  return <Text style={base.brand}>PATRONAGE</Text>;
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  if (!value) return null;
  return (
    <View style={last ? base.rowLast : base.row}>
      <Text style={base.label}>{label}</Text>
      <Text style={base.value}>{value}</Text>
    </View>
  );
}

function editionString(
  edition: string | null,
  editionNumber: number | null,
  editionTotal: number | null,
  editionType: string | null
): string {
  if (edition) return edition;
  const parts: string[] = [];
  if (editionNumber != null && editionTotal != null) parts.push(`${editionNumber}/${editionTotal}`);
  else if (editionNumber != null) parts.push(`${editionNumber}`);
  if (editionType) parts.push(editionType);
  return parts.join(" ").trim();
}

// ── Shared data shape ─────────────────────────────────────────────────────────

export interface ArtworkDocumentData {
  artworkId: string;
  title: string;
  imageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  medium: string | null;
  yearCreated: number | null;
  dimensions: string | null;
  edition: string | null;
  editionNumber: number | null;
  editionTotal: number | null;
  editionType: string | null;
  priceCents: number | null;
  priceCurrency: string;
  isPoa: boolean;
  locationText: string | null;
  bio: string | null;
  ledgerId: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
}

// ── COA ──────────────────────────────────────────────────────────────────────

function CoaDocument({
  data,
  qrDataUrl,
}: {
  data: ArtworkDocumentData;
  qrDataUrl: string | null;
}) {
  const ed = editionString(data.edition, data.editionNumber, data.editionTotal, data.editionType);
  const profileUrl = data.artistUsername ? `${SITE_URL}/${data.artistUsername}` : null;
  const provenanceUrl = data.ledgerId ? `${SITE_URL}/provenance/${data.ledgerId}` : null;

  return (
    <Document title={`Certificate of Authenticity — ${data.title}`} author="Patronage">
      <Page size="A4" style={base.page}>
        <View style={base.header}>
          <Logo url={data.logoUrl} />
          {data.ledgerId && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 2 }}>
                PROVENANCE LEDGER
              </Text>
              <Text style={{ fontSize: 8, fontFamily: "Courier", color: "#333333" }}>{data.ledgerId}</Text>
            </View>
          )}
        </View>

        <Text style={base.heading}>CERTIFICATE OF AUTHENTICITY</Text>
        <View style={base.hr} />

        {data.imageUrl && (
          <View style={base.imgWrap}>
            <Image src={data.imageUrl} style={base.img} />
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <DetailRow label="TITLE" value={data.title} />
          <DetailRow label="ARTIST" value={data.artistName} />
          {data.yearCreated != null && <DetailRow label="YEAR" value={String(data.yearCreated)} />}
          {data.medium && <DetailRow label="MEDIUM" value={data.medium} />}
          {data.dimensions && <DetailRow label="DIMENSIONS" value={data.dimensions} />}
          {ed && <DetailRow label="EDITION" value={ed} last />}
        </View>

        <Text style={{ fontSize: 9, color: "#555555", lineHeight: 1.6, marginBottom: 16 }}>
          This certificate authenticates that the above work is an original creation by {data.artistName}.
          {provenanceUrl ? ` The provenance record for this work is held on the Patronage platform and can be verified at: ${provenanceUrl.replace(/^https?:\/\//, "")}` : ""}
        </Text>

        <View style={base.sigBlock}>
          <View style={{ flex: 1 }}>
            {data.signatureUrl ? (
              <Image src={data.signatureUrl} style={base.sigImg} />
            ) : (
              <View style={{ height: 36, width: 120, borderBottomWidth: 1, borderBottomColor: "#cccccc", borderBottomStyle: "solid" }} />
            )}
            <Text style={base.sigLabel}>SIGNED BY {data.artistName.toUpperCase()}</Text>
          </View>

          {qrDataUrl && (
            <View style={{ alignItems: "flex-end", marginLeft: 16 }}>
              <Image src={qrDataUrl} style={base.qrImg} />
              <Text style={base.qrLabel}>{profileUrl ? profileUrl.replace(/^https?:\/\//, "") : "patronage.nz"}</Text>
            </View>
          )}
        </View>

        <View style={base.footer}>
          <Text style={base.footerText}>Patronage · patronage.nz · Auckland, New Zealand</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateCoaPdf(data: ArtworkDocumentData): Promise<Buffer> {
  const profileUrl = data.artistUsername ? `${SITE_URL}/${data.artistUsername}` : SITE_URL;
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 160, errorCorrectionLevel: "H", margin: 1 });
  const imageUrl = resolveImageUrl(data.imageUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<CoaDocument data={{ ...data, imageUrl }} qrDataUrl={qrDataUrl} /> as any) as Promise<Buffer>;
}

// ── Tear sheet ────────────────────────────────────────────────────────────────

function TearSheetDocument({ data }: { data: ArtworkDocumentData }) {
  const ed = editionString(data.edition, data.editionNumber, data.editionTotal, data.editionType);
  const profileUrl = data.artistUsername ? `${SITE_URL}/${data.artistUsername}` : SITE_URL;
  const bioExcerpt = data.bio ? (data.bio.length > 320 ? data.bio.slice(0, 317) + "…" : data.bio) : null;
  const priceDisplay = data.isPoa
    ? "Price on application"
    : data.priceCents
      ? `${data.priceCurrency} ${(data.priceCents / 100).toLocaleString("en-NZ", { minimumFractionDigits: 0 })}`
      : null;

  return (
    <Document title={`Tear Sheet — ${data.title}`} author="Patronage">
      <Page size="A4" style={base.page}>
        {/* Header */}
        <View style={[base.header, { marginBottom: 16 }]}>
          <Logo url={data.logoUrl} />
          <Text style={{ fontSize: 9, color: "#888888" }}>
            {profileUrl.replace(/^https?:\/\//, "")}
          </Text>
        </View>

        {/* Artwork image — takes up ~40% of page height */}
        {data.imageUrl && (
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Image
              src={resolveImageUrl(data.imageUrl) ?? ""}
              style={{ maxHeight: 260, maxWidth: CW, objectFit: "contain" }}
            />
          </View>
        )}

        <View style={base.hrThin} />

        {/* Work title + artist */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{data.title}</Text>
          <Text style={{ fontSize: 11, color: "#555555" }}>{data.artistName}</Text>
        </View>

        {/* Details */}
        <View style={{ marginBottom: 14 }}>
          <DetailRow label="YEAR" value={data.yearCreated != null ? String(data.yearCreated) : ""} />
          <DetailRow label="MEDIUM" value={data.medium ?? ""} />
          <DetailRow label="DIMENSIONS" value={data.dimensions ?? ""} />
          <DetailRow label="EDITION" value={ed} />
          {priceDisplay && <DetailRow label="PRICE" value={priceDisplay} last />}
        </View>

        <View style={base.hrThin} />

        {/* Bio excerpt */}
        {bioExcerpt && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 6 }}>ARTIST STATEMENT</Text>
            <Text style={{ fontSize: 9.5, color: "#444444", lineHeight: 1.55, fontStyle: "italic" }}>{bioExcerpt}</Text>
          </View>
        )}

        <View style={base.footer}>
          <Text style={base.footerText}>
            {data.artistName} · {profileUrl.replace(/^https?:\/\//, "")} · Patronage
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateTearSheetPdf(data: ArtworkDocumentData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<TearSheetDocument data={data} /> as any) as Promise<Buffer>;
}

// ── Wall label ────────────────────────────────────────────────────────────────

function WallLabelDocument({
  data,
  qrDataUrl,
  qrTarget,
}: {
  data: ArtworkDocumentData;
  qrDataUrl: string | null;
  qrTarget: "profile" | "provenance";
}) {
  const ed = editionString(data.edition, data.editionNumber, data.editionTotal, data.editionType);

  // Centre the label content in the middle of an A4 page — designed to print at A6
  return (
    <Document title={`Wall Label — ${data.title}`} author="Patronage">
      <Page size="A4" style={base.page}>
        {/* Centred label box */}
        <View style={{
          flex: 1,
          alignItems: "flex-start",
          justifyContent: "center",
        }}>
          <View style={{
            borderWidth: 0.5,
            borderColor: "#dddddd",
            borderStyle: "solid",
            padding: 24,
            width: CW,
          }}>
            {/* Artist name */}
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888888", letterSpacing: 1.5, marginBottom: 8 }}>
              {data.artistName.toUpperCase()}
            </Text>

            {/* Work title — large */}
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6, lineHeight: 1.2 }}>
              {data.title}
            </Text>

            {/* Year */}
            {data.yearCreated != null && (
              <Text style={{ fontSize: 11, color: "#555555", marginBottom: 10 }}>{data.yearCreated}</Text>
            )}

            <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#eeeeee", borderBottomStyle: "solid", marginBottom: 10 }} />

            {/* Medium */}
            {data.medium && (
              <Text style={{ fontSize: 10, color: "#333333", marginBottom: 4 }}>{data.medium}</Text>
            )}

            {/* Dimensions */}
            {data.dimensions && (
              <Text style={{ fontSize: 10, color: "#555555", marginBottom: 4 }}>{data.dimensions}</Text>
            )}

            {/* Edition */}
            {ed && (
              <Text style={{ fontSize: 10, color: "#555555", marginBottom: 4 }}>Edition: {ed}</Text>
            )}

            {/* QR — bottom-right */}
            {qrDataUrl && (
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end", marginTop: 14 }}>
                <View style={{ alignItems: "flex-end" }}>
                  <Image src={qrDataUrl} style={{ width: 52, height: 52, marginBottom: 3 }} />
                  <Text style={{ fontSize: 7, color: "#aaaaaa" }}>
                    {qrTarget === "provenance" ? "Verify provenance" : "Artist profile"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={base.footer}>
          <Text style={base.footerText}>Designed to print at A6 · Patronage · patronage.nz</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateWallLabelPdf(
  data: ArtworkDocumentData,
  opts: { includeQr?: boolean; qrTarget?: "profile" | "provenance" } = {}
): Promise<Buffer> {
  const { includeQr = false, qrTarget = "profile" } = opts;
  let qrDataUrl: string | null = null;

  if (includeQr) {
    const qrUrl = qrTarget === "provenance" && data.ledgerId
      ? `${SITE_URL}/provenance/${data.ledgerId}`
      : data.artistUsername
        ? `${SITE_URL}/${data.artistUsername}`
        : SITE_URL;
    qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 160, errorCorrectionLevel: "H", margin: 1 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<WallLabelDocument data={data} qrDataUrl={qrDataUrl} qrTarget={qrTarget} /> as any) as Promise<Buffer>;
}

// ── Consignment agreement ─────────────────────────────────────────────────────

export interface ConsignmentData extends ArtworkDocumentData {
  consigneeName: string;
  consigneeAddress: string;
  startDate: string;
  endDate: string;
  commissionPct: number;
}

function ConsignmentDocument({ data }: { data: ConsignmentData }) {
  const ed = editionString(data.edition, data.editionNumber, data.editionTotal, data.editionType);
  const estimatedValue = data.priceCents && !data.isPoa
    ? `${data.priceCurrency} ${(data.priceCents / 100).toLocaleString("en-NZ", { minimumFractionDigits: 0 })}`
    : "Price on application";
  const artistShare = 100 - data.commissionPct;
  const today = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

  const sigLineStyle = {
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    borderBottomStyle: "solid" as const,
    width: 180,
    marginBottom: 4,
    height: 30,
  };
  const sigSubLabel = { fontSize: 8, color: "#888888", letterSpacing: 0.8 };

  return (
    <Document title={`Consignment Agreement — ${data.title}`} author="Patronage">
      <Page size="A4" style={base.page}>
        <View style={[base.header, { marginBottom: 16 }]}>
          <Logo url={data.logoUrl} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: "#888888" }}>Date of agreement: {today}</Text>
          </View>
        </View>

        <Text style={base.heading}>CONSIGNMENT AGREEMENT</Text>
        <View style={base.hr} />

        {/* Parties */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 8 }}>PARTIES</Text>
          <View style={{ flexDirection: "row", gap: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "#888888", marginBottom: 2 }}>ARTIST (CONSIGNOR)</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{data.artistName}</Text>
              {data.artistUsername && (
                <Text style={{ fontSize: 8, color: "#888888", marginTop: 1 }}>patronage.nz/{data.artistUsername}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "#888888", marginBottom: 2 }}>GALLERY / VENUE (CONSIGNEE)</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{data.consigneeName || "—"}</Text>
              {data.consigneeAddress && (
                <Text style={{ fontSize: 8, color: "#555555", marginTop: 2, lineHeight: 1.5 }}>{data.consigneeAddress}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={base.hrThin} />

        {/* Artwork */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 8 }}>ARTWORK</Text>
          <DetailRow label="TITLE" value={data.title} />
          {data.yearCreated != null && <DetailRow label="YEAR" value={String(data.yearCreated)} />}
          {data.medium && <DetailRow label="MEDIUM" value={data.medium} />}
          {data.dimensions && <DetailRow label="DIMENSIONS" value={data.dimensions} />}
          {ed && <DetailRow label="EDITION" value={ed} />}
          <DetailRow label="ESTIMATED VALUE" value={estimatedValue} />
          {data.locationText && <DetailRow label="CURRENT LOCATION" value={data.locationText} last />}
        </View>

        <View style={base.hrThin} />

        {/* Terms */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 8 }}>CONSIGNMENT PERIOD & COMMISSION</Text>
          <View style={{ flexDirection: "row", gap: 24, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "#888888", marginBottom: 2 }}>START DATE</Text>
              <Text style={{ fontSize: 10 }}>{data.startDate || "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "#888888", marginBottom: 2 }}>END DATE</Text>
              <Text style={{ fontSize: 10 }}>{data.endDate || "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "#888888", marginBottom: 2 }}>COMMISSION SPLIT</Text>
              <Text style={{ fontSize: 10 }}>{artistShare}% artist / {data.commissionPct}% gallery</Text>
            </View>
          </View>
        </View>

        <View style={base.hrThin} />

        {/* Standard terms */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#aaaaaa", letterSpacing: 1.5, marginBottom: 8 }}>STANDARD TERMS & CONDITIONS</Text>
          {[
            "1. The artist retains ownership of the artwork until it is sold.",
            "2. The consignee agrees to display, handle, and store the artwork with reasonable care and in a manner befitting its value.",
            "3. Sale proceeds (artist's share as specified above) will be remitted to the artist within 30 days of the date of sale.",
            "4. The consignee is responsible for insuring the artwork against loss, theft, and damage for its full estimated value during the consignment period.",
            "5. Either party may terminate this agreement with 14 days written notice. Upon termination or expiry, the artwork shall be returned to the artist at the consignee's expense and in the same condition as received.",
            "6. Any damage to the artwork while in the consignee's custody shall be the consignee's financial responsibility.",
            "7. The consignee shall not reproduce or use images of the artwork for commercial purposes without the artist's written consent.",
            "8. This agreement is governed by the laws of New Zealand.",
          ].map((term, i) => (
            <Text key={i} style={{ fontSize: 8.5, color: "#444444", lineHeight: 1.6, marginBottom: 3 }}>{term}</Text>
          ))}
        </View>

        {/* Signatures */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <View style={{ flex: 1, marginRight: 24 }}>
            {data.signatureUrl ? (
              <Image src={data.signatureUrl} style={{ height: 30, width: 120, objectFit: "contain", marginBottom: 4 }} />
            ) : (
              <View style={sigLineStyle} />
            )}
            <Text style={sigSubLabel}>ARTIST SIGNATURE</Text>
            <Text style={{ ...sigSubLabel, marginTop: 2 }}>{data.artistName}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={sigLineStyle} />
            <Text style={sigSubLabel}>CONSIGNEE SIGNATURE</Text>
            <Text style={{ ...sigSubLabel, marginTop: 2 }}>{data.consigneeName || "—"}</Text>
          </View>
        </View>

        <View style={[base.footer, { marginTop: 16 }]}>
          <Text style={base.footerText}>
            Generated by Patronage · patronage.nz · Standard NZ consignment conditions
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateConsignmentPdf(data: ConsignmentData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<ConsignmentDocument data={data} /> as any) as Promise<Buffer>;
}

// ── Image URL helper ──────────────────────────────────────────────────────────

function resolveImageUrl(url: string | null): string | null {
  // Serve the stored object directly — it's already compressed by our own
  // image pipeline on upload. (Previously routed through Supabase's transform
  // endpoint, which we no longer use.)
  return url ?? null;
}
