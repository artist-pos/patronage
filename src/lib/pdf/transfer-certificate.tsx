import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 64,
    paddingRight: 64,
    fontFamily: "Helvetica",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
  },
  brand: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 4,
    color: "#000000",
  },
  certTitle: {
    fontSize: 8,
    color: "#888888",
    letterSpacing: 2,
    marginTop: 5,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  certLabel: {
    fontSize: 7,
    color: "#aaaaaa",
    letterSpacing: 1,
  },
  // Image
  imageContainer: {
    marginBottom: 32,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    paddingTop: 24,
    paddingBottom: 24,
  },
  image: {
    maxHeight: 240,
    maxWidth: 380,
    objectFit: "contain",
  },
  // Details table
  table: {
    marginBottom: 32,
  },
  row: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
    borderBottomStyle: "solid",
  },
  rowLast: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: 9,
  },
  label: {
    width: 110,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    letterSpacing: 1.5,
    paddingTop: 1,
  },
  value: {
    flex: 1,
    fontSize: 11,
    color: "#000000",
    lineHeight: 1.4,
  },
  valueMuted: {
    flex: 1,
    fontSize: 10,
    color: "#555555",
    lineHeight: 1.4,
  },
  transferArrow: {
    flex: 1,
    fontSize: 11,
    color: "#000000",
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderTopStyle: "solid",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: {
    flex: 1,
    marginRight: 24,
  },
  transferIdLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  transferId: {
    fontSize: 7.5,
    fontFamily: "Courier",
    color: "#444444",
    marginBottom: 10,
  },
  legal: {
    fontSize: 7,
    color: "#aaaaaa",
    lineHeight: 1.6,
  },
  verifyBox: {
    alignItems: "flex-end",
  },
  verifyLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  verifyUrl: {
    fontSize: 8,
    color: "#000000",
    fontFamily: "Courier",
    textDecoration: "underline",
  },
});

// ── Certificate component ─────────────────────────────────────────────────────

interface CertificateProps {
  transferId: string;
  workTitle: string;
  workImageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  patronName: string;
  yearCreated: number | null;
  medium: string | null;
  transferDate: string;
  verificationUrl: string;
}

function TransferCertificate({
  transferId,
  workTitle,
  workImageUrl,
  artistName,
  artistUsername,
  patronName,
  yearCreated,
  medium,
  transferDate,
  verificationUrl,
}: CertificateProps) {
  const artistDisplay = artistUsername
    ? `${artistName}\n${SITE_URL}/${artistUsername}`
    : artistName;

  return (
    <Document
      title={`Certificate of Transfer — ${workTitle}`}
      author="Patronage"
      subject="Artwork Provenance Certificate"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>PATRONAGE</Text>
            <Text style={styles.certTitle}>CERTIFICATE OF TRANSFER</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.certLabel}>OFFICIAL PROVENANCE DOCUMENT</Text>
          </View>
        </View>

        {/* Artwork image */}
        {workImageUrl && (
          <View style={styles.imageContainer}>
            <Image src={workImageUrl} style={styles.image} />
          </View>
        )}

        {/* Details table */}
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.label}>WORK</Text>
            <Text style={styles.value}>{workTitle}</Text>
          </View>

          {(yearCreated || medium) && (
            <View style={styles.row}>
              <Text style={styles.label}>DETAILS</Text>
              <Text style={styles.valueMuted}>
                {[yearCreated, medium].filter(Boolean).join("  ·  ")}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>ARTIST</Text>
            <Text style={styles.value}>{artistDisplay}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>TRANSFER</Text>
            <Text style={styles.transferArrow}>
              {artistName}
              {"\n→  "}
              {patronName}
            </Text>
          </View>

          <View style={styles.rowLast}>
            <Text style={styles.label}>DATE</Text>
            <Text style={styles.value}>{transferDate}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={styles.transferIdLabel}>TRANSFER ID</Text>
              <Text style={styles.transferId}>{transferId}</Text>
              <Text style={styles.legal}>
                This document certifies the transfer of ownership of the above artwork
                from the artist to the collector, as recorded on the Patronage platform
                on {transferDate}. Patronage serves as the provenance record for this
                transaction.
              </Text>
            </View>
            <View style={styles.verifyBox}>
              <Text style={styles.verifyLabel}>VERIFY ONLINE</Text>
              <Link src={verificationUrl} style={styles.verifyUrl}>
                {verificationUrl.replace("https://", "")}
              </Link>
            </View>
          </View>
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
  transferId,
  verificationUrl,
}: {
  workTitle: string;
  artistName: string;
  patronName: string;
  transferId: string;
  verificationUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Certificate of Transfer</p>

      <p style="margin:0 0 16px;font-size:15px;">
        The transfer of <strong>${esc(workTitle)}</strong> from
        <strong>${esc(artistName)}</strong> to
        <strong>${esc(patronName)}</strong> has been completed.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#555;">
        Your Certificate of Transfer is attached as a PDF. This is the official
        provenance document for this artwork — keep it on record.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">
        The certificate can be independently verified online:
      </p>

      <a href="${verificationUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;margin-bottom:8px;">
        Verify provenance →
      </a>
      <p style="font-family:monospace;font-size:11px;color:#888;margin:0 0 32px;">${esc(verificationUrl)}</p>

      <p style="font-family:monospace;font-size:11px;color:#aaa;margin:0 0 32px;">Transfer ID: ${esc(transferId)}</p>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you have an account at
        <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface TransferCertificateData {
  artistId: string;
  buyerId: string;
  transferId: string;
  workTitle: string;
  workImageUrl: string | null;
  artistName: string;
  artistUsername: string | null;
  patronName: string;
  yearCreated: number | null;
  medium: string | null;
}

export async function sendTransferCertificate(data: TransferCertificateData): Promise<void> {
  const {
    artistId, buyerId, transferId, workTitle, workImageUrl,
    artistName, artistUsername, patronName, yearCreated, medium,
  } = data;

  const admin = createAdminClient();

  const [{ data: { user: artistUser } }, { data: { user: buyerUser } }] =
    await Promise.all([
      admin.auth.admin.getUserById(artistId),
      admin.auth.admin.getUserById(buyerId),
    ]);

  if (!artistUser?.email && !buyerUser?.email) return;

  const transferDate = new Date().toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const verificationUrl = `${SITE_URL}/verify/${transferId}`;

  // Resize image for reasonable PDF file size
  const imageUrl = workImageUrl?.includes("/storage/v1/object/public/")
    ? workImageUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=800&quality=85"
    : workImageUrl ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(
    <TransferCertificate
      transferId={transferId}
      workTitle={workTitle}
      workImageUrl={imageUrl}
      artistName={artistName}
      artistUsername={artistUsername}
      patronName={patronName}
      yearCreated={yearCreated}
      medium={medium}
      transferDate={transferDate}
      verificationUrl={verificationUrl}
    /> as React.ReactElement<any>
  );

  const attachment = {
    filename: `certificate-of-transfer-${transferId.slice(0, 8)}.pdf`,
    content: pdfBuffer,
  };

  const html = buildCertificateEmailHtml({
    workTitle, artistName, patronName, transferId, verificationUrl,
  });
  const subject = `Certificate of Transfer — ${workTitle}`;
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
