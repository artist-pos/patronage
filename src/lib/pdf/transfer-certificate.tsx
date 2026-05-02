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
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerByLedgerId } from "@/lib/provenance";
import {
  resolveTheme,
  getFontPair,
  DEFAULT_THEME,
  type ProvenanceTheme,
} from "@/lib/provenance-theme";
import { listDocPhotosWithUrls, DOC_PHOTO_TYPES } from "@/lib/artwork-documentation";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

// ── Styles ────────────────────────────────────────────────────────────────────
// A4 = 595 × 842pt. With 56pt vertical padding, content area ≈ 730pt tall.
// Image max height = 40% of page height = 336pt.

const PAGE_PADDING_X = 44;
const PAGE_PADDING_Y = 44;
const CONTENT_WIDTH = 595 - PAGE_PADDING_X * 2; // 507
// Image is bounded to a fixed height so the rest of page 1 (details, statement,
// signature, QR) always fits without spilling onto a third page.
const IMAGE_MAX_HEIGHT = 260;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingTop: PAGE_PADDING_Y,
    paddingBottom: PAGE_PADDING_Y,
    paddingLeft: PAGE_PADDING_X,
    paddingRight: PAGE_PADDING_X,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  headerLeft: {
    flex: 1,
  },
  logoImage: {
    height: 32,
    width: 110,
    objectFit: "contain",
  },
  brandFallback: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    color: "#000000",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  ledgerLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#aaaaaa",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  ledgerId: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#333333",
    letterSpacing: 0.5,
  },
  certHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    color: "#000000",
    marginBottom: 14,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
    marginBottom: 22,
  },
  hrThin: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    borderBottomStyle: "solid",
    marginBottom: 18,
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  image: {
    maxHeight: IMAGE_MAX_HEIGHT,
    maxWidth: CONTENT_WIDTH,
    objectFit: "contain",
  },
  table: {
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
    borderBottomStyle: "solid",
  },
  rowLast: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
  },
  label: {
    width: 90,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    letterSpacing: 1.5,
    paddingTop: 2,
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.4,
  },
  valueMuted: {
    flex: 1,
    fontSize: 9.5,
    color: "#555555",
    lineHeight: 1.4,
  },
  artistUrl: {
    fontSize: 8.5,
    color: "#777777",
    marginTop: 1,
  },
  noteBox: {
    marginBottom: 18,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 14,
    paddingRight: 14,
    borderLeftWidth: 2,
    borderLeftColor: "#000000",
    borderLeftStyle: "solid",
  },
  noteText: {
    fontSize: 9.5,
    color: "#444444",
    lineHeight: 1.55,
    fontStyle: "italic",
  },
  // Bottom row on page 1: signature on the left, small QR + label on the right.
  // marginTop: "auto" pushes it to the bottom of the page so the certificate
  // always feels balanced regardless of statement length.
  page1Bottom: {
    marginTop: "auto",
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  signatureBlock: {
    flex: 1,
  },
  signatureImage: {
    height: 40,
    width: 140,
    objectFit: "contain",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    color: "#999999",
    letterSpacing: 1.2,
  },
  page1QrBox: {
    alignItems: "flex-end",
    marginLeft: 18,
  },
  page1QrImage: {
    width: 60,
    height: 60,
    marginBottom: 4,
  },
  page1QrLabel: {
    fontSize: 7,
    color: "#888888",
    textAlign: "right",
  },
  // ── Page 2 ──
  sectionHeading: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: "#999999",
    marginBottom: 14,
  },
  custodyList: {
    marginBottom: 28,
    borderLeftWidth: 1,
    borderLeftColor: "#dddddd",
    borderLeftStyle: "solid",
    paddingLeft: 14,
  },
  custodyItem: {
    marginBottom: 14,
  },
  custodyDate: {
    fontSize: 8,
    color: "#999999",
    marginBottom: 2,
  },
  custodyEvent: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    marginBottom: 2,
  },
  custodyDetail: {
    fontSize: 9,
    color: "#555555",
  },
  custodyEventRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  selfAttestedBadge: {
    fontSize: 6.5,
    color: "#888888",
    backgroundColor: "#f0f0f0",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    marginLeft: 6,
    letterSpacing: 0.6,
  },
  refSection: {
    marginTop: 8,
    marginBottom: 18,
  },
  refGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  refTile: {
    width: 110,
    marginRight: 8,
    marginBottom: 8,
  },
  refImage: {
    width: 110,
    height: 110,
    objectFit: "cover",
  },
  refLabel: {
    fontSize: 7,
    color: "#888888",
    letterSpacing: 1,
    marginTop: 3,
  },
  // Phase 3 — holder-upload variant
  trustTierRow: {
    marginBottom: 14,
  },
  trustTierChip: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    color: "#666666",
    backgroundColor: "#f4f4f3",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderStyle: "solid",
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    alignSelf: "flex-start",
  },
  royaltyText: {
    fontSize: 7.5,
    color: "#888888",
    lineHeight: 1.5,
    marginTop: 12,
    marginBottom: 8,
  },
  legalBlock: {
    marginBottom: 24,
  },
  legalText: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.6,
  },
  qrRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginBottom: 24,
  },
  qrBox: {
    alignItems: "flex-end",
  },
  qrImage: {
    width: 96,
    height: 96,
    marginBottom: 6,
  },
  qrLabel: {
    fontSize: 7.5,
    color: "#888888",
    textAlign: "right",
  },
  pageFooter: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    borderTopStyle: "solid",
  },
  pageFooterText: {
    fontSize: 7.5,
    color: "#888888",
    textAlign: "center",
    letterSpacing: 0.5,
  },
});

