import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getLatestUpdates } from "@/lib/feed";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";

export const metadata: Metadata = {
  title: "Studio Feed | Patronage",
  description: "Work in progress from the Patronage community.",
};

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;

  const updates = await getLatestUpdates(60);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Studio Feed</h1>
          <p className="text-sm text-muted-foreground">Work in progress from the Patronage community.</p>
        </div>
        {profile && (
          <CreateUpdateModal profileId={profile.id} label="New update +" />
        )}
      </div>

      {/* Masonry grid */}
      {updates.length > 0 ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2">
          {updates.map((u) => (
            <Link
              key={u.id}
              href={`/projects/${u.id}`}
              className="group block mb-2 border border-border overflow-hidden bg-muted break-inside-avoid relative"
            >
              <Image
                src={u.image_url}
                alt={u.caption ?? `Update by ${u.artist_full_name ?? u.artist_username}`}
                width={600}
                height={600}
                unoptimized
                style={{ width: "100%", height: "auto", display: "block" }}
                className="transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                {u.caption && (
                  <p className="text-xs leading-snug line-clamp-3 mb-1">{u.caption}</p>
                )}
                <p className="text-xs font-semibold truncate">
                  {u.artist_full_name ?? u.artist_username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No updates yet. Be the first to post.</p>
      )}
    </div>
  );
}
