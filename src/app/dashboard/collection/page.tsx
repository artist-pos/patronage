import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCollection } from "@/lib/collection";
import { CollectionGrid } from "@/components/collection/CollectionGrid";
import { CollectionGroupsManager } from "@/components/collection/CollectionGroupsManager";
import { CopyEmbedButton } from "@/components/collection/CopyEmbedButton";
import { EmbedConfigurator } from "@/components/collection/EmbedConfigurator";
import { DEFAULT_EMBED_CONFIG } from "@/types/database";
import type { CollectionGroup, PatronEmbedConfig } from "@/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collection — Patronage",
};

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/dashboard/collection");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (profile?.role === "partner") redirect("/dashboard");

  const username = profile?.username ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const embedConfig: PatronEmbedConfig = { ...DEFAULT_EMBED_CONFIG };

  const [entries, groupsResult] = await Promise.all([
    getCollection(user.id),
    supabase.from("collection_groups").select("*").eq("holder_id", user.id).order("position"),
  ]);

  const groups = (groupsResult.data ?? []) as CollectionGroup[];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
            <p className="text-sm text-muted-foreground">
              Works you own. Assign them to collections and publish embeds for your website.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {username && <CopyEmbedButton username={username} label="Copy full collection embed" />}
            <Link
              href="/dashboard/collection/upload"
              className="bg-foreground text-background text-sm rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Add to collection
            </Link>
          </div>
        </div>

        {/* Embed configurator */}
        {username && (
          <EmbedConfigurator initialConfig={embedConfig} username={username} siteUrl={siteUrl} />
        )}

        {/* Collection groups */}
        {username && (
          <CollectionGroupsManager groups={groups} entries={entries} username={username} />
        )}

        {/* All works */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">All works</h2>
          {entries.length === 0 ? (
            <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center space-y-3">
              <p className="text-base font-medium">No works in your collection yet</p>
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
          ) : (
            <CollectionGrid entries={entries} />
          )}
        </div>
      </div>
    </div>
  );
}
