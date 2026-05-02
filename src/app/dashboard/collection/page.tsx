import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCollection } from "@/lib/collection";
import { CollectionGrid } from "@/components/collection/CollectionGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collection — Patronage",
};

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/dashboard/collection");

  const entries = await getCollection(user.id);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
          <p className="text-sm text-muted-foreground">
            Works you own. Toggle individual works public to feature them on
            your profile (coming soon).
          </p>
        </div>
        <Link
          href="/dashboard/collection/upload"
          className="bg-foreground text-background text-sm rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add to collection
        </Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <CollectionGrid entries={entries} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center space-y-3">
      <h2 className="text-base font-medium">No works in your collection yet</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Add works you own — paintings, prints, photographs, sculptures. Each
        record stays private until you choose to publish it.
      </p>
      <div className="pt-2">
        <Link
          href="/dashboard/collection/upload"
          className="inline-block bg-foreground text-background text-sm rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add your first work
        </Link>
      </div>
    </div>
  );
}
