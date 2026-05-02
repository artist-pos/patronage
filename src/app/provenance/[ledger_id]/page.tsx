import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getLedgerByLedgerId, type OwnerInfo } from "@/lib/provenance";
import { listDocPhotos, listDocPhotosWithUrls } from "@/lib/artwork-documentation";
import { priorHistoryLabel } from "@/lib/artwork-prior-history";
import { DocumentationGallery } from "./DocumentationGallery";
import { supabaseTransform } from "@/lib/image";
import { ProvenanceClient } from "./ProvenanceClient";
import { getTrustTier } from "@/lib/trust-tier";
import { TrustTierChip } from "@/components/provenance/TrustTierChip";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ ledger_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ledger_id } = await params;
  const data = await getLedgerByLedgerId(ledger_id);
  if (!data) return { title: "Provenance — Patronage" };
  const title = data.artwork.title ?? data.artwork.caption ?? "Untitled";
  const artist = data.artist.full_name ?? data.artist.username;
  return {
    title: `${title} by ${artist} — Provenance`,
    description: `Provenance record for ${title} by ${artist}, recorded on Patronage. Ledger ID: ${ledger_id}`,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" });
}

function entryLabel(type: string, method: string) {
  if (type === "created") return "Created & registered";
  if (type === "transferred") {
    if (method === "claim") return "Transferred via ownership claim";
    if (method === "direct") return "Transferred directly";
    return "Transferred";
  }
  if (type === "resold") return "Resold";
  return type;
}

