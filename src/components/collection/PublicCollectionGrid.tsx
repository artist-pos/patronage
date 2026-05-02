import Link from "next/link";
import { supabaseTransform } from "@/lib/image";
import { TrustTierChip } from "@/components/provenance/TrustTierChip";
import type { PublicCollectionEntry } from "@/lib/collection";

interface Props {
  entries: PublicCollectionEntry[];
}

/**
 * Public collection grid — server component, no interactivity. Trust-tier
 * chips and artist credit are non-removable per the spec; the holder can
 * choose what's public via the dashboard, but cannot strip the chip or the
 * artist link.
 */
export function PublicCollectionGrid({ entries }: Props) {
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {entries.map((entry) => {
        const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";
        const linkedArtist =
          entry.attributedArtist?.username
            ? `/${entry.attributedArtist.username}`
            : null;
        const thumb =
          supabaseTransform(entry.artwork.url, { width: 800, quality: 80 })
          ?? entry.artwork.url;
        const ledgerHref = entry.artwork.ledger_id
          ? `/provenance/${entry.artwork.ledger_id}`
          : null;

        return (
          <li key={entry.membership.id} className="space-y-2">
            {ledgerHref ? (
              <Link
                href={ledgerHref}
                className="block aspect-square overflow-hidden rounded-md bg-stone-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={entry.artwork.title ?? artistName}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </Link>
            ) : (
              <div className="block aspect-square overflow-hidden rounded-md bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={entry.artwork.title ?? artistName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium truncate">
                {entry.artwork.title ?? "Untitled"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {linkedArtist ? (
                  <Link href={linkedArtist} className="hover:underline">
                    {artistName}
                  </Link>
                ) : (
                  artistName
                )}
                {entry.artwork.year ? ` · ${entry.artwork.year}` : ""}
              </p>
              {entry.artwork.medium && (
                <p className="text-xs text-muted-foreground truncate">
                  {entry.artwork.medium}
                </p>
              )}
              <div className="pt-1">
                <TrustTierChip tier={entry.trustTier} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
