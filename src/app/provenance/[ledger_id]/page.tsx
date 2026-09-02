import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLedgerByLedgerId, type OwnerInfo } from "@/lib/provenance";
import { listDocPhotos, listDocPhotosWithUrls } from "@/lib/artwork-documentation";
import { DocumentationGallery } from "./DocumentationGallery";
import { ProvenanceClient } from "./ProvenanceClient";
import { getTrustTier } from "@/lib/trust-tier";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ ledger_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ledger_id } = await params;
  const data = await getLedgerByLedgerId(ledger_id);
  if (!data) return { title: "Provenance | Patronage" };
  const title = data.artwork.title ?? data.artwork.caption ?? "Untitled";
  const artist = data.artist.full_name ?? data.artist.username;
  return {
    title: `${title} by ${artist} | Provenance`,
    description: `Provenance record for ${title} by ${artist}, recorded on Patronage. Ledger ID: ${ledger_id}`,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ProvenancePage({ params }: PageProps) {
  const { ledger_id } = await params;

  const [data, supabase] = await Promise.all([
    getLedgerByLedgerId(ledger_id),
    createClient(),
  ]);

  if (!data) notFound();

  const { artwork, entries, priorHistory, artist, owners } = data;

  // Edition provenance: fetch parent artwork info for the edition pill
  let parentArtworkInfo: { ledger_id: string; caption: string | null; title: string | null } | null = null;
  let editionNumber: number | null = null;
  if (artwork.parent_artwork_id) {
    const { data: parent } = await supabase
      .from("artworks")
      .select("ledger_id, caption, title")
      .eq("id", artwork.parent_artwork_id)
      .maybeSingle();
    parentArtworkInfo = parent ?? null;
    // Derive edition number from the ledger_id suffix e.g. PTRN-2026-AB12-CD34-0003 → 3
    const suffixMatch = artwork.ledger_id.match(/-(\d{4})$/);
    if (suffixMatch) editionNumber = parseInt(suffixMatch[1], 10);
  }

  const selectedOppIds = entries
    .filter(e => e.entry_type === "selected" && e.source_opportunity_id)
    .map(e => e.source_opportunity_id as string);

  // Run auth + non-auth-dependent fetches in parallel; sign URLs only if needed after
  const [{ data: { user } }, trustTier, docPhotosCount, oppTitlesResult] = await Promise.all([
    supabase.auth.getUser(),
    getTrustTier(artwork.id),
    listDocPhotos(artwork.id),
    selectedOppIds.length > 0
      ? supabase.from("opportunities").select("id, title, type").in("id", selectedOppIds)
      : Promise.resolve({ data: [] }),
  ]);

  const isArtist = user?.id === artwork.creator_id;
  const isCurrentOwner = user?.id === artwork.current_owner_id;
  const isLoggedIn = !!user;
  const canPrivateView = isArtist || isCurrentOwner;

  // Only generate signed URLs if the viewer can actually see the photos
  const docPhotos = canPrivateView ? await listDocPhotosWithUrls(artwork.id) : [];

  const oppTitles: Record<string, { title: string; type: string }> = {};
  for (const opp of (oppTitlesResult as { data: Array<{ id: string; title: string; type: string }> | null }).data ?? []) {
    oppTitles[opp.id] = { title: opp.title, type: opp.type };
  }

  const docPhotosExist = canPrivateView ? docPhotos.length > 0 : docPhotosCount.length > 0;

  const thumbUrl = artwork.url
    ? artwork.url
    : null;

  const workHref = `/${artist.username}/works/${artwork.id}`;

  const metaLine = [
    artwork.year,
    artwork.medium,
    artwork.dimensions,
    artwork.edition ? `Ed. ${artwork.edition}` : null,
  ].filter(Boolean).join(" · ");

  // Trust banner copy — never say "Self-attested" or "Verified by Patronage"
  const TRUST_COPY: Record<string, { title: string; body: string }> = {
    recorded_by_artist: {
      title: "Recorded by artist",
      body: "This record was lodged by the artist on Patronage. It reflects what the artist submitted, not an independent authentication of the physical work.",
    },
    confirmed_by_artist: {
      title: "Confirmed by artist",
      body: "Uploaded by the current holder and subsequently confirmed by the artist.",
    },
    recorded_by_holder: {
      title: "Recorded by holder",
      body: "Uploaded by the current holder. The artist has not yet confirmed this record.",
    },
    resolved_by_patronage: {
      title: "Record resolved",
      body: "Patronage adjudicated a dispute about this record. See the resolution note for details.",
    },
    disputed: {
      title: "Disputed record",
      body: "The artist has declined this record.",
    },
  };

  const trustCopy = trustTier ? TRUST_COPY[trustTier] : null;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-[640px] mx-auto px-4 py-12 md:py-20 space-y-10">

        {/* 1. Header — green pill badge + ledger ID */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Recorded on Patronage
          </span>
          <p className="font-mono text-xs text-stone-400">{ledger_id}</p>
        </div>

        {/* 2. Artwork row — thumbnail + title + meta + link */}
        <div className="flex items-start gap-4">
          <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-stone-100 shrink-0">
            {thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt={artwork.title ?? "Artwork"}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-stone-900 leading-snug">
              {artwork.title ?? artwork.caption ?? "Untitled"}
            </h1>
            {metaLine && (
              <p className="text-sm text-stone-500 mt-1">{metaLine}</p>
            )}
            <Link
              href={workHref}
              className="inline-flex items-center gap-1 mt-2 text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              View artwork →
            </Link>
          </div>
        </div>

        {/* Edition provenance pill */}
        {parentArtworkInfo && editionNumber && (
          <div className="flex items-center gap-2 text-sm text-stone-600 border border-stone-200 rounded-lg px-4 py-3 bg-white">
            <span className="font-medium">Edition {editionNumber}</span>
            <span className="text-stone-300">·</span>
            <Link
              href={`/provenance/${parentArtworkInfo.ledger_id}`}
              className="text-stone-500 hover:text-stone-800 transition-colors underline underline-offset-2"
            >
              View series provenance ({parentArtworkInfo.title ?? parentArtworkInfo.caption ?? "Parent work"})
            </Link>
          </div>
        )}

        {/* 3. Trust banner — never say "Verified by Patronage" or "Self-attested" */}
        {trustCopy && (
          <div className="border border-stone-200 rounded-xl px-5 py-4 flex items-start gap-3 bg-white">
            <ShieldCheck className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-stone-900">{trustCopy.title}</p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">{trustCopy.body}</p>
            </div>
          </div>
        )}

        {/* 4. Work details grid */}
        {(artwork.medium || artwork.year || artwork.dimensions || artwork.edition) && (
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <dl className="grid grid-cols-2 divide-y divide-stone-100">
              {artwork.medium && (
                <>
                  <dt className="px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider bg-stone-50">Medium</dt>
                  <dd className="px-4 py-3 text-sm text-stone-700">{artwork.medium}</dd>
                </>
              )}
              {artwork.year && (
                <>
                  <dt className="px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider bg-stone-50 border-t border-stone-100">Year</dt>
                  <dd className="px-4 py-3 text-sm text-stone-700 border-t border-stone-100">{artwork.year}</dd>
                </>
              )}
              {artwork.dimensions && (
                <>
                  <dt className="px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider bg-stone-50 border-t border-stone-100">Dimensions</dt>
                  <dd className="px-4 py-3 text-sm text-stone-700 border-t border-stone-100">{artwork.dimensions}</dd>
                </>
              )}
              {artwork.edition && (
                <>
                  <dt className="px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider bg-stone-50 border-t border-stone-100">Edition</dt>
                  <dd className="px-4 py-3 text-sm text-stone-700 border-t border-stone-100">{artwork.edition}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Certificate note */}
        {artwork.certificate_note && (
          <blockquote className="border-l-2 border-stone-200 pl-4 italic text-stone-600 text-sm leading-relaxed">
            {artwork.certificate_note}
          </blockquote>
        )}

        {/* Documentation photos — gated to artist + current owner */}
        {canPrivateView && docPhotos.length > 0 && (
          <DocumentationGallery
            photos={docPhotos.map(p => ({
              id: p.id,
              type: p.type,
              signedUrl: p.signedUrl,
              caption: p.caption,
            }))}
          />
        )}
        {!canPrivateView && docPhotosExist && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-3">
              Documentation
            </h2>
            <div className="border border-stone-200 rounded-xl px-4 py-5 text-sm text-stone-600 bg-stone-50">
              Documentation photos are available for this work.{" "}
              {isLoggedIn ? (
                <>Only the artist and the current owner can view them.</>
              ) : (
                <>
                  <Link href="/auth/login" className="underline underline-offset-2">Sign in</Link>{" "}
                  to view if you&apos;re the current owner.
                </>
              )}
            </div>
          </section>
        )}

        {/* 5. Chain of custody */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-5">
            Chain of Custody
          </h2>
          <ol className="relative border-l border-stone-200 space-y-0">
            {/* Pre-platform history — no "Self-attested" label */}
            {priorHistory.map((entry) => (
              <li key={entry.id} className="ml-5 pb-6">
                <div className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-stone-300 bg-white" />
                <p className="text-xs text-stone-400 mb-0.5">
                  {entry.date_text ?? (entry.year_int ? String(entry.year_int) : "")}
                </p>
                <p className="text-sm font-medium text-stone-800">
                  {/* priorHistoryLabel mapped inline to avoid import */}
                  {entry.type === "exhibited" ? "Exhibited"
                    : entry.type === "sold" ? "Sold"
                    : entry.type === "gifted" ? "Gifted"
                    : entry.type === "commissioned" ? "Commissioned"
                    : entry.type === "published" ? "Published"
                    : "Other"}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">{entry.description}</p>
              </li>
            ))}

            {/* On-platform ledger entries */}
            {entries.map((entry, idx) => {
              const toOwner = owners[entry.to_owner_id];
              const fromOwner = entry.from_owner_id ? owners[entry.from_owner_id] : null;
              const isFirst = idx === 0;
              const isLast = idx === entries.length - 1;
              const filled = isFirst || isLast;

              // Privacy: hide real collector name unless viewer is creator or current owner
              function renderOwner(info: OwnerInfo | null | undefined, fallbackName: string) {
                if (!info) return <span>{fallbackName}</span>;
                const isPrivate = info.isShadow || !info.collectionPublic;
                if (!canPrivateView && isPrivate) {
                  return <span>Private collector</span>;
                }
                if (info.username && !info.isShadow) {
                  return (
                    <Link
                      href={`/${info.username}`}
                      className="text-stone-700 hover:text-stone-900 underline underline-offset-2 decoration-stone-300 transition-colors"
                    >
                      {info.name}
                    </Link>
                  );
                }
                return <span>{info.name}</span>;
              }

              // Entry label — 'selected' must read "Selected for [title] ([type])"
              // never "Exhibited"
              function entryLabel() {
                if (entry.entry_type === "created") return "Created & registered";
                if (entry.entry_type === "selected") return "Selected";
                if (entry.entry_type === "transferred") {
                  if (entry.transfer_method === "claim") return "Transferred via ownership claim";
                  if (entry.transfer_method === "direct") return "Transferred directly";
                  return "Transferred";
                }
                if (entry.entry_type === "resold") return "Resold";
                return entry.entry_type;
              }

              return (
                <li key={entry.id} className="ml-5 pb-6 last:pb-0">
                  <div
                    className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                      filled
                        ? "border-stone-900 bg-stone-900"
                        : "border-stone-300 bg-white"
                    }`}
                  />
                  <p className="text-xs text-stone-400 mb-0.5">{formatDate(entry.transferred_at)}</p>

                  {entry.entry_type === "selected" ? (
                    // "Selected for [title] ([type])" — never "Exhibited"
                    <p className="text-sm font-medium text-stone-800">
                      {entry.source_opportunity_id && oppTitles[entry.source_opportunity_id]
                        ? `Selected for ${oppTitles[entry.source_opportunity_id].title} (${oppTitles[entry.source_opportunity_id].type})`
                        : "Selected for an opportunity"}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-stone-800">{entryLabel()}</p>
                  )}

                  {entry.entry_type === "created" && (
                    <p className="text-xs text-stone-500">
                      Registered by {renderOwner(fromOwner ?? toOwner, toOwner?.name ?? "Unknown")}
                    </p>
                  )}
                  {(entry.entry_type === "transferred" || entry.entry_type === "resold") && (
                    <p className="text-xs text-stone-500">
                      {fromOwner ? <>{renderOwner(fromOwner, fromOwner.name)} → </> : null}
                      {renderOwner(toOwner, toOwner?.name ?? "Unknown")}
                    </p>
                  )}
                  {entry.price != null && (
                    <p className="text-xs text-stone-400 mt-0.5">NZD {entry.price.toLocaleString()}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* 6. Actions — context-aware CTAs via ProvenanceClient */}
        <ProvenanceClient
          ledgerId={ledger_id}
          artworkId={artwork.id}
          artworkTitle={artwork.title ?? artwork.caption ?? "Untitled"}
          isLoggedIn={isLoggedIn}
          isArtist={isArtist}
          isCurrentOwner={isCurrentOwner}
          artworkIsAvailable={artwork.current_owner_id === artwork.creator_id}
          artistUsername={artist.username}
        />

        {/* 7. Footer disclaimer */}
        <footer className="text-center space-y-1">
          <p className="text-xs text-stone-400">
            Recorded on{" "}
            <Link href="/" className="hover:text-stone-600 transition-colors">Patronage</Link>
            {" · "}
            <span className="font-mono">{ledger_id}</span>
          </p>
          <p className="text-xs text-stone-400">
            This record reflects what has been lodged on Patronage. Patronage does not independently authenticate artworks or artists.
          </p>
        </footer>

      </div>
    </main>
  );
}
