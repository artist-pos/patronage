import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCollectionEntry,
  getHolderClaim,
  listSourceDocsWithUrls,
} from "@/lib/collection";
import { CollectionDetailEditor } from "@/components/collection/CollectionDetailEditor";
import { ClaimStatusBanner } from "@/components/collection/ClaimStatusBanner";
import type { CollectionGroup } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?redirect=/dashboard/collection/${id}`);

  const supabaseClient = await createClient();
  const [entryResult, groupsResult] = await Promise.all([
    getCollectionEntry(id, user.id),
    supabaseClient.from("collection_groups").select("*").eq("holder_id", user.id).order("position"),
  ]);

  const entry = entryResult;
  if (!entry) notFound();

  const groups = (groupsResult.data ?? []) as CollectionGroup[];

  // Both depend on artwork id — fetch in parallel once we have the entry.
  const [sourceDocs, claim] = await Promise.all([
    listSourceDocsWithUrls(entry.artwork.id, user.id),
    getHolderClaim(entry.artwork.id, user.id),
  ]);

  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link
          href="/dashboard/collection"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to collection
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {entry.artwork.title ?? "Untitled"}
        </h1>
        <p className="text-sm text-muted-foreground">by {artistName}</p>
      </div>

      {claim && <ClaimStatusBanner claim={claim} />}

      <CollectionDetailEditor entry={entry} sourceDocs={sourceDocs} groups={groups} />
    </div>
  );
}
