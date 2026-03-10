import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ transferId: string }>;
}

async function getTransferRecord(transferId: string) {
  const admin = createAdminClient();

  // Fetch the transfer_accepted message
  const { data: message } = await admin
    .from("messages")
    .select("id, work_id, sender_id, created_at, message_type")
    .eq("id", transferId)
    .eq("message_type", "transfer_accepted")
    .maybeSingle();

  if (!message || !message.work_id) return null;

  // Fetch artwork + artist and patron profiles in parallel
  const [{ data: artwork }, { data: patronProfile }] = await Promise.all([
    admin
      .from("artworks")
      .select("id, title, caption, image_url, year_created, medium_detail, creator_id")
      .eq("id", message.work_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", message.sender_id)
      .maybeSingle(),
  ]);

  if (!artwork) return null;

  const { data: artistProfile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", artwork.creator_id)
    .maybeSingle();

  return {
    transferId: message.id,
    transferredAt: message.created_at as string,
    artwork: {
      title: (artwork.title ?? artwork.caption ?? "Untitled") as string,
      imageUrl: artwork.image_url as string | null,
      yearCreated: artwork.year_created as number | null,
      medium: artwork.medium_detail as string | null,
    },
    artist: {
      name: (artistProfile?.full_name ?? artistProfile?.username ?? "Unknown artist") as string,
      username: artistProfile?.username as string | null,
    },
    patron: {
      name: (patronProfile?.full_name ?? patronProfile?.username ?? "Unknown collector") as string,
      username: patronProfile?.username as string | null,
    },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { transferId } = await params;
  const record = await getTransferRecord(transferId);
  if (!record) return { title: "Transfer Not Found | Patronage" };

  return {
    title: `Provenance: ${record.artwork.title} | Patronage`,
    description: `Verified transfer of "${record.artwork.title}" by ${record.artist.name} to ${record.patron.name}.`,
  };
}

export default async function VerifyPage({ params }: Props) {
  const { transferId } = await params;
  const record = await getTransferRecord(transferId);

  if (!record) notFound();

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

  const transferDate = new Date(record.transferredAt).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Schema.org structured data — TransferAction + VisualArtwork
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TransferAction",
    "name": `Transfer of ${record.artwork.title}`,
    "identifier": record.transferId,
    "startTime": record.transferredAt,
    "object": {
      "@type": "VisualArtwork",
      "name": record.artwork.title,
      ...(record.artwork.yearCreated ? { "dateCreated": String(record.artwork.yearCreated) } : {}),
      ...(record.artwork.medium ? { "artMedium": record.artwork.medium } : {}),
      ...(record.artwork.imageUrl ? { "image": record.artwork.imageUrl } : {}),
      "creator": {
        "@type": "Person",
        "name": record.artist.name,
        ...(record.artist.username ? { "url": `${SITE_URL}/${record.artist.username}` } : {}),
      },
    },
    "agent": {
      "@type": "Person",
      "name": record.artist.name,
      ...(record.artist.username ? { "url": `${SITE_URL}/${record.artist.username}` } : {}),
    },
    "recipient": {
      "@type": "Person",
      "name": record.patron.name,
    },
    "provider": {
      "@type": "Organization",
      "name": "Patronage",
      "url": SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm font-semibold tracking-tight">Patronage</Link>
          <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">
            Verified Provenance Record
          </p>
        </div>

        {/* Verified badge */}
        <div className="flex items-center gap-2 mb-8 border border-black px-4 py-2.5 w-fit">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 0L8.5 5.5H14L9.5 8.5L11 14L7 11L3 14L4.5 8.5L0 5.5H5.5L7 0Z" fill="black"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Verified Transfer</span>
        </div>

        {/* Artwork image */}
        {record.artwork.imageUrl && (
          <div className="mb-8 bg-stone-50 border border-border flex items-center justify-center p-6">
            <Image
              src={record.artwork.imageUrl}
              alt={record.artwork.title}
              width={600}
              height={500}
              unoptimized
              style={{ maxHeight: 400, width: "auto", display: "block", margin: "0 auto" }}
            />
          </div>
        )}

        {/* Transfer details */}
        <div className="border-t border-black">
          <Row label="Work" value={record.artwork.title} large />

          {(record.artwork.yearCreated || record.artwork.medium) && (
            <Row
              label="Details"
              value={[record.artwork.yearCreated, record.artwork.medium].filter(Boolean).join("  ·  ")}
            />
          )}

          <Row
            label="Artist"
            value={
              record.artist.username ? (
                <Link
                  href={`/${record.artist.username}`}
                  className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  {record.artist.name}
                </Link>
              ) : (
                record.artist.name
              )
            }
          />

          <Row
            label="Transfer"
            value={
              <span>
                {record.artist.name}
                <span className="text-muted-foreground mx-2">→</span>
                {record.patron.name}
              </span>
            }
          />

          <Row label="Date" value={transferDate} />

          <Row
            label="Transfer ID"
            value={<span className="font-mono text-xs break-all">{record.transferId}</span>}
          />
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This record was created by Patronage, the provenance infrastructure for New Zealand
            and Australian artists. The transfer above was confirmed by both parties on the
            Patronage platform and cannot be altered.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <Link href="/" className="underline underline-offset-2 hover:text-foreground transition-colors">
              patronage.nz
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  large = false,
}: {
  label: string;
  value: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div className="flex gap-6 border-b border-border py-4">
      <span className="text-xs font-medium uppercase tracking-widest text-stone-400 w-24 shrink-0 pt-0.5">
        {label}
      </span>
      <span className={large ? "text-base font-semibold" : "text-sm"}>
        {value}
      </span>
    </div>
  );
}