export default async function ProvenancePage({ params }: PageProps) {
  const { ledger_id } = await params;

  const [data, supabase] = await Promise.all([
    getLedgerByLedgerId(ledger_id),
    createClient(),
  ]);

  if (!data) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const { artwork, entries, priorHistory, artist, ownerNames, owners } = data;

  const isArtist = user?.id === artwork.creator_id;
  const isCurrentOwner = user?.id === artwork.current_owner_id;
  const isLoggedIn = !!user;

  // Documentation photos: gated to creator + current owner. Anyone else sees a
  // "Sign in to view" placeholder if photos exist but they can't access them.
  const canSeeDocPhotos = isArtist || isCurrentOwner;
  const docPhotos = canSeeDocPhotos ? await listDocPhotosWithUrls(artwork.id) : [];
  const docPhotosExist = !canSeeDocPhotos
    ? (await listDocPhotos(artwork.id)).length > 0
    : docPhotos.length > 0;

  const artworkImageUrl = artwork.url
    ? (supabaseTransform(artwork.url, { width: 900, quality: 85 }) ?? artwork.url)
    : null;

  // Trust tier — derived from artworks.source + the most-advanced status of
  // any holder_attribution_claims row. Phase 2 surfaces this as a chip; Phase
  // 4's public collection page filters out 'disputed' rows entirely.
  const trustTier = await getTrustTier(artwork.id);

  // Use the raw avatar URL — same as the /artists directory — and let
  // next/image pick the best size. supabaseTransform with a fixed width
  // was producing crops that looked off compared to the artist cards.
  const artistAvatarUrl = artist.avatar_url ?? null;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">

        {/* Verified badge */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-emerald-700">Recorded on Patronage</span>
          </div>
          <span className="text-xs text-stone-400 font-mono">{ledger_id}</span>
        </div>

        {/* Trust tier — non-removable per the spec. self_registered (Recorded
            by artist) renders without the description; holder cases get the
            longer caption so the viewer understands the provenance level. */}
        {trustTier && (
          <div className="mb-8">
            <TrustTierChip
              tier={trustTier}
              showDescription={trustTier !== "recorded_by_artist"}
            />
          </div>
        )}

        {/* Artwork image — natural aspect, capped at 500px tall, no cropping. */}
        {artworkImageUrl && (
          <div className="mb-8 flex justify-center">
            <img
              src={artworkImageUrl}
              alt={artwork.title ?? "Artwork"}
              className="rounded-xl"
              style={{
                maxHeight: 500,
                maxWidth: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        )}

        {/* Artwork details */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-stone-900 mb-1">
            {(artwork.title ?? artwork.caption ?? "Untitled")}
          </h1>

          {/* Artist line */}
          <Link
            href={`/${artist.username}`}
            className="flex items-center gap-2 mb-4 group w-fit"
          >
            {artistAvatarUrl ? (
              <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-stone-100">
                <Image
                  src={artistAvatarUrl}
                  alt={artist.full_name ?? artist.username}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-sm text-stone-500">
                {(artist.full_name ?? artist.username).charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">
              {artist.full_name ?? artist.username}
            </span>
          </Link>

          {/* Metadata grid */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {artwork.year && (
              <>
                <dt className="text-stone-400 font-medium">Year</dt>
                <dd className="text-stone-700">{artwork.year}</dd>
              </>
            )}
            {artwork.medium && (
              <>
                <dt className="text-stone-400 font-medium">Medium</dt>
                <dd className="text-stone-700">{artwork.medium}</dd>
              </>
            )}
            {artwork.dimensions && (
              <>
                <dt className="text-stone-400 font-medium">Dimensions</dt>
                <dd className="text-stone-700">{artwork.dimensions}</dd>
              </>
            )}
            {artwork.edition && (
              <>
                <dt className="text-stone-400 font-medium">Edition</dt>
                <dd className="text-stone-700">{artwork.edition}</dd>
              </>
            )}
            <dt className="text-stone-400 font-medium">Ledger ID</dt>
            <dd className="text-stone-700 font-mono text-xs">{ledger_id}</dd>
          </dl>
        </div>

        {/* Certificate note */}
        {artwork.certificate_note && (
          <blockquote className="mb-10 border-l-2 border-stone-200 pl-4 italic text-stone-600 text-sm leading-relaxed">
            {artwork.certificate_note}
          </blockquote>
        )}

        {/* Documentation photos — gated to artist + current owner */}
        {canSeeDocPhotos && docPhotos.length > 0 && (
          <DocumentationGallery
            photos={docPhotos.map(p => ({
              id: p.id,
              type: p.type,
              signedUrl: p.signedUrl,
              caption: p.caption,
            }))}
          />
        )}
        {!canSeeDocPhotos && docPhotosExist && (
          <section className="mb-12">
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-3">
              Documentation
            </h2>
            <div className="border border-stone-200 rounded-xl px-4 py-5 text-sm text-stone-600 bg-stone-50">
              Documentation photos are available for this work.{" "}
              {isLoggedIn ? (
                <>Only the artist and the current owner can view them.</>
              ) : (
                <>
                  <Link href="/auth/login" className="underline underline-offset-2">Sign in</Link> to view if you’re the current owner.
                </>
              )}
            </div>
          </section>
        )}

        {/* Chain of custody — pre-platform history shown chronologically before
            on-platform ledger entries, marked "Self-attested" so readers can
            see at a glance what's verified vs. supplied by the artist. */}
        <section className="mb-12">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-5">
            Chain of Custody
          </h2>
          <ol className="relative border-l border-stone-200 space-y-0">
            {priorHistory.map((entry) => (
              <li key={entry.id} className="ml-5 pb-6">
                <div className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-stone-300 bg-white" />
                <p className="text-xs text-stone-400 mb-0.5">{entry.date_text ?? (entry.year_int ? String(entry.year_int) : "")}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-800">{priorHistoryLabel(entry.type)}</p>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                    Self-attested
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{entry.description}</p>
              </li>
            ))}
            {entries.map((entry, idx) => {
              const toOwner = owners[entry.to_owner_id];
              const fromOwner = entry.from_owner_id ? owners[entry.from_owner_id] : null;
              const ownerName = toOwner?.name ?? ownerNames[entry.to_owner_id] ?? "Unknown";
              const fromName = fromOwner?.name ?? (entry.from_owner_id ? ownerNames[entry.from_owner_id] ?? "Unknown" : null);
              const isLast = idx === entries.length - 1;

              const renderOwner = (info: OwnerInfo | null | undefined, fallbackName: string) => {
                const display = info?.name ?? fallbackName;
                if (info && !info.isShadow && info.username) {
                  return (
                    <Link
                      href={`/${info.username}`}
                      className="text-stone-700 hover:text-stone-900 underline underline-offset-2 decoration-stone-300 hover:decoration-stone-700 transition-colors"
                    >
                      {display}
                    </Link>
                  );
                }
                return <span>{display}</span>;
              };

              return (
                <li key={entry.id} className="ml-5 pb-6">
                  <div
                    className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${isLast ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-white"}`}
                  />
                  <p className="text-xs text-stone-400 mb-0.5">{formatDate(entry.transferred_at)}</p>
                  <p className="text-sm font-medium text-stone-800">{entryLabel(entry.entry_type, entry.transfer_method)}</p>
                  {entry.entry_type === "created" ? (
                    <p className="text-xs text-stone-500">
                      Registered by {renderOwner(fromOwner ?? toOwner, fromName ?? ownerName)}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500">
                      {fromOwner ? <>{renderOwner(fromOwner, fromName ?? "Unknown")} → </> : null}
                      {renderOwner(toOwner, ownerName)}
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

        {/* Client component: verification + CTAs */}
        <ProvenanceClient
          ledgerId={ledger_id}
          artworkId={artwork.id}
          artworkTitle={(artwork.title ?? artwork.caption ?? "Untitled")}
          isLoggedIn={isLoggedIn}
          isArtist={isArtist}
          isCurrentOwner={isCurrentOwner}
          artworkIsAvailable={artwork.current_owner_id === artwork.creator_id}
          artistUsername={artist.username}
        />

        {/* Footer */}
        <p className="mt-16 text-center text-xs text-stone-400">
          Recorded on{" "}
          <Link href="/" className="hover:text-stone-600 transition-colors">
            Patronage
          </Link>
          {" · "}
          <span className="font-mono">{ledger_id}</span>
        </p>
      </div>
    </main>
  );
}