const STATEMENT_MAX_CHARS = 480;

// ── Certificate component ─────────────────────────────────────────────────────

interface ChainEntry {
  name: string;
  fromName?: string | null;
  date: string;
  type: string;
  /** Pre-platform / self-attested entries render with a "Self-attested" mark. */
  selfAttested?: boolean;
  /** Prior history entries carry a free-text description instead of a from→to line. */
  description?: string | null;
}

interface ReferencePhoto {
  label: string;
  url: string;
}

interface CertificateProps {
  ledgerId: string;
  verificationUrl: string;
  workTitle: string;
  workImageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  patronName: string;
  yearCreated: number | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  certificateNote: string | null;
  transferDate: string;
  chainOfCustody: ChainEntry[];
  referencePhotos: ReferencePhoto[];
  logoUrl: string | null;
  signatureUrl: string | null;
  qrDataUrl: string;
  theme: ProvenanceTheme;
  isHolderUploaded?: boolean;
  trustTierLabel?: string | null;
  royaltyStatement?: string | null;
}

function entryEventLabel(type: string): string {
  if (type === "created") return "Created & registered";
  if (type === "transferred") return "Transferred";
  if (type === "resold") return "Resold";
  // Prior-history types
  if (type === "exhibited")    return "Exhibited";
  if (type === "sold")         return "Sold";
  if (type === "gifted")       return "Gifted";
  if (type === "commissioned") return "Commissioned";
  if (type === "published")    return "Published";
  if (type === "other")        return "Other";
  return type;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function TransferCertificate({
  ledgerId,
  verificationUrl,
  workTitle,
  workImageUrl,
  artistName,
  artistUsername,
  patronName,
  yearCreated,
  medium,
  dimensions,
  edition,
  certificateNote,
  transferDate,
  chainOfCustody,
  logoUrl,
  signatureUrl,
  qrDataUrl,
  theme,
  referencePhotos,
  isHolderUploaded,
  trustTierLabel,
  royaltyStatement,
}: CertificateProps) {
  const artistProfileUrl = artistUsername ? `${SITE_URL}/${artistUsername}` : null;
  const detailParts = [yearCreated, medium, dimensions, edition].filter(Boolean);
  const artistDisplay = artistName || "Unknown";
  const cleanPatron = (patronName ?? "").trim() || "Unknown";
  const truncatedNote = certificateNote ? truncate(certificateNote, STATEMENT_MAX_CHARS) : null;
  const cleanedVerifyUrl = verificationUrl.replace(/^https?:\/\//, "");

  const fontPair = getFontPair(theme.fontPair);
  // Theme-derived overrides applied on top of the base style sheet. Base sheet
  // controls layout; theme controls colour + font family.
  const t = {
    body:        { fontFamily: fontPair.pdfBodyFamily },
    heading:     { fontFamily: fontPair.pdfHeadingFamily, color: theme.primaryColor },
    primaryFill: { color: theme.primaryColor },
    accentFill:  { color: theme.accentColor },
    primaryRule: { borderBottomColor: theme.primaryColor },
    primaryLeft: { borderLeftColor: theme.primaryColor },
  };
  const pageOrientation = theme.orientation === "landscape" ? "landscape" : "portrait";

  return (
    <Document
      title={`Provenance Certificate — ${workTitle}`}
      author="Patronage"
      subject="Artwork Provenance Certificate"
    >
      {/* ── PAGE 1: The Certificate ─────────────────────────────────────────── */}
      <Page size="A4" orientation={pageOrientation} wrap={false} style={[styles.page, t.body]}>
        {/* Header: logo (left) + ledger id (right) */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logoImage} />
            ) : (
              <Text style={[styles.brandFallback, t.heading]}>PATRONAGE</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.ledgerLabel, t.accentFill]}>LEDGER ID</Text>
            <Text style={[styles.ledgerId, t.primaryFill]}>{ledgerId}</Text>
          </View>
        </View>

        <Text style={[styles.certHeading, t.heading]}>CERTIFICATE OF PROVENANCE</Text>
        <View style={[styles.hr, t.primaryRule]} />

        {/* Artwork image — preserves aspect ratio via objectFit:contain */}
        {workImageUrl && (
          <View style={styles.imageWrap}>
            <Image src={workImageUrl} style={styles.image} />
          </View>
        )}

        {/* Work details */}
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.label, t.heading, t.accentFill]}>WORK</Text>
            <Text style={[styles.value, t.body, t.primaryFill]}>{workTitle}</Text>
          </View>

          {detailParts.length > 0 && (
            <View style={styles.row}>
              <Text style={[styles.label, t.heading, t.accentFill]}>DETAILS</Text>
              <Text style={[styles.valueMuted, t.body, t.accentFill]}>{detailParts.join("  ·  ")}</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={[styles.label, t.heading, t.accentFill]}>ARTIST</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.value, t.body, t.primaryFill]}>{artistDisplay}</Text>
              {artistProfileUrl && (
                <Text style={[styles.artistUrl, t.accentFill]}>{artistProfileUrl.replace(/^https?:\/\//, "")}</Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, t.heading, t.accentFill]}>
              {isHolderUploaded ? "REGISTERED BY" : "TRANSFER"}
            </Text>
            <Text style={[styles.value, t.body, t.primaryFill]}>
              {isHolderUploaded ? cleanPatron : `${artistDisplay}  →  ${cleanPatron}`}
            </Text>
          </View>

          <View style={styles.rowLast}>
            <Text style={[styles.label, t.heading, t.accentFill]}>DATE</Text>
            <Text style={[styles.value, t.body, t.primaryFill]}>{transferDate}</Text>
          </View>
        </View>

        {/* Trust tier + royalty statement (Phase 3 holder variant). The chip
            sits between the details table and the artist statement so it's
            unmissable when the cert is photocopied or printed. */}
        {trustTierLabel && (
          <View style={styles.trustTierRow}>
            <Text style={[styles.trustTierChip, t.heading]}>{trustTierLabel}</Text>
          </View>
        )}

        {/* Artist statement (truncated to fit on page 1) */}
        {truncatedNote && (
          <View style={[styles.noteBox, t.primaryLeft]}>
            <Text style={[styles.noteText, t.body]}>{truncatedNote}</Text>
          </View>
        )}

        {/* Royalty notice — required on holder-uploaded certificates so the
            5% RRA royalty obligation is visible on the artefact itself. */}
        {royaltyStatement && (
          <Text style={[styles.royaltyText, t.accentFill]}>{royaltyStatement}</Text>
        )}

        {/* Bottom: thin rule, then signature (left) + small QR (right) */}
        <View style={styles.page1Bottom}>
          <View style={styles.signatureBlock}>
            {signatureUrl ? (
              <Image src={signatureUrl} style={styles.signatureImage} />
            ) : (
              <View style={{ height: 40 }} />
            )}
            <Text style={[styles.signatureLabel, t.heading, t.accentFill]}>
              SIGNED BY {(artistDisplay || "THE ARTIST").toUpperCase()}
            </Text>
          </View>
          <View style={styles.page1QrBox}>
            <Image src={qrDataUrl} style={styles.page1QrImage} />
            <Text style={[styles.page1QrLabel, t.accentFill]}>Scan to verify</Text>
          </View>
        </View>
      </Page>

      {/* ── PAGE 2: Chain of custody & verification ─────────────────────────── */}
      <Page size="A4" orientation={pageOrientation} wrap={false} style={[styles.page, t.body]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logoImage} />
            ) : (
              <Text style={[styles.brandFallback, t.heading]}>PATRONAGE</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.ledgerLabel, t.accentFill]}>LEDGER ID</Text>
            <Text style={[styles.ledgerId, t.primaryFill]}>{ledgerId}</Text>
          </View>
        </View>

        <View style={[styles.hr, t.primaryRule]} />

        <Text style={[styles.sectionHeading, t.heading, t.accentFill]}>CHAIN OF CUSTODY</Text>
        <View style={styles.custodyList}>
          {chainOfCustody.length === 0 ? (
            <Text style={[styles.custodyDetail, t.body, t.accentFill]}>No custody events recorded.</Text>
          ) : (
            chainOfCustody.map((entry, i) => (
              <View key={i} style={styles.custodyItem}>
                <Text style={[styles.custodyDate, t.accentFill]}>{entry.date}</Text>
                <View style={styles.custodyEventRow}>
                  <Text style={[styles.custodyEvent, t.heading]}>{entryEventLabel(entry.type)}</Text>
                  {entry.selfAttested && (
                    <Text style={styles.selfAttestedBadge}>SELF-ATTESTED</Text>
                  )}
                </View>
                <Text style={[styles.custodyDetail, t.body, t.accentFill]}>
                  {entry.description
                    ? entry.description
                    : entry.type === "created"
                      ? `Registered to ${entry.name}`
                      : entry.fromName
                        ? `${entry.fromName}  →  ${entry.name}`
                        : `Acquired by ${entry.name}`}
                </Text>
              </View>
            ))
          )}
        </View>

        {referencePhotos.length > 0 && (
          <View style={styles.refSection}>
            <Text style={[styles.sectionHeading, t.heading, t.accentFill]}>REFERENCE PHOTOS</Text>
            <View style={styles.refGrid}>
              {referencePhotos.slice(0, 8).map((p, i) => (
                <View key={i} style={styles.refTile}>
                  <Image src={p.url} style={styles.refImage} />
                  <Text style={[styles.refLabel, t.heading, t.accentFill]}>
                    {p.label.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.legalBlock}>
          <Text style={[styles.legalText, t.body, t.accentFill]}>
            This document certifies the transfer of ownership of the above artwork as
            recorded on the Patronage platform on {transferDate}. The chain of custody
            shown reflects the verified ownership history of this work as held in the
            Patronage provenance ledger. Self-attested entries pre-date the work’s
            registration on Patronage and are supplied by the artist. Scan the QR code
            or visit the URL below to verify the provenance record online.
          </Text>
        </View>

        <View style={styles.qrRow}>
          <View style={styles.qrBox}>
            <Image src={qrDataUrl} style={styles.qrImage} />
            <Text style={[styles.qrLabel, t.accentFill]}>Scan to verify provenance</Text>
          </View>
        </View>

        <View style={styles.pageFooter}>
          <Text style={[styles.pageFooterText, t.accentFill]}>
            Recorded on Patronage · patronage.nz · {cleanedVerifyUrl}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Email HTML ────────────────────────────────────────────────────────────────

function buildCertificateEmailHtml({
  workTitle,
  artistName,
  patronName,
  ledgerId,
  verificationUrl,
  isNewAccount,
}: {
  workTitle: string;
  artistName: string;
  patronName: string;
  ledgerId: string;
  verificationUrl: string;
  isNewAccount?: boolean;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const claimCta = isNewAccount
    ? `<a href="${SITE_URL}/claim-account" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;margin-top:8px;">
        Claim your Patronage collection →
      </a>`
    : `<a href="${SITE_URL}/dashboard" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;margin-top:8px;">
        View your collection →
      </a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px 64px;">
    <tr><td>
      <p style="margin:0 0 32px;font-size:15px;line-height:1.7;">
        ${esc(artistName)} has registered you as the owner of <strong>${esc(workTitle)}</strong>.
        Your Certificate of Provenance is attached as a PDF — keep it on record.
      </p>

      <p style="margin:0 0 8px;font-size:13px;color:#555;">
        Verify the provenance of this work online:
      </p>
      <a href="${verificationUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View provenance record →
      </a>
      <p style="font-family:monospace;font-size:11px;color:#888;margin:6px 0 24px;">${esc(verificationUrl)}</p>

      <p style="font-family:monospace;font-size:11px;color:#aaa;margin:0 0 8px;">Ledger ID: ${esc(ledgerId)}</p>

      ${claimCta}

      <div style="border-top:1px solid #e8e8e8;margin-top:40px;padding-top:20px;">
        <p style="margin:0;font-size:11px;color:#aaa;">
          Patronage &middot; <a href="mailto:hello@patronage.nz" style="color:#aaa;text-decoration:none;">hello@patronage.nz</a> &middot; <a href="${SITE_URL}" style="color:#aaa;text-decoration:none;">patronage.nz</a> &middot; Auckland, New Zealand
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── PDF buffer generation (reusable for API route) ────────────────────────────

export interface CertificateGenerationData {
  ledgerId: string;
  workTitle: string;
  workImageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  patronName: string;
  yearCreated: number | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  certificateNote: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  chainOfCustody?: Array<{
    name: string;
    fromName?: string | null;
    date: string;
    type: string;
    selfAttested?: boolean;
    description?: string | null;
  }>;
  referencePhotos?: ReferencePhoto[];
  theme?: ProvenanceTheme;
  // Holder-uploaded variant (Phase 3). When set, the cert shows a trust-tier
  // chip, a royalty statement, and rephrases TRANSFER → REGISTERED BY.
  isHolderUploaded?: boolean;
  trustTierLabel?: string | null;
  royaltyStatement?: string | null;
}

export async function generateCertificatePdf(data: CertificateGenerationData): Promise<Buffer> {
  const verificationUrl = `${SITE_URL}/provenance/${data.ledgerId}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 200,
    errorCorrectionLevel: "H",
    margin: 1,
  });

  const imageUrl = data.workImageUrl?.includes("/storage/v1/object/public/")
    ? data.workImageUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=800&quality=85"
    : data.workImageUrl ?? null;

  const transferDate = new Date().toLocaleDateString("en-NZ", {
    day: "numeric", month: "long", year: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(
    <TransferCertificate
      ledgerId={data.ledgerId}
      verificationUrl={verificationUrl}
      workTitle={data.workTitle}
      workImageUrl={imageUrl}
      artistName={data.artistName}
      artistUsername={data.artistUsername}
      patronName={data.patronName}
      yearCreated={data.yearCreated}
      medium={data.medium}
      dimensions={data.dimensions}
      edition={data.edition}
      certificateNote={data.certificateNote}
      transferDate={transferDate}
      chainOfCustody={data.chainOfCustody ?? []}
      logoUrl={data.logoUrl}
      signatureUrl={data.signatureUrl}
      qrDataUrl={qrDataUrl}
      theme={data.theme ?? DEFAULT_THEME}
      referencePhotos={data.referencePhotos ?? []}
      isHolderUploaded={data.isHolderUploaded ?? false}
      trustTierLabel={data.trustTierLabel ?? null}
      royaltyStatement={data.royaltyStatement ?? null}
    /> as React.ReactElement<any>
  ) as Promise<Buffer>;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface TransferCertificateData {
  artistId: string;
  buyerId: string;
  // Legacy field kept for backward compat — new code should pass ledgerId instead
  transferId?: string;
  ledgerId?: string;
  workTitle: string;
  workImageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  patronName: string;
  yearCreated: number | null;
  medium: string | null;
  dimensions?: string | null;
  edition?: string | null;
  certificateNote?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  chainOfCustody?: Array<{
    name: string;
    fromName?: string | null;
    date: string;
    type: string;
    selfAttested?: boolean;
    description?: string | null;
  }>;
  referencePhotos?: ReferencePhoto[];
  isNewAccount?: boolean;
  artworkId?: string;
}

export async function sendTransferCertificate(data: TransferCertificateData): Promise<void> {
  const {
    artistId, buyerId, workTitle, workImageUrl,
    artistName, artistUsername, patronName, yearCreated, medium,
    dimensions, edition, certificateNote, logoUrl, signatureUrl,
    chainOfCustody, referencePhotos, isNewAccount,
  } = data;

  const ledgerId = data.ledgerId ?? data.transferId ?? "UNKNOWN";
  const admin = createAdminClient();

  // Build chain of custody from the ledger if caller didn't supply one — keeps
  // the PDF in sync with the public provenance page. Pre-platform / prior
  // history items are merged in chronologically before the on-platform entries
  // and clearly marked as self-attested.
  let chain = chainOfCustody;
  if ((!chain || chain.length === 0) && data.ledgerId) {
    const ledger = await getLedgerByLedgerId(data.ledgerId);
    if (ledger) {
      const platformEntries = ledger.entries.map(e => ({
        name: ledger.ownerNames[e.to_owner_id] ?? "Unknown",
        fromName: e.from_owner_id ? (ledger.ownerNames[e.from_owner_id] ?? "Unknown") : null,
        date: new Date(e.transferred_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" }),
        type: e.entry_type,
      }));
      const priorEntries = ledger.priorHistory.map(p => ({
        name: "",
        fromName: null,
        date: p.date_text ?? (p.year_int ? String(p.year_int) : ""),
        type: p.type,
        selfAttested: true,
        description: p.description,
      }));
      chain = [...priorEntries, ...platformEntries];
    }
  }

  // Reference photos for page 2 — only if caller hasn't supplied them and we
  // have an artwork id to look up. These are private docs, but they're embedded
  // in the certificate PDF (which is itself private) so the buyer sees them.
  let refs = referencePhotos ?? data.referencePhotos;
  if ((!refs || refs.length === 0) && data.artworkId) {
    const photos = await listDocPhotosWithUrls(data.artworkId);
    const labels = Object.fromEntries(DOC_PHOTO_TYPES.map(t => [t.id, t.label]));
    refs = photos
      .filter(p => p.signedUrl)
      .map(p => ({ label: labels[p.type] ?? p.type, url: p.signedUrl! }));
  }

  const [{ data: { user: artistUser } }, { data: { user: buyerUser } }, { data: themeRow }] = await Promise.all([
    admin.auth.admin.getUserById(artistId),
    admin.auth.admin.getUserById(buyerId),
    admin
      .from("profiles")
      .select("provenance_template_theme, provenance_primary_color, provenance_accent_color, provenance_font_pair, provenance_orientation")
      .eq("id", artistId)
      .maybeSingle(),
  ]);
  const theme = resolveTheme(themeRow);

  if (!artistUser?.email && !buyerUser?.email) return;

  // Signature is stored as a private-bucket path — resolve to a signed URL before passing to PDF renderer
  const rawSignaturePath = signatureUrl ?? null;
  let resolvedSignatureUrl: string | null = null;
  if (rawSignaturePath) {
    if (rawSignaturePath.startsWith("http")) {
      resolvedSignatureUrl = rawSignaturePath;
    } else {
      const { data: signedData } = await admin.storage
        .from("provenance-signatures")
        .createSignedUrl(rawSignaturePath, 3600);
      resolvedSignatureUrl = signedData?.signedUrl ?? null;
    }
  }

  const pdfBuffer = await generateCertificatePdf({
    ledgerId,
    workTitle,
    workImageUrl,
    artistName,
    artistUsername,
    patronName,
    yearCreated,
    medium,
    dimensions: dimensions ?? null,
    edition: edition ?? null,
    certificateNote: certificateNote ?? null,
    logoUrl: logoUrl ?? null,
    signatureUrl: resolvedSignatureUrl,
    chainOfCustody: chain ?? [],
    referencePhotos: refs ?? [],
    theme,
  });

  const attachment = {
    filename: `provenance-${ledgerId}.pdf`,
    content: pdfBuffer,
  };

  const verificationUrl = `${SITE_URL}/provenance/${ledgerId}`;
  const html = buildCertificateEmailHtml({
    workTitle, artistName, patronName, ledgerId, verificationUrl, isNewAccount,
  });
  const subject = `Provenance Certificate — ${workTitle}`;
  const resend = new Resend(process.env.RESEND_API_KEY!);

  await Promise.all([
    artistUser?.email
      ? resend.emails.send({ from: FROM, to: artistUser.email, subject, html, attachments: [attachment] })
      : Promise.resolve(),
    buyerUser?.email
      ? resend.emails.send({ from: FROM, to: buyerUser.email, subject, html, attachments: [attachment] })
      : Promise.resolve(),
  ]);
}
