import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getLatestUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import type { ProjectUpdateWithArtist } from "@/types/database";

export const metadata: Metadata = {
  title: "Studio Feed | Patronage",
  description: "Work in progress from the Patronage community.",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

function FeedCard({ u }: { u: ProjectUpdateWithArtist }) {
  const name = u.artist_full_name ?? u.artist_username;
  return (
    <Link
      href={u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}?from=feed`}
      scroll={false}
      className="group block break-inside-avoid mb-2 border border-border bg-background"
    >
      {/* Image — own overflow-hidden so zoom stays clipped */}
      <div className="overflow-hidden bg-muted">
        <Image
          src={u.image_url}
          alt={u.caption ?? `Update by ${name}`}
          width={600}
          height={600}
          unoptimized
          style={{ width: "100%", height: "auto", display: "block" }}
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Always-visible card footer */}
      <div className="px-2.5 py-2 space-y-1.5 border-t border-border">
        {/* Avatar + name + timestamp */}
        <div className="flex items-center gap-2">
          {u.artist_avatar_url ? (
            <div className="relative w-6 h-6 shrink-0 overflow-hidden border border-black">
              <Image
                src={u.artist_avatar_url}
                alt={name}
                fill
                className="object-cover"
                sizes="24px"
              />
            </div>
          ) : (
            <div className="w-6 h-6 shrink-0 border border-black bg-muted flex items-center justify-center text-[9px] font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate leading-tight">{name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight font-mono">
              {formatTimestamp(u.created_at)}
            </p>
          </div>
        </div>

        {/* Caption */}
        {u.caption && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-3">
            {u.caption}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;

  const [updates, userProjects] = await Promise.all([
    getLatestUpdates(60),
    profile ? getArtistProjects(profile.id) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Header */}
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Studio Feed</h1>
          <p className="text-sm text-muted-foreground">Work in progress from the Patronage community.</p>
        </div>
        {profile && (
          <div className="flex justify-center">
            <CreateUpdateModal
              profileId={profile.id}
              label="New update +"
              className="w-full max-w-sm border border-black px-4 py-2 text-sm text-center hover:bg-black hover:text-white transition-colors"
              projects={userProjects.map((p) => ({ id: p.id, title: p.title }))}
            />
          </div>
        )}
      </div>

      <hr className="border-t border-border" />

      {/* Masonry grid */}
      {updates.length > 0 ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2">
          {updates.map((u) => (
            <FeedCard key={u.id} u={u} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No updates yet. Be the first to post.</p>
      )}
    </div>
  );
}
