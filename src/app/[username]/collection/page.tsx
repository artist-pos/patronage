import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/profiles";
import { getPublicCollection } from "@/lib/collection";
import { JustifiedGrid } from "@/components/collection/JustifiedGrid";
import { CopyEmbedButton } from "@/components/collection/CopyEmbedButton";
import { DEFAULT_EMBED_CONFIG } from "@/types/database";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Collection | Patronage" };
  const displayName = profile.full_name ?? profile.username;
  return {
    title: `${displayName} | Collection`,
    description: `Works in ${displayName}'s collection on Patronage.`,
  };
}

export default async function PublicCollectionPage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const entries = await getPublicCollection(profile.id);

  // Header copy: organisations get "[Name] Collection" (Te Papa Collection,
  // KRBA Collection); individuals get "Collection of [Name]" (Collection of
  // Andrew Barnes). Same rule as the embed; org_type drives both.
  const displayName = profile.full_name ?? profile.username;
  const headerLabel = profile.organisation_type
    ? `${displayName} Collection`
    : `Collection of ${displayName}`;
  const cityLine = profile.show_location && profile.city ? profile.city : null;
  const showDonationCta =
    profile.organisation_type === "charity"
    && profile.donation_enabled
    && profile.donation_url;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <header className="mb-10 space-y-2">
        <p className="text-xs uppercase tracking-widest text-stone-400">Collection</p>
        <h1 className="text-3xl font-semibold tracking-tight">{headerLabel}</h1>
        {cityLine && (
          <p className="text-sm text-muted-foreground">Currently in {cityLine}</p>
        )}
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <Link href={`/${profile.username}`} className="underline underline-offset-2">
              View profile →
            </Link>
          </p>
          <CopyEmbedButton username={profile.username} />
        </div>
        {showDonationCta && (
          <a
            href={profile.donation_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 bg-foreground text-background text-sm rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Support {displayName}
          </a>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing public here yet.
          </p>
        </div>
      ) : (
        <JustifiedGrid
          entries={entries}
          config={DEFAULT_EMBED_CONFIG}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}
        />
      )}
    </main>
  );
}
